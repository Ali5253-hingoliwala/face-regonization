import base64
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from auth_utils import create_access_token, hash_password
from user_manager import UserManager

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
sys.path.append(str(RECOGNITION_DIR))
sys.path.append(str(ATTENDANCE_DIR))

from database import FaceDatabase
from recognizer import FaceRecognizer

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover - dependency is declared in requirements
    google_requests = None
    id_token = None

router = APIRouter()
user_manager = UserManager()
face_database = FaceDatabase()
face_recognizer = None

ALLOWED_GENDERS = {"male", "female", "prefer not to say"}


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=10000)
    username: str | None = Field(default=None, min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    student_id: str | None = Field(default=None, min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    password: str | None = Field(default=None, min_length=6, max_length=72)
    gender: str | None = Field(default=None, max_length=30)
    face_image: str | None = Field(default=None, max_length=7000000)


def _get_face_recognizer():
    global face_recognizer
    if face_recognizer is None:
        face_recognizer = FaceRecognizer()
    return face_recognizer


def _capture_embedding(image_data: str):
    if not image_data:
        raise HTTPException(status_code=422, detail="Face capture is required to finish Google signup.")
    try:
        encoded = image_data.split(",", 1)[1] if image_data.startswith("data:") and "," in image_data else image_data
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > int(os.getenv("MAX_FACE_IMAGE_BYTES", "5000000")):
            raise HTTPException(status_code=413, detail="Face image is too large.")
        frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid face image.") from exc

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid face image.")

    embedding, face_count = _get_face_recognizer().get_single_face_embedding(frame)
    if face_count == 0:
        raise HTTPException(status_code=422, detail="No face detected. Please position one face clearly in the camera.")
    if face_count > 1:
        raise HTTPException(status_code=422, detail="Multiple faces detected. Only one person may be registered at a time.")
    return embedding


def _verify_google_credential(credential: str):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured on this server yet.")
    if id_token is None or google_requests is None:
        raise HTTPException(status_code=503, detail="Google authentication dependency is not installed on the server.")

    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential.") from exc

    if info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google credential issuer.")
    if not info.get("sub") or not info.get("email"):
        raise HTTPException(status_code=401, detail="Google did not provide the required account identity.")
    if not info.get("email_verified"):
        raise HTTPException(status_code=403, detail="Your Google email must be verified before using it with VisionAttend.")
    return info


def _token_for(user):
    user_manager.mark_login(user["username"])
    token = create_access_token(
        username=user["username"],
        role=user["role"],
        student_id=user.get("student_id"),
        name=user.get("name"),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "name": user.get("name"),
        "student_id": user.get("student_id"),
    }


@router.post("/auth/google")
def google_auth(request: GoogleAuthRequest):
    info = _verify_google_credential(request.credential)
    google_sub = info["sub"]
    email = info["email"].strip().lower()

    # Existing Google-linked account: authenticate immediately.
    user = user_manager.get_user_by_google_sub(google_sub)
    if user is not None:
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="This account is inactive. Please contact an administrator.")
        return {"success": True, "onboarding_required": False, **_token_for(user)}

    # A verified email can identify an existing local account, but we do not
    # silently take it over. The user must explicitly link it from the account
    # security flow later.
    existing_email_user = user_manager.get_user_by_email(email)
    if existing_email_user is not None:
        raise HTTPException(
            status_code=409,
            detail="An account already exists with this Google email. Log in with your existing account and link Google from Security.",
        )

    # First-time Google user: return only the minimum profile needed for the
    # client to show the onboarding form. No account is created yet.
    if not all([request.username, request.student_id, request.password, request.gender, request.face_image]):
        return {
            "success": True,
            "onboarding_required": True,
            "email": email,
            "suggested_name": info.get("name") or info.get("given_name") or "",
        }

    username = request.username.strip()
    student_id = request.student_id.strip()
    gender = request.gender.strip().lower()
    password = request.password

    if gender not in ALLOWED_GENDERS:
        raise HTTPException(status_code=422, detail="Gender must be Male, Female, or Prefer not to say.")
    if username != student_id:
        raise HTTPException(status_code=422, detail="Username and Student ID must currently match for student accounts.")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password is too long.")
    if user_manager.get_user(username) is not None:
        raise HTTPException(status_code=409, detail="That username or Student ID is already registered.")
    if face_database.get_all().get(student_id) is not None:
        raise HTTPException(status_code=409, detail="That Student ID already has a face registration.")

    embedding = _capture_embedding(request.face_image)
    name = (info.get("name") or info.get("given_name") or username).strip()

    face_database.add_person(student_id, name, embedding)
    try:
        user = user_manager.create_user(
            username=username,
            password_hash=hash_password(password),
            role="student",
            student_id=student_id,
            name=name,
            email=email,
            email_verified=True,
            gender=gender,
            auth_provider="both",
            google_sub=google_sub,
        )
    except ValueError as exc:
        # Avoid leaving a face record behind if account creation fails.
        face_database.delete_person(student_id)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if user is None:
        face_database.delete_person(student_id)
        raise HTTPException(status_code=409, detail="An account for this student already exists.")

    return {"success": True, "onboarding_required": False, "new_account": True, **_token_for(user)}
