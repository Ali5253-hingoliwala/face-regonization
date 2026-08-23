import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[1]

UTILS_DIR = PROJECT_ROOT / "ml" / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class UserManager:
    """
    Manages login accounts (both student and admin roles) in
    MongoDB. Separate from FaceDatabase — a face registration and
    a login account are two different things. A student needs
    BOTH: a registered face (to be recognized by the camera) and
    a user account (to log into the dashboard).
    """

    def __init__(self):

        db = get_database()

        self.collection = db["users"]

        self.collection.create_index("username", unique=True)

    def create_user(
        self,
        username,
        password_hash,
        role,
        student_id=None,
        name=None
    ):
        """
        Returns the created user dict, or None if the username
        already exists.
        """

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
        """
        Returns the raw user document (including password_hash),
        or None if it doesn't exist. Only ever used internally by
        the login/signup logic — never returned directly to a
        client.
        """

        return self.collection.find_one({"username": username})