import cv2
import sys
from pathlib import Path


# ---------------------------------------------------------
# Add project folders to Python path
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

RECOGNITION_PATH = PROJECT_ROOT / "ml" / "recognition"

sys.path.append(str(RECOGNITION_PATH))


# ---------------------------------------------------------
# Import our existing recognition system
# ---------------------------------------------------------

from recognizer import FaceRecognizer
from database import FaceDatabase


# Import attendance manager
from attendance_manager import AttendanceManager


# ---------------------------------------------------------
# Main function
# ---------------------------------------------------------

def main():

    print("=" * 60)
    print("              VISIONATTEND AI")
    print("          LIVE ATTENDANCE SYSTEM")
    print("=" * 60)

    # -----------------------------------------------------
    # Initialize recognition
    # -----------------------------------------------------

    print()
    print("Initializing face recognition...")

    recognizer = FaceRecognizer()

    # -----------------------------------------------------
    # Load registered students
    # -----------------------------------------------------

    database = FaceDatabase()

    registered_people = database.get_all()

    print(
        f"Registered students: {len(registered_people)}"
    )

    if len(registered_people) == 0:

        print()
        print("ERROR: No registered faces found.")

        return

    # -----------------------------------------------------
    # Initialize attendance manager
    # -----------------------------------------------------

    attendance = AttendanceManager()

    print("Attendance system ready.")

    # -----------------------------------------------------
    # Start camera
    # -----------------------------------------------------

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():

        print()
        print("ERROR: Could not open webcam.")

        return

    print()
    print("Camera started.")
    print("Press Q to exit.")

    print()
    print("-" * 60)

    # -----------------------------------------------------
    # Main camera loop
    # -----------------------------------------------------

    while True:

        success, frame = cap.read()

        if not success:

            print("ERROR: Could not read frame.")

            break

        # -------------------------------------------------
        # Detect faces and generate embeddings
        # -------------------------------------------------

        faces = recognizer.get_faces(frame)

        # -------------------------------------------------
        # Process every detected face
        # -------------------------------------------------

        for face in faces:

            # Face bounding box
            bbox = face.bbox.astype(int)

            x1, y1, x2, y2 = bbox

            # Face embedding
            embedding = face.embedding

            # -------------------------------------------------
            # Find best registered person
            # -------------------------------------------------

            match = recognizer.find_best_match(
                embedding,
                registered_people,
                threshold=0.45
            )

            # -------------------------------------------------
            # Unknown person
            # -------------------------------------------------

            if match is None:

                label = "UNKNOWN"

                box_color = (0, 0, 255)

            # -------------------------------------------------
            # Recognized person
            # -------------------------------------------------

            else:

                student_id = match["student_id"]

                name = match["name"]

                score = match["score"]

                # -------------------------------------------------
                # Mark attendance
                # -------------------------------------------------

                result = attendance.mark_attendance(
                    student_id=student_id,
                    name=name,
                    confidence=score
                )

                # -------------------------------------------------
                # Attendance successfully marked
                # -------------------------------------------------

                if result["success"]:

                    print(
                        f"[ATTENDANCE] "
                        f"{name} marked PRESENT "
                        f"({score * 100:.1f}%)"
                    )

                    label = (
                        f"{name} | "
                        f"{score * 100:.1f}% | PRESENT"
                    )

                # -------------------------------------------------
                # Already marked
                # -------------------------------------------------

                else:

                    label = (
                        f"{name} | "
                        f"{score * 100:.1f}% | "
                        f"ALREADY MARKED"
                    )

                box_color = (0, 255, 0)

            # -------------------------------------------------
            # Draw face bounding box
            # -------------------------------------------------

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                box_color,
                2
            )

            # -------------------------------------------------
            # Draw name / attendance status
            # -------------------------------------------------

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                box_color,
                2
            )

        # -----------------------------------------------------
        # Display system information
        # -----------------------------------------------------

        cv2.putText(
            frame,
            "VisionAttend AI",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 0),
            2
        )

        cv2.putText(
            frame,
            "Press Q to Exit",
            (20, 65),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        # -----------------------------------------------------
        # Show camera
        # -----------------------------------------------------

        cv2.imshow(
            "VisionAttend AI - Live Attendance",
            frame
        )

        # -----------------------------------------------------
        # Exit
        # -----------------------------------------------------

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):

            break

    # ---------------------------------------------------------
    # Cleanup
    # ---------------------------------------------------------

    cap.release()

    cv2.destroyAllWindows()

    print()
    print("-" * 60)
    print("Attendance system stopped.")
    print("-" * 60)


# ---------------------------------------------------------
# Program entry point
# ---------------------------------------------------------

if __name__ == "__main__":

    main()