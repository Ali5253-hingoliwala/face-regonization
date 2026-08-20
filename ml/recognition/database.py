import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
UTILS_DIR = CURRENT_DIR.parents[0] / "utils"

sys.path.append(str(UTILS_DIR))

from mongo_client import get_database


class FaceDatabase:
    """
    MongoDB-backed version of FaceDatabase.

    Public method names (get_all, add_person) are kept identical
    to the original JSON-file version, so nothing else in the
    project (recognizer.py, attendance_pipeline.py, register.py,
    live_attendance.py) needs to change.
    """

    def __init__(self):

        db = get_database()

        self.collection = db["faces"]

    def add_person(
        self,
        student_id,
        name,
        embedding
    ):

        # embedding may be a numpy array (as returned by
        # FaceRecognizer.get_embedding) -- convert to a plain list
        # for storage, same as the original .tolist() call.

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

    def get_all(self):
        """
        Returns all registered people in the same shape as the
        JSON version: { student_id: { "name": ..., "embedding": [...] } }
        """

        data = {}

        for doc in self.collection.find():

            student_id = doc["_id"]

            data[student_id] = {
                "name": doc["name"],
                "embedding": doc["embedding"]
            }

        return data