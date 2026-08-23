import sys
import subprocess
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# Project paths
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

PIPELINE_SCRIPT = (
    PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline.py"
)

pipeline_process = None


# ============================================================
# Pipeline/session synchronization helpers
# ============================================================

def _launch_pipeline_if_not_running():

    global pipeline_process

    if (
        pipeline_process is None
        or pipeline_process.poll() is not None
    ):

        pipeline_process = subprocess.Popen(
            [sys.executable, str(PIPELINE_SCRIPT)]
        )

        return True

    return False


def _mark_session_absentees(session):
    """Mark only students missing from this exact session as absent."""

    if session is None:
        return []

    session_id = session["session_id"]
    session_date = session["start_time"].strftime("%Y-%m-%d")

    existing = attendance_manager.get_by_session(
        session_id
    )

    all_students = face_database.get_all()

    marked_absent = []

    for student_id, person in all_students.items():

        if student_id in existing:
            continue

        result = attendance_manager.mark_absent(
            student_id=student_id,
            name=person["name"],
            date=session_date,
            session_id=session_id
        )

        if result["success"]:
            marked_absent.append(student_id)

    return marked_absent


def _close_session_and_pipeline(session=None):
    """Close one session, mark its absentees, and stop the process."""

    global pipeline_process

    if session is None:
        session = session_manager.get_current_session()

    if session is not None:
        _mark_session_absentees(session)
        session_manager.end_session(
            session["session_id"]
        )

    if (
        pipeline_process is not None
        and pipeline_process.poll() is None
    ):
        pipeline_process.terminate()


def _synchronize_dead_pipeline():
    """
    Safety net: if the ML subprocess dies unexpectedly while its
    session is still active, close that session and mark absentees.
    Normal ML exits already close the session themselves, so this
    is only a crash/desync fallback.
    """

    global pipeline_process

    if pipeline_process is None:
        return

    if pipeline_process.poll() is None:
        return

    session = session_manager.get_current_session()

    if session is not None:
        print(
            "[SYNC] ML pipeline stopped unexpectedly. "
            "Closing active session."
        )
        _close_session_and_pipeline(session)

    pipeline_process = None


def _build_summary(student_id):

    records = attendance_manager.get_history_for_student(
        student_id
    )

    total = len(records)

    present = sum(
        1 for r in records
        if r.get("status") == "Present"
    )

    late = sum(
        1 for r in records
        if r.get("status") == "Late"
    )

    absent = sum(
        1 for r in records
        if r.get("status") == "Absent"
    )

    attended = present + late

    percentage = (
        round((attended / total) * 100, 1)
        if total > 0
        else 0
    )

    return {
        "student_id": student_id,
        "total_sessions": total,
        "total_days": total,
        "present": present,
        "late": late,
        "absent": absent,
        "attendance_percentage": percentage
    }


