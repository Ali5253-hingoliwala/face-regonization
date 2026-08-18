import cv2
import time

from blink_detection import BlinkDetector
from head_pose import HeadPoseDetector
from liveness import LivenessDetector


def main():

    print("=" * 60)
    print("             VISIONATTEND AI")
    print("          REAL-TIME LIVENESS")
    print("=" * 60)

    # ---------------------------------------------------------
    # Initialize detectors
    # ---------------------------------------------------------

    print("\nInitializing blink detector...")

    blink_detector = BlinkDetector()

    print("Initializing head-pose detector...")

    head_detector = HeadPoseDetector()

    print("Initializing liveness controller...")

    liveness = LivenessDetector()

    # ---------------------------------------------------------
    # Camera
    # ---------------------------------------------------------

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():

        print("ERROR: Could not open webcam.")

        return

    print("\nCamera started.")
    print("Complete the liveness challenge.")
    print("Press Q to exit.\n")

    # ---------------------------------------------------------
    # Challenge state
    # ---------------------------------------------------------

    challenge = "BLINK"

    challenge_start = time.time()

    challenge_timeout = 10

    # ---------------------------------------------------------
    # Main loop
    # ---------------------------------------------------------

    while True:

        success, frame = camera.read()

        if not success:

            print("ERROR: Could not read camera.")

            break

        # -----------------------------------------------------
        # Run blink detector
        # -----------------------------------------------------

        blink_result = blink_detector.process(frame)

        # -----------------------------------------------------
        # Run head-pose detector
        # -----------------------------------------------------

        head_result = head_detector.process(frame)

        # -----------------------------------------------------
        # Process current challenge
        # -----------------------------------------------------

        if liveness.is_live():

            status = "LIVE"

            status_color = (0, 255, 0)

        elif liveness.has_failed():

            status = "FAILED"

            status_color = (0, 0, 255)

        else:

            # =================================================
            # CHALLENGE 1 — BLINK
            # =================================================

            if challenge == "BLINK":

                instruction = "PLEASE BLINK"

                if blink_result["blink"]:

                    liveness.register_blink()

                    challenge = "HEAD"

                    challenge_start = time.time()

            # =================================================
            # CHALLENGE 2 — HEAD MOVEMENT
            # =================================================

            elif challenge == "HEAD":

                instruction = "TURN YOUR HEAD LEFT OR RIGHT"

                if head_result:

                    direction = head_result["direction"]

                    if direction != "CENTER":

                        liveness.register_head_movement()

            # =================================================
            # TIMEOUT
            # =================================================

            if (
                time.time() - challenge_start
                > challenge_timeout
            ):

                status = "CHALLENGE TIMEOUT"

                status_color = (0, 0, 255)

            else:

                status = liveness.get_status()

                status_color = (0, 255, 255)

        # -----------------------------------------------------
        # Display challenge
        # -----------------------------------------------------

        if liveness.is_live():

            instruction = "LIVE PERSON VERIFIED"

        elif liveness.has_failed():

            instruction = "LIVENESS FAILED"

        elif challenge == "BLINK":

            instruction = "PLEASE BLINK"

        else:

            instruction = "TURN HEAD LEFT OR RIGHT"

        # -----------------------------------------------------
        # Display information
        # -----------------------------------------------------

        cv2.putText(
            frame,
            "VisionAttend AI",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            instruction,
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            status_color,
            2
        )

        cv2.putText(
            frame,
            f"Status: {status}",
            (20, 110),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            status_color,
            2
        )

        cv2.putText(
            frame,
            f"Blinks: {blink_result['blink_count']}",
            (20, 145),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        if head_result:

            cv2.putText(
                frame,
                f"Head: {head_result['direction']}",
                (20, 180),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

        cv2.putText(
            frame,
            "Press Q to exit",
            (20, 215),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        # -----------------------------------------------------
        # Show camera
        # -----------------------------------------------------

        cv2.imshow(
            "VisionAttend AI - Liveness Challenge",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):

            break

    # ---------------------------------------------------------
    # Cleanup
    # ---------------------------------------------------------

    camera.release()

    cv2.destroyAllWindows()

    blink_detector.close()

    head_detector.close()

    print("\nLiveness challenge stopped.")


if __name__ == "__main__":

    main()