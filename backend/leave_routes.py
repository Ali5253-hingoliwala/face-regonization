from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import get_current_user, require_admin
from mongo_client import get_database

router = APIRouter()
db = get_database()
leaves = db["leave_requests"]
sessions = db["sessions"]

LEAVE_TYPES = {"Sick Leave", "Casual Leave", "Emergency Leave", "Other"}
DURATIONS = {"Full Day", "Half Day"}
HALF_DAYS = {"Morning", "Afternoon"}
STATUSES = {"Pending", "Approved", "Rejected"}

class LeaveCreateRequest(BaseModel):
    leave_type: str = Field(min_length=1, max_length=40)
    duration: str = Field(min_length=1, max_length=20)
    half_day: str | None = Field(default=None, max_length=20)
    leave_date: str = Field(min_length=10, max_length=10)
    reason: str = Field(min_length=5, max_length=500)

class LeaveDecisionRequest(BaseModel):
    status: str = Field(min_length=1, max_length=20)
    admin_note: str | None = Field(default=None, max_length=500)


def _validate_leave(request: LeaveCreateRequest):
    if request.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=422, detail="Invalid leave type.")
    if request.duration not in DURATIONS:
        raise HTTPException(status_code=422, detail="Invalid leave duration.")
    if request.duration == "Half Day" and request.half_day not in HALF_DAYS:
        raise HTTPException(status_code=422, detail="Half-day must be Morning or Afternoon.")
    if request.duration == "Full Day" and request.half_day is not None:
        raise HTTPException(status_code=422, detail="Half-day selection is only valid for half-day leave.")
    try:
        requested_date = date.fromisoformat(request.leave_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Leave date must be YYYY-MM-DD.")
    if requested_date < date.today():
        raise HTTPException(status_code=422, detail="Leave date cannot be in the past.")
    return requested_date


def _serialize(doc):
    return {
        "leave_id": doc["leave_id"],
        "student_id": doc["student_id"],
        "student_name": doc["student_name"],
        "leave_type": doc["leave_type"],
        "duration": doc["duration"],
        "half_day": doc.get("half_day"),
        "leave_date": doc["leave_date"],
        "reason": doc["reason"],
        "status": doc["status"],
        "admin_note": doc.get("admin_note"),
        "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
        "decided_at": doc["decided_at"].isoformat() if isinstance(doc.get("decided_at"), datetime) else doc.get("decided_at"),
    }


@router.post("/leave")
def create_leave(request: LeaveCreateRequest, user=Depends(get_current_user)):
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only student accounts can submit leave requests.")
    requested_date = _validate_leave(request)

    existing = leaves.find_one({
        "student_id": user["student_id"],
        "leave_date": request.leave_date,
        "status": "Pending",
    })
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending leave request for this date.")

    # Avoid duplicate approved requests for the same student/date.
    approved = leaves.find_one({
        "student_id": user["student_id"],
        "leave_date": request.leave_date,
        "status": "Approved",
    })
    if approved:
        raise HTTPException(status_code=409, detail="Leave is already approved for this date.")

    doc = {
        "leave_id": uuid4().hex,
        "student_id": user["student_id"],
        "student_name": user.get("name") or user["student_id"],
        "leave_type": request.leave_type,
        "duration": request.duration,
        "half_day": request.half_day,
        "leave_date": requested_date.isoformat(),
        "reason": request.reason.strip(),
        "status": "Pending",
        "admin_note": None,
        "created_at": datetime.now(),
        "decided_at": None,
    }
    leaves.insert_one(doc)
    return {"success": True, "request": _serialize(doc)}


@router.get("/leave/mine")
def get_my_leaves(user=Depends(get_current_user)):
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student leave endpoint only.")
    docs = leaves.find({"student_id": user["student_id"]}).sort([("leave_date", -1), ("created_at", -1)])
    return {"count": leaves.count_documents({"student_id": user["student_id"]}), "requests": [_serialize(d) for d in docs]}


@router.get("/admin/leaves")
def get_all_leaves(admin=Depends(require_admin)):
    docs = leaves.find({}).sort([("status", 1), ("leave_date", 1), ("created_at", -1)])
    return {"count": leaves.count_documents({}), "pending_count": leaves.count_documents({"status": "Pending"}), "requests": [_serialize(d) for d in docs]}


@router.put("/admin/leaves/{leave_id}")
def decide_leave(leave_id: str, request: LeaveDecisionRequest, admin=Depends(require_admin)):
    if request.status not in {"Approved", "Rejected"}:
        raise HTTPException(status_code=422, detail="Decision must be Approved or Rejected.")
    doc = leaves.find_one({"leave_id": leave_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if doc["status"] != "Pending":
        raise HTTPException(status_code=409, detail="This leave request has already been decided.")

    result = leaves.update_one(
        {"leave_id": leave_id, "status": "Pending"},
        {"$set": {"status": request.status, "admin_note": (request.admin_note or "").strip() or None, "decided_at": datetime.now(), "decided_by": admin.get("sub")}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Leave request was already updated.")
    updated = leaves.find_one({"leave_id": leave_id})
    return {"success": True, "request": _serialize(updated)}


@router.get("/notifications")
def get_notifications(user=Depends(get_current_user)):
    """Return fresh server-side notifications for the current role."""
    items = []
    now = datetime.now()
    cutoff = now + timedelta(days=14)

    active = sessions.find_one({"status": "active"}, sort=[("start_time", -1)])
    if active:
        items.append({
            "id": f"live-{active['session_id']}",
            "title": "Live session started",
            "text": f"{active.get('name', 'Attendance session')} is currently active.",
            "kind": "live",
        })

    upcoming = sessions.find({
        "status": "scheduled",
        "planned_start_time": {"$gte": now, "$lte": cutoff},
    }).sort("planned_start_time", 1).limit(10)
    for session in upcoming:
        planned = session.get("planned_start_time")
        items.append({
            "id": f"scheduled-{session['session_id']}",
            "title": "Session scheduled",
            "text": f"{session.get('name', 'Attendance session')} is scheduled for {planned.strftime('%d %b %Y, %I:%M %p') if isinstance(planned, datetime) else planned}.",
            "kind": "scheduled",
        })

    if user.get("role") == "admin":
        pending = leaves.count_documents({"status": "Pending"})
        if pending:
            items.insert(0, {"id": "leave-pending", "title": "Leave requests pending", "text": f"{pending} leave request{'s' if pending != 1 else ''} need your review.", "kind": "system"})
    else:
        recent = leaves.find({"student_id": user["student_id"], "status": {"$in": ["Approved", "Rejected"]}}).sort("decided_at", -1).limit(10)
        for leave in recent:
            status = leave["status"]
            items.insert(0, {
                "id": f"leave-{leave['leave_id']}-{status.lower()}",
                "title": f"Leave {status.lower()}",
                "text": f"Your {leave['leave_type'].lower()} request for {leave['leave_date']} was {status.lower()}." + (f" Admin note: {leave['admin_note']}" if leave.get("admin_note") else ""),
                "kind": "attendance" if status == "Approved" else "system",
            })
    return {"count": len(items), "notifications": items}
