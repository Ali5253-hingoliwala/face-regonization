import base64, binascii
from datetime import datetime, timezone
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
    account=users.get_user(user["sub"])
    if account is None or account.get("is_active") is False: raise HTTPException(401,"Account is unavailable.")
    return account

@router.get("/account/profile")
def account_profile(user=Depends(get_current_user)):
    a=_account(user)
    return {"username":a["username"],"name":a.get("name"),"role":a.get("role"),"student_id":a.get("student_id"),"email":a.get("email"),"gender":a.get("gender"),"profile_photo":a.get("profile_photo"),"email_verified":bool(a.get("email_verified")),"auth_provider":a.get("auth_provider","local"),"google_linked":bool(a.get("google_sub")),"is_active":a.get("is_active",True),"two_factor_enabled":bool(a.get("two_factor_enabled",False)),"created_at":a.get("created_at"),"last_login":a.get("last_login")}

@router.put("/account/profile")
def update_account_profile(request:ProfileUpdate,user=Depends(get_current_user)):
    a=_account(user); name=request.name.strip(); email=request.email.strip().lower() if request.email else None; gender=request.gender.strip().lower() if request.gender else None
    if gender and gender not in ALLOWED_GENDERS: raise HTTPException(422,"Gender must be Male, Female, or Prefer not to say.")
    try:
        users.update_profile(a["username"],name)
        if email != a.get("email"): users.update_email(a["username"],email,verified=False)
        if gender != a.get("gender"): users.update_gender(a["username"],gender)
    except ValueError as exc: raise HTTPException(409,str(exc))
    return {"success":True}

@router.put("/account/password")
def update_account_password(request:PasswordUpdate,user=Depends(get_current_user)):
    if request.new_password != request.confirm_password: raise HTTPException(422,"New passwords do not match.")
    a=_account(user)
    if not a.get("password_hash"): raise HTTPException(400,"This account does not have a local password. Use Google sign-in.")
    if not verify_password(request.current_password,a["password_hash"]): raise HTTPException(401,"Current password is incorrect.")
    users.update_password(a["username"],hash_password(request.new_password)); return {"success":True}

@router.put("/account/photo")
def update_account_photo(request:PhotoUpdate,user=Depends(get_current_user)):
    _account(user); data=request.image
    if not data.startswith("data:image/") or "," not in data: raise HTTPException(400,"A valid image data URL is required.")
    header,payload=data.split(",",1); mime=header.split(";",1)[0].lower()
    if mime not in {"data:image/jpeg","data:image/png","data:image/webp"}: raise HTTPException(400,"Only JPEG, PNG and WebP images are allowed.")
    try: raw=base64.b64decode(payload,validate=True)
    except (binascii.Error,ValueError): raise HTTPException(400,"Invalid image encoding.")
    if len(raw)>2*1024*1024: raise HTTPException(413,"Profile photo must be 2 MB or smaller.")
    if cv2.imdecode(np.frombuffer(raw,dtype=np.uint8),cv2.IMREAD_COLOR) is None: raise HTTPException(400,"Invalid image file.")
    users.update_profile_photo(user["sub"],data); return {"success":True}

@router.get("/account/security")
def account_security(user=Depends(get_current_user)):
    a=_account(user); return {"email_verified":bool(a.get("email_verified")),"google_linked":bool(a.get("google_sub")),"auth_provider":a.get("auth_provider","local"),"two_factor_enabled":bool(a.get("two_factor_enabled",False)),"active":a.get("is_active",True),"last_login":a.get("last_login")}

@router.post("/account/2fa/enable")
def enable_2fa(user=Depends(get_current_user)):
    a=_account(user)
    if not a.get("email") or not a.get("email_verified"): raise HTTPException(400,"Verify your email before enabling 2FA.")
    users.collection.update_one({"username":a["username"]},{"$set":{"two_factor_enabled":True,"updated_at":datetime.now(timezone.utc)}}); return {"success":True,"two_factor_enabled":True}

@router.post("/account/2fa/disable")
def disable_2fa(user=Depends(get_current_user)):
    a=_account(user); users.collection.update_one({"username":a["username"]},{"$set":{"two_factor_enabled":False,"updated_at":datetime.now(timezone.utc)}}); return {"success":True,"two_factor_enabled":False}
