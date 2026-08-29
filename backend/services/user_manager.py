import sys
from datetime import datetime, timezone
from pathlib import Path

from pymongo.errors import DuplicateKeyError

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[1]
UTILS_DIR = PROJECT_ROOT / "ml" / "utils"
sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class UserManager:
    """Manage VisionAttend student and admin accounts in MongoDB."""

    ACCOUNT_DEFAULTS = {
        "email": None,
        "email_verified": False,
        "gender": None,
        "profile_photo": None,
        "auth_provider": "local",
        "google_sub": None,
        "is_active": True,
    }

    def __init__(self):
        db = get_database()
        self.collection = db["users"]
        self._ensure_schema()

    def _ensure_schema(self):
        now = datetime.now(timezone.utc)
        for field, default in self.ACCOUNT_DEFAULTS.items():
            self.collection.update_many({field: {"$exists": False}}, {"$set": {field: default}})
        self.collection.update_many({"created_at": {"$exists": False}}, {"$set": {"created_at": now}})
        self.collection.update_many({"updated_at": {"$exists": False}}, {"$set": {"updated_at": now}})
        self.collection.update_many({"last_login": {"$exists": False}}, {"$set": {"last_login": None}})

        # Preserve the existing username_1 index created by older versions.
        self.collection.create_index("username", unique=True)
        self.collection.create_index("email", unique=True, name="email_unique", partialFilterExpression={"email": {"$type": "string"}})
        self.collection.create_index("google_sub", unique=True, name="google_sub_unique", partialFilterExpression={"google_sub": {"$type": "string"}})

    @staticmethod
    def _clean_optional(value):
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    @staticmethod
    def _normalize_email(email):
        email = UserManager._clean_optional(email)
        return email.lower() if email else None

    def create_user(self, username, password_hash, role, student_id=None, name=None, email=None, gender=None, auth_provider="local", google_sub=None, email_verified=False, profile_photo=None):
        now = datetime.now(timezone.utc)
        username = str(username).strip()
        email = self._normalize_email(email)
        auth_provider = str(auth_provider or "local").strip().lower()

        if self.collection.find_one({"username": username}):
            return None
        if email and self.collection.find_one({"email": email}):
            raise ValueError("An account with this email already exists.")
        if google_sub and self.collection.find_one({"google_sub": google_sub}):
            raise ValueError("This Google account is already linked to an account.")

        doc = {
            "username": username, "password_hash": password_hash, "role": role,
            "student_id": student_id, "name": name, "email": email,
            "email_verified": bool(email_verified), "gender": self._clean_optional(gender),
            "profile_photo": profile_photo, "auth_provider": auth_provider,
            "google_sub": self._clean_optional(google_sub), "is_active": True,
            "created_at": now, "updated_at": now, "last_login": None,
        }
        try:
            self.collection.insert_one(dict(doc))
        except DuplicateKeyError as exc:
            raise ValueError("An account with one of these identifiers already exists.") from exc
        return doc

    def get_user(self, username_or_email):
        """Find an account by username or normalized email for local login and profile operations."""
        value = str(username_or_email).strip()
        if not value:
            return None
        user = self.collection.find_one({"username": value})
        if user is not None:
            return user
        return self.get_user_by_email(value)

    def get_user_by_username(self, username):
        return self.collection.find_one({"username": str(username).strip()})

    def get_user_by_email(self, email):
        email = self._normalize_email(email)
        return self.collection.find_one({"email": email}) if email else None

    def get_user_by_google_sub(self, google_sub):
        google_sub = self._clean_optional(google_sub)
        return self.collection.find_one({"google_sub": google_sub}) if google_sub else None

    def update_profile(self, username, name):
        result = self.collection.update_one({"username": username}, {"$set": {"name": name, "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def update_password(self, username, password_hash):
        result = self.collection.update_one({"username": username}, {"$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def update_email(self, username, email, verified=False):
        email = self._normalize_email(email)
        if email:
            existing = self.get_user_by_email(email)
            if existing and existing.get("username") != username:
                raise ValueError("An account with this email already exists.")
        result = self.collection.update_one({"username": username}, {"$set": {"email": email, "email_verified": bool(verified), "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def update_gender(self, username, gender):
        result = self.collection.update_one({"username": username}, {"$set": {"gender": self._clean_optional(gender), "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def update_profile_photo(self, username, profile_photo):
        result = self.collection.update_one({"username": username}, {"$set": {"profile_photo": profile_photo, "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def set_google_identity(self, username, google_sub):
        google_sub = self._clean_optional(google_sub)
        if not google_sub:
            raise ValueError("Google subject is required.")
        existing = self.get_user_by_google_sub(google_sub)
        if existing and existing.get("username") != username:
            raise ValueError("This Google account is already linked to another account.")
        result = self.collection.update_one({"username": username}, {"$set": {"google_sub": google_sub, "auth_provider": "both", "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def mark_login(self, username):
        result = self.collection.update_one({"username": username}, {"$set": {"last_login": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def set_email_verified(self, username, verified=True):
        result = self.collection.update_one({"username": username}, {"$set": {"email_verified": bool(verified), "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def set_active(self, username, is_active):
        result = self.collection.update_one({"username": username}, {"$set": {"is_active": bool(is_active), "updated_at": datetime.now(timezone.utc)}})
        return result.matched_count > 0

    def delete_student_account(self, student_id):
        result = self.collection.delete_one({"student_id": student_id, "role": "student"})
        return result.deleted_count > 0
