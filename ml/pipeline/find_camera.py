import cv2


# ============================================================
# Camera index finder
#
# Opens each camera index in turn and shows its live feed so
# you can see which one is your phone (Iriun / DroidCam / etc.)
# and which one is your laptop's built-in webcam.
#
# Press N to move to the next index.
# Press Q to quit.
# ============================================================

MAX_INDEX_TO_TRY = 5


def main():

    print("=" * 60)
    print("           CAMERA INDEX FINDER")
    print("=" * 60)

    print()
    print("This will try camera indexes 0 to", MAX_INDEX_TO_TRY - 1)
    print("Press N to try the next index.")
    print("Press Q to quit once you've found the right one.")
    print()

    index = 0

    while index < MAX_INDEX_TO_TRY:

        print(f"Trying camera index {index} ...")

        cap = cv2.VideoCapture(index)

        if not cap.isOpened():

            print(f"  Index {index}: could not open. Skipping.")

            cap.release()

            index += 1

            continue

        print(f"  Index {index}: opened successfully.")
        print("  Showing feed — press N for next index, Q to quit.")

        while True:

            ret, frame = cap.read()

            if not ret:

                print("  Could not read frame from this index.")

                break

            cv2.putText(
                frame,
                f"Camera index: {index}",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                "Press N: next   Press Q: quit",
                (20, 70),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2
            )

            cv2.imshow("Camera Index Finder", frame)

            key = cv2.waitKey(1) & 0xFF

            if key == ord("n"):

                break

            if key == ord("q"):

                cap.release()
                cv2.destroyAllWindows()

                print()
                print(f"Stopped at index {index}.")
                print(f"If this was the right feed, use cv2.VideoCapture({index})")
                print("in attendance_pipeline.py")

                return

        cap.release()
        cv2.destroyAllWindows()

        index += 1

    print()
    print(f"Tried indexes 0 to {MAX_INDEX_TO_TRY - 1}.")
    print("If none showed your phone, check that the desktop")
    print("companion app (Iriun / DroidCam) is running and connected.")


if __name__ == "__main__":
    main()