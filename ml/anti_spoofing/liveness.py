import time


class LivenessDetector:

    def __init__(self):

        self.blink_detected = False
        self.head_movement_detected = False

        self.start_time = time.time()

        self.timeout = 15

        self.status = "WAITING"


    def register_blink(self):

        self.blink_detected = True

        self.update_status()


    def register_head_movement(self):

        self.head_movement_detected = True

        self.update_status()


    def update_status(self):

        if self.blink_detected and self.head_movement_detected:

            self.status = "LIVE"


        elif time.time() - self.start_time > self.timeout:

            self.status = "FAILED"


        elif self.blink_detected:

            self.status = "HEAD MOVEMENT REQUIRED"


        elif self.head_movement_detected:

            self.status = "BLINK REQUIRED"


        else:

            self.status = "BLINK + HEAD MOVEMENT REQUIRED"


    def is_live(self):

        self.update_status()

        return self.status == "LIVE"


    def has_failed(self):

        self.update_status()

        return self.status == "FAILED"


    def get_status(self):

        self.update_status()

        return self.status


    def reset(self):

        self.blink_detected = False

        self.head_movement_detected = False

        self.start_time = time.time()

        self.status = "WAITING"