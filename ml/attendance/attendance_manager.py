import sys
from pathlib import Path
from datetime import datetime

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class AttendanceManager:
    """MongoDB-backed, session-based attendance manager."""

    def __init__(self):
        db = get_database()
        self.collection = db["attendance"]

        # Remove the old day-based unique index. It prevented a student
        # from attending more than one session on the same day.
        try:
            for index in self.collection.list_indexes():
                key = list(index.get("key", {}).items())
                if (
                    index.get("unique") is True
                    and key == [("date", 1), ("student_id", 1)]
                ):
                    self.collection.drop_index(index["name"])
        except Exception as exc:
            print(f"[ATTENDANCE] Index migration warning: {exc}")

        # Atlas does not support $ne inside a partial index expression.
        # $exists is enough because all new session attendance records
        # always contain a non-empty session_id.
        self.collection.create_index(
            [("session_id", 1), ("student_id", 1)],
            unique=True,
            partialFilterExpression={
                "session_id": {"$exists": True}
            },
            name="session_id_student_id_unique"
        )

    def mark_attendance(self, student_id, name, confidence,
                        status="Present", session_id=None):
        if not session_id:
            return {
                "success": False,
                "already_marked": False,
                "record": None,
                "error": "session_id is required for attendance"
            }

        now = datetime.now()
        date = now.strftime("%Y-%m-%d")
        time = now.strftime("%H:%M:%S")

        existing = self.collection.find_one({
            "session_id": session_id,
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
            "confidence": round(confidence * 100, 2),
            "session_id": session_id
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
        """Return the latest attendance record for each student on a date."""
        records = {}

        cursor = self.collection.find({"date": date}).sort([
            ("time", -1),
            ("_id", -1)
        ])

        for doc in cursor:
            doc.pop("_id", None)
            if doc["student_id"] not in records:
                records[doc["student_id"]] = doc

        return records

    def get_by_session(self, session_id):
        records = {}
        for doc in self.collection.find({"session_id": session_id}):
            doc.pop("_id", None)
            records[doc["student_id"]] = doc
        return records

    def get_history_for_student(self, student_id):
        records = list(
            self.collection.find({"student_id": student_id}).sort([
                ("date", -1),
                ("time", -1),
                ("_id", -1)
            ])
        )

        for record in records:
            record.pop("_id", None)

        return records

    def mark_absent(self, student_id, name, date=None, session_id=None):
        """Mark a student absent for one specific session."""
        if not session_id:
            return {
                "success": False,
                "already_marked": False,
                "record": None,
                "error": "session_id is required for absence"
            }

        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        existing = self.collection.find_one({
            "session_id": session_id,
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
            "confidence": None,
            "session_id": session_id
        }

        self.collection.insert_one(dict(record))

        return {
            "success": True,
            "already_marked": False,
            "record": record
        }
