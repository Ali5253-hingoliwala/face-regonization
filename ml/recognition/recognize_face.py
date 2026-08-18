import cv2

from recognizer import FaceRecognizer
from database import FaceDatabase


def main():

    print("=" * 50)
    print("       VISIONATTEND AI")
    print("       FACE RECOGNITION")
    print("=" * 50)

    recognizer = FaceRecognizer()

    database = FaceDatabase()

    registered_people = database.get_all()

    print(
        f"Loaded {len(registered_people)} registered person(s)."
    )

    if len(registered_people) == 0:

        print("❌ No registered faces found.")

        return

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():

        print("❌ Could not open webcam.")

        return

    print()
    print("Recognition started.")
    print("Press Q to exit.")

    while True:

        ret, frame = cap.read()

        if not ret:

            print("❌ Failed to read camera.")

            break

        # Get faces + embeddings
        faces = recognizer.get_faces(frame)

        for face in faces:

            # Bounding box
            bbox = face.bbox.astype(int)

            x1, y1, x2, y2 = bbox

            # Face embedding
            embedding = face.embedding

            # Find registered person
            match = recognizer.find_best_match(
                embedding,
                registered_people,
                threshold=0.45
            )

            if match:

                name = match["name"]

                score = match["score"]

                label = (
                    f"{name} | "
                    f"{score * 100:.1f}%"
                )

                # Green
                box_color = (0, 255, 0)

            else:

                label = "UNKNOWN"

                # Red
                box_color = (0, 0, 255)

            # Draw box
            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                box_color,
                2
            )

            # Draw label
            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                box_color,
                2
            )

        cv2.putText(
            frame,
            f"Registered: {len(registered_people)}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 0),
            2
        )

        cv2.imshow(
            "VisionAttend AI - Face Recognition",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()

    cv2.destroyAllWindows()

    print("Recognition stopped.")


if __name__ == "__main__":
    main()