import os
from pathlib import Path
from datetime import datetime, timedelta

from dotenv import load_dotenv
import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[1]

load_dotenv(PROJECT_ROOT / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:

    raise RuntimeError(
        "JWT_SECRET_KEY not found.\n"
        "Add this line to your .env file (project root):\n"
        "JWT_SECRET_KEY=some-long-random-string\n"
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12

security = HTTPBearer()


def hash_password(password):

    # bcrypt has a hard 72-byte input limit -- truncate defensively
    # so an unusually long password doesn't raise an error.
    password_bytes = password.encode("utf-8")[:72]

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(password, password_hash):

    password_bytes = password.encode("utf-8")[:72]

    return bcrypt.checkpw(
        password_bytes,
        password_hash.encode("utf-8")
    )


def create_access_token(username, role, student_id=None, name=None):

    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)

    payload = {
        "sub": username,
        "role": role,
        "student_id": student_id,
        "name": name,
        "exp": expire
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token):

    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    except JWTError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    FastAPI dependency — validates the bearer token and returns
    its payload: {"sub": username, "role": ..., "student_id": ...}
    Use this on any endpoint that just needs "someone logged in".
    """

    payload = decode_token(credentials.credentials)

    if payload is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )

    return payload


def require_admin(user=Depends(get_current_user)):
    """
    FastAPI dependency — same as get_current_user, but also
    rejects non-admin accounts. Use this on admin-only endpoints.
    """

    if user["role"] != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )

    return user