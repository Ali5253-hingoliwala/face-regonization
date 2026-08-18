import json
from pathlib import Path


class FaceDatabase:

    def __init__(self):

        project_root = Path(__file__).resolve().parents[2]

        self.file_path = (
            project_root
            / "database"
            / "face_embeddings.json"
        )

        self.file_path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        if not self.file_path.exists():
            self.save({})

    def load(self):

        with open(
            self.file_path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    def save(self, data):

        with open(
            self.file_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                data,
                file,
                indent=4
            )

    def add_person(
        self,
        student_id,
        name,
        embedding
    ):

        data = self.load()

        data[student_id] = {
            "name": name,
            "embedding": embedding.tolist()
        }

        self.save(data)

        print(
            f"✅ Registered: {name} ({student_id})"
        )

    def get_all(self):

        return self.load()