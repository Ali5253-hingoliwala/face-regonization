import sys
from pathlib import Path
from datetime import datetime

import cv2

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
DETECTION_DIR = PROJECT_ROOT / "ml" / "detection"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ANTI_SPOOFING_DIR = PROJECT_ROOT / "ml" / "anti_spoofing"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
for folder in (DETECTION_DIR, RECOGNITION_DIR, ANTI_SPOOFING_DIR, ATTENDANCE_DIR):
    sys.path.append(str(folder))

from detector import FaceDetector
from recognizer import FaceRecognizer
from database import FaceDatabase
from fast_liveness import FastLivenessSignals
from liveness import LivenessDetector
from attendance_manager import AttendanceManager
from session_manager import SessionManager

RECOGNITION_THRESHOLD = 0.45
DETECTION_INTERVAL = 2
RECOGNITION_INTERVAL = 5
WINDOW_NAME = "VisionAttend AI - Main Pipeline"
SPOOF_WARNING_SECONDS = 3.0


def bbox_area(bbox):
    x1, y1, x2, y2 = bbox
    return max(0, x2 - x1) * max(0, y2 - y1)


def match_yolo_to_insightface(yolo_bbox, recognized_faces):
    x1, y1, x2, y2 = yolo_bbox
    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    for r_face in recognized_faces:
        rx1, ry1, rx2, ry2 = map(int, r_face.bbox)
        if rx1 <= center_x <= rx2 and ry1 <= center_y <= ry2:
            return r_face
    return None


