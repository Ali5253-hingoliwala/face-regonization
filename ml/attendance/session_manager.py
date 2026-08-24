import sys
from pathlib import Path
from datetime import datetime
from bson import ObjectId

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class SessionManager:
    """MongoDB-backed lecture session manager."""

    def __init__(self):
        db = get_database()
        self.collection = db["sessions"]

    def create_session(self, name=None, planned_start_time=None, duration_minutes=45, late_after_minutes=10):
        is_immediate = planned_start_time is None
        now = datetime.now()

        if not is_immediate and planned_start_time <= now:
            raise ValueError("A scheduled session must be set for a future date and time.")

        start_time = now if is_immediate else planned_start_time
        clean_name = (name or "").strip() or "Untitled Session"

        if is_immediate:
            self.collection.update_many(
                {"status": "active"},
                {"$set": {"status": "closed", "ended_at": now}}
            )

        session_doc = {
            "name": clean_name,
            "start_time": start_time,
            "planned_start_time": planned_start_time or start_time,
            "duration_minutes": duration_minutes,
            "late_after_minutes": late_after_minutes,
            "status": "active" if is_immediate else "scheduled"
        }

        if is_immediate:
            session_doc["activated_at"] = now

        result = self.collection.insert_one(session_doc)
        return self._to_public(session_doc, result.inserted_id)

    def activate_session(self, session_id):
        try:
            object_id = ObjectId(session_id)
        except Exception:
            return {"success": False, "message": "Invalid session ID."}

        doc = self.collection.find_one({"_id": object_id})
        if doc is None:
            return {"success": False, "message": "Session not found."}

        if doc["status"] == "active":
            return {"success": True, "session": self._to_public(doc, doc["_id"])}

        if doc["status"] != "scheduled":
            return {"success": False, "message": "Session is no longer schedulable."}

        now = datetime.now()
        self.collection.update_many(
            {"status": "active"},
            {"$set": {"status": "closed", "ended_at": now}}
        )

        self.collection.update_one(
            {"_id": object_id},
            {"$set": {"status": "active", "activated_at": now, "start_time": now}}
        )

        doc["status"] = "active"
        doc["start_time"] = now
        doc["activated_at"] = now

        return {"success": True, "session": self._to_public(doc, doc["_id"])}

    def cancel_session(self, session_id):
        try:
            object_id = ObjectId(session_id)
        except Exception:
            return {"success": False}
        result = self.collection.delete_one({"_id": object_id, "status": "scheduled"})
        return {"success": result.deleted_count > 0}

    def end_session(self, session_id=None):
        if session_id is None:
            active = self.collection.find_one({"status": "active"})
        else:
            try:
                object_id = ObjectId(session_id)
            except Exception:
                return {"success": False, "message": "Invalid session ID."}
            active = self.collection.find_one({"_id": object_id, "status": "active"})

        if active is None:
            return {"success": False, "message": "No active session to end."}

        ended_at = datetime.now()
        self.collection.update_one(
            {"_id": active["_id"]},
            {"$set": {"status": "closed", "ended_at": ended_at}}
        )
        active["status"] = "closed"
        active["ended_at"] = ended_at
        return {"success": True, "session": self._to_public(active, active["_id"])}

    def get_current_session(self):
        doc = self.collection.find_one({"status": "active"})
        return None if doc is None else self._to_public(doc, doc["_id"])

    def get_scheduled_sessions(self):
        docs = self.collection.find({"status": "scheduled"}).sort("planned_start_time", 1)
        return [self._to_public(doc, doc["_id"]) for doc in docs]

    def get_session_history(self, limit=100):
        docs = self.collection.find({"status": "closed"}).sort("start_time", -1).limit(limit)
        return [self._to_public(doc, doc["_id"]) for doc in docs]

    def get_status_for_time(self, session, check_time=None):
        if check_time is None:
            check_time = datetime.now()
        elapsed_minutes = (check_time - session["start_time"]).total_seconds() / 60
        if elapsed_minutes <= session["late_after_minutes"]:
            return "Present"
        if elapsed_minutes <= session["duration_minutes"]:
            return "Late"
        return None

    def _to_public(self, doc, object_id):
        planned = doc.get("planned_start_time") or doc.get("start_time")
        return {
            "session_id": str(object_id),
            "name": doc.get("name", "Untitled Session"),
            "start_time": doc["start_time"],
            "planned_start_time": planned,
            "duration_minutes": doc["duration_minutes"],
            "late_after_minutes": doc["late_after_minutes"],
            "status": doc["status"],
            "activated_at": doc.get("activated_at").isoformat() if doc.get("activated_at") else None,
            "ended_at": doc.get("ended_at").isoformat() if doc.get("ended_at") else None,
        }
