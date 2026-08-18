import cv2

from head_pose import HeadPoseDetector


def main():

    print("=" * 50)
    print("        VISIONATTEND AI")
    print("        HEAD POSE TEST")
    print("=" * 50)

    detector = HeadPoseDetector()

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        print("ERROR: Could not open camera.")
        return

    print()
    print("Camera started.")
    print("Move your head LEFT and RIGHT.")
    print("Press Q to exit.")
    print()

    while True:

        success, frame = camera.read()

        if not success:
            print("Could not read camera frame.")
            break

        result = detector.process(frame)

        if result:

            direction = result["direction"]
            offset = result["nose_offset"]

            cv2.putText(
                frame,
                f"Direction: {direction}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Offset: {offset:.3f}",
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

        else:

            cv2.putText(
                frame,
                "NO FACE",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2
            )

        cv2.imshow(
            "VisionAttend AI - Head Pose",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

    camera.release()

    cv2.destroyAllWindows()

    detector.close()

    print("Head pose test finished.")


if __name__ == "__main__":
    main()