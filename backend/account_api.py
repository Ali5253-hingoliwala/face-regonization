import base64, binascii, hashlib, os, secrets, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
CURRENT_DIR=Path(__file__).resolve().parent; SERVICES_DIR=CURRENT_DIR/"services"
if str(SERVICES_DIR) not in sys.path: sys.path.insert(0,str(SERVICES_DIR))
from auth_utils import create_access_token, get_current_user, hash_password, verify_password
from email_service import send_email
from user_manager import UserManager
router=APIRouter(tags=["Account & Security"]); users=UserManager()
ALLOWED_GENDERS={"male","female","prefer not to say"}; VERIFY_MINUTES=30; OTP_MINUTES=10; OTP_MAX_ATTEMPTS=5; RESEND_COOLDOWN=60; RESET_MINUTES=30
class ProfileUpdate(BaseModel): name:str=Field(min_length=2,max_length=100); email:str|None=Field(default=None,max_length=254); gender:str|None=Field(default=None,max_length=30)
class PasswordUpdate(BaseModel): current_password:str=Field(min_length=1,max_length=72); new_password:str=Field(min_length=6,max_length=72); confirm_password:str=Field(min_length=6,max_length=72)
class PhotoUpdate(BaseModel): image:str=Field(min_length=1,max_length=3500000)
class VerifyCode(BaseModel): code:str=Field(min_length=6,max_length=6,pattern=r"^\d{6}$")
class LoginRequest(BaseModel): username:str=Field(min_length=1,max_length=64); password:str=Field(min_length=1,max_length=72)
class ForgotPasswordRequest(BaseModel): email:str=Field(min_length=3,max_length=254)
class ResetPasswordRequest(BaseModel): token:str=Field(min_length=20,max_length=200); new_password:str=Field(min_length=6,max_length=72); confirm_password:str=Field(min_length=6,max_length=72)
def _now(): return datetime.now(timezone.utc)
def _utc(value):
    if value is None: return None
    if value.tzinfo is None: return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
def _hash(value): return hashlib.sha256(value.encode("utf-8")).hexdigest()
def _account(user):
    account=users.get_user(user["sub"])
    if account is None or account.get("is_active") is False: raise HTTPException(401,"Account is unavailable.")
    return account
def _frontend_url(): return os.getenv("FRONTEND_URL","http://localhost:5173").rstrip("/")
def _send_verification(account):
    email=account.get("email")
    if not email: raise HTTPException(400,"Add an email address before verifying it.")
    now=_now(); last=_utc(account.get("verification_last_sent_at"))
    if last and (now-last).total_seconds()<RESEND_COOLDOWN: raise HTTPException(429,f"Please wait {max(1,RESEND_COOLDOWN-int((now-last).total_seconds()))} seconds before requesting another email.")
    raw=secrets.token_urlsafe(32)
    users.collection.update_one({"_id":account["_id"]},{"$set":{"email_verification_token_hash":_hash(raw),"email_verification_expires_at":now+timedelta(minutes=VERIFY_MINUTES),"verification_last_sent_at":now,"updated_at":now}})
    link=f"{_frontend_url()}/verify-email?token={raw}"
    try: send_email(email,"Verify your VisionAttend AI email",f"Verify your VisionAttend AI email:\n\n{link}\n\nThis link expires in {VERIFY_MINUTES} minutes and can be used once.",f"<h2>Verify your VisionAttend AI email</h2><p><a href=\"{link}\">Verify email</a></p><p>This link expires in {VERIFY_MINUTES} minutes and can be used once.</p>")
    except RuntimeError as exc: users.collection.update_one({"_id":account["_id"]},{"$unset":{"email_verification_token_hash":"","email_verification_expires_at":"","verification_last_sent_at":""}}); raise HTTPException(503,str(exc))
    except Exception: users.collection.update_one({"_id":account["_id"]},{"$unset":{"email_verification_token_hash":"","email_verification_expires_at":"","verification_last_sent_at":""}}); raise HTTPException(502,"Verification email could not be sent. Check the mail server configuration.")
    return {"success":True,"expires_in_minutes":VERIFY_MINUTES}
