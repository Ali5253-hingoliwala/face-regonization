"""Collect 10 diverse, live face embeddings for an already-registered student.

This is deliberately a separate enrollment-training step. It does not change
email verification, account creation, the existing primary embedding, or the
live attendance pipeline.

The collector requires exactly one detected face, waits for a liveness signal,
and rejects embeddings that are too similar to samples already accepted.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"
ANTI_SPOOFING_DIR = PROJECT_ROOT / "ml" / "anti_spoofing"
sys.path.extend([str(RECOGNITION_DIR), str(ANTI_SPOOFING_DIR)])

from database import FaceDatabase  # noqa: E402
from recognizer import FaceRecognizer  # noqa: E402
from fast_liveness import FastLivenessSignals  # noqa: E402
from liveness import LivenessDetector  # noqa: E402

TARGET_SAMPLES = 10
MIN_CAPTURE_GAP_SECONDS = 0.60
DIVERSITY_THRESHOLD = float(os.getenv("TRAINING_SAMPLE_SIMILARITY_THRESHOLD", "0.985"))


def is_diverse(candidate, accepted) -> bool:
    """Return True only when candidate is not effectively a duplicate."""
    if not accepted:
        return True

    candidate = np.asarray(candidate, dtype=np.float32)
    for previous in accepted:
        previous = np.asarray(previous, dtype=np.float32)
        norm_a = np.linalg.norm(candidate)
        norm_b = np.linalg.norm(previous)
        if norm_a == 0 or norm_b == 0:
            continue
        similarity = float(np.dot(candidate, previous) / (norm_a * norm_b))
        if similarity >= DIVERSITY_THRESHOLD:
            return False
    return True


def collect(student_id: str, target: int = TARGET_SAMPLES) -> None:
    database = FaceDatabase()
    person = database.get_person(student_id)
    if person is None:
        raise ValueError(f"Student '{student_id}' is not registered. Complete normal registration first.")

    recognizer = FaceRecognizer()
    liveness_signals = FastLivenessSignals()
    liveness = LivenessDetector()
    accepted: list[np.ndarray] = []
    last_capture = 0.0

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        liveness_signals.close()
        raise RuntimeError("Could not open webcam.")

    print("=" * 60)
    print("VISIONATTEND AI - ML TRAINING ENROLLMENT")
    print("=" * 60)
    print(f"Student: {person['name']} ({student_id})")
    print(f"Target: {target} diverse live samples")
    print("Only ONE face must be visible.")
    print("Move naturally: slightly left/right/up/down between captures.")
    print("Blink or change head/gaze direction so liveness can be verified.")
    print("Press Q to cancel.\n")

    try:
        while len(accepted) < target:
            ret, frame = cap.read()
            if not ret:
                raise RuntimeError("Failed to capture webcam frame.")

            faces = recognizer.get_faces(frame)
            face_count = len(faces)
            status = "NO FACE"

            if face_count == 1:
                signals = liveness_signals.process(frame)
                status = liveness.update(
                    blink=signals["blink"],
                    direction=signals["direction"],
                    gaze=signals["gaze"],
                )

                if status == "LIVE" and time.time() - last_capture >= MIN_CAPTURE_GAP_SECONDS:
                    embedding = faces[0].embedding
                    if is_diverse(embedding, accepted):
                        accepted.append(np.asarray(embedding, dtype=np.float32).copy())
                        last_capture = time.time()
                        liveness.reset()
                        print(f"Accepted sample {len(accepted)}/{target}")
                    else:
                        status = "MOVE SLIGHTLY - SAMPLE TOO SIMILAR"
            elif face_count > 1:
                status = "MULTIPLE FACES - ONLY ONE ALLOWED"
            else:
                liveness.reset()

            cv2.putText(frame, f"ML Samples: {len(accepted)}/{target}", (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 255), 2)
            cv2.putText(frame, f"Faces: {face_count}", (20, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
            cv2.putText(frame, status, (20, 94), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 255, 255), 2)
            cv2.putText(frame, "Q = Cancel", (20, 126), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 255, 255), 2)
            cv2.imshow("VisionAttend AI - ML Enrollment", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("\nTraining enrollment cancelled. No samples were written.")
                return

        total = database.add_training_embeddings(student_id, accepted)
        print(f"\nTraining enrollment complete: {total} total samples stored for {student_id}.")
        print("The original primary embedding was not changed.")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        liveness_signals.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect diverse live face embeddings for SVM training.")
    parser.add_argument("student_id", help="Already-registered student ID")
    parser.add_argument("--samples", type=int, default=TARGET_SAMPLES, choices=range(2, 51))
    args = parser.parse_args()
    collect(args.student_id, args.samples)


if __name__ == "__main__":
    main()
