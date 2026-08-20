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
ANTI_SPOOFING_DIR = PROJECT_ROOT / "ml" / "anti_spoofing"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"

sys.path.append(str(DETECTION_DIR))
sys.path.append(str(RECOGNITION_DIR))
sys.path.append(str(ANTI_SPOOFING_DIR))
sys.path.append(str(ATTENDANCE_DIR))


# ============================================================
# Import existing, already-working classes
# (none of these files are modified)
# ============================================================

from detector import FaceDetector
from recognizer import FaceRecognizer
from database import FaceDatabase

from fast_liveness import FastLivenessSignals
from liveness import LivenessDetector

from attendance_manager import AttendanceManager


# ============================================================
# Config
# ============================================================

RECOGNITION_THRESHOLD = 0.45

# head_pose.py returns "LEFT" / "CENTER" / "RIGHT".
# Either side counts as head movement for liveness.
HEAD_MOVEMENT_DIRECTIONS = {"LEFT", "RIGHT"}


# ============================================================
# Helper — match a YOLO detection to an InsightFace face
# ============================================================

def match_yolo_to_insightface(yolo_bbox, recognized_faces):

    x1, y1, x2, y2 = yolo_bbox

    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2

    for r_face in recognized_faces:

        rx1, ry1, rx2, ry2 = map(int, r_face.bbox)

        if rx1 <= center_x <= rx2 and ry1 <= center_y <= ry2:

            return r_face

    return None


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 60)
    print("             VISIONATTEND AI")
    print("          MAIN ATTENDANCE PIPELINE")
    print("=" * 60)

    # --------------------------------------------------------
    # Face detection (YOLO)
    # --------------------------------------------------------

    print("\nLoading YOLO face detector...")

    detector = FaceDetector(confidence=0.50)

    print("YOLO detector ready.")

    # --------------------------------------------------------
    # Face recognition (InsightFace)
    # --------------------------------------------------------

    recognizer = FaceRecognizer()

    print("Recognition system ready.")

    # --------------------------------------------------------
    # Real registered-face database (fixes the empty-DATABASE bug)
    # --------------------------------------------------------

    face_db = FaceDatabase()

    DATABASE = face_db.get_all()

    print(f"Registered people: {len(DATABASE)}")

    if len(DATABASE) == 0:
        print("WARNING: No registered faces found. Everyone will show as UNKNOWN.")

    # --------------------------------------------------------
    # Anti-spoofing — single shared landmarker (see fast_liveness.py)
    # --------------------------------------------------------

    print("\nLoading anti-spoofing models...")

    liveness_signals = FastLivenessSignals()

    print("Anti-spoofing ready.")

    # --------------------------------------------------------
    # Attendance manager (unchanged, already handles duplicates)
    # --------------------------------------------------------

    attendance = AttendanceManager()

    # Fetch today's attendance ONCE at startup instead of querying
    # the database every frame — important now that the database is
    # a network call (MongoDB Atlas), not a local file.
    today_attendance_cache = attendance.get_today_attendance()

    # One LivenessDetector per recognized student_id, created on
    # first sight and dropped once they pass or once already marked.
    liveness_controllers = {}

    # --------------------------------------------------------
    # Camera
    # --------------------------------------------------------

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("ERROR: Could not open webcam.")
        return

    # Lower capture resolution -> less work per frame for every
    # downstream model (YOLO, InsightFace, landmarker).
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

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
        # STEP 3 — Match each YOLO face to InsightFace + database
        # ----------------------------------------------------

        face_results = []

        for face in faces:

            bbox = face["bbox"]

            r_face = match_yolo_to_insightface(bbox, recognized_faces)

            match = None

            if r_face is not None:

                match = recognizer.find_best_match(
                    r_face.embedding,
                    DATABASE,
                    threshold=RECOGNITION_THRESHOLD
                )

            face_results.append({
                "bbox": bbox,
                "match": match
            })

        # ----------------------------------------------------
        # STEP 4 — Anti-spoofing + liveness + attendance
        #
        # Anti-spoofing models run once per frame (num_faces=1),
        # so they apply to the largest KNOWN face in view.
        # ----------------------------------------------------

        known_results = [f for f in face_results if f["match"] is not None]

        status_lines = []

        if known_results:

            primary = max(
                known_results,
                key=lambda f: (
                    (f["bbox"][2] - f["bbox"][0])
                    * (f["bbox"][3] - f["bbox"][1])
                )
            )

            student_id = primary["match"]["student_id"]
            name = primary["match"]["name"]
            score = primary["match"]["score"]

            if student_id in today_attendance_cache:

                # Already marked today — skip anti-spoofing work.
                status_lines.append(f"{name}: PRESENT (already marked)")

                liveness_controllers.pop(student_id, None)

            else:

                if student_id not in liveness_controllers:
                    liveness_controllers[student_id] = LivenessDetector()

                live_ctrl = liveness_controllers[student_id]

                signals = liveness_signals.process(frame)

                if signals["blink"]:
                    live_ctrl.register_blink()

                if signals["direction"] in HEAD_MOVEMENT_DIRECTIONS:
                    live_ctrl.register_head_movement()

                live_status = live_ctrl.get_status()

                gaze_text = signals["gaze"] if signals["gaze"] else "N/A"

                status_lines.append(f"{name}: {live_status}  (gaze: {gaze_text})")

                # ------------------------------------------------
                # LIVE -> mark attendance
                # ------------------------------------------------

                if live_status == "LIVE":

                    result = attendance.mark_attendance(
                        student_id=student_id,
                        name=name,
                        confidence=score
                    )

                    if result["success"]:

                        print(
                            f"[ATTENDANCE] {name} marked PRESENT "
                            f"({score * 100:.1f}%)"
                        )

                        # Update the cache locally — this is the ONLY
                        # place attendance data changes during the
                        # session, so no need to re-query the database.
                        today_attendance_cache[student_id] = result["record"]

                    liveness_controllers.pop(student_id, None)

                # ------------------------------------------------
                # FAILED -> let them try again
                # ------------------------------------------------

                elif live_status == "FAILED":

                    live_ctrl.reset()

        # ----------------------------------------------------
        # Draw all face boxes
        # ----------------------------------------------------

        for f in face_results:

            x1, y1, x2, y2 = f["bbox"]
            match = f["match"]

            if match is not None:

                label = f"{match['name']} ({match['score']:.2f})"
                box_color = (0, 255, 0)

            else:

                label = "UNKNOWN"
                box_color = (0, 0, 255)

            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

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
        # HUD: face count + liveness/attendance status
        # ----------------------------------------------------

        cv2.putText(
            frame,
            f"Faces: {len(faces)}",
            (20, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 0),
            2
        )

        y_offset = 60

        for line in status_lines:

            cv2.putText(
                frame,
                line,
                (20, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 0),
                2
            )

            y_offset += 30

        cv2.putText(
            frame,
            "Press Q to exit",
            (20, frame.shape[0] - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        # ----------------------------------------------------
        # Display
        # ----------------------------------------------------

        cv2.imshow("VisionAttend AI - Main Pipeline", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # --------------------------------------------------------
    # Cleanup
    # --------------------------------------------------------

    cap.release()
    cv2.destroyAllWindows()
    liveness_signals.close()

    print("\nVisionAttend AI stopped.")


if __name__ == "__main__":
    main()