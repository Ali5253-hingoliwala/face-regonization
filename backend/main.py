import os
import sys
import subprocess
import base64
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
SERVICES_DIR = PROJECT_ROOT / "backend" / "services"
sys.path.append(str(ATTENDANCE_DIR)); sys.path.append(str(RECOGNITION_DIR)); sys.path.append(str(SERVICES_DIR))
from attendance_manager import AttendanceManager
from database import FaceDatabase
from recognizer import FaceRecognizer
from session_manager import SessionManager
from user_manager import UserManager
from auth_utils import hash_password, verify_password, create_access_token, get_current_user, require_admin
from security_middleware import SecurityMiddleware
from leave_api import router as leave_router
from account_api import router as account_router

app = FastAPI(title="VisionAttend AI API", version="1.2.0")
cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"], allow_credentials=True)
app.add_middleware(SecurityMiddleware)
app.include_router(leave_router)
app.include_router(account_router)

attendance_manager = AttendanceManager(); face_database = FaceDatabase(); session_manager = SessionManager(); user_manager = UserManager(); face_recognizer = None
PIPELINE_SCRIPT = PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline_svm.py"; pipeline_process = None

def _get_face_recognizer():
    global face_recognizer
    if face_recognizer is None: face_recognizer = FaceRecognizer()
    return face_recognizer

def _decode_face_image(image_data):
    if not image_data: raise HTTPException(status_code=400, detail="Face image is required.")
    max_encoded=int(os.getenv("MAX_FACE_IMAGE_BASE64_CHARS","7000000"))
    if len(image_data)>max_encoded: raise HTTPException(status_code=413, detail="Face image is too large.")
    try:
        if "," in image_data and image_data.startswith("data:"): image_data=image_data.split(",",1)[1]
        raw=base64.b64decode(image_data,validate=True)
        if len(raw)>int(os.getenv("MAX_FACE_IMAGE_BYTES","5000000")): raise HTTPException(status_code=413, detail="Face image is too large.")
        frame=cv2.imdecode(np.frombuffer(raw,dtype=np.uint8),cv2.IMREAD_COLOR)
    except HTTPException: raise
    except Exception: frame=None
    if frame is None: raise HTTPException(status_code=400,detail="Invalid face image.")
    return frame

def _capture_embedding(image_data):
    frame=_decode_face_image(image_data); embedding,face_count=_get_face_recognizer().get_single_face_embedding(frame)
    if face_count==0: raise HTTPException(status_code=422,detail="No face detected. Please position one face clearly in the camera.")
    if face_count>1: raise HTTPException(status_code=422,detail="Multiple faces detected. Only one person may be registered at a time.")
    return embedding

def _cosine_similarity(a,b):
    a=np.asarray(a,dtype=np.float32); b=np.asarray(b,dtype=np.float32); na=np.linalg.norm(a); nb=np.linalg.norm(b)
    return 0.0 if na==0 or nb==0 else float(np.dot(a,b)/(na*nb))

def _capture_training_embeddings(face_images):
    if len(face_images)!=10:
        raise HTTPException(status_code=422,detail="Exactly 10 face samples are required for registration.")
    embeddings=[]
    threshold=float(os.getenv("TRAINING_SAMPLE_SIMILARITY_THRESHOLD","0.985"))
    for index,image in enumerate(face_images,1):
        embedding=_capture_embedding(image)
        if any(_cosine_similarity(embedding,old)>=threshold for old in embeddings):
            raise HTTPException(status_code=422,detail=f"Face sample {index} is too similar to an earlier sample. Please retake the 10 poses with more variation.")
        embeddings.append(np.asarray(embedding,dtype=np.float32).copy())
    return embeddings

def _launch_pipeline_if_not_running():
    global pipeline_process
    if pipeline_process is None or pipeline_process.poll() is not None: pipeline_process=subprocess.Popen([sys.executable,str(PIPELINE_SCRIPT)]); return True
    return False

