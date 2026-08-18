from attendance_manager import AttendanceManager


def main():

    attendance = AttendanceManager()

    result = attendance.mark_attendance(
        student_id="CW001",
        name="Ali",
        confidence=0.94
    )

    print()
    print("================================")
    print("ATTENDANCE TEST")
    print("================================")

    print()
    print("Result:")
    print(result)

    print()
    print("Today's Attendance:")

    today = attendance.get_today_attendance()

    for student_id, record in today.items():

        print(
            student_id,
            "->",
            record
        )


if __name__ == "__main__":
    main()