import base64
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
load_dotenv(CURRENT_DIR / ".env")
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
sys.path.append(str(RECOGNITION_DIR)); sys.path.append(str(ATTENDANCE_DIR))

from auth_utils import create_access_token, hash_password, get_current_user
from user_manager import UserManager
from database import FaceDatabase
from recognizer import FaceRecognizer

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
    face_images: list[str] | None = Field(default=None, min_length=10, max_length=10)

def _get_face_recognizer():
    global face_recognizer
    if face_recognizer is None: face_recognizer = FaceRecognizer()
    return face_recognizer

def _decode_image(image_data: str):
    if not image_data: raise HTTPException(status_code=422, detail="Face capture is required to finish Google signup.")
    try:
        encoded=image_data.split(",",1)[1] if image_data.startswith("data:") and "," in image_data else image_data
        raw=base64.b64decode(encoded,validate=True)
        if len(raw)>int(os.getenv("MAX_FACE_IMAGE_BYTES","5000000")): raise HTTPException(status_code=413,detail="Face image is too large.")
        frame=cv2.imdecode(np.frombuffer(raw,dtype=np.uint8),cv2.IMREAD_COLOR)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(status_code=400,detail="Invalid face image.") from exc
    if frame is None: raise HTTPException(status_code=400,detail="Invalid face image.")
    return frame

def _capture_embedding(image_data):
    frame=_decode_image(image_data);embedding,face_count=_get_face_recognizer().get_single_face_embedding(frame)
    if face_count==0: raise HTTPException(status_code=422,detail="No face detected. Please position one face clearly in the camera.")
    if face_count>1: raise HTTPException(status_code=422,detail="Multiple faces detected. Only one person may be registered at a time.")
    return embedding

def _cosine_similarity(a,b):
    a=np.asarray(a,dtype=np.float32);b=np.asarray(b,dtype=np.float32);na=np.linalg.norm(a);nb=np.linalg.norm(b)
    return 0.0 if na==0 or nb==0 else float(np.dot(a,b)/(na*nb))

def _capture_training_embeddings(face_images):
    if len(face_images)!=10: raise HTTPException(status_code=422,detail="Exactly 10 face samples are required for registration.")
    embeddings=[];threshold=float(os.getenv("TRAINING_SAMPLE_SIMILARITY_THRESHOLD","0.985"))
    for index,image in enumerate(face_images,1):
        embedding=_capture_embedding(image)
        if any(_cosine_similarity(embedding,old)>=threshold for old in embeddings):
            raise HTTPException(status_code=422,detail=f"Face sample {index} is too similar to an earlier sample. Please retake the 10 poses with more variation.")
        embeddings.append(np.asarray(embedding,dtype=np.float32).copy())
    return embeddings

def _verify_google_credential(credential: str):
    client_id=os.getenv("GOOGLE_CLIENT_ID")
    if not client_id: raise HTTPException(status_code=503,detail="Google Sign-In is not configured on this server yet.")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc: raise HTTPException(status_code=503,detail="Google authentication dependency is not installed on the server.") from exc
    try: info=id_token.verify_oauth2_token(credential,google_requests.Request(),client_id)
    except ValueError as exc: raise HTTPException(status_code=401,detail="Invalid or expired Google credential.") from exc
    if info.get("iss") not in {"accounts.google.com","https://accounts.google.com"}: raise HTTPException(status_code=401,detail="Invalid Google credential issuer.")
    if not info.get("sub") or not info.get("email"): raise HTTPException(status_code=401,detail="Google did not provide the required account identity.")
    if not info.get("email_verified"): raise HTTPException(status_code=403,detail="Your Google email must be verified before using it with VisionAttend.")
    return info

def _token_for(user):
    user_manager.mark_login(user["username"]);token=create_access_token(username=user["username"],role=user["role"],student_id=user.get("student_id"),name=user.get("name"))
    return {"access_token":token,"token_type":"bearer","role":user["role"],"name":user.get("name"),"student_id":user.get("student_id")}

