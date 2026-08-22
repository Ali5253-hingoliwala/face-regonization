import sys
from pathlib import Path
from datetime import datetime
from bson import ObjectId

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class SessionManager:
    """
    Manages lecture sessions in MongoDB.

    A session can be:
    - Created immediately (status="active", start_time=now) — the
      original "just start now" behavior.
    - Scheduled ahead of time (status="scheduled", start_time=the
      planned time) with a name, then activated later by a teacher
      clicking "Start Now" -- at which point it becomes "active"
      but KEEPS its originally planned start_time as the reference
      for Present/Late calculations, even if actually started a
      little early or late.

    Only one session can be "active" at a time.
    """

    def __init__(self):

        db = get_database()

        self.collection = db["sessions"]

    def create_session(
        self,
        name=None,
        planned_start_time=None,
        duration_minutes=45,
        late_after_minutes=10
    ):
        """
        If planned_start_time is None, creates and immediately
        activates a session (old "start now" behavior).

        If planned_start_time is given, creates it as "scheduled"
        only -- it must be activated later via activate_session().
        """

        is_immediate = planned_start_time is None

        start_time = (
            datetime.now() if is_immediate else planned_start_time
        )

        if is_immediate:

            # Close any other active session first.
            self.collection.update_many(
                {"status": "active"},
                {"$set": {"status": "closed"}}
            )

        session_doc = {
            "name": name or "Untitled Session",
            "start_time": start_time,
            "duration_minutes": duration_minutes,
            "late_after_minutes": late_after_minutes,
            "status": "active" if is_immediate else "scheduled"
        }

        result = self.collection.insert_one(session_doc)

        return self._to_public(session_doc, result.inserted_id)

    def activate_session(self, session_id):
        """
        Activates a previously scheduled session. Keeps its
        originally planned start_time as the reference point.
        """

        doc = self.collection.find_one({"_id": ObjectId(session_id)})

        if doc is None:

            return {
                "success": False,
                "message": "Session not found."
            }

        if doc["status"] == "active":

            return {
                "success": True,
                "session": self._to_public(doc, doc["_id"])
            }

        # Close any other active session first — only one at a time.
        self.collection.update_many(
            {"status": "active"},
            {"$set": {"status": "closed"}}
        )

        self.collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": "active"}}
        )

        doc["status"] = "active"

        return {
            "success": True,
            "session": self._to_public(doc, doc["_id"])
        }

    def cancel_session(self, session_id):
        """
        Cancels a scheduled (not yet started) session.
        """

        result = self.collection.delete_one({
            "_id": ObjectId(session_id),
            "status": "scheduled"
        })

        return {"success": result.deleted_count > 0}

    def end_session(self):

        active = self.collection.find_one({"status": "active"})

        if active is None:

            return {
                "success": False,
                "message": "No active session to end."
            }

        self.collection.update_one(
            {"_id": active["_id"]},
            {"$set": {"status": "closed"}}
        )

        return {
            "success": True,
            "session": self._to_public(active, active["_id"])
        }

    def get_current_session(self):

        doc = self.collection.find_one({"status": "active"})

        if doc is None:
            return None

        return self._to_public(doc, doc["_id"])

    def get_scheduled_sessions(self):
        """
        Returns all sessions waiting to be started, soonest first.
        """

        docs = self.collection.find(
            {"status": "scheduled"}
        ).sort("start_time", 1)

        return [
            self._to_public(doc, doc["_id"])
            for doc in docs
        ]

    def get_status_for_time(self, session, check_time=None):
        """
        Returns "Present", "Late", or None (session already over)
        based on how many minutes have passed since the session's
        reference start_time.
        """

        if check_time is None:
            check_time = datetime.now()

        elapsed_minutes = (
            (check_time - session["start_time"]).total_seconds() / 60
        )

        if elapsed_minutes <= session["late_after_minutes"]:
            return "Present"

        elif elapsed_minutes <= session["duration_minutes"]:
            return "Late"

        else:
            return None

    def _to_public(self, doc, object_id):

        return {
            "session_id": str(object_id),
            "name": doc.get("name", "Untitled Session"),
            "start_time": doc["start_time"],
            "duration_minutes": doc["duration_minutes"],
            "late_after_minutes": doc["late_after_minutes"],
            "status": doc["status"]
        }