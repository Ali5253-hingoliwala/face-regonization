import json
from pathlib import Path
from datetime import datetime


class AttendanceManager:

    def __init__(self):

        project_root = Path(__file__).resolve().parents[2]

        self.file_path = (
            project_root
            / "database"
            / "attendance.json"
        )

        self.file_path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        if not self.file_path.exists():
            self.save({})

    def load(self):

        with open(
            self.file_path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    def save(self, data):

        with open(
            self.file_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                data,
                file,
                indent=4
            )

    def mark_attendance(
        self,
        student_id,
        name,
        confidence
    ):

        data = self.load()

        now = datetime.now()

        date = now.strftime("%Y-%m-%d")
        time = now.strftime("%H:%M:%S")

        if date not in data:
            data[date] = {}

        # Prevent duplicate attendance
        if student_id in data[date]:

            return {
                "success": False,
                "already_marked": True,
                "record": data[date][student_id]
            }

        record = {
            "student_id": student_id,
            "name": name,
            "date": date,
            "time": time,
            "status": "Present",
            "confidence": round(
                confidence * 100,
                2
            )
        }

        data[date][student_id] = record

        self.save(data)

        return {
            "success": True,
            "already_marked": False,
            "record": record
        }

    def get_today_attendance(self):

        data = self.load()

        today = datetime.now().strftime(
            "%Y-%m-%d"
        )

        return data.get(today, {})

    def get_by_date(self, date):
        """
        Returns { student_id: record } for the given date.
        (Needed by backend/main.py's /attendance/{date} route.)
        """

        data = self.load()

        return data.get(date, {})

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
        """

        data = self.load()

        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        if date not in data:
            data[date] = {}

        # Don't overwrite an existing record (e.g. if they were
        # already marked Present earlier that day).
        if student_id in data[date]:

            return {
                "success": False,
                "already_marked": True,
                "record": data[date][student_id]
            }

        record = {
            "student_id": student_id,
            "name": name,
            "date": date,
            "time": None,
            "status": "Absent",
            "confidence": None
        }

        data[date][student_id] = record

        self.save(data)

        return {
            "success": True,
            "already_marked": False,
            "record": record
        }