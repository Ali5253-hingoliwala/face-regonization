import cv2
import mediapipe as mp
import math
from pathlib import Path

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


class HeadPoseDetector:

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

        # Important facial landmarks
        nose = landmarks[1]
        left_eye = landmarks[33]
        right_eye = landmarks[263]

        # Calculate horizontal face direction
        eye_center_x = (
            left_eye.x + right_eye.x
        ) / 2

        nose_offset = nose.x - eye_center_x

        if nose_offset < -0.035:
            direction = "LEFT"

        elif nose_offset > 0.035:
            direction = "RIGHT"

        else:
            direction = "CENTER"

        return {
            "direction": direction,
            "nose_offset": nose_offset
        }


    def close(self):

        self.detector.close()