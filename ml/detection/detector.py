from pathlib import Path

from ultralytics import YOLO


class FaceDetector:

    def __init__(self, confidence=0.50):

        # Find the project root
        project_root = Path(__file__).resolve().parents[2]

        # Path to our trained face detection model
        model_path = (
            project_root
            / "ml"
            / "models"
            / "best.pt"
        )

        # Check whether model exists
        if not model_path.exists():
            raise FileNotFoundError(
                f"Face model not found:\n{model_path}"
            )

        print("Loading YOLO Face Detection Model...")

        self.model = YOLO(str(model_path))

        self.confidence = confidence

        print("YOLO Face Detector Ready!")

    def detect(self, frame):

        results = self.model.predict(
            source=frame,
            conf=self.confidence,
            imgsz=320,
            verbose=False
        )

        result = results[0]

        detections = []

        if result.boxes is None:
            return detections

        for box in result.boxes:

            coordinates = box.xyxy[0].cpu().numpy()

            x1, y1, x2, y2 = coordinates.astype(int)

            confidence = float(box.conf[0])

            detections.append({
                "bbox": (x1, y1, x2, y2),
                "confidence": confidence
            })

        return detections