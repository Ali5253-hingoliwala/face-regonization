import cv2
import mediapipe as mp
from pathlib import Path

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from blink_detection import eye_aspect_ratio, EAR_THRESHOLD, BLINK_CONSECUTIVE_FRAMES


CURRENT_DIR = Path(__file__).resolve().parent
MODEL_PATH = str(CURRENT_DIR / "models" / "face_landmarker.task")

# --------------------------------------------------------------
# These indices are fixed MediaPipe Face Landmarker landmark IDs
# (not tunable business logic), mirrored from head_pose.py and
# iris_detector.py so we can compute everything from ONE landmark
# pass instead of instantiating a separate FaceLandmarker per signal.
# --------------------------------------------------------------

NOSE_INDEX = 1
LEFT_EYE_INDEX = 33
RIGHT_EYE_INDEX = 263
HEAD_TURN_THRESHOLD = 0.035

LEFT_EYE_EAR_POINTS = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_EAR_POINTS = [33, 160, 158, 133, 153, 144]

LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]

LEFT_EYE_OUTER = 33
LEFT_EYE_INNER = 133
RIGHT_EYE_OUTER = 263
RIGHT_EYE_INNER = 362


def _iris_center(landmarks, indices):

    x = y = z = 0

    for index in indices:
        point = landmarks[index]
        x += point.x
        y += point.y
        z += point.z

    count = len(indices)

    return (x / count, y / count, z / count)


def _horizontal_ratio(iris, outer, inner):

    iris_x = iris[0]

    min_x = min(outer.x, inner.x)
    max_x = max(outer.x, inner.x)

    width = max_x - min_x

    if width == 0:
        return 0.5

    ratio = (iris_x - min_x) / width

    return max(0.0, min(1.0, ratio))


class FastLivenessSignals:
    """
    Runs ONE MediaPipe FaceLandmarker pass per frame and derives
    blink, head-pose direction, and gaze from the same landmark set.

    Replaces running BlinkDetector + HeadPoseDetector + IrisDetector
    as three independent landmarkers (which triples per-frame cost).

    blink_detection.py, head_pose.py, and iris_detector.py are left
    untouched — their standalone scripts (test_head_pose.py etc.)
    still work exactly as before.
    """

    def __init__(self):

        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)

        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1
        )

        self.detector = vision.FaceLandmarker.create_from_options(options)

        self.timestamp = 0

        self.blink_count = 0
        self.eye_closed_frames = 0
        self.blink_detected = False

    def process(self, frame):

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        self.timestamp += 33

        result = self.detector.detect_for_video(mp_image, self.timestamp)

        if not result.face_landmarks:

            self.blink_detected = False

            return {
                "face_detected": False,
                "blink": False,
                "blink_count": self.blink_count,
                "direction": None,
                "gaze": None
            }

        landmarks = result.face_landmarks[0]

        # ---- Blink (reuses blink_detection.py's exact EAR math) ----

        left_ear = eye_aspect_ratio(landmarks, LEFT_EYE_EAR_POINTS)
        right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE_EAR_POINTS)

        avg_ear = (left_ear + right_ear) / 2.0

        if avg_ear < EAR_THRESHOLD:

            self.eye_closed_frames += 1

        else:

            if self.eye_closed_frames >= BLINK_CONSECUTIVE_FRAMES:
                self.blink_count += 1
                self.blink_detected = True
            else:
                self.blink_detected = False

            self.eye_closed_frames = 0

        # ---- Head pose (mirrors head_pose.py) ----

        nose = landmarks[NOSE_INDEX]
        left_eye = landmarks[LEFT_EYE_INDEX]
        right_eye = landmarks[RIGHT_EYE_INDEX]

        eye_center_x = (left_eye.x + right_eye.x) / 2
        nose_offset = nose.x - eye_center_x

        if nose_offset < -HEAD_TURN_THRESHOLD:
            direction = "LEFT"
        elif nose_offset > HEAD_TURN_THRESHOLD:
            direction = "RIGHT"
        else:
            direction = "CENTER"

        # ---- Gaze (mirrors iris_detector.py) ----

        left_iris = _iris_center(landmarks, LEFT_IRIS)
        right_iris = _iris_center(landmarks, RIGHT_IRIS)

        left_ratio = _horizontal_ratio(
            left_iris,
            landmarks[LEFT_EYE_OUTER],
            landmarks[LEFT_EYE_INNER]
        )

        right_ratio = _horizontal_ratio(
            right_iris,
            landmarks[RIGHT_EYE_OUTER],
            landmarks[RIGHT_EYE_INNER]
        )

        gaze_ratio = (left_ratio + right_ratio) / 2

        if gaze_ratio < 0.35:
            gaze = "LEFT"
        elif gaze_ratio > 0.65:
            gaze = "RIGHT"
        else:
            gaze = "CENTER"

        return {
            "face_detected": True,
            "blink": self.blink_detected,
            "blink_count": self.blink_count,
            "direction": direction,
            "gaze": gaze
        }

    def close(self):
        self.detector.close()