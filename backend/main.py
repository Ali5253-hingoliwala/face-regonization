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
PIPELINE_SCRIPT = PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline.py"; pipeline_process = None

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
    student_id:str=Field(min_length=1,max_length=32,pattern=r"^[A-Za-z0-9_-]+$");name:str|None=Field(default=None,max_length=100);email:str=Field(min_length=5,max_length=254);password:str=Field(min_length=6,max_length=72);gender:str=Field(min_length=1,max_length=30);face_image:str=Field(min_length=1,max_length=7000000)
class LoginRequest(BaseModel): username:str=Field(min_length=1,max_length=64);password:str=Field(min_length=1,max_length=72)

@app.post("/auth/signup")
def signup(request:SignupRequest):
    student_id=request.student_id.strip();email=request.email.strip().lower();gender=request.gender.strip().lower();existing_face=face_database.get_all().get(student_id)
    if gender not in {"male","female","prefer not to say"}:raise HTTPException(status_code=422,detail="Gender must be Male, Female, or Prefer not to say.")
    if user_manager.get_user_by_email(email) is not None:raise HTTPException(status_code=409,detail="An account with this email already exists.")
    name=(request.name or "").strip() if existing_face is None else existing_face["name"]
    if not name:raise HTTPException(status_code=422,detail="Name is required for a new student.")
    embedding=_capture_embedding(request.face_image);face_database.add_person(student_id,name,embedding)
    try:user=user_manager.create_user(username=student_id,password_hash=hash_password(request.password),role="student",student_id=student_id,name=name,email=email,gender=gender,auth_provider="local",email_verified=False)
    except ValueError as exc:raise HTTPException(status_code=422,detail=str(exc))
    if user is None:raise HTTPException(status_code=409,detail="An account for this student ID already exists.")
    return {"success":True,"username":student_id,"name":name,"email":email,"gender":gender,"role":"student","face_registered":True}

@app.post("/auth/login")
def login(request:LoginRequest):
    user=user_manager.get_user(request.username)
    if user is None or not verify_password(request.password,user["password_hash"]):raise HTTPException(status_code=401,detail="Incorrect username or password.")
    if user.get("is_active") is False:raise HTTPException(status_code=403,detail="This account is disabled.")
    user_manager.mark_login(user["username"])
    token=create_access_token(username=user["username"],role=user["role"],student_id=user.get("student_id"),name=user.get("name"))
    return {"access_token":token,"token_type":"bearer","role":user["role"],"name":user.get("name"),"student_id":user.get("student_id")}

# The account_api router supplies /account/profile, /account/password, /account/photo and /account/security.
# Existing attendance/session endpoints remain below.
@app.get("/attendance/today")
def get_today_attendance(admin=Depends(require_admin)):
    records=attendance_manager.get_today_attendance();return {"count":len(records),"records":list(records.values())}
@app.get("/attendance/session/{session_id}")
def get_session_attendance(session_id:str,admin=Depends(require_admin)):
    records=attendance_manager.get_by_session(session_id);return {"session_id":session_id,"count":len(records),"records":list(records.values())}
@app.get("/attendance/summary")
def get_class_summary(admin=Depends(require_admin)):
    people=face_database.get_all();return {"count":len(people),"summaries":[_build_summary(sid) for sid in people.keys()]}
@app.get("/attendance/{date}")
def get_attendance_by_date(date:str,admin=Depends(require_admin)):
    records=attendance_manager.get_by_date(date)
    if not records:raise HTTPException(status_code=404,detail=f"No attendance records found for {date}")
    return {"date":date,"count":len(records),"records":list(records.values())}
@app.delete("/admin/attendance-history")
def clear_attendance_history(admin=Depends(require_admin)):
    active=session_manager.get_current_session()
    if active is not None:raise HTTPException(status_code=409,detail="Stop the active attendance session before clearing history.")
    a=attendance_manager.collection.delete_many({});s=session_manager.collection.delete_many({"status":"closed"})
    return {"success":True,"attendance_deleted":a.deleted_count,"sessions_deleted":s.deleted_count,"students_preserved":True,"accounts_preserved":True,"face_embeddings_preserved":True}
