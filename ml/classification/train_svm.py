"""Train an SVM classifier from registered face embeddings in MongoDB.

This module is intentionally separate from the live recognition/anti-spoofing
pipeline. It does not modify attendance behavior.

Supported face documents:
- Existing: {"_id": student_id, "name": name, "embedding": [...]}
- Upgraded: {"_id": student_id, "name": name,
             "embedding": [...], "training_embeddings": [[...], ...]}

The existing single embedding is used as a fallback so the script can inspect
an existing database, but real training requires multiple samples per student.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

PROJECT_ROOT = Path(__file__).resolve().parents[2]
UTILS_DIR = PROJECT_ROOT / "ml" / "utils"
sys.path.append(str(UTILS_DIR))

from mongo_client import get_database  # noqa: E402

DEFAULT_MODEL_PATH = PROJECT_ROOT / "ml" / "classification" / "model" / "face_svm.joblib"
RANDOM_STATE = 42
MIN_SAMPLES_PER_STUDENT = 2


def load_embedding_dataset() -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load training embeddings and labels from the MongoDB faces collection."""
    collection = get_database()["faces"]
    samples: list[list[float]] = []
    labels: list[str] = []
    names: dict[str, str] = {}

    for doc in collection.find({}, {"_id": 1, "name": 1, "embedding": 1, "training_embeddings": 1}):
        student_id = str(doc.get("_id", "")).strip()
        if not student_id:
            continue

        names[student_id] = str(doc.get("name", student_id))
        training_embeddings = doc.get("training_embeddings") or []

        # Backward-compatible fallback for the current database schema.
        if not training_embeddings and doc.get("embedding"):
            training_embeddings = [doc["embedding"]]

        for embedding in training_embeddings:
            try:
                vector = np.asarray(embedding, dtype=np.float32).reshape(-1)
            except (TypeError, ValueError):
                continue
            if vector.size > 0 and np.all(np.isfinite(vector)):
                samples.append(vector.tolist())
                labels.append(student_id)

    if not samples:
        raise RuntimeError("No usable face embeddings were found in the faces collection.")

    dimensions = {len(sample) for sample in samples}
    if len(dimensions) != 1:
        raise RuntimeError(f"Embedding dimensions are inconsistent: {sorted(dimensions)}")

    counts = {student_id: labels.count(student_id) for student_id in set(labels)}
    insufficient = {sid: count for sid, count in counts.items() if count < MIN_SAMPLES_PER_STUDENT}
    if insufficient:
        details = ", ".join(f"{names.get(sid, sid)}={count}" for sid, count in insufficient.items())
        raise RuntimeError(
            "Not enough samples for every student. Collect multiple training embeddings first. "
            f"Current counts: {details}"
        )

    return np.asarray(samples, dtype=np.float32), np.asarray(labels), [names[sid] for sid in sorted(names)]


def train(model_path: Path) -> dict:
    X, y, _ = load_embedding_dataset()
    class_counts = {str(label): int(np.sum(y == label)) for label in np.unique(y)}

    # Stratification keeps each student's class represented in both sets.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("svm", SVC(kernel="rbf", C=10.0, gamma="scale", probability=True, class_weight="balanced")),
        ]
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, predictions))
    labels = sorted(np.unique(y).tolist())
    report = classification_report(y_test, predictions, labels=labels, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, predictions, labels=labels).tolist()

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)

    result = {
        "samples": int(len(X)),
        "embedding_dimensions": int(X.shape[1]),
        "students": int(len(labels)),
        "class_counts": class_counts,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "accuracy": accuracy,
        "classification_report": report,
        "labels": labels,
        "confusion_matrix": matrix,
        "model_path": str(model_path),
    }

    metrics_path = model_path.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the VisionAttend SVM face classifier.")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    args = parser.parse_args()

    print("=" * 60)
    print("VISIONATTEND AI - SVM TRAINING")
    print("=" * 60)

    try:
        result = train(args.model)
    except Exception as exc:
        print(f"\nERROR: {exc}")
        raise SystemExit(1)

    print(f"\nStudents: {result['students']}")
    print(f"Samples: {result['samples']}")
    print(f"Embedding dimensions: {result['embedding_dimensions']}")
    print(f"Training samples: {result['train_samples']}")
    print(f"Test samples: {result['test_samples']}")
    print(f"Accuracy: {result['accuracy'] * 100:.2f}%")
    print(f"\nModel saved to: {result['model_path']}")
    print(f"Metrics saved to: {Path(result['model_path']).with_suffix('.metrics.json')}")


if __name__ == "__main__":
    main()
