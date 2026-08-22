import sys
import json
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

RECOGNITION_DIR = PROJECT_ROOT / "ml" / "recognition"

sys.path.append(str(RECOGNITION_DIR))

from database import FaceDatabase


JSON_PATH = PROJECT_ROOT / "database" / "face_embeddings.json"


def main():

    print("=" * 60)
    print("   MIGRATE face_embeddings.json -> MongoDB Atlas")
    print("=" * 60)

    if not JSON_PATH.exists():

        print(f"\nERROR: {JSON_PATH} not found.")
        return

    with open(JSON_PATH, "r") as f:
        old_data = json.load(f)

    print(f"\nFound {len(old_data)} registered people in the old JSON file.")

    face_db = FaceDatabase()

    already_in_db = face_db.get_all()

    migrated = 0
    skipped = 0

    for student_id, person in old_data.items():

        if student_id in already_in_db:

            print(f"  SKIP  {student_id} ({person['name']}) — already in MongoDB")
            skipped += 1
            continue

        face_db.add_person(
            student_id,
            person["name"],
            person["embedding"]
        )

        migrated += 1

    print()
    print(f"Migrated: {migrated}")
    print(f"Skipped (already present): {skipped}")

    print("\nVerifying — people now in MongoDB:")

    for student_id, person in face_db.get_all().items():
        print(f"  {student_id}: {person['name']}")


if __name__ == "__main__":
    main()