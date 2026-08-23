import sys
import subprocess
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# Add existing ml modules + backend services to the Python path
# (none of the ml files are modified)
# ============================================================

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
SERVICES_DIR = PROJECT_ROOT / "backend" / "services"

sys.path.append(str(ATTENDANCE_DIR))
sys.path.append(str(RECOGNITION_DIR))
sys.path.append(str(SERVICES_DIR))

from attendance_manager import AttendanceManager
from database import FaceDatabase
from session_manager import SessionManager

from user_manager import UserManager
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin
)


# ============================================================
# App setup
# ============================================================

app = FastAPI(title="VisionAttend AI API")

# Allow a frontend running on a different port (e.g. React on
# :3000 or :5173) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

attendance_manager = AttendanceManager()
face_database = FaceDatabase()
session_manager = SessionManager()
user_manager = UserManager()

# ------------------------------------------------------------
# Demo-only: lets a frontend button trigger the ML pipeline
# (opens the local webcam window). This only works because the
# backend is running on the SAME machine as the webcam -- once
# this backend is deployed to a real cloud server later, this
# has no camera to open and should be removed/disabled.
# ------------------------------------------------------------

PIPELINE_SCRIPT = PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline.py"

pipeline_process = None


def _launch_pipeline_if_not_running():

    global pipeline_process

    if pipeline_process is None or pipeline_process.poll() is not None:

        pipeline_process = subprocess.Popen(
            [sys.executable, str(PIPELINE_SCRIPT)]
        )


def _build_summary(student_id):

    records = attendance_manager.get_history_for_student(student_id)

    total = len(records)
    present = sum(1 for r in records if r["status"] == "Present")
    late = sum(1 for r in records if r["status"] == "Late")
    absent = sum(1 for r in records if r["status"] == "Absent")

    attended = present + late

    percentage = round((attended / total) * 100, 1) if total > 0 else 0

    return {
        "student_id": student_id,
        "total_days": total,
        "present": present,
        "late": late,
        "absent": absent,
        "attendance_percentage": percentage
    }


# ============================================================
# Health check (public — no login needed)
# ============================================================

@app.get("/health")
def health_check():

    return {
        "status": "ok",
        "message": "VisionAttend AI backend is running"
    }


# ============================================================
# Authentication
# ============================================================

class SignupRequest(BaseModel):
    student_id: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/signup")
def signup(request: SignupRequest):
    """
    Student self-registration. Only works if the student_id
    already has a registered face (via the desktop registration
    script) — this links the login account to an actual, real
    registered student, rather than letting anyone create an
    account for any ID.
    """

    all_students = face_database.get_all()

    if request.student_id not in all_students:

        raise HTTPException(
            status_code=404,
            detail=(
                "This student ID isn't registered yet. "
                "Register your face first, then sign up."
            )
        )

    if len(request.password) < 6:

        raise HTTPException(
            status_code=422,
            detail="Password must be at least 6 characters."
        )

    name = all_students[request.student_id]["name"]

    password_hash = hash_password(request.password)

    user = user_manager.create_user(
        username=request.student_id,
        password_hash=password_hash,
        role="student",
        student_id=request.student_id,
        name=name
    )

    if user is None:

        raise HTTPException(
            status_code=409,
            detail="An account for this student ID already exists."
        )

    return {
        "success": True,
        "username": request.student_id,
        "name": name,
        "role": "student"
    }