@app.post("/attendance/mark-absentees")
def mark_absentees(admin=Depends(require_admin)):
    session=session_manager.get_current_session()
    if session is None:raise HTTPException(status_code=409,detail="No active session. No absences were created.")
    marked=_mark_session_absentees(session);return {"session_id":session["session_id"],"date":session["start_time"].strftime("%Y-%m-%d"),"marked_absent":marked,"count":len(marked)}
@app.get("/students")
def get_all_students(admin=Depends(require_admin)):
    people=face_database.get_all();return {"count":len(people),"students":[{"student_id":sid,"name":p["name"]} for sid,p in people.items()]}
@app.delete("/students/{student_id}")
def delete_student(student_id:str,admin=Depends(require_admin)):
    f=face_database.delete_person(student_id);a=user_manager.delete_student_account(student_id)
    if not f and not a:raise HTTPException(status_code=404,detail="Student not found.")
    return {"success":True,"student_id":student_id,"face_deleted":f,"account_deleted":a,"attendance_history_preserved":True}
@app.get("/students/{student_id}/attendance")
def get_student_attendance(student_id:str,admin=Depends(require_admin)):return {"student_id":student_id,"count":len(attendance_manager.get_history_for_student(student_id)),"records":attendance_manager.get_history_for_student(student_id)}
@app.get("/students/{student_id}/summary")
def get_student_summary(student_id:str,admin=Depends(require_admin)):return _build_summary(student_id)
@app.get("/me/attendance")
def get_my_attendance(user=Depends(get_current_user)):
    if user["role"]!="student":raise HTTPException(status_code=403,detail="This endpoint is for student accounts only.")
    records=attendance_manager.get_history_for_student(user["student_id"]);return {"student_id":user["student_id"],"count":len(records),"records":records}
@app.get("/me/summary")
def get_my_summary(user=Depends(get_current_user)):
    if user["role"]!="student":raise HTTPException(status_code=403,detail="This endpoint is for student accounts only.")
    return _build_summary(user["student_id"])

class ScheduleSessionRequest(BaseModel):name:str=Field(min_length=1,max_length=120);planned_start_time:str=Field(min_length=19,max_length=40);duration_minutes:int=Field(default=45,ge=1,le=240);late_after_minutes:int=Field(default=10,ge=0,le=240)
class StartSessionRequest(BaseModel):name:str=Field(default="Untitled Session",min_length=1,max_length=120);duration_minutes:int=Field(default=45,ge=1,le=240);late_after_minutes:int=Field(default=10,ge=0,le=240)
@app.post("/pipeline/start")
def start_pipeline(admin=Depends(require_admin)):
    started=_launch_pipeline_if_not_running();return {"status":"started" if started else "already_running","pid":pipeline_process.pid if pipeline_process else None}
@app.post("/pipeline/stop")
def stop_pipeline(admin=Depends(require_admin)):
    session=session_manager.get_current_session()
    if session is None:return {"status":"not_running"}
    _close_session_and_pipeline(session);return {"status":"stopped","session_id":session["session_id"]}
@app.get("/pipeline/status")
def pipeline_status(admin=Depends(require_admin)):_synchronize_dead_pipeline();return {"running":pipeline_process is not None and pipeline_process.poll() is None}
@app.post("/session/schedule")
def schedule_session(request:ScheduleSessionRequest,admin=Depends(require_admin)):
    try:planned=datetime.fromisoformat(request.planned_start_time)
    except ValueError:raise HTTPException(status_code=400,detail="planned_start_time must be ISO 8601.")
    if planned<=datetime.now():raise HTTPException(status_code=422,detail="Scheduled session time must be in the future.")
    s=session_manager.create_session(name=request.name.strip(),planned_start_time=planned,duration_minutes=request.duration_minutes,late_after_minutes=request.late_after_minutes)
    return {"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"planned_start_time":s["planned_start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"late_after_minutes":s["late_after_minutes"],"status":s["status"]}
