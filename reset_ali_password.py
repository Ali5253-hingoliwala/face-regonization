import os
import getpass
from dotenv import load_dotenv
from pymongo import MongoClient
from passlib.context import CryptContext

load_dotenv()

uri = os.getenv("MONGODB_URI")
if not uri:
    raise RuntimeError("MONGODB_URI is missing from .env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

username = "CW001"
new_password = getpass.getpass("Enter new temporary password for Ali: ")

if len(new_password.encode("utf-8")) > 72:
    raise ValueError("Password is too long for bcrypt (maximum 72 bytes).")

client = MongoClient(uri, serverSelectionTimeoutMS=5000)

try:
    db = client["visionattend"]
    users = db["users"]

    user = users.find_one({"username": username})

    if not user:
        print(f"User '{username}' was not found.")
    else:
        password_hash = pwd_context.hash(new_password)

        result = users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": password_hash}}
        )

        if result.modified_count == 1:
            print(f"Password successfully reset for '{username}'.")
        else:
            print("Password was not modified.")

finally:
    client.close()