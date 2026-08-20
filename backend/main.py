import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


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