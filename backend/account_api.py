import base64
import binascii
import hashlib
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
SERVICES_DIR = CURRENT_DIR / "services"
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

from auth_utils import create_access_token, get_current_user, hash_password, verify_password
from email_service import send_email
from user_manager import UserManager

router = APIRouter(tags=["Account & Security"])
users = UserManager()
ALLOWED_GENDERS = {"male", "female", "prefer not to say"}
VERIFY_MINUTES = 30
OTP_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
RESEND_COOLDOWN = 60

class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str | None = Field(default=None, max_length=254)
    gender: str | None = Field(default=None, max_length=30)

class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)
    confirm_password: str = Field(min_length=6, max_length=72)

class PhotoUpdate(BaseModel):
    image: str = Field(min_length=1, max_length=3500000)

class VerifyCode(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

def _now():
    return datetime.now(timezone.utc)

def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def _account(user):
    account = users.get_user(user["sub"])
    if account is None or account.get("is_active") is False:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    return account

def _frontend_url():
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

def _send_verification(account):
    email = account.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Add an email address before verifying it.")
    now = _now()
    last = account.get("verification_last_sent_at")
    if last and (now - last).total_seconds() < RESEND_COOLDOWN:
        wait = max(1, RESEND_COOLDOWN - int((now - last).total_seconds()))
        raise HTTPException(status_code=429, detail=f"Please wait {wait} seconds before requesting another email.")
    raw = secrets.token_urlsafe(32)
    users.collection.update_one({"username": account["username"]}, {"$set": {
        "email_verification_token_hash": _hash(raw),
        "email_verification_expires_at": now + timedelta(minutes=VERIFY_MINUTES),
        "verification_last_sent_at": now,
        "updated_at": now,
    }})
    link = f"{_frontend_url()}/verify-email?token={raw}"
    text = f"Verify your VisionAttend AI email by opening this link:\n\n{link}\n\nThis link expires in {VERIFY_MINUTES} minutes and can be used once."
    html = f"<h2>Verify your VisionAttend AI email</h2><p>Click the button below to verify your email.</p><p><a href=\"{link}\">Verify email</a></p><p>This link expires in {VERIFY_MINUTES} minutes and can be used once.</p>"
    try:
        send_email(email, "Verify your VisionAttend AI email", text, html)
    except RuntimeError as exc:
        users.collection.update_one({"username": account["username"]}, {"$unset": {"email_verification_token_hash": "", "email_verification_expires_at": "", "verification_last_sent_at": ""}})
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        users.collection.update_one({"username": account["username"]}, {"$unset": {"email_verification_token_hash": "", "email_verification_expires_at": "", "verification_last_sent_at": ""}})
        raise HTTPException(status_code=502, detail="Verification email could not be sent. Check the mail server configuration.")
    return {"success": True, "expires_in_minutes": VERIFY_MINUTES}

def start_2fa_challenge(account):
    email = account.get("email")
    if not email or not account.get("email_verified"):
        raise HTTPException(status_code=403, detail="A verified email is required for 2FA.")
    now = _now()
    recent = account.get("two_factor_last_sent_at")
    if recent and (now - recent).total_seconds() < RESEND_COOLDOWN:
        wait = max(1, RESEND_COOLDOWN - int((now - recent).total_seconds()))
        raise HTTPException(status_code=429, detail=f"Please wait {wait} seconds before requesting another OTP.")
    challenge = secrets.token_urlsafe(32)
    otp = f"{secrets.randbelow(1000000):06d}"
    users.collection.update_one({"username": account["username"]}, {"$set": {
        "two_factor_challenge_hash": _hash(challenge),
        "two_factor_otp_hash": _hash(otp),
        "two_factor_otp_expires_at": now + timedelta(minutes=OTP_MINUTES),
        "two_factor_attempts": 0,
        "two_factor_last_sent_at": now,
        "updated_at": now,
    }})
    try:
        send_email(email, "Your VisionAttend AI login code", f"Your VisionAttend AI verification code is {otp}. It expires in {OTP_MINUTES} minutes.", f"<h2>VisionAttend AI login code</h2><p style='font-size:28px;font-weight:bold;letter-spacing:8px'>{otp}</p><p>This code expires in {OTP_MINUTES} minutes.</p>")
    except Exception:
        users.collection.update_one({"username": account["username"]}, {"$unset": {"two_factor_challenge_hash": "", "two_factor_otp_hash": "", "two_factor_otp_expires_at": "", "two_factor_attempts": "", "two_factor_last_sent_at": ""}})
        raise HTTPException(status_code=502, detail="2FA code could not be sent. Check the mail server configuration.")
    return {"challenge": challenge, "masked_email": f"{email[:2]}***@{email.split('@',1)[1]}", "expires_in_minutes": OTP_MINUTES}

def complete_2fa_challenge(challenge: str, code: str):
    account = users.collection.find_one({"two_factor_challenge_hash": _hash(challenge)})
    if not account:
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA challenge.")
    now = _now(); expires = account.get("two_factor_otp_expires_at")
    if not expires or expires <= now:
        raise HTTPException(status_code=401, detail="The 2FA code has expired. Please log in again.")
    attempts = int(account.get("two_factor_attempts", 0))
    if attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect 2FA attempts. Please log in again.")
    if not secrets.compare_digest(account.get("two_factor_otp_hash", ""), _hash(code)):
        users.collection.update_one({"_id": account["_id"]}, {"$inc": {"two_factor_attempts": 1}})
        raise HTTPException(status_code=401, detail="Incorrect 2FA code.")
    users.collection.update_one({"_id": account["_id"]}, {"$unset": {"two_factor_challenge_hash": "", "two_factor_otp_hash": "", "two_factor_otp_expires_at": "", "two_factor_attempts": "", "two_factor_last_sent_at": ""}})
    users.mark_login(account["username"])
    return create_access_token(username=account["username"], role=account["role"], student_id=account.get("student_id"), name=account.get("name"))

@router.get("/account/profile")
def account_profile(user=Depends(get_current_user)):
    account = _account(user)
    return {"username": account["username"], "name": account.get("name"), "role": account.get("role"), "student_id": account.get("student_id"), "email": account.get("email"), "gender": account.get("gender"), "profile_photo": account.get("profile_photo"), "email_verified": bool(account.get("email_verified")), "auth_provider": account.get("auth_provider", "local"), "google_linked": bool(account.get("google_sub")), "is_active": account.get("is_active", True), "two_factor_enabled": bool(account.get("two_factor_enabled", False)), "created_at": account.get("created_at"), "last_login": account.get("last_login")}

@router.put("/account/profile")
def update_account_profile(request: ProfileUpdate, user=Depends(get_current_user)):
    account = _account(user); name=request.name.strip(); email=request.email.strip().lower() if request.email else None; gender=request.gender.strip().lower() if request.gender else None
    if not name: raise HTTPException(status_code=422, detail="Name cannot be empty.")
    if gender and gender not in ALLOWED_GENDERS: raise HTTPException(status_code=422, detail="Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(account["username"], name)
        if email != account.get("email"): users.update_email(account["username"], email, verified=False)
        if gender != account.get("gender"): users.update_gender(account["username"], gender)
    except ValueError as exc: raise HTTPException(status_code=409, detail=str(exc))
    return {"success": True}

@router.put("/account/password")
def update_account_password(request: PasswordUpdate, user=Depends(get_current_user)):
    if request.new_password != request.confirm_password: raise HTTPException(status_code=422, detail="New passwords do not match.")
    account=_account(user)
    if not account.get("password_hash"): raise HTTPException(status_code=400, detail="This account does not have a local password. Use Google sign-in.")
    if not verify_password(request.current_password, account["password_hash"]): raise HTTPException(status_code=401, detail="Current password is incorrect.")
    users.update_password(account["username"], hash_password(request.new_password)); return {"success": True}

@router.put("/account/photo")
def update_account_photo(request: PhotoUpdate, user=Depends(get_current_user)):
    _account(user); data=request.image
    if not data.startswith("data:image/") or "," not in data: raise HTTPException(status_code=400, detail="A valid image data URL is required.")
    header,payload=data.split(",",1); mime=header.split(";",1)[0].lower()
    if mime not in {"data:image/jpeg","data:image/png","data:image/webp"}: raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed.")
    try: raw=base64.b64decode(payload,validate=True)
    except (binascii.Error,ValueError): raise HTTPException(status_code=400,detail="Invalid image encoding.")
    if len(raw)>2*1024*1024: raise HTTPException(status_code=413,detail="Profile photo must be 2 MB or smaller.")
    if not raw.startswith((b"\xff\xd8\xff",b"\x89PNG\r\n\x1a\n",b"RIFF")): raise HTTPException(status_code=400,detail="Invalid image file.")
    users.update_profile_photo(user["sub"],data); return {"success":True}

@router.get("/account/security")
def account_security(user=Depends(get_current_user)):
    account=_account(user); return {"email":account.get("email"),"email_verified":bool(account.get("email_verified")),"google_linked":bool(account.get("google_sub")),"auth_provider":account.get("auth_provider","local"),"two_factor_enabled":bool(account.get("two_factor_enabled",False)),"active":account.get("is_active",True),"last_login":account.get("last_login")}

@router.post("/account/email/verify/request")
def request_email_verification(user=Depends(get_current_user)):
    account=_account(user)
    if account.get("email_verified"): return {"success":True,"already_verified":True}
    return _send_verification(account)

@router.post("/account/email/verify/resend")
def resend_email_verification(user=Depends(get_current_user)):
    account=_account(user)
    if account.get("email_verified"): return {"success":True,"already_verified":True}
    return _send_verification(account)

@router.get("/account/email/verify")
def verify_email(token: str):
    account=users.collection.find_one({"email_verification_token_hash":_hash(token)})
    if not account: raise HTTPException(status_code=400,detail="Invalid or expired verification link.")
    expires=account.get("email_verification_expires_at")
    if not expires or expires <= _now(): raise HTTPException(status_code=400,detail="Invalid or expired verification link.")
    users.collection.update_one({"_id":account["_id"]},{"$set":{"email_verified":True,"updated_at":_now()},"$unset":{"email_verification_token_hash":"","email_verification_expires_at":"","verification_last_sent_at":""}})
    return {"success":True,"message":"Email verified successfully."}

@router.post("/account/2fa/enable")
def enable_2fa(user=Depends(get_current_user)):
    account=_account(user)
    if not account.get("email") or not account.get("email_verified"): raise HTTPException(status_code=400,detail="Verify your email before enabling 2FA.")
    users.collection.update_one({"username":account["username"]},{"$set":{"two_factor_enabled":True,"updated_at":_now()}}); return {"success":True,"two_factor_enabled":True}

@router.post("/account/2fa/disable")
def disable_2fa(user=Depends(get_current_user)):
    account=_account(user); users.collection.update_one({"username":account["username"]},{"$set":{"two_factor_enabled":False,"updated_at":_now()}}); return {"success":True,"two_factor_enabled":False}

@router.post("/auth/2fa/verify")
def verify_2fa(request: VerifyCode, challenge: str):
    token=complete_2fa_challenge(challenge, request.code)
    account=users.get_user(users.collection.find_one({"two_factor_challenge_hash":_hash(challenge)})["username"]) if False else None
    # The completed challenge has already authenticated the account and issued its token.
    return {"access_token":token,"token_type":"bearer"}
