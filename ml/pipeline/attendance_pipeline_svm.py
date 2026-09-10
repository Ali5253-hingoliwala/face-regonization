"""SVM-based multi-face attendance pipeline with per-face liveness checks."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import cv2

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
DETECTION_DIR = PROJECT_ROOT / "ml" / "detection"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ANTI_SPOOFING_DIR = PROJECT_ROOT / "ml" / "anti_spoofing"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
CLASSIFICATION_DIR = PROJECT_ROOT / "ml" / "classification"
LOG_DIR = PROJECT_ROOT / "ml" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "svm_pipeline.log"

_log_handle = open(LOG_FILE, "a", encoding="utf-8", buffering=1)
sys.stdout = _log_handle
sys.stderr = _log_handle
print("\n" + "=" * 64)
print(f"SVM pipeline process started: {datetime.now().isoformat()}")
print("=" * 64)

for folder in (DETECTION_DIR, RECOGNITION_DIR, ANTI_SPOOFING_DIR, ATTENDANCE_DIR, CLASSIFICATION_DIR):
    sys.path.append(str(folder))

from detector import FaceDetector
from recognizer import FaceRecognizer
from database import FaceDatabase
from fast_liveness import FastLivenessSignals
from liveness import LivenessDetector
from attendance_manager import AttendanceManager
from session_manager import SessionManager
from svm_recognizer import SVMFaceClassifier

# Temporary presentation settings.
# 60% is more forgiving for the small demo dataset than the previous 70%.
SVM_CONFIDENCE_THRESHOLD = 0.60
DETECTION_INTERVAL = 2
WINDOW_NAME = "VisionAttend AI - SVM Attendance"
SPOOF_WARNING_SECONDS = 3.0


def session_clock_now():
    if os.getenv("VISIONATTEND_SESSION_CLOCK", "local").lower() == "utc":
        return datetime.now(timezone.utc).replace(tzinfo=None)
    return datetime.now()


def clamp_bbox(bbox, width, height):
    x1, y1, x2, y2 = map(int, bbox)
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(x1 + 1, min(x2, width))
    y2 = max(y1 + 1, min(y2, height))
    return x1, y1, x2, y2


def classify_detection(detection, frame, recognizer, svm, database):
    """Generate an embedding and SVM prediction for one YOLO detection.

    The prediction is retained even when below the acceptance threshold so
    that liveness can still run on an unrecognized face. This is important for
    rejecting a phone photo instead of simply displaying UNKNOWN.
    """
    bbox = detection["bbox"]
    x1, y1, x2, y2 = clamp_bbox(bbox, frame.shape[1], frame.shape[0])
    face_crop = frame[y1:y2, x1:x2]
    if face_crop.size == 0:
        return {"bbox": bbox, "match": None, "embedding": None}

    try:
        embedding, _ = recognizer.get_single_face_embedding(face_crop)
    except Exception as exc:
        print(f"[RECOGNITION] Embedding error: {type(exc).__name__}: {exc}")
        embedding = None

    if embedding is None:
        return {"bbox": bbox, "match": None, "embedding": None}

    prediction = svm.predict(embedding)
    if prediction is None:
        return {"bbox": bbox, "match": None, "embedding": embedding}

    confidence = prediction["confidence"]
    student_id = prediction["student_id"]
    person = database.get(student_id)

    if person is None or (confidence is not None and confidence < SVM_CONFIDENCE_THRESHOLD):
        return {
            "bbox": bbox,
            "match": None,
            "embedding": embedding,
            "svm_prediction": prediction,
        }

    return {
        "bbox": bbox,
        "match": {
            "student_id": student_id,
            "name": person["name"],
            "confidence": confidence,
            "embedding": embedding,
        },
        "embedding": embedding,
        "svm_prediction": prediction,
    }


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
    print("=" * 64)
    print("          VISIONATTEND AI - SVM MULTI-FACE")
    print("=" * 64)

    print("\nLoading YOLO face detector...")
    detector = FaceDetector(confidence=0.50)
    recognizer = FaceRecognizer()
    face_db = FaceDatabase()
    database = face_db.get_all()
    svm = SVMFaceClassifier()

    print(f"Registered people: {len(database)}")
    print(f"TEMPORARY DEMO SVM confidence threshold: {SVM_CONFIDENCE_THRESHOLD:.0%}")
    print("\nLoading per-face anti-spoofing...")
    print("Liveness is checked for every detected face, including UNKNOWN faces.")

    attendance = AttendanceManager()
    session_manager = SessionManager()
    current_session = session_manager.get_current_session()
    if current_session is None:
        print("\nERROR: No active lecture session.")
        print("Start a session from the admin portal first.")
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
    liveness_signals = {}
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open webcam.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    print("\nCamera started. Session expiry controls normal shutdown.\n")

    frame_count = 0
    cached_results = []
    spoof_warnings = {}
    session_finished = False

    try:
        while True:
            current_time = session_clock_now()
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

            if frame_count % DETECTION_INTERVAL == 0 or not cached_results:
                detections = detector.detect(frame)
                cached_results = [
                    classify_detection(d, frame, recognizer, svm, database)
                    for d in detections
                ]

            frame_count += 1
            status_lines = []
            active_liveness_keys = set()

            # Run liveness BEFORE requiring a successful SVM identity match.
            # This lets a static phone photo be flagged even when SVM calls it
            # UNKNOWN or gives it low confidence.
            for detection_index, result in enumerate(cached_results):
                x1, y1, x2, y2 = clamp_bbox(result["bbox"], frame.shape[1], frame.shape[0])
                face_crop = frame[y1:y2, x1:x2]
                if face_crop.size == 0:
                    continue

                liveness_key = f"face_{detection_index}"
                active_liveness_keys.add(liveness_key)
                if liveness_key not in liveness_controllers:
                    liveness_controllers[liveness_key] = LivenessDetector()
                if liveness_key not in liveness_signals:
                    liveness_signals[liveness_key] = FastLivenessSignals()

                signals = liveness_signals[liveness_key].process(face_crop)
                live_status = liveness_controllers[liveness_key].update(
                    blink=signals["blink"],
                    direction=signals["direction"],
                    gaze=signals["gaze"],
                )

                match = result["match"]
                if live_status == "POSSIBLE PHOTO - NO MOVEMENT DETECTED":
                    warning_name = match["name"] if match else "Unrecognized face"
                    spoof_warnings[liveness_key] = (
                        current_time.timestamp() + SPOOF_WARNING_SECONDS,
                        warning_name,
                    )
                    status_lines.append(f"WARNING {warning_name}: POSSIBLE PHOTO")
                    print(
                        f"[SECURITY] Possible static photo for {warning_name}; "
                        "attendance NOT marked."
                    )
                    continue

                if match is None:
                    status_lines.append(f"UNKNOWN: {live_status}")
                    continue

                student_id = match["student_id"]
                name = match["name"]
                confidence = match["confidence"]

                if student_id in session_attendance_cache:
                    status_lines.append(f"{name}: PRESENT")
                    continue

                status_lines.append(
                    f"{name}: {live_status} (SVM: {(confidence or 0) * 100:.1f}%)"
                )

                if live_status == "LIVE":
                    attendance_status = session_manager.get_status_for_time(
                        current_session,
                        check_time=current_time,
                    )
                    if attendance_status is not None:
                        attendance_result = attendance.mark_attendance(
                            student_id=student_id,
                            name=name,
                            confidence=float(confidence or 0.0),
                            status=attendance_status,
                            session_id=session_id,
                        )
                        if attendance_result["success"]:
                            print(
                                f"[ATTENDANCE] {name} marked {attendance_status.upper()} "
                                f"for session {session_id} (SVM {(confidence or 0) * 100:.1f}%)"
                            )
                            session_attendance_cache[student_id] = attendance_result["record"]
                            liveness_controllers[liveness_key].reset()

            for key in list(liveness_signals):
                if key not in active_liveness_keys:
                    liveness_signals[key].close()
                    del liveness_signals[key]
                    liveness_controllers.pop(key, None)

            for result in cached_results:
                x1, y1, x2, y2 = clamp_bbox(result["bbox"], frame.shape[1], frame.shape[0])
                match = result["match"]
                if match is not None:
                    confidence = match["confidence"]
                    label = (
                        f"{match['name']} {confidence * 100:.1f}%"
                        if confidence is not None
                        else match["name"]
                    )
                    box_color = (0, 255, 0)
                else:
                    label = "UNKNOWN"
                    box_color = (0, 0, 255)

                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                cv2.putText(
                    frame, label, (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, box_color, 2,
                )

            remaining_seconds = max(0, int(session_duration_seconds - elapsed_seconds))
            cv2.putText(
                frame, f"Faces: {len(cached_results)}", (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2,
            )
            cv2.putText(
                frame, f"Session: {remaining_seconds // 60:02d}:{remaining_seconds % 60:02d}",
                (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 0), 2,
            )

            y_offset = 90
            for line in status_lines[:6]:
                cv2.putText(
                    frame, line, (20, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2,
                )
                y_offset += 26

            active_warnings = [
                (name, expiry)
                for expiry, name in spoof_warnings.values()
                if current_time.timestamp() < expiry
            ]
            if active_warnings:
                box_x1, box_y1 = 15, frame.shape[0] - 75
                box_x2, box_y2 = frame.shape[1] - 15, frame.shape[0] - 15
                cv2.rectangle(frame, (box_x1, box_y1), (box_x2, box_y2), (0, 0, 180), -1)
                cv2.putText(
                    frame, "SECURITY WARNING: FAKE / DUPLICATE PHOTO",
                    (30, frame.shape[0] - 47), cv2.FONT_HERSHEY_SIMPLEX,
                    0.55, (255, 255, 255), 2,
                )
                cv2.putText(
                    frame, ", ".join(name for name, _ in active_warnings),
                    (30, frame.shape[0] - 23), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (255, 255, 255), 2,
                )

            cv2.imshow(WINDOW_NAME, frame)
            try:
                if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                    print("\n[SESSION] Camera window closed manually.")
                    break
            except cv2.error:
                break
            cv2.waitKey(1)

    finally:
        cap.release()
        cv2.destroyAllWindows()
        for signal_processor in liveness_signals.values():
            signal_processor.close()
        if not session_finished:
            close_session_and_mark_absentees(session_manager, attendance, face_db, current_session)
        print("\nVisionAttend AI SVM attendance stopped.")
        _log_handle.flush()


if __name__ == "__main__":
    main()
