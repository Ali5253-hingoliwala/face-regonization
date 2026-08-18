import cv2

from detector import FaceDetector


def main():

    print("Starting VisionAttend AI...")

    # Create detector
    detector = FaceDetector(confidence=0.50)

    print("Detector loaded successfully!")

    # Open webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Could not open webcam.")
        return

    print("✅ Camera started.")
    print("Press Q to exit.")

    while True:

        ret, frame = cap.read()

        if not ret:
            print("❌ Failed to read camera frame.")
            break

        faces = detector.detect(frame)

        print(f"Faces detected: {len(faces)}")

        for face in faces:

            x1, y1, x2, y2 = face["bbox"]

            confidence = face["confidence"]

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            label = f"Face: {confidence * 100:.1f}%"

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

        cv2.putText(
            frame,
            f"Faces Detected: {len(faces)}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 0),
            2
        )

        cv2.imshow(
            "VisionAttend AI - YOLO Face Detection",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

    print("Camera closed.")


if __name__ == "__main__":
    main()