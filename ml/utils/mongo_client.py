import os
from pathlib import Path

from pymongo import MongoClient
from dotenv import load_dotenv


# ============================================================
# Load environment variables from the project's .env file
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(ENV_PATH)

MONGO_URI = os.getenv("MONGODB_URI")

if not MONGO_URI:

    raise RuntimeError(
        "MONGODB_URI not found.\n"
        "Create a .env file in the project root "
        "(same folder as requirements.txt) containing:\n\n"
        "MONGODB_URI=your_connection_string_here\n"
    )


# ============================================================
# Single shared MongoDB client for the whole project
# ============================================================

_client = MongoClient(MONGO_URI)

DATABASE_NAME = "visionattend"

_db = _client[DATABASE_NAME]


def get_database():
    """
    Returns the shared VisionAttend database object.
    Used by FaceDatabase and AttendanceManager.
    """

    return _db