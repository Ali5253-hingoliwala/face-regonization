import sys
from pathlib import Path
import getpass

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

SERVICES_DIR = PROJECT_ROOT / "backend" / "services"

sys.path.append(str(SERVICES_DIR))

from user_manager import UserManager
from auth_utils import hash_password


def main():

    print("=" * 60)
    print("        CREATE ADMIN ACCOUNT")
    print("=" * 60)

    username = input("\nAdmin username: ").strip()

    if not username:
        print("\nERROR: Username can't be empty.")
        return

    password = getpass.getpass("Admin password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("\nERROR: Passwords don't match.")
        return

    if len(password) < 6:
        print("\nERROR: Password should be at least 6 characters.")
        return

    user_manager = UserManager()

    existing = user_manager.get_user(username)

    if existing:
        print(f"\nERROR: Username '{username}' already exists.")
        return

    password_hash = hash_password(password)

    user_manager.create_user(
        username=username,
        password_hash=password_hash,
        role="admin"
    )

    print(f"\nAdmin account '{username}' created successfully.")
    print("You can now log in via POST /auth/login with this username/password.")


if __name__ == "__main__":
    main()