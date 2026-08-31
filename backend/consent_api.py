import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from user_manager import UserManager

router = APIRouter(tags=["Legal & Consent"])
users = UserManager()
TERMS_VERSION = os.getenv("TERMS_VERSION", "2026-08-31")
PRIVACY_VERSION = os.getenv("PRIVACY_VERSION", "2026-08-31")
COOKIE_VERSION = os.getenv("COOKIE_VERSION", "2026-08-31")

class ConsentRequest(BaseModel):
    username: str | None = Field(default=None, max_length=64)
    student_id: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    terms_accepted: bool = False
    privacy_accepted: bool = False
    biometric_accepted: bool = False
    attendance_accepted: bool = False
    cookie_analytics: bool = False
    cookie_marketing: bool = False

class CookieRequest(BaseModel):
    essential: bool = True
    analytics: bool = False
    marketing: bool = False

@router.get("/legal/versions")
def legal_versions():
    return {"terms": TERMS_VERSION, "privacy": PRIVACY_VERSION, "cookies": COOKIE_VERSION}

@router.post("/legal/consent")
def record_consent(request: ConsentRequest, http_request: Request):
    if not request.terms_accepted or not request.privacy_accepted:
        return {"success": False, "required": ["terms", "privacy"], "message": "Terms and Privacy consent are required."}
    now = datetime.now(timezone.utc)
    document = {
        "username": request.username,
        "student_id": request.student_id,
        "email": request.email.lower().strip() if request.email else None,
        "terms": {"accepted": True, "version": TERMS_VERSION, "accepted_at": now},
        "privacy": {"accepted": True, "version": PRIVACY_VERSION, "accepted_at": now},
        "biometric": {"accepted": bool(request.biometric_accepted), "version": PRIVACY_VERSION, "accepted_at": now if request.biometric_accepted else None},
        "attendance": {"accepted": bool(request.attendance_accepted), "version": PRIVACY_VERSION, "accepted_at": now if request.attendance_accepted else None},
        "cookies": {"analytics": bool(request.cookie_analytics), "marketing": bool(request.cookie_marketing), "version": COOKIE_VERSION, "updated_at": now},
        "ip_hash": None,
        "user_agent": http_request.headers.get("user-agent", "")[:500],
        "created_at": now,
        "updated_at": now,
    }
    try:
        from hashlib import sha256
        ip = http_request.client.host if http_request.client else ""
        document["ip_hash"] = sha256(ip.encode()).hexdigest() if ip else None
    except Exception:
        pass
    users.collection.database["consents"].insert_one(document)
    return {"success": True, "terms_version": TERMS_VERSION, "privacy_version": PRIVACY_VERSION}

@router.post("/legal/cookies")
def record_cookie_preferences(request: CookieRequest, http_request: Request):
    now = datetime.now(timezone.utc)
    users.collection.database["cookie_consents"].insert_one({"essential": True, "analytics": bool(request.analytics), "marketing": bool(request.marketing), "version": COOKIE_VERSION, "user_agent": http_request.headers.get("user-agent", "")[:500], "created_at": now})
    return {"success": True, "version": COOKIE_VERSION}

@router.get("/legal/consent")
def get_consent(username: str):
    doc = users.collection.database["consents"].find_one({"username": username}, sort=[("created_at", -1)])
    if not doc:
        return {"has_consent": False}
    return {"has_consent": bool(doc.get("terms", {}).get("accepted") and doc.get("privacy", {}).get("accepted")), "terms": doc.get("terms"), "privacy": doc.get("privacy"), "biometric": doc.get("biometric"), "attendance": doc.get("attendance"), "cookies": doc.get("cookies")}
