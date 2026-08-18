import cv2

from recognizer import FaceRecognizer
from database import FaceDatabase


def main():

    print("=" * 50)
    print("       VISIONATTEND AI")
    print("       FACE REGISTRATION")
    print("=" * 50)

    student_id = input(
        "Enter Student ID: "
    ).strip()

    name = input(
        "Enter Student Name: "
    ).strip()

    if not student_id or not name:

        print("❌ Student ID and Name are required.")

        return

    recognizer = FaceRecognizer()

    database = FaceDatabase()

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():

        print("❌ Could not open webcam.")

        return

    print()
    print("Look directly at the camera.")
    print("Make sure only ONE person is visible.")
    print()
    print("Press SPACE to register.")
    print("Press Q to cancel.")

    while True:

        ret, frame = cap.read()

        if not ret:

            print("❌ Failed to capture frame.")

            break

        cv2.putText(
            frame,
            "SPACE = Register | Q = Cancel",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 255),
            2
        )

        cv2.imshow(
            "VisionAttend AI - Registration",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):

            print()
            print("Processing face...")

            embedding = recognizer.get_embedding(
                frame
            )

            if embedding is None:

                print(
                    "❌ No face detected."
                )

                print(
                    "Please try again."
                )

                continue

            database.add_person(
                student_id,
                name,
                embedding
            )

            print()
            print("🎉 Registration successful!")

            break

        elif key == ord("q"):

            print("Registration cancelled.")

            break

    cap.release()

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()