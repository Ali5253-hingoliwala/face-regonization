import cv2
import mediapipe as mp
from pathlib import Path

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


class IrisDetector:

    def __init__(self):

        current_dir = Path(__file__).resolve().parent

        model_path = str(
            current_dir / "models" / "face_landmarker.task"
        )

        base_options = python.BaseOptions(
            model_asset_path=model_path
        )

        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1
        )

        self.detector = vision.FaceLandmarker.create_from_options(
            options
        )

        self.timestamp = 0

    def process(self, frame):

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        self.timestamp += 33

        result = self.detector.detect_for_video(
            mp_image,
            self.timestamp
        )

        if not result.face_landmarks:

            return None

        landmarks = result.face_landmarks[0]

        # -------------------------------------------------
        # Iris landmark indices
        # -------------------------------------------------

        LEFT_IRIS = [468, 469, 470, 471, 472]

        RIGHT_IRIS = [473, 474, 475, 476, 477]

        left_iris = self._center(
            landmarks,
            LEFT_IRIS
        )

        right_iris = self._center(
            landmarks,
            RIGHT_IRIS
        )

        # -------------------------------------------------
        # Eye corner landmarks
        # -------------------------------------------------

        left_inner = landmarks[133]
        left_outer = landmarks[33]

        right_inner = landmarks[362]
        right_outer = landmarks[263]

        # -------------------------------------------------
        # Calculate relative iris position
        # -------------------------------------------------

        left_ratio = self._horizontal_ratio(
            left_iris,
            left_outer,
            left_inner
        )

        right_ratio = self._horizontal_ratio(
            right_iris,
            right_outer,
            right_inner
        )

        gaze_ratio = (
            left_ratio + right_ratio
        ) / 2

        if gaze_ratio < 0.35:

            gaze = "LEFT"

        elif gaze_ratio > 0.65:

            gaze = "RIGHT"

        else:

            gaze = "CENTER"

        return {
            "gaze": gaze,
            "gaze_ratio": gaze_ratio,
            "left_iris": left_iris,
            "right_iris": right_iris
        }

    def _center(self, landmarks, indices):

        x = 0
        y = 0
        z = 0

        for index in indices:

            point = landmarks[index]

            x += point.x
            y += point.y
            z += point.z

        count = len(indices)

        return (
            x / count,
            y / count,
            z / count
        )

    def _horizontal_ratio(
        self,
        iris,
        outer,
        inner
    ):

        iris_x = iris[0]

        outer_x = outer.x
        inner_x = inner.x

        min_x = min(
            outer_x,
            inner_x
        )

        max_x = max(
            outer_x,
            inner_x
        )

        width = max_x - min_x

        if width == 0:

            return 0.5

        ratio = (
            iris_x - min_x
        ) / width

        return max(
            0.0,
            min(1.0, ratio)
        )

    def close(self):

        self.detector.close()


def main():

    print("=" * 60)
    print("          VISIONATTEND AI")
    print("             IRIS TEST")
    print("=" * 60)

    detector = IrisDetector()

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():

        print("ERROR: Could not open webcam.")

        return

    print()
    print("Look at the camera.")
    print("Move your eyes LEFT and RIGHT.")
    print("Press Q to exit.")
    print()

    while True:

        success, frame = camera.read()

        if not success:

            break

        result = detector.process(frame)

        if result:

            gaze = result["gaze"]

            ratio = result["gaze_ratio"]

            cv2.putText(
                frame,
                f"Gaze: {gaze}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Ratio: {ratio:.2f}",
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            # Draw iris centers

            left = result["left_iris"]
            right = result["right_iris"]

            h, w = frame.shape[:2]

            left_x = int(left[0] * w)
            left_y = int(left[1] * h)

            right_x = int(right[0] * w)
            right_y = int(right[1] * h)

            cv2.circle(
                frame,
                (left_x, left_y),
                4,
                (0, 255, 255),
                -1
            )

            cv2.circle(
                frame,
                (right_x, right_y),
                4,
                (0, 255, 255),
                -1
            )

        else:

            cv2.putText(
                frame,
                "NO FACE",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 0, 255),
                2
            )

        cv2.imshow(
            "VisionAttend AI - Iris Detection",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):

            break

    camera.release()

    cv2.destroyAllWindows()

    detector.close()


if __name__ == "__main__":

    main()