def _mark_session_absentees(session):
    if session is None:return []
    session_id=session["session_id"]; session_date=session["start_time"].strftime("%Y-%m-%d"); existing=attendance_manager.get_by_session(session_id); marked_absent=[]
    for student_id,person in face_database.get_all().items():
        if student_id in existing:continue
        result=attendance_manager.mark_absent(student_id=student_id,name=person["name"],date=session_date,session_id=session_id)
        if result["success"]:marked_absent.append(student_id)
    return marked_absent

def _close_session_and_pipeline(session=None):
    global pipeline_process
    if session is None:session=session_manager.get_current_session()
    if session is not None:_mark_session_absentees(session);session_manager.end_session(session["session_id"])
    if pipeline_process is not None and pipeline_process.poll() is None:pipeline_process.terminate()

def _synchronize_dead_pipeline():
    global pipeline_process
    if pipeline_process is None or pipeline_process.poll() is None:return
    session=session_manager.get_current_session()
    if session is not None:_close_session_and_pipeline(session)
    pipeline_process=None

def _build_summary(student_id):
    records=attendance_manager.get_history_for_student(student_id);total=len(records);present=sum(1 for r in records if r.get("status")=="Present");late=sum(1 for r in records if r.get("status")=="Late");absent=sum(1 for r in records if r.get("status")=="Absent")
    return {"student_id":student_id,"total_sessions":total,"total_days":total,"present":present,"late":late,"absent":absent,"attendance_percentage":round(((present+late)/total)*100,1) if total else 0}

@app.get("/health")
def health_check():return {"status":"ok","message":"VisionAttend AI backend is running"}

class SignupRequest(BaseModel):
    student_id:str=Field(min_length=1,max_length=32,pattern=r"^[A-Za-z0-9_-]+$");name:str|None=Field(default=None,max_length=100);email:str=Field(min_length=5,max_length=254);password:str=Field(min_length=6,max_length=72);gender:str=Field(min_length=1,max_length=30);face_images:list[str]=Field(min_length=10,max_length=10)
class LoginRequest(BaseModel): username:str=Field(min_length=1,max_length=64);password:str=Field(min_length=1,max_length=72)

@app.post("/auth/signup")
def signup(request:SignupRequest):
    student_id=request.student_id.strip();email=request.email.strip().lower();gender=request.gender.strip().lower();existing_face=face_database.get_all().get(student_id)
    if gender not in {"male","female","prefer not to say"}:raise HTTPException(status_code=422,detail="Gender must be Male, Female, or Prefer not to say.")
    if user_manager.get_user_by_email(email) is not None:raise HTTPException(status_code=409,detail="An account with this email already exists.")
    name=(request.name or "").strip() if existing_face is None else existing_face["name"]
    if not name:raise HTTPException(status_code=422,detail="Name is required for a new student.")
    embeddings=_capture_training_embeddings(request.face_images)
    face_database.add_person(student_id,name,embeddings[0])
    try:
        face_database.add_training_embeddings(student_id,embeddings)
        user=user_manager.create_user(username=student_id,password_hash=hash_password(request.password),role="student",student_id=student_id,name=name,email=email,gender=gender,auth_provider="local",email_verified=False)
    except ValueError as exc:
        face_database.delete_person(student_id)
        raise HTTPException(status_code=422,detail=str(exc))
    except Exception:
        face_database.delete_person(student_id)
        raise
    if user is None:
        face_database.delete_person(student_id)
        raise HTTPException(status_code=409,detail="An account for this student ID already exists.")
    return {"success":True,"username":student_id,"name":name,"email":email,"gender":gender,"role":"student","face_registered":True,"training_samples":10}

@app.post("/auth/login")
def login(request:LoginRequest):
    user=user_manager.get_user(request.username)
    if user is None or not verify_password(request.password,user["password_hash"]):raise HTTPException(status_code=401,detail="Incorrect username or password.")
    if user.get("is_active") is False:raise HTTPException(status_code=403,detail="This account is disabled.")