import sys
from pathlib import Path

import cv2


# ============================================================
# Add project folders to Python path
# ============================================================

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent

DETECTION_DIR = PROJECT_ROOT / "ml" / "detection"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"

sys.path.append(str(DETECTION_DIR))
sys.path.append(str(RECOGNITION_DIR))


# ============================================================
# Import our existing classes
# ============================================================

from detector import FaceDetector
from recognizer import FaceRecognizer


# ============================================================
# Registered people
#
# IMPORTANT:
# Replace this section with your actual database-loading
# code if you already have one.
# ============================================================

DATABASE = {
    # Example:
    #
    # "STU001": {
    #     "name": "Ali",
    #     "embedding": [...]
    # }
}


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 60)
    print("             VISIONATTEND AI")
    print("          MAIN ATTENDANCE PIPELINE")
    print("=" * 60)

    # --------------------------------------------------------
    # Initialize face detector
    # --------------------------------------------------------

    print("\nLoading YOLO face detector...")

    detector = FaceDetector(
        confidence=0.50
    )

    print("YOLO detector ready.")

    # --------------------------------------------------------
    # Initialize recognizer
    # --------------------------------------------------------

    recognizer = FaceRecognizer()

    print("Recognition system ready.")

    # --------------------------------------------------------
    # Camera
    # --------------------------------------------------------

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():

        print("ERROR: Could not open webcam.")

        return

    print("\nCamera started.")
    print("Press Q to exit.\n")

    # --------------------------------------------------------
    # Main loop
    # --------------------------------------------------------

    while True:

        ret, frame = cap.read()

        if not ret:

            print("ERROR: Failed to read camera.")

            break

        # ----------------------------------------------------
        # STEP 1 — Face detection
        # ----------------------------------------------------

        faces = detector.detect(frame)

        # ----------------------------------------------------
        # STEP 2 — Recognition
        # ----------------------------------------------------

        recognized_faces = recognizer.get_faces(frame)

        # ----------------------------------------------------
        # Display detected faces
        # ----------------------------------------------------

        for face in faces:

            x1, y1, x2, y2 = face["bbox"]

            detection_confidence = face["confidence"]

            label = (
                f"Face "
                f"{detection_confidence * 100:.1f}%"
            )

            # ------------------------------------------------
            # Try to match an InsightFace face
            # ------------------------------------------------

            best_match = None

            for r_face in recognized_faces:

                rx1, ry1, rx2, ry2 = map(
                    int,
                    r_face.bbox
                )

                # Center of YOLO detection
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2

                # Check whether InsightFace bbox
                # contains YOLO center
                if (
                    rx1 <= center_x <= rx2
                    and
                    ry1 <= center_y <= ry2
                ):

                    embedding = r_face.embedding

                    best_match = (
                        recognizer.find_best_match(
                            embedding,
                            DATABASE,
                            threshold=0.45
                        )
                    )

                    break

            # ------------------------------------------------
            # Known / Unknown
            # ------------------------------------------------

            if best_match is not None:

                name = best_match["name"]

                score = best_match["score"]

                label = (
                    f"{name} "
                    f"({score:.2f})"
                )

                box_color = (0, 255, 0)

            else:

                label = "UNKNOWN"

                box_color = (0, 0, 255)

            # ------------------------------------------------
            # Draw face
            # ------------------------------------------------

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                box_color,
                2
            )

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                box_color,
                2
            )

        # ----------------------------------------------------
        # Number of detected faces
        # ----------------------------------------------------

        cv2.putText(
            frame,
            f"Faces: {len(faces)}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 0),
            2
        )

        # ----------------------------------------------------
        # Display
        # ----------------------------------------------------

        cv2.imshow(
            "VisionAttend AI - Main Pipeline",
            frame
        )

        # ----------------------------------------------------
        # Exit
        # ----------------------------------------------------

        if cv2.waitKey(1) & 0xFF == ord("q"):

            break

    # --------------------------------------------------------
    # Cleanup
    # --------------------------------------------------------

    cap.release()

    cv2.destroyAllWindows()

    print("\nVisionAttend AI stopped.")


if __name__ == "__main__":

    main()