import cv2

from recognizer import FaceRecognizer
from database import FaceDatabase


def main():

    student_id = input(
        "Enter Student ID: "
    )

    name = input(
        "Enter Student Name: "
    )

    recognizer = FaceRecognizer()

    database = FaceDatabase()

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():

        print("❌ Could not open webcam.")

        return

    print()
    print("Look directly at the camera.")
    print("Press SPACE to capture.")
    print("Press Q to cancel.")

    while True:

        ret, frame = cap.read()

        if not ret:
            break

        cv2.putText(
            frame,
            "SPACE = Register | Q = Cancel",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2
        )

        cv2.imshow(
            "VisionAttend AI - Registration",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):

            print("Processing face...")

            embedding = recognizer.get_embedding(
                frame
            )

            if embedding is None:

                print(
                    "❌ No face detected. "
                    "Try again."
                )

                continue

            database.add_person(
                student_id,
                name,
                embedding
            )

            print(
                "✅ Registration successful!"
            )

            break

        elif key == ord("q"):

            print("Registration cancelled.")

            break

    cap.release()

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()