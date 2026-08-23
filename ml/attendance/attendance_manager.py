import sys
from pathlib import Path
from datetime import datetime

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class AttendanceManager:
    """
    MongoDB-backed version of AttendanceManager.

    Public method names (mark_attendance, get_today_attendance,
    get_by_date, mark_absent) are kept identical to what the rest
    of the project expects, so attendance_pipeline.py and
    backend/main.py don't need any changes.

    One document per attendance record, e.g.:
    {
        "date": "2026-08-22",
        "student_id": "CW001",
        "name": "Ali",
        "time": "17:48:14",
        "status": "Present",
        "confidence": 94.0
    }
    """

    def __init__(self):

        db = get_database()

        self.collection = db["attendance"]

        # Prevent duplicate (date, student_id) pairs at the
        # database level too, not just in application logic.
        self.collection.create_index(
            [("date", 1), ("student_id", 1)],
            unique=True
        )

    def mark_attendance(
        self,
        student_id,
        name,
        confidence,
        status="Present"
    ):

        now = datetime.now()

        date = now.strftime("%Y-%m-%d")
        time = now.strftime("%H:%M:%S")

        existing = self.collection.find_one({
            "date": date,
            "student_id": student_id
        })

        if existing is not None:

            existing.pop("_id", None)

            return {
                "success": False,
                "already_marked": True,
                "record": existing
            }

        record = {
            "student_id": student_id,
            "name": name,
            "date": date,
            "time": time,
            "status": status,
            "confidence": round(confidence * 100, 2)
        }

        self.collection.insert_one(dict(record))

        return {
            "success": True,
            "already_marked": False,
            "record": record
        }

    def get_today_attendance(self):

        today = datetime.now().strftime("%Y-%m-%d")

        return self.get_by_date(today)

    def get_by_date(self, date):
        """
        Returns { student_id: record } for the given date.
        """

        records = {}

        for doc in self.collection.find({"date": date}):

            doc.pop("_id", None)

            records[doc["student_id"]] = doc

        return records

    def get_history_for_student(self, student_id):
        """
        Returns every attendance record for one student, across all
        dates. Used for a student's own attendance history/charts.
        """

        records = list(
            self.collection.find({"student_id": student_id})
        )

        for record in records:
            record.pop("_id", None)

        return records

    def mark_absent(
        self,
        student_id,
        name,
        date=None
    ):
        """
        Explicitly marks someone Absent for a given date (defaults
        to today). Meant to be run once, e.g. at end of day, for
        every registered student who never got marked Present.

        Won't overwrite an existing record (e.g. if they were
        already marked Present earlier that day).
        """

        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        existing = self.collection.find_one({
            "date": date,
            "student_id": student_id
        })

        if existing is not None:

            existing.pop("_id", None)

            return {
                "success": False,
                "already_marked": True,
                "record": existing
            }

        record = {
            "student_id": student_id,
            "name": name,
            "date": date,
            "time": None,
            "status": "Absent",
            "confidence": None
        }

        self.collection.insert_one(dict(record))

        return {
            "success": True,
            "already_marked": False,
            "record": record
        }