def start_2fa_challenge(account):
    email=account.get("email")
    if not email or not account.get("email_verified"): raise HTTPException(403,"A verified email is required for 2FA.")
    now=_now(); recent=_utc(account.get("two_factor_last_sent_at"))
    if recent and (now-recent).total_seconds()<RESEND_COOLDOWN: raise HTTPException(429,f"Please wait {max(1,RESEND_COOLDOWN-int((now-recent).total_seconds()))} seconds before requesting another OTP.")
    challenge=secrets.token_urlsafe(32); otp=f"{secrets.randbelow(1000000):06d}"
    users.collection.update_one({"_id":account["_id"]},{"$set":{"two_factor_challenge_hash":_hash(challenge),"two_factor_otp_hash":_hash(otp),"two_factor_otp_expires_at":now+timedelta(minutes=OTP_MINUTES),"two_factor_attempts":0,"two_factor_last_sent_at":now,"updated_at":now}})
    try: send_email(email,"Your VisionAttend AI login code",f"Your VisionAttend AI verification code is {otp}. It expires in {OTP_MINUTES} minutes.",f"<h2>VisionAttend AI login code</h2><p style='font-size:28px;font-weight:bold;letter-spacing:8px'>{otp}</p><p>This code expires in {OTP_MINUTES} minutes.</p>")
    except Exception: users.collection.update_one({"_id":account["_id"]},{"$unset":{"two_factor_challenge_hash":"","two_factor_otp_hash":"","two_factor_otp_expires_at":"","two_factor_attempts":"","two_factor_last_sent_at":""}}); raise HTTPException(502,"2FA code could not be sent. Check the mail server configuration.")
    return {"challenge":challenge,"masked_email":f"{email[:2]}***@{email.split('@',1)[1]}","expires_in_minutes":OTP_MINUTES}
def complete_2fa_challenge(challenge,code):
    account=users.collection.find_one({"two_factor_challenge_hash":_hash(challenge)})
    if not account: raise HTTPException(401,"Invalid or expired 2FA challenge.")
    expires_at=_utc(account.get("two_factor_otp_expires_at"))
    if not expires_at or expires_at<=_now(): raise HTTPException(401,"The 2FA code has expired. Please log in again.")
    if int(account.get("two_factor_attempts",0))>=OTP_MAX_ATTEMPTS: raise HTTPException(429,"Too many incorrect 2FA attempts. Please log in again.")
    if not secrets.compare_digest(account.get("two_factor_otp_hash",""),_hash(code)): users.collection.update_one({"_id":account["_id"]},{"$inc":{"two_factor_attempts":1}}); raise HTTPException(401,"Incorrect 2FA code.")
    users.collection.update_one({"_id":account["_id"]},{"$unset":{"two_factor_challenge_hash":"","two_factor_otp_hash":"","two_factor_otp_expires_at":"","two_factor_attempts":"","two_factor_last_sent_at":""}}); users.mark_login(account["username"])
    return {"access_token":create_access_token(username=account["username"],role=account["role"],student_id=account.get("student_id"),name=account.get("name")),"token_type":"bearer","role":account["role"],"name":account.get("name"),"student_id":account.get("student_id")}
@router.post("/auth/login")
def account_login(request:LoginRequest):
    user=users.get_user(request.username)
    if user is None or not user.get("password_hash") or not verify_password(request.password,user["password_hash"]): raise HTTPException(401,"Incorrect username or password.")
    if user.get("is_active") is False: raise HTTPException(403,"This account is disabled.")
    if user.get("two_factor_enabled"): challenge=start_2fa_challenge(user); return {"requires_2fa":True,**challenge}
    users.mark_login(user["username"]); return {"access_token":create_access_token(username=user["username"],role=user["role"],student_id=user.get("student_id"),name=user.get("name")),"token_type":"bearer","role":user["role"],"name":user.get("name"),"student_id":user.get("student_id")}
