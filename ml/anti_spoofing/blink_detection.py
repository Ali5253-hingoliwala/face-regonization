import cv2
import time
import math
from pathlib import Path
import mediapipe as mp

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


CURRENT_DIR = Path(__file__).resolve().parent

MODEL_PATH = str(
    CURRENT_DIR / "models" / "face_landmarker.task"
)

EAR_THRESHOLD = 0.21

BLINK_CONSECUTIVE_FRAMES = 2

# ============================================================
# DISTANCE FUNCTION
# ============================================================

def distance(point1, point2):

    return math.sqrt(
        (point1.x - point2.x) ** 2
        +
        (point1.y - point2.y) ** 2
    )


# ============================================================
# EYE ASPECT RATIO
# ============================================================

def eye_aspect_ratio(landmarks, indices):

    p1 = landmarks[indices[0]]
    p2 = landmarks[indices[1]]
    p3 = landmarks[indices[2]]
    p4 = landmarks[indices[3]]
    p5 = landmarks[indices[4]]
    p6 = landmarks[indices[5]]

    vertical_1 = distance(p2, p6)

    vertical_2 = distance(p3, p5)

    horizontal = distance(p1, p4)

    if horizontal == 0:

        return 0.0

    ear = (
        vertical_1 + vertical_2
    ) / (
        2.0 * horizontal
    )

    return ear


# ============================================================
# BLINK DETECTOR
# ============================================================

class BlinkDetector:

    def __init__(self):

        print("Initializing MediaPipe Face Landmarker...")

        base_options = python.BaseOptions(
            model_asset_path=MODEL_PATH
        )

        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1
        )

        self.detector = vision.FaceLandmarker.create_from_options(
            options
        )

        self.frame_timestamp = 0

        self.blink_count = 0

        self.eye_closed_frames = 0

        self.blink_detected = False

        print("Blink detector ready!")


    # ========================================================
    # PROCESS FRAME
    # ========================================================

    def process(self, frame):

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        mp_image = mp.Image(
         image_format=mp.ImageFormat.SRGB,
         data=rgb_frame
         )

        self.frame_timestamp += 33

        result = self.detector.detect_for_video(
            mp_image,
            self.frame_timestamp
        )

        if not result.face_landmarks:

            return {
                "face_detected": False,
                "blink": False,
                "blink_count": self.blink_count
            }

        landmarks = result.face_landmarks[0]

        # ----------------------------------------------------
        # MediaPipe Face Landmarker eye landmarks
        # ----------------------------------------------------

        LEFT_EYE = [
            362,
            385,
            387,
            263,
            373,
            380
        ]

        RIGHT_EYE = [
            33,
            160,
            158,
            133,
            153,
            144
        ]

        left_ear = eye_aspect_ratio(
            landmarks,
            LEFT_EYE
        )

        right_ear = eye_aspect_ratio(
            landmarks,
            RIGHT_EYE
        )

        average_ear = (
            left_ear + right_ear
        ) / 2.0

        # ----------------------------------------------------
        # Detect eye closure
        # ----------------------------------------------------

        if average_ear < EAR_THRESHOLD:

            self.eye_closed_frames += 1

        else:

            # Eyes opened after being closed
            if (
                self.eye_closed_frames
                >= BLINK_CONSECUTIVE_FRAMES
            ):

                self.blink_count += 1

                self.blink_detected = True

            else:

                self.blink_detected = False

            self.eye_closed_frames = 0

        return {
            "face_detected": True,
            "blink": self.blink_detected,
            "blink_count": self.blink_count,
            "ear": average_ear
        }


# ============================================================
# TEST CAMERA
# ============================================================

def main():

    print("=" * 60)

    print("             VISIONATTEND AI")

    print("             BLINK DETECTOR")

    print("=" * 60)

    detector = BlinkDetector()

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():

        print("ERROR: Could not open webcam.")

        return

    print()

    print("Look at the camera.")

    print("Blink your eyes.")

    print("Press Q to exit.")

    print()

    last_blink_time = 0

    while True:

        success, frame = camera.read()

        if not success:

            print("ERROR: Could not read camera.")

            break

        result = detector.process(frame)

        # ----------------------------------------------------
        # Display information
        # ----------------------------------------------------

        if not result["face_detected"]:

            status = "NO FACE"

            color = (0, 0, 255)

        else:

            ear = result.get(
                "ear",
                0
            )

            status = (
                f"EAR: {ear:.3f}"
            )

            color = (0, 255, 0)

        cv2.putText(
            frame,
            status,
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2
        )

        cv2.putText(
            frame,
            f"Blinks: {result['blink_count']}",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 0),
            2
        )

        # ----------------------------------------------------
        # Blink detected
        # ----------------------------------------------------

        if result["blink"]:

            last_blink_time = time.time()

        if (
            time.time() - last_blink_time
            < 1.0
        ):

            cv2.putText(
                frame,
                "BLINK DETECTED!",
                (20, 110),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

        cv2.putText(
            frame,
            "Press Q to exit",
            (20, 145),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        cv2.imshow(
            "VisionAttend AI - Blink Detection",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):

            break

    camera.release()

    cv2.destroyAllWindows()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()