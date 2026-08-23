import sys
from pathlib import Path
from datetime import datetime

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


from detector import FaceDetector
from recognizer import FaceRecognizer
from database import FaceDatabase

from fast_liveness import FastLivenessSignals
from liveness import LivenessDetector

from attendance_manager import AttendanceManager
from session_manager import SessionManager


# ============================================================
# Config
# ============================================================

RECOGNITION_THRESHOLD = 0.45
DETECTION_INTERVAL = 2
RECOGNITION_INTERVAL = 5
WINDOW_NAME = "VisionAttend AI - Main Pipeline"


def bbox_area(bbox):

    x1, y1, x2, y2 = bbox

    return (x2 - x1) * (y2 - y1)


# ============================================================
# Helper — match YOLO detection to InsightFace face
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
# Close the active session cleanly
# ============================================================

def close_session_and_mark_absentees(
    session_manager,
    attendance,
    face_db,
    session
):

    if session is None:
        return

    session_id = session["session_id"]
    session_date = session["start_time"].strftime("%Y-%m-%d")

    print("\n[SESSION] Closing session...")

    # Close only this session.
    result = session_manager.end_session(session_id)

    if not result["success"]:
        print(f"[SESSION] {result.get('message', 'Session already closed.')}")

    existing = attendance.get_by_session(session_id)
    all_students = face_db.get_all()

    marked_absent = 0

    for student_id, person in all_students.items():

        if student_id in existing:
            continue

        absent_result = attendance.mark_absent(
            student_id=student_id,
            name=person["name"],
            date=session_date,
            session_id=session_id
        )

        if absent_result["success"]:
            marked_absent += 1

    print(
        f"[SESSION] Marked {marked_absent} student(s) absent."
    )

    print("[SESSION] Session closed successfully.")


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 60)
    print("             VISIONATTEND AI")
    print("          MAIN ATTENDANCE PIPELINE")
    print("=" * 60)

    print("\nLoading YOLO face detector...")
    detector = FaceDetector(confidence=0.50)
    print("YOLO detector ready.")

    recognizer = FaceRecognizer()
    print("Recognition system ready.")

    face_db = FaceDatabase()
    DATABASE = face_db.get_all()

    print(f"Registered people: {len(DATABASE)}")

    if len(DATABASE) == 0:
        print(
            "WARNING: No registered faces found. "
            "Everyone will show as UNKNOWN."
        )

    print("\nLoading anti-spoofing models...")
    liveness_signals = FastLivenessSignals()
    print("Anti-spoofing ready.")

    attendance = AttendanceManager()
    session_manager = SessionManager()

    # --------------------------------------------------------
    # The pipeline MUST belong to one active lecture session.
    # --------------------------------------------------------

    current_session = session_manager.get_current_session()

    if current_session is None:
        print("\nERROR: No active lecture session.")
        print("Start a session from the admin portal first.")
        liveness_signals.close()
        return

    SESSION_ID = current_session["session_id"]

    print(
        f"\nActive session: {current_session['name']}"
    )
    print(f"Session ID: {SESSION_ID}")
    print(
        f"Started: {current_session['start_time'].strftime('%H:%M:%S')}"
    )
    print(
        f"Duration: {current_session['duration_minutes']} minutes"
    )
    print(
        f"Late after: {current_session['late_after_minutes']} minutes"
    )

    # Attendance is now session-based.
    # A student can attend another session on the same day.
    session_attendance_cache = attendance.get_by_session(
        SESSION_ID
    )

    print(
        f"Existing attendance in this session: "
        f"{len(session_attendance_cache)}"
    )

    liveness_controllers = {}

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("ERROR: Could not open webcam.")
        liveness_signals.close()
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("\nCamera started.")
    print("Camera is controlled by the active session — no Q exit.\n")

    frame_count = 0
    cached_match = None
    cached_faces = []

    spoof_detected = False
    spoof_name = None
    manual_window_close = False
    session_finished = False

    # --------------------------------------------------------
    # Main loop
    # --------------------------------------------------------

    while True:

        # ----------------------------------------------------
        # SESSION TIME CHECK
        # ----------------------------------------------------

        current_time = datetime.now()

        elapsed_seconds = (
            current_time - current_session["start_time"]
        ).total_seconds()

        session_duration_seconds = (
            current_session["duration_minutes"] * 60
        )

        if elapsed_seconds >= session_duration_seconds:

            print("\n[SESSION] Session duration completed.")

            close_session_and_mark_absentees(
                session_manager,
                attendance,
                face_db,
                current_session
            )

            session_finished = True
            break

        ret, frame = cap.read()

        if not ret:
            print("ERROR: Failed to read camera.")
            break

        # ----------------------------------------------------
        # STEP 1 — Face detection
        # ----------------------------------------------------

        if frame_count % DETECTION_INTERVAL == 0 or not cached_faces:
            cached_faces = detector.detect(frame)

        faces = cached_faces

        # ----------------------------------------------------
        # STEP 2 — Recognition
        # ----------------------------------------------------

        if not faces:

            cached_match = None

        else:

            should_run_recognition = (
                frame_count % RECOGNITION_INTERVAL == 0
                or cached_match is None
            )

            if should_run_recognition:

                recognized_faces = recognizer.get_faces(frame)

                primary_face = max(
                    faces,
                    key=lambda f: bbox_area(f["bbox"])
                )

                r_face = match_yolo_to_insightface(
                    primary_face["bbox"],
                    recognized_faces
                )

                if r_face is not None:

                    cached_match = recognizer.find_best_match(
                        r_face.embedding,
                        DATABASE,
                        threshold=RECOGNITION_THRESHOLD
                    )

                else:
                    cached_match = None

        frame_count += 1

        # ----------------------------------------------------
        # STEP 3 — Build results
        # ----------------------------------------------------

        face_results = []

        if faces:

            primary_face = max(
                faces,
                key=lambda f: bbox_area(f["bbox"])
            )

            for face in faces:

                match = (
                    cached_match
                    if face is primary_face
                    else None
                )

                face_results.append({
                    "bbox": face["bbox"],
                    "match": match
                })

        # ----------------------------------------------------
        # STEP 4 — Anti-spoofing + liveness + attendance
        # ----------------------------------------------------

        known_results = [
            f for f in face_results
            if f["match"] is not None
        ]

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

            if student_id in session_attendance_cache:

                status_lines.append(
                    f"{name}: PRESENT (already marked)"
                )

                liveness_controllers.pop(student_id, None)

            else:

                if student_id not in liveness_controllers:
                    liveness_controllers[student_id] = LivenessDetector()

                live_ctrl = liveness_controllers[student_id]

                signals = liveness_signals.process(frame)

                live_status = live_ctrl.update(
                    blink=signals["blink"],
                    direction=signals["direction"],
                    gaze=signals["gaze"]
                )

                gaze_text = (
                    signals["gaze"]
                    if signals["gaze"]
                    else "N/A"
                )

                if live_status == "POSSIBLE PHOTO - NO MOVEMENT DETECTED":

                    status_lines.append(
                        f"WARNING {name}: POSSIBLE PHOTO"
                    )

                    spoof_detected = True
                    spoof_name = name

                else:

                    status_lines.append(
                        f"{name}: {live_status} "
                        f"(gaze: {gaze_text})"
                    )

                # ------------------------------------------------
                # LIVE -> mark attendance for THIS SESSION
                # ------------------------------------------------

                if live_status == "LIVE":

                    attendance_status = session_manager.get_status_for_time(
                        current_session
                    )

                    # None means the session has already elapsed.
                    if attendance_status is not None:

                        result = attendance.mark_attendance(
                            student_id=student_id,
                            name=name,
                            confidence=score,
                            status=attendance_status,
                            session_id=SESSION_ID
                        )

                        if result["success"]:

                            print(
                                f"[ATTENDANCE] {name} marked "
                                f"{attendance_status.upper()} "
                                f"for session {SESSION_ID} "
                                f"({score * 100:.1f}%)"
                            )

                            session_attendance_cache[
                                student_id
                            ] = result["record"]

                    liveness_controllers.pop(
                        student_id,
                        None
                    )

        # ----------------------------------------------------
        # Draw face boxes
        # ----------------------------------------------------

        for f in face_results:

            x1, y1, x2, y2 = f["bbox"]
            match = f["match"]

            if match is not None:

                label = (
                    f"{match['name']} "
                    f"({match['score']:.2f})"
                )
                box_color = (0, 255, 0)

            else:

                label = "UNKNOWN"
                box_color = (0, 0, 255)

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
        # HUD
        # ----------------------------------------------------

        remaining_seconds = max(
            0,
            int(session_duration_seconds - elapsed_seconds)
        )

        remaining_minutes = remaining_seconds // 60
        remaining_secs = remaining_seconds % 60

        cv2.putText(
            frame,
            f"Faces: {len(faces)}",
            (20, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 0),
            2
        )

        cv2.putText(
            frame,
            f"Session: {remaining_minutes:02d}:{remaining_secs:02d}",
            (20, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 0),
            2
        )

        y_offset = 90

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

        # ----------------------------------------------------
        # Fake photo detected
        # ----------------------------------------------------

        if spoof_detected:

            overlay = frame.copy()

            cv2.rectangle(
                overlay,
                (0, 0),
                (frame.shape[1], frame.shape[0]),
                (0, 0, 255),
                -1
            )

            frame = cv2.addWeighted(
                overlay,
                0.5,
                frame,
                0.5,
                0
            )

            cv2.putText(
                frame,
                "FAKE / DUPLICATE PHOTO DETECTED",
                (30, frame.shape[0] // 2 - 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (255, 255, 255),
                3
            )

            cv2.putText(
                frame,
                f"({spoof_name}) - closing session...",
                (30, frame.shape[0] // 2 + 15),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2
            )

        # ----------------------------------------------------
        # Display
        # ----------------------------------------------------

        cv2.imshow(WINDOW_NAME, frame)

        # No Q exit.
        # If the OpenCV window is closed using its X button,
        # treat that as a session stop so the frontend and Atlas
        # never remain stuck in ACTIVE state.
        try:

            window_visible = cv2.getWindowProperty(
                WINDOW_NAME,
                cv2.WND_PROP_VISIBLE
            )

            if window_visible < 1:

                print(
                    "\n[SESSION] Camera window closed manually."
                )

                manual_window_close = True
                break

        except cv2.error:

            manual_window_close = True
            break

        if spoof_detected:

            print(
                f"\n[SECURITY] Fake/duplicate photo detected "
                f"for {spoof_name}."
            )

            cv2.waitKey(2500)
            break

        cv2.waitKey(1)

    # --------------------------------------------------------
    # Cleanup and synchronization
    # --------------------------------------------------------

    cap.release()
    cv2.destroyAllWindows()
    liveness_signals.close()

    # If the session did not already close because of normal
    # expiry or fake-photo detection, close it here. This covers
    # manual camera-window closure and unexpected loop exits.
    if not session_finished:

        close_session_and_mark_absentees(
            session_manager,
            attendance,
            face_db,
            current_session
        )

    print("\nVisionAttend AI stopped.")


if __name__ == "__main__":
    main()
