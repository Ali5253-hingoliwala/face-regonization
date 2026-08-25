import os
import sys
from pathlib import Path

import numpy as np
from fastapi import HTTPException

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class FaceDatabase:
    """MongoDB-backed face database with enrollment uniqueness protection."""

    def __init__(self):
        db = get_database()
        self.collection = db["faces"]

    @staticmethod
    def _cosine_similarity(embedding1, embedding2):
        a = np.asarray(embedding1, dtype=np.float32)
        b = np.asarray(embedding2, dtype=np.float32)

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(np.dot(a, b) / (norm_a * norm_b))

    def _find_similar_face(self, embedding):
        """Return the closest registered face above the enrollment threshold."""
        threshold = float(os.getenv("FACE_UNIQUENESS_THRESHOLD", "0.60"))
        best_score = -1.0
        best_student_id = None

        for doc in self.collection.find({}, {"_id": 1, "embedding": 1}):
            stored_embedding = doc.get("embedding")
            if not stored_embedding:
                continue

            score = self._cosine_similarity(embedding, stored_embedding)
            if score > best_score:
                best_score = score
                best_student_id = doc.get("_id")

        if best_student_id is not None and best_score >= threshold:
            return best_student_id, best_score

        return None, best_score

    def add_person(self, student_id, name, embedding):
        embedding_list = (
            embedding.tolist()
            if hasattr(embedding, "tolist")
            else list(embedding)
        )

        # Never overwrite an existing identity and never allow two students
        # to register essentially the same face.
        existing_student_id, similarity = self._find_similar_face(embedding_list)
        if existing_student_id is not None:
            raise HTTPException(
                status_code=409,
                detail="This face is already registered or is too similar to an existing registered face. Please register with your own face."
            )

        self.collection.insert_one(
            {
                "_id": student_id,
                "name": name,
                "embedding": embedding_list
            }
        )

        print(f"Registered: {name} ({student_id})")
        return True

    def delete_person(self, student_id):
        result = self.collection.delete_one({"_id": student_id})
        return result.deleted_count > 0

    def get_person(self, student_id):
        doc = self.collection.find_one({"_id": student_id})

        if doc is None:
            return None

        return {
            "name": doc["name"],
            "embedding": doc["embedding"]
        }

    def get_all(self):
        data = {}

        for doc in self.collection.find():
            student_id = doc["_id"]

            data[student_id] = {
                "name": doc["name"],
                "embedding": doc["embedding"]
            }

        return data