@app.post("/auth/login")
def login(request: LoginRequest):
    """
    Works for both students (username = student_id) and admins
    (username = whatever was set via scripts/create_admin.py).
    """

    user = user_manager.get_user(request.username)

    if user is None or not verify_password(
        request.password, user["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password."
        )

    token = create_access_token(
        username=user["username"],
        role=user["role"],
        student_id=user.get("student_id"),
        name=user.get("name")
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "name": user.get("name"),
        "student_id": user.get("student_id")
    }


# ============================================================
# Attendance endpoints (admin only — full class visibility)
# ============================================================

@app.get("/attendance/today")
def get_today_attendance(admin=Depends(require_admin)):

    records = attendance_manager.get_today_attendance()

    return {
        "count": len(records),
        "records": list(records.values())
    }


@app.get("/attendance/summary")
def get_class_summary(admin=Depends(require_admin)):
    """
    Class-wide Present/Late/Absent summary for every registered
    student — powers admin dashboard charts.
    """

    all_students = face_database.get_all()

    summaries = [
        _build_summary(student_id)
        for student_id in all_students.keys()
    ]

    return {
        "count": len(summaries),
        "summaries": summaries
    }


@app.get("/attendance/{date}")
def get_attendance_by_date(date: str, admin=Depends(require_admin)):
    """
    Date format: YYYY-MM-DD
    """

    records = attendance_manager.get_by_date(date)

    if not records:

        raise HTTPException(
            status_code=404,
            detail=f"No attendance records found for {date}"
        )

    return {
        "date": date,
        "count": len(records),
        "records": list(records.values())
    }


@app.post("/attendance/mark-absentees")
def mark_absentees(admin=Depends(require_admin)):
    """
    Marks every registered student who wasn't already marked
    Present/Late today as Absent. Safe to call more than once.
    """

    today = datetime.now().strftime("%Y-%m-%d")

    all_students = face_database.get_all()
    present_today = attendance_manager.get_by_date(today)

    marked_absent = []
    already_recorded = []

    for student_id, person in all_students.items():

        if student_id in present_today:

            already_recorded.append(student_id)
            continue

        result = attendance_manager.mark_absent(
            student_id=student_id,
            name=person["name"],
            date=today
        )

        if result["success"]:
            marked_absent.append(student_id)

    return {
        "date": today,
        "marked_absent": marked_absent,
        "already_recorded_count": len(already_recorded)
    }


# ============================================================
# Student roster (admin only)
# ============================================================

@app.get("/students")
def get_all_students(admin=Depends(require_admin)):

    people = face_database.get_all()

    students = [
        {"student_id": student_id, "name": person["name"]}
        for student_id, person in people.items()
    ]

    return {
        "count": len(students),
        "students": students
    }


@app.get("/students/{student_id}/attendance")
def get_student_attendance(student_id: str, admin=Depends(require_admin)):

    records = attendance_manager.get_history_for_student(student_id)

    return {
        "student_id": student_id,
        "count": len(records),
        "records": records
    }


@app.get("/students/{student_id}/summary")
def get_student_summary(student_id: str, admin=Depends(require_admin)):

    return _build_summary(student_id)


# ============================================================
# "My" endpoints — a logged-in student's own data only.
# Uses the student_id from their OWN token, never a
# client-supplied id, so a student can never see anyone else's.
# ============================================================

@app.get("/me/attendance")
def get_my_attendance(user=Depends(get_current_user)):

    if user["role"] != "student":

        raise HTTPException(
            status_code=403,
            detail="This endpoint is for student accounts only."
        )

    records = attendance_manager.get_history_for_student(
        user["student_id"]
    )

    return {
        "student_id": user["student_id"],
        "count": len(records),
        "records": records
    }


@app.get("/me/summary")
def get_my_summary(user=Depends(get_current_user)):

    if user["role"] != "student":

        raise HTTPException(
            status_code=403,
            detail="This endpoint is for student accounts only."
        )

    return _build_summary(user["student_id"])


# ============================================================
# ML pipeline control (demo only — see note above). Admin only.
# ============================================================

@app.post("/pipeline/start")
def start_pipeline(admin=Depends(require_admin)):

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        return {"status": "already_running"}

    pipeline_process = subprocess.Popen(
        [sys.executable, str(PIPELINE_SCRIPT)]
    )

    return {"status": "started", "pid": pipeline_process.pid}


@app.post("/pipeline/stop")
def stop_pipeline(admin=Depends(require_admin)):

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        pipeline_process.terminate()

        return {"status": "stopped"}

    return {"status": "not_running"}


@app.get("/pipeline/status")
def pipeline_status(admin=Depends(require_admin)):

    running = (
        pipeline_process is not None
        and pipeline_process.poll() is None
    )

    return {"running": running}


# ============================================================
# Lecture sessions (admin only)
# ============================================================

class ScheduleSessionRequest(BaseModel):
    name: str
    planned_start_time: str  # ISO 8601, e.g. "2026-08-25T09:00:00"
    duration_minutes: int = 45
    late_after_minutes: int = 10


class StartSessionRequest(BaseModel):
    name: str = "Untitled Session"
    duration_minutes: int = 45
    late_after_minutes: int = 10


@app.post("/session/schedule")
def schedule_session(
    request: ScheduleSessionRequest,
    admin=Depends(require_admin)
):

    try:
        planned_time = datetime.fromisoformat(request.planned_start_time)

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="planned_start_time must be ISO 8601, e.g. 2026-08-25T09:00:00"
        )

    session = session_manager.create_session(
        name=request.name,
        planned_start_time=planned_time,
        duration_minutes=request.duration_minutes,
        late_after_minutes=request.late_after_minutes
    )

    return {
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "status": session["status"]
    }


