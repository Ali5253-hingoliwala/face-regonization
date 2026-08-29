"""One-time local helper for restoring an administrator account.

Run from the project root with the virtualenv active:
    python backend/services/admin_bootstrap.py

This intentionally is a local CLI, not an HTTP endpoint.
"""
from getpass import getpass
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[1]
sys.path.append(str(CURRENT_DIR))

from auth_utils import hash_password
from user_manager import UserManager


def main():
    manager = UserManager()
    username = input("Admin username: ").strip()
    email = input("Admin email: ").strip().lower()
    name = input("Admin name: ").strip()
    password = getpass("Admin password: ")
    confirm = getpass("Confirm password: ")

    if not username or not email or not name:
        raise SystemExit("Username, email, and name are required.")
    if password != confirm:
        raise SystemExit("Passwords do not match.")
    if len(password.encode("utf-8")) < 6:
        raise SystemExit("Password must be at least 6 characters.")
    if len(password.encode("utf-8")) > 72:
        raise SystemExit("Password is too long (maximum 72 UTF-8 bytes).")

    existing = manager.get_user_by_username(username)
    if existing:
        if existing.get("role") != "admin":
            raise SystemExit("That username belongs to a non-admin account. Refusing to elevate it.")
        manager.update_password(username, hash_password(password))
        manager.update_email(username, email, verified=True)
        manager.update_profile(username, name)
        print("Existing admin account updated successfully.")
        return

    if manager.get_user_by_email(email):
        raise SystemExit("That email is already associated with another account.")

    manager.create_user(
        username=username,
        password_hash=hash_password(password),
        role="admin",
        name=name,
        email=email,
        email_verified=True,
        auth_provider="local",
    )
    print("Admin account created successfully.")


if __name__ == "__main__":
    main()
