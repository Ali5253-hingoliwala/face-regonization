import base64
import binascii
from datetime import datetime, timezone

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

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
        raise HTTPException(401, "Account is unavailable.")
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
        "created_at": account.get("created_at"), "last_login": account.get("last_login"),
    }

@router.put("/account/profile")
def update_account_profile(request: ProfileUpdate, user=Depends(get_current_user)):
    account = _account(user)
    name = request.name.strip()
    email = request.email.strip().lower() if request.email else None
    gender = request.gender.strip().lower() if request.gender else None
    if gender and gender not in ALLOWED_GENDERS:
        raise HTTPException(422, "Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(account["username"], name)
        if email != account.get("email"):
            users.update_email(account["username"], email, verified=False)
        if gender != account.get("gender"):
            users.update_gender(account["username"], gender)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    return {"success": True}

@router.put("/account/password")
def update_account_password(request: PasswordUpdate, user=Depends(get_current_user)):
    if request.new_password != request.confirm_password:
        raise HTTPException(422, "New passwords do not match.")
    if len(request.new_password.encode("utf-8")) > 72:
        raise HTTPException(422, "New password is too long.")
    account = _account(user)
    if not account.get("password_hash"):
        raise HTTPException(400, "This account does not have a local password. Use Google sign-in.")
    if not verify_password(request.current_password, account["password_hash"]):
        raise HTTPException(401, "Current password is incorrect.")
    users.update_password(account["username"], hash_password(request.new_password))
    return {"success": True}

@router.put("/account/photo")
def update_account_photo(request: PhotoUpdate, user=Depends(get_current_user)):
    _account(user)
    data = request.image
    if not data.startswith("data:image/") or "," not in data:
        raise HTTPException(400, "A valid image data URL is required.")
    header, payload = data.split(",", 1)
    mime = header.split(";", 1)[0].lower()
    if mime not in {"data:image/jpeg", "data:image/png", "data:image/webp"}:
        raise HTTPException(400, "Only JPEG, PNG and WebP images are allowed.")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Invalid image encoding.")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, "Profile photo must be 2 MB or smaller.")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Invalid image file.")
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(400, "Could not process image.")
    safe_data = "data:image/jpeg;base64," + base64.b64encode(encoded.tobytes()).decode("ascii")
    users.update_profile_photo(user["sub"], safe_data)
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
        "last_login": account.get("last_login"),
    }

@router.post("/account/2fa/enable")
def enable_2fa(user=Depends(get_current_user)):
    account = _account(user)
    if not account.get("email") or not account.get("email_verified"):
        raise HTTPException(400, "Verify your email before enabling 2FA.")
    users.collection.update_one({"username": account["username"]}, {"$set": {"two_factor_enabled": True, "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "two_factor_enabled": True}

@router.post("/account/2fa/disable")
def disable_2fa(user=Depends(get_current_user)):
    account = _account(user)
    users.collection.update_one({"username": account["username"]}, {"$set": {"two_factor_enabled": False, "updated_at": datetime.now(timezone.utc)}})
    return {"success": True, "two_factor_enabled": False}
