from datetime import date, datetime
from typing import Optional

from bson import ObjectId
from pymongo import ReturnDocument


DEFAULT_BALANCES = {
    "casual_leave": 12.0,
    "sick_leave": 7.0,
    "earned_leave": 20.0,
    "emergency_leave": 5.0,
}

TYPE_TO_FIELD = {
    "Casual Leave": "casual_leave",
    "Sick Leave": "sick_leave",
    "Earned Leave": "earned_leave",
    "Emergency Leave": "emergency_leave",
}


class LeaveManager:
    def __init__(self, db):
        self.balances = db["leave_balances"]
        self.requests = db["leave_requests"]
        self.balances.create_index("student_id", unique=True)
        self.requests.create_index([("student_id", 1), ("leave_date", -1)])
        self.requests.create_index([("status", 1), ("leave_date", -1)])

    def _ensure_balance(self, student_id: str):
        existing = self.balances.find_one({"student_id": student_id}, {"_id": 0})
        if existing:
            return existing
        doc = {"student_id": student_id, **DEFAULT_BALANCES, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
        self.balances.update_one({"student_id": student_id}, {"$setOnInsert": doc}, upsert=True)
        return self.balances.find_one({"student_id": student_id}, {"_id": 0})

    def get_balance(self, student_id: str):
        doc = self._ensure_balance(student_id)
        result = {}
        for label, field in TYPE_TO_FIELD.items():
            entitlement = DEFAULT_BALANCES[field]
            remaining = float(doc.get(field, entitlement))
            result[label] = {"entitlement": entitlement, "remaining": remaining, "used": round(entitlement - remaining, 1)}
        return result

    def create_request(self, student_id: str, leave_type: str, duration: str, leave_date: date, reason: str, half_day: Optional[str] = None):
        if leave_type not in TYPE_TO_FIELD:
            raise ValueError("Invalid leave type.")
        if duration not in {"Full Day", "Half Day"}:
            raise ValueError("Duration must be Full Day or Half Day.")
        if len(reason.strip()) < 8:
            raise ValueError("Reason must be at least 8 characters.")
        if duration == "Half Day":
            if leave_date != date.today():
                raise ValueError("Half-day leave can only be requested for today.")
            if half_day not in {"Morning", "Afternoon"}:
                raise ValueError("Choose Morning or Afternoon for a half-day leave.")
            amount = 0.5
        else:
            half_day = None
            if leave_date < date.today():
                raise ValueError("Full-day leave cannot be requested for a past date.")
            amount = 1.0

        duplicate = self.requests.find_one({"student_id": student_id, "leave_date": leave_date.isoformat(), "status": {"$in": ["Pending", "Approved", "pending", "approved"]}})
        if duplicate:
            raise ValueError("A leave request already exists for this date.")

        field = TYPE_TO_FIELD[leave_type]
        balance = self._ensure_balance(student_id)
        if float(balance.get(field, 0)) < amount:
            raise ValueError(f"Insufficient {leave_type} balance.")

        updated = self.balances.find_one_and_update({"student_id": student_id, field: {"$gte": amount}}, {"$inc": {field: -amount}, "$set": {"updated_at": datetime.utcnow()}}, return_document=ReturnDocument.AFTER, projection={"_id": 0})
        if not updated:
            raise ValueError(f"Insufficient {leave_type} balance.")

        doc = {
            "student_id": student_id,
            "leave_type": leave_type,
            "duration": duration,
            "half_day": half_day,
            "leave_date": leave_date.isoformat(),
            "amount": amount,
            "reason": reason.strip(),
            "status": "Pending",
            "admin_note": "",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        try:
            inserted = self.requests.insert_one(doc)
        except Exception:
            self.balances.update_one({"student_id": student_id}, {"$inc": {field: amount}, "$set": {"updated_at": datetime.utcnow()}})
            raise
        doc["leave_id"] = str(inserted.inserted_id)
        doc.pop("_id", None)
        return doc

    def get_student_requests(self, student_id: str):
        docs = list(self.requests.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1))
        return docs

    def get_all_requests(self, status: Optional[str] = None):
        query = {}
        if status and status.lower() != "all":
            query["status"] = status.title()
        docs = []
        for doc in self.requests.find(query).sort("created_at", -1):
            doc["leave_id"] = str(doc.pop("_id"))
            docs.append(doc)
        return docs

    def update_request(self, leave_id: str, status: str, admin_note: str = ""):
        status = status.title()
        if status not in {"Approved", "Rejected"}:
            raise ValueError("Status must be Approved or Rejected.")
        try:
            oid = ObjectId(leave_id)
        except Exception:
            raise ValueError("Invalid leave request ID.")
        request = self.requests.find_one({"_id": oid})
        if not request:
            raise ValueError("Leave request not found.")
        if request.get("status") != "Pending":
            raise ValueError("This leave request has already been processed.")

        self.requests.update_one({"_id": oid}, {"$set": {"status": status, "admin_note": admin_note.strip(), "updated_at": datetime.utcnow()}})
        if status == "Rejected":
            field = TYPE_TO_FIELD.get(request.get("leave_type"))
            if field:
                self.balances.update_one({"student_id": request["student_id"]}, {"$inc": {field: float(request.get("amount", 1))}, "$set": {"updated_at": datetime.utcnow()}})
        result = self.requests.find_one({"_id": oid}, {"_id": 0})
        result["leave_id"] = leave_id
        return result