@router.post("/auth/2fa/verify")
def verify_2fa(request:VerifyCode,challenge:str): return complete_2fa_challenge(challenge,request.code)
@router.post("/auth/password/forgot")
def forgot_password(request:ForgotPasswordRequest):
    email=request.email.strip().lower(); account=users.collection.find_one({"email":email})
    generic={"success":True,"message":"If an eligible account exists, password-reset instructions have been sent to its verified email."}
    if not account or account.get("is_active") is False or not account.get("email_verified"): return generic
    now=_now(); last=_utc(account.get("password_reset_last_sent_at"))
    if last and (now-last).total_seconds()<RESEND_COOLDOWN: return generic
    raw=secrets.token_urlsafe(32); users.collection.update_one({"_id":account["_id"]},{"$set":{"password_reset_token_hash":_hash(raw),"password_reset_expires_at":now+timedelta(minutes=RESET_MINUTES),"password_reset_last_sent_at":now,"updated_at":now}})
    link=f"{_frontend_url()}/reset-password?token={raw}"
    try: send_email(email,"Reset your VisionAttend AI password",f"Reset your password:\n\n{link}\n\nThis link expires in {RESET_MINUTES} minutes and can be used once.",f"<h2>Reset your VisionAttend AI password</h2><p><a href=\"{link}\">Reset password</a></p><p>This link expires in {RESET_MINUTES} minutes and can be used once.</p>")
    except Exception:
        users.collection.update_one({"_id":account["_id"]},{"$unset":{"password_reset_token_hash":"","password_reset_expires_at":"","password_reset_last_sent_at":""}})
    return generic
@router.post("/auth/password/reset")
def reset_password(request:ResetPasswordRequest):
    if request.new_password!=request.confirm_password: raise HTTPException(422,"New passwords do not match.")
    account=users.collection.find_one({"password_reset_token_hash":_hash(request.token)})
    expires=_utc(account.get("password_reset_expires_at")) if account else None
    if not account or not expires or expires<=_now(): raise HTTPException(400,"Invalid or expired password reset link.")
    if account.get("is_active") is False or not account.get("email_verified"): raise HTTPException(400,"Password reset is unavailable for this account.")
    new_hash=hash_password(request.new_password)
    result=users.collection.update_one({"_id":account["_id"]},{"$set":{"password_hash":new_hash,"updated_at":_now()},"$unset":{"password_reset_token_hash":"","password_reset_expires_at":"","password_reset_last_sent_at":""}})
    if result.matched_count!=1: raise HTTPException(500,"The password could not be updated for this account.")
    updated=users.collection.find_one({"_id":account["_id"]},{"password_hash":1,"username":1})
    if not updated or not updated.get("password_hash") or not verify_password(request.new_password,updated["password_hash"]): raise HTTPException(500,"Password update verification failed. Please request a new reset link.")
    return {"success":True,"message":"Password reset successfully. Your username remains unchanged; you can now log in with your new password."}
@router.get("/account/profile")
def account_profile(user=Depends(get_current_user)):
    account=_account(user); return {"username":account["username"],"name":account.get("name"),"role":account.get("role"),"student_id":account.get("student_id"),"email":account.get("email"),"gender":account.get("gender"),"profile_photo":account.get("profile_photo"),"email_verified":bool(account.get("email_verified")),"auth_provider":account.get("auth_provider","local"),"google_linked":bool(account.get("google_sub")),"is_active":account.get("is_active",True),"two_factor_enabled":bool(account.get("two_factor_enabled",False)),"created_at":account.get("created_at"),"last_login":account.get("last_login")}