@app.get("/session/scheduled")
def list_scheduled_sessions(admin=Depends(require_admin)):
    sessions=session_manager.get_scheduled_sessions();now=datetime.now();return {"count":len(sessions),"sessions":[{"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"planned_start_time":s["planned_start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"late_after_minutes":s["late_after_minutes"],"overdue":s["planned_start_time"]<now} for s in sessions]}
@app.get("/session/history")
def session_history(admin=Depends(require_admin)):
    sessions=session_manager.get_session_history();return {"count":len(sessions),"sessions":[{"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"planned_start_time":s["planned_start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"status":s["status"],"ended_at":s.get("ended_at")} for s in sessions]}
@app.delete("/session/scheduled/{session_id}")
def cancel_scheduled_session(session_id:str,admin=Depends(require_admin)):
    result=session_manager.cancel_session(session_id)
    if not result["success"]:raise HTTPException(status_code=404,detail="Scheduled session not found.")
    return {"success":True}
@app.post("/session/start")
def start_session_now(request:StartSessionRequest=StartSessionRequest(),admin=Depends(require_admin)):
    if session_manager.get_current_session() is not None:raise HTTPException(status_code=409,detail="A session is already active.")
    s=session_manager.create_session(name=request.name.strip(),planned_start_time=None,duration_minutes=request.duration_minutes,late_after_minutes=request.late_after_minutes);_launch_pipeline_if_not_running();return {"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"late_after_minutes":s["late_after_minutes"],"status":s["status"],"pipeline_started":True}
@app.post("/session/start/{session_id}")
def start_scheduled_session(session_id:str,admin=Depends(require_admin)):
    if session_manager.get_current_session() is not None:raise HTTPException(status_code=409,detail="A session is already active.")
    result=session_manager.activate_session(session_id)
    if not result["success"]:raise HTTPException(status_code=404,detail=result.get("message","Session not found."))
    _launch_pipeline_if_not_running();s=result["session"];return {"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"planned_start_time":s["planned_start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"late_after_minutes":s["late_after_minutes"],"status":s["status"],"pipeline_started":True}
@app.post("/session/end")
def end_session(admin=Depends(require_admin)):
    global pipeline_process
    s=session_manager.get_current_session()
    if s is None:return {"success":False,"status":"no_active_session","pipeline_stopped":False}
    marked=_mark_session_absentees(s);result=session_manager.end_session(s["session_id"])
    if pipeline_process is not None and pipeline_process.poll() is None:pipeline_process.terminate()
    pipeline_process=None;return {"success":result["success"],"session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"status":"closed","pipeline_stopped":True,"marked_absent":marked}
@app.get("/session/current")
def get_current_session(admin=Depends(require_admin)):
    _synchronize_dead_pipeline();s=session_manager.get_current_session()
    if s is None:return {"active":False,"status":"closed"}
    now=datetime.now();elapsed=(now-s["start_time"]).total_seconds()/60;remaining=max(0,s["duration_minutes"]-elapsed)
    if remaining<=0:
        marked=_mark_session_absentees(s);session_manager.end_session(s["session_id"])
        global pipeline_process
        if pipeline_process is not None and pipeline_process.poll() is None:pipeline_process.terminate()
        pipeline_process=None;return {"active":False,"status":"closed","session_id":s["session_id"],"marked_absent":marked}
    return {"active":True,"status":"active","session_id":s["session_id"],"name":s["name"],"start_time":s["start_time"].isoformat(),"planned_start_time":s["planned_start_time"].isoformat(),"duration_minutes":s["duration_minutes"],"late_after_minutes":s["late_after_minutes"],"elapsed_minutes":round(elapsed,1),"remaining_minutes":round(remaining,1)}

if __name__=="__main__":
    import uvicorn;uvicorn.run("main:app",host="127.0.0.1",port=8000,reload=True)
