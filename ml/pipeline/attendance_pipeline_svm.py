"""SVM-based multi-face attendance pipeline.

This is an isolated successor to attendance_pipeline.py. The existing pipeline
is intentionally left unchanged until this version is validated.

Flow per detected face:
    YOLO detection -> InsightFace embedding -> SVM identity -> per-face liveness
    -> attendance

The existing FastLivenessSignals implementation is reused on a one-face crop,
so the anti-spoofing algorithms themselves are not replaced or modified.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import cv2

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
DETECTION_DIR = PROJECT_ROOT / "ml" / "detection"
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ANTI_SPOOFING_DIR = PROJECT_ROOT / "ml" / "anti_spoofing"
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
CLASSIFICATION_DIR = PROJECT_ROOT / "ml" / "classification"

for folder in (
    DETECTION_DIR,
    RECOGNITION_DIR,
    ANTI_SPOOFING_DIR,
    ATTENDANCE_DIR,
    CLASSIFICATION_DIR,
):
    sys.path.append(str(folder))

from detector import FaceDetector
from recognizer import FaceRecognizer
from database import FaceDatabase
from fast_liveness import FastLivenessSignals
from liveness import LivenessDetector
from attendance_manager import AttendanceManager
from session_manager import SessionManager
from svm_recognizer import SVMFaceClassifier

SVM_CONFIDENCE_THRESHOLD = 0.70
DETECTION_INTERVAL = 2
RECOGNITION_INTERVAL = 5
WINDOW_NAME = "VisionAttend AI - SVM Attendance"
SPOOF_WARNING_SECONDS = 3.0


def bbox_area(bbox):
    x1, y1, x2, y2 = bbox
    return max(0, x2 - x1) * max(0, y2 - y1)


def clamp_bbox(bbox, width, height):
    x1, y1, x2, y2 = map(int, bbox)
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(x1 + 1, min(x2, width))
    y2 = max(y1 + 1, min(y2, height))
    return x1, y1, x2, y2


def match_yolo_to_insightface(yolo_bbox, insight_faces):
    """Match a YOLO detection to its InsightFace result by bbox center."""
    x1, y1, x2, y2 = yolo_bbox
    center_x = (x1 + x2) / 2.0
    center_y = (y1 + y2) / 2.0

    best_face = None
    best_distance = float("inf")

    for face in insight_faces:
        rx1, ry1, rx2, ry2 = map(float, face.bbox)
        if rx1 <= center_x <= rx2 and ry1 <= center_y <= ry2:
            return face

        r_center_x = (rx1 + rx2) / 2.0
        r_center_y = (ry1 + ry2) / 2.0
        distance = (r_center_x - center_x) ** 2 + (r_center_y - center_y) ** 2
        if distance < best_distance:
            best_distance = distance
            best_face = face

    return best_face


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
    print(f"SVM confidence threshold: {SVM_CONFIDENCE_THRESHOLD:.0%}")

    if not database:
        print("WARNING: No registered faces found.")

    print("\nLoading per-face anti-spoofing...")
    print("Each recognized face gets its own liveness controller and landmark detector.")

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

    # One liveness state per student. Each signal processor receives a crop
    # containing only that student's face, which keeps the existing MediaPipe
    # num_faces=1 configuration safe for multi-face classroom frames.
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
            current_time = datetime.now()
            elapsed_seconds = (current_time - current_session["start_time"]).total_seconds()
            session_duration_seconds = current_session["duration_minutes"] * 60

            if elapsed_seconds >= session_duration_seconds:
                print("\n[SESSION] Session duration completed.")
                close_session_and_mark_absentees(
                    session_manager, attendance, face_db, current_session
                )
                session_finished = True
                break

            ret, frame = cap.read()
            if not ret:
                print("ERROR: Failed to read camera.")
                break

            if frame_count % DETECTION_INTERVAL == 0 or not cached_results:
                detections = detector.detect(frame)
                insight_faces = recognizer.get_faces(frame) if detections else []
                new_results = []

                for detection in detections:
                    bbox = detection["bbox"]
                    insight_face = match_yolo_to_insightface(bbox, insight_faces)
                    match = None

                    if insight_face is not None:
                        prediction = svm.predict(insight_face.embedding)
                        if prediction is not None:
                            confidence = prediction["confidence"]
                            student_id = prediction["student_id"]
                            person = database.get(student_id)

                            if person is not None and (
                                confidence is None or confidence >= SVM_CONFIDENCE_THRESHOLD
                            ):
                                match = {
                                    "student_id": student_id,
                                    "name": person["name"],
                                    "confidence": confidence,
                                    "embedding": insight_face.embedding,
                                }

                    new_results.append({"bbox": bbox, "match": match})

                cached_results = new_results

            frame_count += 1
            status_lines = []
            recognized_ids = set()

            for result in cached_results:
                match = result["match"]
                if match is None:
                    continue

                student_id = match["student_id"]
                recognized_ids.add(student_id)
                name = match["name"]

                if student_id in session_attendance_cache:
                    status_lines.append(f"{name}: PRESENT")
                    continue

                x1, y1, x2, y2 = clamp_bbox(
                    result["bbox"], frame.shape[1], frame.shape[0]
                )
                face_crop = frame[y1:y2, x1:x2]
                if face_crop.size == 0:
                    continue

                if student_id not in liveness_controllers:
                    liveness_controllers[student_id] = LivenessDetector()
                if student_id not in liveness_signals:
                    liveness_signals[student_id] = FastLivenessSignals()

                signals = liveness_signals[student_id].process(face_crop)
                live_status = liveness_controllers[student_id].update(
                    blink=signals["blink"],
                    direction=signals["direction"],
                    gaze=signals["gaze"],
                )

                if live_status == "POSSIBLE PHOTO - NO MOVEMENT DETECTED":
                    spoof_warnings[student_id] = (
                        current_time.timestamp() + SPOOF_WARNING_SECONDS,
                        name,
                    )
                    status_lines.append(f"WARNING {name}: POSSIBLE PHOTO")
                    print(
                        f"[SECURITY] Possible fake/duplicate photo for {name}; "
                        "attendance NOT marked."
                    )
                    continue

                status_lines.append(
                    f"{name}: {live_status} (SVM: "
                    f"{(match['confidence'] or 0) * 100:.1f}%)"
                )

                if live_status == "LIVE":
                    attendance_status = session_manager.get_status_for_time(current_session)
                    if attendance_status is not None:
                        attendance_result = attendance.mark_attendance(
                            student_id=student_id,
                            name=name,
                            confidence=float(match["confidence"] or 0.0),
                            status=attendance_status,
                            session_id=session_id,
                        )
                        if attendance_result["success"]:
                            print(
                                f"[ATTENDANCE] {name} marked "
                                f"{attendance_status.upper()} for session {session_id} "
                                f"(SVM {(match['confidence'] or 0) * 100:.1f}%)"
                            )
                            session_attendance_cache[student_id] = attendance_result["record"]
                            liveness_controllers[student_id].reset()

            # Release liveness resources for students no longer visible.
            for student_id in list(liveness_signals):
                if student_id not in recognized_ids:
                    liveness_signals[student_id].close()
                    del liveness_signals[student_id]
                    liveness_controllers.pop(student_id, None)

            for result in cached_results:
                x1, y1, x2, y2 = result["bbox"]
                match = result["match"]
                if match is not None:
                    confidence = match["confidence"]
                    confidence_text = (
                        f" {confidence * 100:.1f}%" if confidence is not None else ""
                    )
                    label = f"{match['name']}{confidence_text}"
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
                    2,
                )

            remaining_seconds = max(0, int(session_duration_seconds - elapsed_seconds))
            cv2.putText(
                frame,
                f"Faces: {len(cached_results)}",
                (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 0),
                2,
            )
            cv2.putText(
                frame,
                f"Session: {remaining_seconds // 60:02d}:{remaining_seconds % 60:02d}",
                (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 0),
                2,
            )

            y_offset = 90
            for line in status_lines[:6]:
                cv2.putText(
                    frame,
                    line,
                    (20, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (255, 255, 0),
                    2,
                )
                y_offset += 26

            active_warnings = [
                (name, expiry)
                for _, (expiry, name) in spoof_warnings.items()
                if current_time.timestamp() < expiry
            ]
            if active_warnings:
                box_x1, box_y1 = 15, frame.shape[0] - 75
                box_x2, box_y2 = frame.shape[1] - 15, frame.shape[0] - 15
                cv2.rectangle(frame, (box_x1, box_y1), (box_x2, box_y2), (0, 0, 180), -1)
                cv2.putText(
                    frame,
                    "SECURITY WARNING: FAKE / DUPLICATE PHOTO",
                    (30, frame.shape[0] - 47),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (255, 255, 255),
                    2,
                )
                cv2.putText(
                    frame,
                    ", ".join(name for name, _ in active_warnings),
                    (30, frame.shape[0] - 23),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (255, 255, 255),
                    2,
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
            close_session_and_mark_absentees(
                session_manager, attendance, face_db, current_session
            )
        print("\nVisionAttend AI SVM attendance stopped.")


if __name__ == "__main__":
    main()
