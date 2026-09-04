"""SVM inference helper.

This module only classifies an already-generated face embedding. It does not
perform face detection or liveness detection, so the anti-spoofing pipeline
remains responsible for deciding whether a face is live.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "ml" / "classification" / "model" / "face_svm.joblib"


class SVMFaceClassifier:
    def __init__(self, model_path: str | Path = DEFAULT_MODEL_PATH):
        self.model_path = Path(model_path)
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"SVM model not found: {self.model_path}. "
                "Train it first with ml/classification/train_svm.py."
            )
        self.model = joblib.load(self.model_path)

    def predict(self, embedding) -> dict | None:
        vector = np.asarray(embedding, dtype=np.float32).reshape(1, -1)
        if vector.size == 0 or not np.all(np.isfinite(vector)):
            return None

        student_id = str(self.model.predict(vector)[0])
        result = {
            "student_id": student_id,
            "confidence": None,
        }

        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(vector)[0]
            result["confidence"] = float(np.max(probabilities))

        return result
