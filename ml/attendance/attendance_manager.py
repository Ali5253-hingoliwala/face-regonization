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

    Public method names (mark_attendance, get_today_attendance) are
    kept identical to the original JSON-file version, so nothing else
    in the project needs to change.

    One document per attendance record, e.g.:
    {
        "date": "2026-08-20",
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
        confidence
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
            "status": "Present",
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
        Returns { student_id: record } for the given date,
        matching the shape the original JSON file used.
        """

        records = {}

        for doc in self.collection.find({"date": date}):

            doc.pop("_id", None)

            records[doc["student_id"]] = doc

        return records