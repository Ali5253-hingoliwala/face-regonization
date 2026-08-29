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

@router.get("/account/profile")
def account_profile(user=Depends(get_current_user)):
    account = users.get_user(user["sub"])
    if account is None:
        raise HTTPException(404, "User not found.")
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
    name = request.name.strip()
    email = request.email.strip().lower() if request.email else None
    gender = request.gender.strip().lower() if request.gender else None
    if gender and gender not in ALLOWED_GENDERS:
        raise HTTPException(422, "Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(user["sub"], name)
        if email is not None:
            users.update_email(user["sub"], email, verified=False)
        if gender is not None:
            users.update_gender(user["sub"], gender)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    return {"success": True}

@router.put("/account/password")
def update_account_password(request: PasswordUpdate, user=Depends(get_current_user)):
    if request.new_password != request.confirm_password:
        raise HTTPException(422, "New passwords do not match.")
    if len(request.new_password.encode("utf-8")) > 72:
        raise HTTPException(422, "New password is too long.")
    account = users.get_user(user["sub"])
    if account is None or not verify_password(request.current_password, account["password_hash"]):
        raise HTTPException(401, "Current password is incorrect.")
    users.update_password(user["sub"], hash_password(request.new_password))
    return {"success": True}

@router.put("/account/photo")
def update_account_photo(request: PhotoUpdate, user=Depends(get_current_user)):
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
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Invalid image file.")
    # Re-encode to a known safe raster format before storing it.
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(400, "Could not process image.")
    safe_data = "data:image/jpeg;base64," + base64.b64encode(encoded.tobytes()).decode("ascii")
    users.update_profile_photo(user["sub"], safe_data)
    return {"success": True}

@router.get("/account/security")
def account_security(user=Depends(get_current_user)):
    account = users.get_user(user["sub"])
    if account is None:
        raise HTTPException(404, "User not found.")
    return {
        "email_verified": bool(account.get("email_verified")),
        "google_linked": bool(account.get("google_sub")),
        "auth_provider": account.get("auth_provider", "local"),
        "two_factor_enabled": bool(account.get("two_factor_enabled", False)),
        "active": account.get("is_active", True),
        "last_login": account.get("last_login"),
    }