@router.put("/account/profile")
def update_account_profile(request:ProfileUpdate,user=Depends(get_current_user)):
    account=_account(user); name=request.name.strip(); email=request.email.strip().lower() if request.email else None; gender=request.gender.strip().lower() if request.gender else None
    if not name: raise HTTPException(422,"Name cannot be empty.")
    if gender and gender not in ALLOWED_GENDERS: raise HTTPException(422,"Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(account["username"],name)
        if email!=account.get("email"): users.update_email(account["username"],email,verified=False)
        if gender!=account.get("gender"): users.update_gender(account["username"],gender)
    except ValueError as exc: raise HTTPException(409,str(exc))
    return {"success":True}
@router.put("/account/password")
def update_account_password(request:PasswordUpdate,user=Depends(get_current_user)):
    if request.new_password!=request.confirm_password: raise HTTPException(422,"New passwords do not match.")
    account=_account(user)
    if not account.get("password_hash"): raise HTTPException(400,"This account does not have a local password. Use Google sign-in.")
    if not verify_password(request.current_password,account["password_hash"]): raise HTTPException(401,"Current password is incorrect.")
    new_hash=hash_password(request.new_password); result=users.collection.update_one({"_id":account["_id"]},{"$set":{"password_hash":new_hash,"updated_at":_now()}})
    if result.matched_count!=1: raise HTTPException(500,"The password could not be updated for this account.")
    return {"success":True}
@router.put("/account/photo")
def update_account_photo(request:PhotoUpdate,user=Depends(get_current_user)):
    _account(user); data=request.image
    if not data.startswith("data:image/") or "," not in data: raise HTTPException(400,"A valid image data URL is required.")
    header,payload=data.split(",",1); mime=header.split(";",1)[0].lower()
    if mime not in {"data:image/jpeg","data:image/png","data:image/webp"}: raise HTTPException(400,"Only JPEG, PNG and WebP images are allowed.")
    try: raw=base64.b64decode(payload,validate=True)
    except (binascii.Error,ValueError): raise HTTPException(400,"Invalid image encoding.")
    if len(raw)>2*1024*1024: raise HTTPException(413,"Profile photo must be 2 MB or smaller.")
    if not raw.startswith((b"\xff\xd8\xff",b"\x89PNG\r\n\x1a\n",b"RIFF")): raise HTTPException(400,"Invalid image file.")
    users.update_profile_photo(user["sub"],data); return {"success":True}
@router.delete("/account/photo")
def remove_account_photo(user=Depends(get_current_user)):
    account=_account(user); users.collection.update_one({"_id":account["_id"]},{"$unset":{"profile_photo":""},"$set":{"updated_at":_now()}}); return {"success":True,"profile_photo":None}
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
def verify_email(token:str):
    account=users.collection.find_one({"email_verification_token_hash":_hash(token)})
    expires_at=_utc(account.get("email_verification_expires_at")) if account else None
    if not account or not expires_at or expires_at<=_now(): raise HTTPException(400,"Invalid or expired verification link.")
    users.collection.update_one({"_id":account["_id"]},{"$set":{"email_verified":True,"updated_at":_now()},"$unset":{"email_verification_token_hash":"","email_verification_expires_at":"","verification_last_sent_at":""}})
    return {"success":True,"message":"Email verified successfully."}
@router.post("/account/2fa/enable")
def enable_2fa(user=Depends(get_current_user)):
    account=_account(user)
    if not account.get("email") or not account.get("email_verified"): raise HTTPException(400,"Verify your email before enabling 2FA.")
    users.collection.update_one({"_id":account["_id"]},{"$set":{"two_factor_enabled":True,"updated_at":_now()}}); return {"success":True,"two_factor_enabled":True}
@router.post("/account/2fa/disable")
def disable_2fa(user=Depends(get_current_user)):
    account=_account(user); users.collection.update_one({"_id":account["_id"]},{"$set":{"two_factor_enabled":False,"updated_at":_now()}}); return {"success":True,"two_factor_enabled":False}
