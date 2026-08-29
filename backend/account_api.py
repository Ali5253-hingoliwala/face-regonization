import base64
import binascii
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
SERVICES_DIR = CURRENT_DIR / "services"
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

from auth_utils import get_current_user, hash_password, verify_password
from user_manager import UserManager

router = APIRouter(tags=["Account & Security"])
users = UserManager()
ALLOWED_GENDERS = {"male", "female", "prefer not to say"}

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

def _account(user):
    account = users.get_user(user["sub"])
    if account is None or account.get("is_active") is False:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    return account

@router.get("/account/profile")
def account_profile(user=Depends(get_current_user)):
    account = _account(user)
    return {
        "username": account["username"], "name": account.get("name"),
        "role": account.get("role"), "student_id": account.get("student_id"),
        "email": account.get("email"), "gender": account.get("gender"),
        "profile_photo": account.get("profile_photo"),
        "email_verified": bool(account.get("email_verified")),
        "auth_provider": account.get("auth_provider", "local"),
        "google_linked": bool(account.get("google_sub")),
        "is_active": account.get("is_active", True),
        "two_factor_enabled": bool(account.get("two_factor_enabled", False)),
        "created_at": account.get("created_at"), "last_login": account.get("last_login")
    }

@router.put("/account/profile")
def update_account_profile(request: ProfileUpdate, user=Depends(get_current_user)):
    account = _account(user)
    name = request.name.strip()
    email = request.email.strip().lower() if request.email else None
    gender = request.gender.strip().lower() if request.gender else None
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty.")
    if gender and gender not in ALLOWED_GENDERS:
        raise HTTPException(status_code=422, detail="Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(account["username"], name)
        if email != account.get("email"):
            users.update_email(account["username"], email, verified=False)
        if gender != account.get("gender"):
            users.update_gender(account["username"], gender)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"success": True}

@router.put("/account/password")
def update_account_password(request: PasswordUpdate, user=Depends(get_current_user)):
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=422, detail="New passwords do not match.")
    account = _account(user)
    if not account.get("password_hash"):
        raise HTTPException(status_code=400, detail="This account does not have a local password. Use Google sign-in.")
    if not verify_password(request.current_password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    try:
        new_hash = hash_password(request.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    users.update_password(account["username"], new_hash)
    return {"success": True}

@router.put("/account/photo")
def update_account_photo(request: PhotoUpdate, user=Depends(get_current_user)):
    _account(user)
    data = request.image
    if not data.startswith("data:image/") or "," not in data:
        raise HTTPException(status_code=400, detail="A valid image data URL is required.")
    header, payload = data.split(",", 1)
    mime = header.split(";", 1)[0].lower()
    if mime not in {"data:image/jpeg", "data:image/png", "data:image/webp"}:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed.")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image encoding.")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Profile photo must be 2 MB or smaller.")
    if not raw.startswith((b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")):
        raise HTTPException(status_code=400, detail="Invalid image file.")
    users.update_profile_photo(user["sub"], data)
    return {"success": True}

@router.get("/account/security")
def account_security(user=Depends(get_current_user)):
    account = _account(user)
    return {
        "email_verified": bool(account.get("email_verified")),
        "google_linked": bool(account.get("google_sub")),
        "auth_provider": account.get("auth_provider", "local"),
        "two_factor_enabled": bool(account.get("two_factor_enabled", False)),
        "active": account.get("is_active", True),
        "last_login": account.get("last_login")
    }

@router.post("/account/2fa/enable")
def enable_2fa(user=Depends(get_current_user)):
    account = _account(user)
    if not account.get("email") or not account.get("email_verified"):
        raise HTTPException(status_code=400, detail="Verify your email before enabling 2FA.")
    users.collection.update_one({"username": account["username"]}, {"$set": {"two_factor_enabled": True, "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "two_factor_enabled": True}

@router.post("/account/2fa/disable")
def disable_2fa(user=Depends(get_current_user)):
    account = _account(user)
    users.collection.update_one({"username": account["username"]}, {"$set": {"two_factor_enabled": False, "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "two_factor_enabled": False}
