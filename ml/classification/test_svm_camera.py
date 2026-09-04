"""Standalone camera test for the trained SVM face classifier.

This intentionally does not touch the live attendance pipeline or liveness
system. It extracts a face embedding with the existing InsightFace recognizer,
then sends that embedding to the trained SVM and displays the prediction.

Controls:
  Q / ESC  - quit
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from ml.recognition.recognizer import FaceRecognizer
from ml.classification.svm_recognizer import SVMFaceClassifier

DEFAULT_CONFIDENCE_THRESHOLD = 0.70


def main() -> None:
    parser = argparse.ArgumentParser(description="Test the trained VisionAttend SVM with a webcam.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_CONFIDENCE_THRESHOLD,
        help="Minimum SVM probability required to display a known student (default: 0.70).",
    )
    parser.add_argument("--camera", type=int, default=0, help="Webcam index (default: 0).")
    args = parser.parse_args()

    if not 0.0 <= args.threshold <= 1.0:
        raise SystemExit("ERROR: --threshold must be between 0 and 1.")

    print("Initializing face recognizer...")
    recognizer = FaceRecognizer()
    classifier = SVMFaceClassifier()

    camera = cv2.VideoCapture(args.camera)
    if not camera.isOpened():
        raise SystemExit(f"ERROR: Could not open camera index {args.camera}.")

    print("\nSVM camera test started.")
    print("Show Student A, Student B, and an unknown person.")
    print("Press Q or ESC to quit.\n")

    try:
        while True:
            ok, frame = camera.read()
            if not ok:
                print("WARNING: Could not read a camera frame.")
                break

            faces = recognizer.get_faces(frame)

            for face in faces:
                bbox = face.bbox.astype(int)
                x1, y1, x2, y2 = bbox.tolist()
                result = classifier.predict(face.embedding)

                label = "UNKNOWN"
                confidence_text = ""
                if result is not None:
                    confidence = result["confidence"]
                    if confidence is not None:
                        confidence_text = f" {confidence * 100:.1f}%"
                        if confidence >= args.threshold:
                            label = f"{result['student_id']}"
                    else:
                        label = str(result["student_id"])

                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 2)
                cv2.putText(
                    frame,
                    f"SVM: {label}{confidence_text}",
                    (x1, max(25, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

            cv2.imshow("VisionAttend AI - SVM Test", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print("SVM camera test stopped.")


if __name__ == "__main__":
    main()
