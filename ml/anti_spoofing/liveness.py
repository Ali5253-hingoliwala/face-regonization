import time


class LivenessDetector:
    """Per-face liveness state machine for the attendance demo.

    A real blink is accepted immediately. Head/gaze movement must be a
    deliberate direction change that remains stable for a few frames. This
    avoids treating tiny MediaPipe landmark jitter from a static phone photo
    as proof of life.
    """

    def __init__(self):
        self.start_time = time.time()
        self.static_photo_timeout = 10.0

        self.initial_direction = None
        self.initial_gaze = None
        self.last_direction = None
        self.last_gaze = None
        self.direction_candidate = None
        self.direction_candidate_frames = 0
        self.gaze_candidate = None
        self.gaze_candidate_frames = 0

        self.movement_detected = False
        self.movement_type = None
        self.status = "CHECKING"

        # Require a small amount of temporal consistency before accepting a
        # head/gaze transition. A static image can otherwise jitter between
        # neighboring landmark classifications.
        self.required_stable_frames = 3

    def update(self, blink, direction, gaze):
        elapsed = time.time() - self.start_time

        # A completed blink is the strongest lightweight liveness signal.
        if blink:
            self.movement_detected = True
            self.movement_type = "blink"

        # Establish the initial head direction, then require a different
        # direction to persist for several frames before accepting movement.
        if direction is not None:
            if self.initial_direction is None:
                self.initial_direction = direction
            if self.last_direction is None:
                self.last_direction = direction
            elif direction != self.last_direction:
                if self.direction_candidate == direction:
                    self.direction_candidate_frames += 1
                else:
                    self.direction_candidate = direction
                    self.direction_candidate_frames = 1

                if self.direction_candidate_frames >= self.required_stable_frames:
                    self.movement_detected = True
                    self.movement_type = self.movement_type or "head movement"
                    self.last_direction = direction
                    self.direction_candidate = None
                    self.direction_candidate_frames = 0
            else:
                self.direction_candidate = None
                self.direction_candidate_frames = 0

        # Same protection for horizontal gaze movement.
        if gaze is not None:
            if self.initial_gaze is None:
                self.initial_gaze = gaze
            if self.last_gaze is None:
                self.last_gaze = gaze
            elif gaze != self.last_gaze:
                if self.gaze_candidate == gaze:
                    self.gaze_candidate_frames += 1
                else:
                    self.gaze_candidate = gaze
                    self.gaze_candidate_frames = 1

                if self.gaze_candidate_frames >= self.required_stable_frames:
                    self.movement_detected = True
                    self.movement_type = self.movement_type or "gaze movement"
                    self.last_gaze = gaze
                    self.gaze_candidate = None
                    self.gaze_candidate_frames = 0
            else:
                self.gaze_candidate = None
                self.gaze_candidate_frames = 0

        if self.movement_detected:
            self.status = "LIVE"
        elif elapsed >= self.static_photo_timeout:
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
        self.initial_direction = None
        self.initial_gaze = None
        self.last_direction = None
        self.last_gaze = None
        self.direction_candidate = None
        self.direction_candidate_frames = 0
        self.gaze_candidate = None
        self.gaze_candidate_frames = 0
        self.movement_detected = False
        self.movement_type = None
        self.status = "CHECKING"
