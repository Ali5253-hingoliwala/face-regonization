from liveness import LivenessDetector


def main():

    print("=" * 50)
    print("        VISIONATTEND AI")
    print("        LIVENESS CONTROLLER TEST")
    print("=" * 50)

    detector = LivenessDetector()

    print()
    print("Initial status:")
    print(detector.get_status())

    print()
    print("Registering blink...")
    detector.register_blink()

    print("Status:")
    print(detector.get_status())

    print()
    print("Registering head movement...")
    detector.register_head_movement()

    print("Status:")
    print(detector.get_status())

    print()

    if detector.is_live():

        print("================================")
        print("       LIVE PERSON DETECTED")
        print("================================")

    else:

        print("LIVENESS CHECK FAILED")


if __name__ == "__main__":
    main()