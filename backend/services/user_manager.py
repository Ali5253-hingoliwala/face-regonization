import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[1]
UTILS_DIR = PROJECT_ROOT / "ml" / "utils"
sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class UserManager:
    """Manage student and admin login accounts in MongoDB."""

    def __init__(self):
        db = get_database()
        self.collection = db["users"]
        self.collection.create_index("username", unique=True)

    def create_user(self, username, password_hash, role, student_id=None, name=None):
        if self.collection.find_one({"username": username}):
            return None

        doc = {
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "student_id": student_id,
            "name": name
        }

        self.collection.insert_one(dict(doc))
        return doc

    def get_user(self, username):
        return self.collection.find_one({"username": username})

    def delete_student_account(self, student_id):
        result = self.collection.delete_one({
            "student_id": student_id,
            "role": "student"
        })
        return result.deleted_count > 0