@router.post("/auth/google")
def google_auth(request: GoogleAuthRequest):
    info=_verify_google_credential(request.credential);google_sub=info["sub"];email=info["email"].strip().lower()
    user=user_manager.get_user_by_google_sub(google_sub)
    if user is not None:
        if not user.get("is_active",True): raise HTTPException(status_code=403,detail="This account is inactive. Please contact an administrator.")
        return {"success":True,"onboarding_required":False,**_token_for(user)}
    existing_email_user=user_manager.get_user_by_email(email)
    if existing_email_user is not None: raise HTTPException(status_code=409,detail="An account already exists with this Google email. Log in with your existing account and link Google from Security.")
    if not all([request.username,request.student_id,request.password,request.gender,request.face_images]):
        return {"success":True,"onboarding_required":True,"email":email,"suggested_name":info.get("name") or info.get("given_name") or ""}
    username=request.username.strip();student_id=request.student_id.strip();gender=request.gender.strip().lower();password=request.password
    if gender not in ALLOWED_GENDERS: raise HTTPException(status_code=422,detail="Gender must be Male, Female, or Prefer not to say.")
    if len(password.encode("utf-8"))>72: raise HTTPException(status_code=422,detail="Password is too long.")
    if user_manager.get_user(username) is not None: raise HTTPException(status_code=409,detail="That username is already registered.")
    if user_manager.collection.find_one({"student_id":student_id,"role":"student"}): raise HTTPException(status_code=409,detail="That Student ID is already registered.")
    if face_database.get_all().get(student_id) is not None: raise HTTPException(status_code=409,detail="That Student ID already has a face registration.")
    embeddings=_capture_training_embeddings(request.face_images)
    name=(info.get("name") or info.get("given_name") or username).strip()
    face_database.add_person(student_id,name,embeddings[0])
    try:
        face_database.add_training_embeddings(student_id,embeddings)
        user=user_manager.create_user(username=username,password_hash=hash_password(password),role="student",student_id=student_id,name=name,email=email,email_verified=True,gender=gender,auth_provider="both",google_sub=google_sub)
    except ValueError as exc:
        face_database.delete_person(student_id);raise HTTPException(status_code=422,detail=str(exc)) from exc
    except Exception:
        face_database.delete_person(student_id);raise
    if user is None:
        face_database.delete_person(student_id);raise HTTPException(status_code=409,detail="An account for this student already exists.")
    return {"success":True,"onboarding_required":False,"new_account":True,"training_samples":10,**_token_for(user)}

@router.post("/account/google/link")
def link_google_account(request: GoogleAuthRequest, user=Depends(get_current_user)):
    info=_verify_google_credential(request.credential);account=user_manager.get_user(user["sub"])
    if account is None or account.get("is_active") is False: raise HTTPException(status_code=401,detail="Account is unavailable.")
    google_sub=info["sub"];google_email=info["email"].strip().lower();existing=user_manager.get_user_by_google_sub(google_sub)
    if existing and existing.get("username")!=account.get("username"): raise HTTPException(status_code=409,detail="This Google account is already linked to another VisionAttend account.")
    account_email=(account.get("email") or "").strip().lower()
    if not account_email: raise HTTPException(status_code=400,detail="Add an email address to your VisionAttend account before linking Google.")
    if account_email!=google_email: raise HTTPException(status_code=409,detail="The Google email must match the verified email on your VisionAttend account.")
    if not account.get("email_verified"): raise HTTPException(status_code=403,detail="Verify your VisionAttend email before linking Google.")
    try: updated=user_manager.set_google_identity(account["username"],google_sub)
    except ValueError as exc: raise HTTPException(status_code=409,detail=str(exc)) from exc
    if not updated: raise HTTPException(status_code=500,detail="Google account could not be linked.")
    return {"success":True,"linked":True,"email":google_email}
