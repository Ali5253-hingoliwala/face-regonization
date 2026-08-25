"""One-time local reset for a fresh VisionAttend student registration cycle.

Run from the repository root after confirming a MongoDB backup exists:
    python tools/reset_student_data.py

This script preserves admin accounts, removes all student accounts, removes all
face embeddings, and clears attendance/session history.
"""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_UTILS = PROJECT_ROOT / "ml" / "utils"
sys.path.insert(0, str(ML_UTILS))

from mongo_client import get_database


CONFIRMATION = "WIPE STUDENTS AND HISTORY"


def main():
    print("VisionAttend destructive student-data reset")
    print("This will:")
    print("  - preserve users whose role is not 'student'")
    print("  - delete all student user accounts")
    print("  - delete ALL face embeddings")
    print("  - delete ALL attendance records")
    print("  - delete ALL sessions")
    print()
    print("Make sure your MongoDB backup is complete before continuing.")

    confirmation = input(f'Type exactly "{CONFIRMATION}" to continue: ').strip()
    if confirmation != CONFIRMATION:
        print("Reset cancelled.")
        return

    db = get_database()

    student_accounts = db["users"].count_documents({"role": "student"})
    face_count = db["faces"].count_documents({})
    attendance_count = db["attendance"].count_documents({})
    session_count = db["sessions"].count_documents({})

    print("\nCurrent data:")
    print(f"  Student accounts: {student_accounts}")
    print(f"  Face embeddings:  {face_count}")
    print(f"  Attendance:       {attendance_count}")
    print(f"  Sessions:         {session_count}")

    users_result = db["users"].delete_many({"role": "student"})
    faces_result = db["faces"].delete_many({})
    attendance_result = db["attendance"].delete_many({})
    sessions_result = db["sessions"].delete_many({})

    print("\nReset complete:")
    print(f"  Student accounts deleted: {users_result.deleted_count}")
    print(f"  Face embeddings deleted:  {faces_result.deleted_count}")
    print(f"  Attendance records deleted:{attendance_result.deleted_count}")
    print(f"  Sessions deleted:          {sessions_result.deleted_count}")
    print("  Admin accounts preserved.")


if __name__ == "__main__":
    main()
