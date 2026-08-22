import sys
from pathlib import Path
from datetime import datetime

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"

sys.path.append(str(RECOGNITION_DIR))
sys.path.append(str(ATTENDANCE_DIR))

from database import FaceDatabase
from attendance_manager import AttendanceManager


def main():

    print("=" * 60)
    print("        MARK ABSENTEES FOR TODAY")
    print("=" * 60)

    today = datetime.now().strftime("%Y-%m-%d")

    print(f"\nDate: {today}")

    face_db = FaceDatabase()
    attendance = AttendanceManager()

    all_students = face_db.get_all()

    print(f"Registered students: {len(all_students)}")

    present_today = attendance.get_by_date(today)

    print(f"Marked present today: {len(present_today)}")

    marked_absent = 0
    already_present = 0

    print()

    for student_id, person in all_students.items():

        name = person["name"]

        if student_id in present_today:

            print(f"  PRESENT  {student_id}  {name}")
            already_present += 1
            continue

        result = attendance.mark_absent(
            student_id=student_id,
            name=name,
            date=today
        )

        print(f"  ABSENT   {student_id}  {name}")
        marked_absent += 1

    print()
    print("-" * 60)
    print(f"Already present: {already_present}")
    print(f"Newly marked absent: {marked_absent}")
    print("-" * 60)


if __name__ == "__main__":
    main()