def close_session_and_mark_absentees(session_manager, attendance, face_db, session):
    if session is None:
        return
    session_id = session["session_id"]
    session_date = session["start_time"].strftime("%Y-%m-%d")
    print("\n[SESSION] Closing session...")
    result = session_manager.end_session(session_id)
    if not result["success"]:
        print(f"[SESSION] {result.get('message', 'Session already closed.')}")
    existing = attendance.get_by_session(session_id)
    marked_absent = 0
    for student_id, person in face_db.get_all().items():
        if student_id in existing:
            continue
        absent_result = attendance.mark_absent(
            student_id=student_id,
            name=person["name"],
            date=session_date,
            session_id=session_id,
        )
        if absent_result["success"]:
            marked_absent += 1
    print(f"[SESSION] Marked {marked_absent} student(s) absent.")
    print("[SESSION] Session closed successfully.")


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
    database = face_db.get_all()
    print(f"Registered people: {len(database)}")
    if not database:
        print("WARNING: No registered faces found. Everyone will show as UNKNOWN.")

    print("\nLoading anti-spoofing models...")
    liveness_signals = FastLivenessSignals()
    print("Anti-spoofing ready.")
    attendance = AttendanceManager()
    session_manager = SessionManager()
    current_session = session_manager.get_current_session()

    if current_session is None:
        print("\nERROR: No active lecture session.")
        print("Start a session from the admin portal first.")
        liveness_signals.close()
        return

    session_id = current_session["session_id"]
    print(f"\nActive session: {current_session['name']}")
    print(f"Session ID: {session_id}")
    print(f"Started: {current_session['start_time'].strftime('%H:%M:%S')}")
    print(f"Duration: {current_session['duration_minutes']} minutes")
    print(f"Late after: {current_session['late_after_minutes']} minutes")

    session_attendance_cache = attendance.get_by_session(session_id)
    print(f"Existing attendance in this session: {len(session_attendance_cache)}")
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
    spoof_warning_until = 0.0
    spoof_name = None
    session_finished = False

    try:
        while True:
            current_time = datetime.now()
            elapsed_seconds = (current_time - current_session["start_time"]).total_seconds()
            session_duration_seconds = current_session["duration_minutes"] * 60

            if elapsed_seconds >= session_duration_seconds:
                print("\n[SESSION] Session duration completed.")
                close_session_and_mark_absentees(session_manager, attendance, face_db, current_session)
                session_finished = True
                break

            ret, frame = cap.read()
            if not ret:
                print("ERROR: Failed to read camera.")
                break

            if frame_count % DETECTION_INTERVAL == 0 or not cached_faces:
                cached_faces = detector.detect(frame)
            faces = cached_faces

            if not faces:
                cached_match = None
            else:
                should_run_recognition = frame_count % RECOGNITION_INTERVAL == 0 or cached_match is None
                if should_run_recognition:
                    recognized_faces = recognizer.get_faces(frame)
                    primary_face = max(faces, key=lambda f: bbox_area(f["bbox"]))
                    r_face = match_yolo_to_insightface(primary_face["bbox"], recognized_faces)
                    cached_match = (
                        recognizer.find_best_match(
                            r_face.embedding,
                            database,
                            threshold=RECOGNITION_THRESHOLD,
                        )
                        if r_face is not None
                        else None
                    )

            frame_count += 1
            primary_face = max(faces, key=lambda f: bbox_area(f["bbox"])) if faces else None
            face_results = []
            for face in faces:
                face_results.append({
                    "bbox": face["bbox"],
                    "match": cached_match if face is primary_face else None,
                })

            status_lines = []
            known_results = [f for f in face_results if f["match"] is not None]

            if known_results:
                primary = max(known_results, key=lambda f: bbox_area(f["bbox"]))
                student_id = primary["match"]["student_id"]
                name = primary["match"]["name"]
                score = primary["match"]["score"]

                if student_id in session_attendance_cache:
                    status_lines.append(f"{name}: PRESENT (already marked)")
                    liveness_controllers.pop(student_id, None)
                else:
                    if student_id not in liveness_controllers:
                        liveness_controllers[student_id] = LivenessDetector()
                    live_ctrl = liveness_controllers[student_id]
                    signals = liveness_signals.process(frame)
                    live_status = live_ctrl.update(
                        blink=signals["blink"],
                        direction=signals["direction"],
                        gaze=signals["gaze"],
                    )
                    gaze_text = signals["gaze"] or "N/A"

                    if live_status == "POSSIBLE PHOTO - NO MOVEMENT DETECTED":
                        # SECURITY EVENT ONLY: never stop the camera/session.
                        # The attendance write below is intentionally skipped.
                        spoof_warning_until = current_time.timestamp() + SPOOF_WARNING_SECONDS
                        spoof_name = name
                        status_lines.append(f"WARNING {name}: POSSIBLE PHOTO")
                        print(f"[SECURITY] Possible fake/duplicate photo detected for {name}; attendance NOT marked.")
                    else:
                        status_lines.append(f"{name}: {live_status} (gaze: {gaze_text})")

                    if live_status == "LIVE":
                        attendance_status = session_manager.get_status_for_time(current_session)
                        if attendance_status is not None:
                            result = attendance.mark_attendance(
                                student_id=student_id,
                                name=name,
                                confidence=score,
                                status=attendance_status,
                                session_id=session_id,
                            )
                            if result["success"]:
                                print(f"[ATTENDANCE] {name} marked {attendance_status.upper()} for session {session_id} ({score * 100:.1f}%)")
                                session_attendance_cache[student_id] = result["record"]
                        liveness_controllers.pop(student_id, None)

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
                cv2.putText(frame, label, (x1, max(y1 - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, box_color, 2)

            remaining_seconds = max(0, int(session_duration_seconds - elapsed_seconds))
            cv2.putText(frame, f"Faces: {len(faces)}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
            cv2.putText(frame, f"Session: {remaining_seconds // 60:02d}:{remaining_seconds % 60:02d}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 0), 2)

            y_offset = 90
            for line in status_lines:
                cv2.putText(frame, line, (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 0), 2)
                y_offset += 30

            # Non-blocking corner notification. It does NOT close the pipeline.
            if current_time.timestamp() < spoof_warning_until:
                box_x1, box_y1, box_x2, box_y2 = 15, frame.shape[0] - 95, frame.shape[1] - 15, frame.shape[0] - 15
                cv2.rectangle(frame, (box_x1, box_y1), (box_x2, box_y2), (0, 0, 180), -1)
                cv2.putText(frame, "SECURITY WARNING: FAKE / DUPLICATE PHOTO", (30, frame.shape[0] - 60), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                cv2.putText(frame, f"{spoof_name} - attendance rejected", (30, frame.shape[0] - 32), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

            cv2.imshow(WINDOW_NAME, frame)

            try:
                if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                    print("\n[SESSION] Camera window closed manually.")
                    break
            except cv2.error:
                break

            # Q is intentionally ignored. Session expiry controls normal shutdown.
            cv2.waitKey(1)

    finally:
        cap.release()
        cv2.destroyAllWindows()
        liveness_signals.close()
        if not session_finished:
            close_session_and_mark_absentees(session_manager, attendance, face_db, current_session)
        print("\nVisionAttend AI stopped.")


if __name__ == "__main__":
    main()
