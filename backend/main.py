import sys
import subprocess
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ============================================================
# Add existing ml modules to the Python path
# (none of these files are modified)
# ============================================================

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"

sys.path.append(str(ATTENDANCE_DIR))
sys.path.append(str(RECOGNITION_DIR))

from attendance_manager import AttendanceManager
from database import FaceDatabase
from session_manager import SessionManager


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

# ------------------------------------------------------------
# Demo-only: lets a frontend button trigger the ML pipeline
# (opens the local webcam window). This only works because the
# backend is running on the SAME machine as the webcam -- once
# this backend is deployed to a real cloud server later, this
# has no camera to open and should be removed/disabled.
# ------------------------------------------------------------

PIPELINE_SCRIPT = PROJECT_ROOT / "ml" / "pipeline" / "attendance_pipeline.py"

pipeline_process = None


# ============================================================
# Health check
# ============================================================

@app.get("/health")
def health_check():

    return {
        "status": "ok",
        "message": "VisionAttend AI backend is running"
    }


# ============================================================
# Attendance endpoints
# ============================================================

@app.get("/attendance/today")
def get_today_attendance():
    """
    Returns today's attendance records as a list.
    """

    records = attendance_manager.get_today_attendance()

    return {
        "count": len(records),
        "records": list(records.values())
    }


@app.get("/attendance/{date}")
def get_attendance_by_date(date: str):
    """
    Returns attendance records for a specific date.
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


# ============================================================
# Student / registered-face endpoints
# ============================================================

@app.get("/students")
def get_all_students():
    """
    Returns all registered people (without their embeddings —
    those are large arrays of numbers, not useful to a frontend).
    """

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


# ============================================================
# Absentee marking
# ============================================================

@app.post("/attendance/mark-absentees")
def mark_absentees():
    """
    Marks every registered student who wasn't already marked
    Present today as Absent. Safe to call more than once — anyone
    already recorded (Present or Absent) is left untouched.
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
# ML pipeline control (demo only — see note above)
# ============================================================

@app.post("/pipeline/start")
def start_pipeline():
    """
    Launches attendance_pipeline.py as a background process on
    this machine. Opens a webcam window locally -- only useful
    when this backend is running on the same computer as the
    camera (e.g. during a live demo).
    """

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        return {"status": "already_running"}

    pipeline_process = subprocess.Popen(
        [sys.executable, str(PIPELINE_SCRIPT)]
    )

    return {"status": "started", "pid": pipeline_process.pid}


@app.post("/pipeline/stop")
def stop_pipeline():
    """
    Terminates the running pipeline process, if any.
    """

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        pipeline_process.terminate()

        return {"status": "stopped"}

    return {"status": "not_running"}


@app.get("/pipeline/status")
def pipeline_status():
    """
    Reports whether the pipeline process is currently running.
    """

    running = (
        pipeline_process is not None
        and pipeline_process.poll() is None
    )

    return {"running": running}


# ============================================================
# Lecture sessions — Present vs Late is decided relative to
# a session's start time, not just the calendar date.
#
# A session can be started immediately, or scheduled ahead of
# time with a name and planned start time, then activated later.
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


def _launch_pipeline_if_not_running():

    global pipeline_process

    if pipeline_process is None or pipeline_process.poll() is not None:

        pipeline_process = subprocess.Popen(
            [sys.executable, str(PIPELINE_SCRIPT)]
        )


@app.post("/session/schedule")
def schedule_session(request: ScheduleSessionRequest):
    """
    Creates a named, scheduled session for a future time. Does NOT
    start the camera — it just sits as "scheduled" until activated
    via /session/start/{session_id}.
    """

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
def list_scheduled_sessions():
    """
    Lists all sessions waiting to be started, soonest first.
    """

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
def cancel_scheduled_session(session_id: str):
    """
    Cancels a session that hasn't been started yet.
    """

    result = session_manager.cancel_session(session_id)

    if not result["success"]:

        raise HTTPException(
            status_code=404,
            detail="Scheduled session not found."
        )

    return {"success": True}


@app.post("/session/start")
def start_session_now(request: StartSessionRequest = StartSessionRequest()):
    """
    Starts a brand new session immediately (no prior scheduling)
    AND launches the camera pipeline — the quick "just start now"
    path.
    """

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
def start_scheduled_session(session_id: str):
    """
    Activates a previously scheduled session AND launches the
    camera pipeline. Keeps the originally planned start_time as
    the reference for Present/Late, even if clicked a bit early
    or late.
    """

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
def end_session():
    """
    Ends the active lecture session, stops the camera pipeline,
    and marks everyone who never showed up today as Absent.
    """

    result = session_manager.end_session()

    global pipeline_process

    if pipeline_process is not None and pipeline_process.poll() is None:

        pipeline_process.terminate()

    if not result["success"]:
        return result

    # Reuse the existing absentee sweep, scoped to today.
    absentee_result = mark_absentees()

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
def get_current_session():
    """
    Returns info about the currently active session, if any --
    including elapsed/remaining minutes, useful for a frontend
    countdown display.
    """

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