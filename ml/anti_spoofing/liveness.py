import time


class LivenessDetector:
    """
    Fast, lightweight liveness check.

    Instead of requiring a blink AND a head turn within a fixed
    window (slow, rigid), this treats blink OR head movement OR
    gaze movement as proof of life -- a real person naturally does
    at least one of these within a couple of seconds.

    If NONE of the three signals ever change over a longer window,
    that's a strong sign the camera is looking at a static photo
    rather than a real face.
    """

    def __init__(self):

        self.start_time = time.time()

        # How long to wait for ANY natural movement before
        # considering the check still in progress.
        self.checking_timeout = 3.0

        # If completely static for this long, flag as a likely photo.
        self.static_photo_timeout = 15.0

        self.last_direction = None
        self.last_gaze = None

        self.movement_detected = False
        self.movement_type = None

        self.status = "CHECKING"

    def update(self, blink, direction, gaze):
        """
        Call this once per frame with the latest signals from
        FastLivenessSignals.process(frame):
            blink: bool
            direction: "LEFT" / "CENTER" / "RIGHT" / None
            gaze: "LEFT" / "CENTER" / "RIGHT" / None
        """

        elapsed = time.time() - self.start_time

        if blink:
            self.movement_detected = True
            self.movement_type = self.movement_type or "blink"

        if (
            direction is not None
            and self.last_direction is not None
            and direction != self.last_direction
        ):
            self.movement_detected = True
            self.movement_type = self.movement_type or "head movement"

        if (
            gaze is not None
            and self.last_gaze is not None
            and gaze != self.last_gaze
        ):
            self.movement_detected = True
            self.movement_type = self.movement_type or "gaze movement"

        if direction is not None:
            self.last_direction = direction

        if gaze is not None:
            self.last_gaze = gaze

        if self.movement_detected:

            self.status = "LIVE"

        elif elapsed > self.static_photo_timeout:

            self.status = "POSSIBLE PHOTO - NO MOVEMENT DETECTED"

        else:

            self.status = "CHECKING"

        return self.status

    def get_status(self):
        return self.status

    def get_movement_type(self):
        return self.movement_type

    def reset(self):

        self.start_time = time.time()

        self.last_direction = None
        self.last_gaze = None

        self.movement_detected = False
        self.movement_type = None

        self.status = "CHECKING"