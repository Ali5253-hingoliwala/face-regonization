import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi
import certifi


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent
ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(ENV_PATH)

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    print("❌ MONGODB_URI not found")
    print("Expected:", ENV_PATH)
    raise SystemExit


print("✅ MONGODB_URI loaded")


# ============================================================
# CONNECT TO ATLAS
# ============================================================

try:

    client = MongoClient(
        MONGODB_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        server_api=ServerApi("1"),
        serverSelectionTimeoutMS=10000,
    )

    # Force connection
    client.admin.command("ping")

    print("✅ MongoDB Atlas connection successful!")

    # Select our database
    db = client["visionattend"]

    print("✅ Database:", db.name)

    print("📁 Collections:")
    collections = db.list_collection_names()

    if collections:
        for collection in collections:
            print("   -", collection)
    else:
        print("   (none yet)")

    client.close()

except Exception as e:

    print("\n❌ MongoDB Atlas connection failed:")
    print(type(e).__name__)
    print(e)