# ============================================================
# Health
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

    user = user_manager.create_user(
        username=request.student_id,
        password_hash=hash_password(request.password),
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

    user = user_manager.get_user(request.username)

    if user is None or not verify_password(
        request.password,
        user["password_hash"]
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
# Attendance — admin
# ============================================================

@app.get("/attendance/today")
def get_today_attendance(
    admin=Depends(require_admin)
):

    records = attendance_manager.get_today_attendance()

    return {
        "count": len(records),
        "records": list(records.values())
    }


@app.get("/attendance/session/{session_id}")
def get_session_attendance(
    session_id: str,
    admin=Depends(require_admin)
):

    records = attendance_manager.get_by_session(
        session_id
    )

    return {
        "session_id": session_id,
        "count": len(records),
        "records": list(records.values())
    }


@app.get("/attendance/summary")
def get_class_summary(
    admin=Depends(require_admin)
):

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
def get_attendance_by_date(
    date: str,
    admin=Depends(require_admin)
):

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
def mark_absentees(
    admin=Depends(require_admin)
):
    """
    Marks absentees only for the CURRENT ACTIVE SESSION.
    If there is no active session, nothing is written to Atlas.
    """

    session = session_manager.get_current_session()

    if session is None:
        raise HTTPException(
            status_code=409,
            detail="No active session. No absences were created."
        )

    marked_absent = _mark_session_absentees(session)

    return {
        "session_id": session["session_id"],
        "date": session["start_time"].strftime("%Y-%m-%d"),
        "marked_absent": marked_absent,
        "count": len(marked_absent)
    }


# ============================================================
# Students
# ============================================================

@app.get("/students")
def get_all_students(
    admin=Depends(require_admin)
):

    people = face_database.get_all()

    students = [
        {
            "student_id": student_id,
            "name": person["name"]
        }
        for student_id, person in people.items()
    ]

    return {
        "count": len(students),
        "students": students
    }


@app.get("/students/{student_id}/attendance")
def get_student_attendance(
    student_id: str,
    admin=Depends(require_admin)
):

    records = attendance_manager.get_history_for_student(
        student_id
    )

    return {
        "student_id": student_id,
        "count": len(records),
        "records": records
    }


@app.get("/students/{student_id}/summary")
def get_student_summary(
    student_id: str,
    admin=Depends(require_admin)
):

    return _build_summary(student_id)


# ============================================================
# Student self-service
# ============================================================

@app.get("/me/attendance")
def get_my_attendance(
    user=Depends(get_current_user)
):

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
def get_my_summary(
    user=Depends(get_current_user)
):

    if user["role"] != "student":
        raise HTTPException(
            status_code=403,
            detail="This endpoint is for student accounts only."
        )

    return _build_summary(user["student_id"])


# ============================================================
# Pipeline control
# ============================================================

@app.post("/pipeline/start")
def start_pipeline(
    admin=Depends(require_admin)
):

    started = _launch_pipeline_if_not_running()

    if not started:
        return {"status": "already_running"}

    return {
        "status": "started",
        "pid": pipeline_process.pid
    }


@app.post("/pipeline/stop")
def stop_pipeline(
    admin=Depends(require_admin)
):

    session = session_manager.get_current_session()

    if session is None:
        return {"status": "not_running"}

    _close_session_and_pipeline(session)

    return {
        "status": "stopped",
        "session_id": session["session_id"]
    }


@app.get("/pipeline/status")
def pipeline_status(
    admin=Depends(require_admin)
):

    _synchronize_dead_pipeline()

    running = (
        pipeline_process is not None
        and pipeline_process.poll() is None
    )

    return {"running": running}


# ============================================================
# Lecture sessions
# ============================================================

class ScheduleSessionRequest(BaseModel):
    name: str
    planned_start_time: str
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
        planned_time = datetime.fromisoformat(
            request.planned_start_time
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "planned_start_time must be ISO 8601, "
                "e.g. 2026-08-25T09:00:00"
            )
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
        "duration_minutes": session["duration_minutes"],
        "late_after_minutes": session["late_after_minutes"],
        "status": session["status"]
    }


@app.get("/session/scheduled")
def list_scheduled_sessions(
    admin=Depends(require_admin)
):

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

    result = session_manager.cancel_session(
        session_id
    )

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

    # Do not allow overlapping active sessions.
    active = session_manager.get_current_session()

    if active is not None:
        raise HTTPException(
            status_code=409,
            detail="A session is already active."
        )

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

    active = session_manager.get_current_session()

    if active is not None:
        raise HTTPException(
            status_code=409,
            detail="A session is already active."
        )

    result = session_manager.activate_session(
        session_id
    )

    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=result.get(
                "message",
                "Session not found."
            )
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
def end_session(
    admin=Depends(require_admin)
):

    session = session_manager.get_current_session()

    if session is None:
        return {
            "success": False,
            "status": "no_active_session",
            "pipeline_stopped": False
        }

    marked_absent = _mark_session_absentees(session)

    result = session_manager.end_session(
        session["session_id"]
    )

    global pipeline_process

    if (
        pipeline_process is not None
        and pipeline_process.poll() is None
    ):
        pipeline_process.terminate()

    pipeline_process = None

    return {
        "success": result["success"],
        "session_id": session["session_id"],
        "name": session["name"],
        "start_time": session["start_time"].isoformat(),
        "status": "closed",
        "pipeline_stopped": True,
        "marked_absent": marked_absent
    }


@app.get("/session/current")
def get_current_session(
    admin=Depends(require_admin)
):

    _synchronize_dead_pipeline()

    session = session_manager.get_current_session()

    if session is None:
        return {
            "active": False,
            "status": "closed"
        }

    now = datetime.now()

    elapsed_minutes = (
        (now - session["start_time"])
        .total_seconds() / 60
    )

    remaining_minutes = max(
        0,
        session["duration_minutes"] - elapsed_minutes
    )

    # Safety fallback in case the ML process has not yet reached
    # its own duration check.
    if remaining_minutes <= 0:

        marked_absent = _mark_session_absentees(
            session
        )

        session_manager.end_session(
            session["session_id"]
        )

        global pipeline_process

        if (
            pipeline_process is not None
            and pipeline_process.poll() is None
        ):
            pipeline_process.terminate()

        pipeline_process = None

        return {
            "active": False,
            "status": "closed",
            "session_id": session["session_id"],
            "marked_absent": marked_absent
        }

    return {
        "active": True,
        "status": "active",
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
