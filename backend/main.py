import sys
import subprocess
import base64
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

app = FastAPI(title="VisionAttend AI API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
attendance_manager = AttendanceManager(); face_database = FaceDatabase(); session_manager = SessionManager(); user_manager = UserManager(); face_recognizer = None
PIPELINE_SCRIPT = PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline.py"; pipeline_process = None

def _get_face_recognizer():
    global face_recognizer
    if face_recognizer is None: face_recognizer = FaceRecognizer()
    return face_recognizer

def _decode_face_image(image_data):
    if not image_data: raise HTTPException(status_code=400, detail="Face image is required.")
    try:
        if "," in image_data and image_data.startswith("data:"): image_data = image_data.split(",", 1)[1]
        frame = cv2.imdecode(np.frombuffer(base64.b64decode(image_data), dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception: frame = None
    if frame is None: raise HTTPException(status_code=400, detail="Invalid face image.")
    return frame

def _capture_embedding(image_data):
    frame = _decode_face_image(image_data); embedding, face_count = _get_face_recognizer().get_single_face_embedding(frame)
    if face_count == 0: raise HTTPException(status_code=422, detail="No face detected. Please position one face clearly in the camera.")
    if face_count > 1: raise HTTPException(status_code=422, detail="Multiple faces detected. Only one person may be registered at a time.")
    return embedding

def _launch_pipeline_if_not_running():
    global pipeline_process
    if pipeline_process is None or pipeline_process.poll() is not None:
        pipeline_process = subprocess.Popen([sys.executable, str(PIPELINE_SCRIPT)]); return True
    return False

def _mark_session_absentees(session):
    if session is None: return []
    session_id = session["session_id"]; session_date = session["start_time"].strftime("%Y-%m-%d"); existing = attendance_manager.get_by_session(session_id); all_students = face_database.get_all(); marked_absent = []
    for student_id, person in all_students.items():
        if student_id in existing: continue
        result = attendance_manager.mark_absent(student_id=student_id, name=person["name"], date=session_date, session_id=session_id)
        if result["success"]: marked_absent.append(student_id)
    return marked_absent

def _close_session_and_pipeline(session=None):
    global pipeline_process
    if session is None: session = session_manager.get_current_session()
    if session is not None: _mark_session_absentees(session); session_manager.end_session(session["session_id"])
    if pipeline_process is not None and pipeline_process.poll() is None: pipeline_process.terminate()

def _synchronize_dead_pipeline():
    global pipeline_process
    if pipeline_process is None or pipeline_process.poll() is None: return
    session = session_manager.get_current_session()
    if session is not None: _close_session_and_pipeline(session)
    pipeline_process = None

def _build_summary(student_id):
    records = attendance_manager.get_history_for_student(student_id); total = len(records); present = sum(1 for r in records if r.get("status") == "Present"); late = sum(1 for r in records if r.get("status") == "Late"); absent = sum(1 for r in records if r.get("status") == "Absent")
    return {"student_id": student_id, "total_sessions": total, "total_days": total, "present": present, "late": late, "absent": absent, "attendance_percentage": round(((present + late) / total) * 100, 1) if total else 0}

@app.get("/health")
def health_check(): return {"status": "ok", "message": "VisionAttend AI backend is running"}

class SignupRequest(BaseModel): student_id: str; name: str | None = None; password: str; face_image: str
class LoginRequest(BaseModel): username: str; password: str
class ProfileRequest(BaseModel): name: str
class PasswordChangeRequest(BaseModel): current_password: str; new_password: str; confirm_password: str

@app.post("/auth/signup")
def signup(request: SignupRequest):
    student_id = request.student_id.strip(); all_students = face_database.get_all(); existing_face = all_students.get(student_id)
    if len(request.password) < 6: raise HTTPException(status_code=422, detail="Password must be at least 6 characters.")
    if existing_face is None:
        name = (request.name or "").strip()
        if not name: raise HTTPException(status_code=422, detail="Name is required for a new student.")
    else: name = existing_face["name"]
    embedding = _capture_embedding(request.face_image); face_database.add_person(student_id, name, embedding)
    user = user_manager.create_user(username=student_id, password_hash=hash_password(request.password), role="student", student_id=student_id, name=name)
    if user is None: raise HTTPException(status_code=409, detail="An account for this student ID already exists.")
    return {"success": True, "username": student_id, "name": name, "role": "student", "face_registered": True}

@app.post("/auth/login")
def login(request: LoginRequest):
    user = user_manager.get_user(request.username)
    if user is None or not verify_password(request.password, user["password_hash"]): raise HTTPException(status_code=401, detail="Incorrect username or password.")
    token = create_access_token(username=user["username"], role=user["role"], student_id=user.get("student_id"), name=user.get("name"))
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "name": user.get("name"), "student_id": user.get("student_id")}

@app.get("/profile")
def get_profile(user=Depends(get_current_user)):
    account = user_manager.get_user(user["sub"])
    if account is None: raise HTTPException(status_code=404, detail="User not found.")
    return {"username": account["username"], "name": account.get("name"), "role": account.get("role"), "student_id": account.get("student_id")}

@app.put("/profile")
def update_profile(request: ProfileRequest, user=Depends(get_current_user)):
    name = request.name.strip()
    if not name: raise HTTPException(status_code=422, detail="Name cannot be empty.")
    user_manager.update_profile(user["sub"], name)
    return {"success": True, "name": name}

@app.put("/profile/password")
def change_password(request: PasswordChangeRequest, user=Depends(get_current_user)):
    if len(request.new_password) < 6: raise HTTPException(status_code=422, detail="New password must be at least 6 characters.")
    if request.new_password != request.confirm_password: raise HTTPException(status_code=422, detail="New passwords do not match.")
    account = user_manager.get_user(user["sub"])
    if account is None or not verify_password(request.current_password, account["password_hash"]): raise HTTPException(status_code=401, detail="Current password is incorrect.")
    user_manager.update_password(user["sub"], hash_password(request.new_password))
    return {"success": True}

@app.get("/attendance/today")
def get_today_attendance(admin=Depends(require_admin)): return {"date": datetime.now().strftime("%Y-%m-%d"), "records": attendance_manager.get_today_attendance()}
