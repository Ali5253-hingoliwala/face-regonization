"""Account security primitives shared by future email/2FA flows."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument

from mongo_client import get_database


class AccountSecurity:
    def __init__(self):
        self.collection = get_database()["account_security_tokens"]
        self.collection.create_index("expires_at", expireAfterSeconds=0)
        self.collection.create_index([("username", 1), ("purpose", 1)])

    @staticmethod
    def _hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def issue(self, username: str, purpose: str, ttl_minutes: int = 10, metadata=None):
        raw = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        self.collection.delete_many({"username": username, "purpose": purpose})
        self.collection.insert_one({"username": username, "purpose": purpose, "token_hash": self._hash(raw), "metadata": metadata or {}, "created_at": now, "expires_at": now + timedelta(minutes=ttl_minutes)})
        return raw

    def consume(self, token: str, purpose: str):
        now = datetime.now(timezone.utc)
        return self.collection.find_one_and_delete({"token_hash": self._hash(token), "purpose": purpose, "expires_at": {"$gt": now}}, projection={"username": 1, "metadata": 1, "_id": 0}, return_document=ReturnDocument.BEFORE)
