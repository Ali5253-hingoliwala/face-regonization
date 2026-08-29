"""Create or update the initial VisionAttend admin account locally.

This is intentionally a CLI script rather than a public API endpoint. Run it from
an activated project virtual environment. It never stores or prints the password.
"""

import getpass
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVICES_DIR = PROJECT_ROOT / "backend" / "services"
sys.path.append(str(SERVICES_DIR))

from auth_utils import hash_password
from user_manager import UserManager

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def main():
    print("\nVisionAttend Admin Bootstrap")
    print("----------------------------")
    print("This creates an admin account directly in the users collection.\n")

    username = input("Admin username: ").strip()
    if not username or not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", username):
        print("Invalid username. Use 1-32 letters, numbers, _ or -.")
        return 1

    email = input("Admin email: ").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        print("Invalid email address.")
        return 1

    name = input("Admin name: ").strip()
    if len(name) < 2:
        print("Name must contain at least 2 characters.")
        return 1

    password = getpass.getpass("Admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match.")
        return 1
    if len(password.encode("utf-8")) < 8:
        print("Admin password must be at least 8 characters.")
        return 1
    if len(password.encode("utf-8")) > 72:
        print("Admin password is too long (maximum 72 UTF-8 bytes).")
        return 1

    manager = UserManager()
    existing = manager.get_user_by_username(username)

    if existing is not None:
        if existing.get("role") != "admin":
            print("That username already belongs to a non-admin account. Choose another username.")
            return 1
        manager.update_password(username, hash_password(password))
        manager.update_profile(username, name)
        manager.update_email(username, email, verified=False)
        manager.set_active(username, True)
        print(f"Admin account '{username}' updated successfully.")
        return 0

    existing_email = manager.get_user_by_email(email)
    if existing_email is not None:
        print("That email is already linked to another account. Choose another email.")
        return 1

    manager.create_user(
        username=username,
        password_hash=hash_password(password),
        role="admin",
        student_id=None,
        name=name,
        email=email,
        gender=None,
        auth_provider="local",
        google_sub=None,
        email_verified=False,
        profile_photo=None,
    )
    print(f"Admin account '{username}' created successfully.")
    print("You can now log in through the VisionAttend admin login.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
