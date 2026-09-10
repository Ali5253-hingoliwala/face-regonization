import time


class LivenessDetector:
    """Per-face liveness gate for the attendance pipeline.

    A completed blink is accepted as a live action. Head/gaze movement is
    accepted only after a deliberate excursion away from the starting
    direction followed by a return to that starting direction. This makes
    static-image landmark jitter insufficient to unlock attendance.
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
        self.direction_moved = False

        self.gaze_candidate = None
        self.gaze_candidate_frames = 0
        self.gaze_moved = False

        self.movement_detected = False
        self.movement_type = None
        self.status = "CHECKING"

        self.required_stable_frames = 4

    def _update_motion(self, value, initial, last, candidate, candidate_frames, moved, kind):
        """Track a stable excursion away from the initial value and return."""
        if value is None:
            return initial, last, candidate, candidate_frames, moved, None

        if initial is None:
            initial = value
            last = value
            return initial, last, None, 0, moved, None

        # A deliberate movement must first be stable in a different direction.
        if not moved:
            if value != initial:
                if candidate == value:
                    candidate_frames += 1
                else:
                    candidate = value
                    candidate_frames = 1

                if candidate_frames >= self.required_stable_frames:
                    moved = True
                    candidate = None
                    candidate_frames = 0
            else:
                candidate = None
                candidate_frames = 0
        else:
            # After the excursion, require a stable return to the starting
            # direction. This return-to-baseline sequence is the liveness
            # confirmation and is much harder for a static photo to satisfy.
            if value == initial:
                if candidate == initial:
                    candidate_frames += 1
                else:
                    candidate = initial
                    candidate_frames = 1

                if candidate_frames >= self.required_stable_frames:
                    return initial, value, None, 0, True, f"{kind} movement"
            else:
                candidate = None
                candidate_frames = 0

        last = value
        return initial, last, candidate, candidate_frames, moved, None

    def update(self, blink, direction, gaze):
        elapsed = time.time() - self.start_time

        # A completed blink requires an open -> closed -> open transition in
        # FastLivenessSignals, so a single static photograph cannot satisfy it.
        if blink:
            self.movement_detected = True
            self.movement_type = "blink"

        (
            self.initial_direction,
            self.last_direction,
            self.direction_candidate,
            self.direction_candidate_frames,
            self.direction_moved,
            direction_event,
        ) = self._update_motion(
            direction,
            self.initial_direction,
            self.last_direction,
            self.direction_candidate,
            self.direction_candidate_frames,
            self.direction_moved,
            "head",
        )

        (
            self.initial_gaze,
            self.last_gaze,
            self.gaze_candidate,
            self.gaze_candidate_frames,
            self.gaze_moved,
            gaze_event,
        ) = self._update_motion(
            gaze,
            self.initial_gaze,
            self.last_gaze,
            self.gaze_candidate,
            self.gaze_candidate_frames,
            self.gaze_moved,
            "gaze",
        )

        if not self.movement_detected:
            if direction_event:
                self.movement_detected = True
                self.movement_type = direction_event
            elif gaze_event:
                self.movement_detected = True
                self.movement_type = gaze_event

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
        self.direction_moved = False
        self.gaze_candidate = None
        self.gaze_candidate_frames = 0
        self.gaze_moved = False
        self.movement_detected = False
        self.movement_type = None
        self.status = "CHECKING"
