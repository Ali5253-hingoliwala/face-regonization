from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import get_current_user, require_admin
from backend.leave_manager import LeaveManager
from ml.utils.mongo_client import get_database

router = APIRouter()
leave_manager = LeaveManager(get_database())


class LeaveRequestBody(BaseModel):
    leave_type: str = Field(min_length=1, max_length=40)
    duration: str = Field(min_length=1, max_length=20)
    half_day: str | None = Field(default=None, max_length=20)
    leave_date: str = Field(min_length=10, max_length=10, pattern=r"^\d{4}-\d{2}-\d{2}$")
    reason: str = Field(min_length=8, max_length=500)


class LeaveDecisionBody(BaseModel):
    status: str = Field(min_length=1, max_length=20)
    admin_note: str = Field(default="", max_length=500)


def _student(user):
    if user.get("role") != "student" or not user.get("student_id"):
        raise HTTPException(status_code=403, detail="This endpoint is for student accounts only.")
    return user["student_id"]


@router.get("/leave/balance")
def get_leave_balance(user=Depends(get_current_user)):
    student_id = _student(user)
    return {"student_id": student_id, "balances": leave_manager.get_balance(student_id)}


@router.post("/leave")
def apply_leave(request: LeaveRequestBody, user=Depends(get_current_user)):
    student_id = _student(user)
    try:
        leave_date = date.fromisoformat(request.leave_date)
        result = leave_manager.create_request(student_id, request.leave_type, request.duration, leave_date, request.reason, request.half_day)
        return {"success": True, "request": result, "balances": leave_manager.get_balance(student_id)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/leave/mine")
def get_my_leave_requests(user=Depends(get_current_user)):
    student_id = _student(user)
    return {"student_id": student_id, "requests": leave_manager.get_student_requests(student_id), "balances": leave_manager.get_balance(student_id)}


@router.get("/admin/leaves")
def get_admin_leaves(status: str = "all", admin=Depends(require_admin)):
    requests = leave_manager.get_all_requests(status)
    users = get_database()["users"]
    for item in requests:
        account = users.find_one({"student_id": item.get("student_id"), "role": "student"}, {"_id": 0, "password_hash": 0})
        item["student_name"] = account.get("name") if account else item.get("student_id")
    return {"count": len(requests), "requests": requests}


@router.put("/admin/leaves/{leave_id}")
def decide_leave(leave_id: str, request: LeaveDecisionBody, admin=Depends(require_admin)):
    try:
        updated = leave_manager.update_request(leave_id, request.status, request.admin_note)
        return {"success": True, "request": updated}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/admin/leaves/balance/{student_id}")
def get_student_leave_balance(student_id: str, admin=Depends(require_admin)):
    return {"student_id": student_id, "balances": leave_manager.get_balance(student_id)}
