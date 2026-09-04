"""Standalone multi-face SVM camera test.

This validates that every detected face in a frame is classified independently
by the trained SVM. It intentionally does NOT modify the attendance pipeline
or anti-spoofing system.

Controls:
  Q / ESC - quit
"""

from __future__ import annotations

import argparse

import cv2

from ml.detection.detector import FaceDetector
from ml.recognition.recognizer import FaceRecognizer
from ml.classification.svm_recognizer import SVMFaceClassifier

DEFAULT_CONFIDENCE_THRESHOLD = 0.70


def bbox_area(bbox):
    x1, y1, x2, y2 = bbox
    return max(0, x2 - x1) * max(0, y2 - y1)


def match_yolo_to_insightface(yolo_bbox, recognized_faces):
    """Match a YOLO detection to the InsightFace result containing its center."""
    x1, y1, x2, y2 = yolo_bbox
    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2

    candidates = []
    for r_face in recognized_faces:
        rx1, ry1, rx2, ry2 = map(int, r_face.bbox)
        if rx1 <= center_x <= rx2 and ry1 <= center_y <= ry2:
            candidates.append(r_face)

    if not candidates:
        return None

    return min(
        candidates,
        key=lambda face: bbox_area(face.bbox),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test independent SVM recognition for multiple faces."
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_CONFIDENCE_THRESHOLD,
        help="Minimum SVM probability for a known label (default: 0.70).",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Webcam index (default: 0).",
    )
    args = parser.parse_args()

    if not 0.0 <= args.threshold <= 1.0:
        raise SystemExit("ERROR: --threshold must be between 0 and 1.")

    print("Initializing YOLO detector...")
    detector = FaceDetector(confidence=0.50)
    print("Initializing InsightFace recognizer...")
    recognizer = FaceRecognizer()
    print("Loading trained SVM...")
    classifier = SVMFaceClassifier()

    camera = cv2.VideoCapture(args.camera)
    if not camera.isOpened():
        raise SystemExit(f"ERROR: Could not open camera index {args.camera}.")

    print("\nMulti-face SVM test started.")
    print("Show Student 1 and Student 2 together if possible.")
    print("Each face is classified independently.")
    print("Press Q or ESC to quit.\n")

    try:
        while True:
            ok, frame = camera.read()
            if not ok:
                print("WARNING: Could not read a camera frame.")
                break

            yolo_faces = detector.detect(frame)
            recognized_faces = recognizer.get_faces(frame) if yolo_faces else []

            for face in yolo_faces:
                bbox = face["bbox"]
                r_face = match_yolo_to_insightface(bbox, recognized_faces)
                result = classifier.predict(r_face.embedding) if r_face is not None else None

                label = "UNKNOWN"
                confidence_text = ""

                if result is not None:
                    confidence = result["confidence"]
                    if confidence is not None:
                        confidence_text = f" {confidence * 100:.1f}%"
                        if confidence >= args.threshold:
                            label = str(result["student_id"])
                    else:
                        label = str(result["student_id"])

                x1, y1, x2, y2 = map(int, bbox)
                box_color = (0, 255, 0) if label != "UNKNOWN" else (0, 0, 255)

                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                cv2.putText(
                    frame,
                    f"SVM: {label}{confidence_text}",
                    (x1, max(25, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.60,
                    box_color,
                    2,
                    cv2.LINE_AA,
                )

            cv2.putText(
                frame,
                f"Faces detected: {len(yolo_faces)}",
                (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (255, 255, 0),
                2,
            )

            cv2.imshow("VisionAttend AI - Multi-Face SVM Test", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print("Multi-face SVM test stopped.")


if __name__ == "__main__":
    main()