@app.get("/session/scheduled")
def list_scheduled_sessions(admin=Depends(require_admin)):

    sessions = session_manager.get_scheduled_sessions()

    return {
        "count": len(sessions),
        "sessions": [
            {
                "session_id": s["session_id"],
                "name": s["name"],
                "start_time": s["start_time"].isoformat(),
                "duration_minutes": s["duration_minutes"],
                "late_after_minutes": s["late_after_minutes"]
            }
            for s in sessions
        ]
    }


@app.delete("/session/scheduled/{session_id}")
def cancel_scheduled_session(
    session_id: str,
    admin=Depends(require_admin)
):

    result = session_manager.cancel_session(session_id)

    if not result["success"]:

        raise HTTPException(
            status_code=404,
            detail="Scheduled session not found."
        )

    return {"success": True}


@app.post("/session/start")
def start_session_now(
    request: StartSessionRequest = StartSessionRequest(),
    admin=Depends(require_admin)
):

    session = session_manager.create_session(
        name=request.name,
        planned_start_time=None,
        duration_minutes=request.duration_minutes,
        late_after_minutes=request.late_after_minutes
    )

    _launch_pipeline_if_not_running()

    return {
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "duration_minutes": session["duration_minutes"],
        "late_after_minutes": session["late_after_minutes"],
        "status": session["status"],
        "pipeline_started": True
    }


@app.post("/session/start/{session_id}")
def start_scheduled_session(
    session_id: str,
    admin=Depends(require_admin)
):

    result = session_manager.activate_session(session_id)

    if not result["success"]:

        raise HTTPException(
            status_code=404,
            detail=result.get("message", "Session not found.")
        )

    _launch_pipeline_if_not_running()

    session = result["session"]

    return {
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "duration_minutes": session["duration_minutes"],
        "late_after_minutes": session["late_after_minutes"],
        "status": session["status"],
        "pipeline_started": True
    }


@app.post("/session/end")
def end_session(admin=Depends(require_admin)):

    result = session_manager.end_session()

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        pipeline_process.terminate()

    if not result["success"]:
        return result

    absentee_result = mark_absentees(admin=admin)

    session = result["session"]

    return {
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "status": "closed",
        "pipeline_stopped": True,
        "marked_absent": absentee_result["marked_absent"]
    }


@app.get("/session/current")
def get_current_session(admin=Depends(require_admin)):

    session = session_manager.get_current_session()

    if session is None:
        return {"active": False}

    now = datetime.now()

    elapsed_minutes = (
        (now - session["start_time"]).total_seconds() / 60
    )

    remaining_minutes = max(
        0,
        session["duration_minutes"] - elapsed_minutes
    )

    return {
        "active": True,
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "duration_minutes": session["duration_minutes"],
        "late_after_minutes": session["late_after_minutes"],
        "elapsed_minutes": round(elapsed_minutes, 1),
        "remaining_minutes": round(remaining_minutes, 1)
    }


# ============================================================
# Run directly with: python main.py
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )