import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class FaceDatabase:
    """MongoDB-backed face database."""

    def __init__(self):
        db = get_database()
        self.collection = db["faces"]

    def add_person(self, student_id, name, embedding):
        embedding_list = (
            embedding.tolist()
            if hasattr(embedding, "tolist")
            else list(embedding)
        )

        self.collection.update_one(
            {"_id": student_id},
            {
                "$set": {
                    "name": name,
                    "embedding": embedding_list
                }
            },
            upsert=True
        )

        print(f"Registered: {name} ({student_id})")

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
