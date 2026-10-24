from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class SensorData:
    acceleration: float
    speed_before: float
    speed_after: float
    tilt_angle: float
    observation_seconds: int
    speed_during_observation: float


class AccidentDetectionEngine:
    """
    AcciSafe continuous five-stage accident detection engine.

    Detection flow:

        NORMAL
          ↓
        IMPACT
          ↓
        SPEED VERIFIED
          ↓
        SUDDEN STOP
          ↓
        TILT DETECTED
          ↓
        OBSERVING
          ↓
        ACCIDENT_CONFIRMED
          ↓
        CANCELLATION_WINDOW
          ↓
        EMERGENCY_ACTIVE

    The rider can cancel only during the cancellation window.
    """

    def __init__(
        self,
        impact_threshold: float = 4.0,
        minimum_speed_threshold: float = 10.0,
        speed_drop_threshold: float = 20.0,
        tilt_threshold: float = 45.0,
        observation_period: int = 15,
        stationary_speed_threshold: float = 5.0,
        cancellation_period: int = 10,
    ):
        self.impact_threshold = impact_threshold
        self.minimum_speed_threshold = minimum_speed_threshold
        self.speed_drop_threshold = speed_drop_threshold
        self.tilt_threshold = tilt_threshold
        self.observation_period = observation_period
        self.stationary_speed_threshold = stationary_speed_threshold
        self.cancellation_period = cancellation_period

        self.state = "NORMAL"
        self.current_stage = 1

        self.observation_started_at: Optional[datetime] = None
        self.cancellation_started_at: Optional[datetime] = None

        self.checks = self._empty_checks()

    # =========================================================
    # CHECKS
    # =========================================================

    def _empty_checks(self):
        return {
            "impact_detected": False,
            "speed_verified": False,
            "sudden_stop": False,
            "significant_tilt": False,
            "observation_complete": False,
        }

    def check_impact(self, acceleration: float) -> bool:
        return acceleration >= self.impact_threshold

    def check_speed_verification(self, speed_before: float) -> bool:
        return speed_before >= self.minimum_speed_threshold

    def check_sudden_stop(
        self,
        speed_before: float,
        speed_after: float,
    ) -> bool:

        speed_drop = speed_before - speed_after

        return speed_drop >= self.speed_drop_threshold

    def check_tilt(self, tilt_angle: float) -> bool:
        return abs(tilt_angle) >= self.tilt_threshold

    # =========================================================
    # RESET
    # =========================================================

    def reset(self):

        self.state = "NORMAL"
        self.current_stage = 1

        self.observation_started_at = None
        self.cancellation_started_at = None

        self.checks = self._empty_checks()

    # =========================================================
    # START OBSERVATION
    # =========================================================

    def start_observation(self):

        self.state = "OBSERVING"
        self.current_stage = 5

        self.observation_started_at = datetime.now()

    # =========================================================
    # START CANCELLATION WINDOW
    # =========================================================

    def start_cancellation_window(self):

        self.state = "CANCELLATION_WINDOW"
        self.current_stage = 5

        self.cancellation_started_at = datetime.now()

    # =========================================================
    # OBSERVATION
    # =========================================================

    def process_observation(self, speed: float):

        if self.observation_started_at is None:
            self.start_observation()

        elapsed = (
            datetime.now() - self.observation_started_at
        ).total_seconds()

        remaining = max(
            0,
            self.observation_period - elapsed,
        )

        # Motorcycle recovered.
        if speed >= self.stationary_speed_threshold:

            result = self._result(
                status="NORMAL",
                stage=5,
                message=(
                    "Motorcycle resumed movement during "
                    "observation. Possible accident cancelled."
                ),
                checks={
                    **self.checks,
                    "observation_complete": False,
                },
                accident_confirmed=False,
                new_accident=False,
                observation_elapsed=round(elapsed, 1),
                observation_remaining=0,
            )

            self.reset()

            return result

        # Still observing.
        if elapsed < self.observation_period:

            return self._result(
                status="OBSERVING",
                stage=5,
                message=(
                    "Possible accident detected. "
                    "Observation period in progress."
                ),
                checks={
                    **self.checks,
                    "observation_complete": False,
                },
                accident_confirmed=False,
                new_accident=False,
                observation_elapsed=round(elapsed, 1),
                observation_remaining=round(
                    remaining,
                    1,
                ),
            )

        # Observation completed.
        self.checks["observation_complete"] = True

        self.start_cancellation_window()

        return self._result(
            status="ACCIDENT_CONFIRMED",
            stage=5,
            message=(
                "Accident confirmed. Rider has a "
                "10-second cancellation window."
            ),
            checks=self.checks.copy(),
            accident_confirmed=True,
            new_accident=True,
            observation_elapsed=round(elapsed, 1),
            observation_remaining=0,
            cancellation_remaining=self.cancellation_period,
        )

    # =========================================================
    # CANCELLATION WINDOW
    # =========================================================

    def process_cancellation_window(self):

        if self.cancellation_started_at is None:
            self.start_cancellation_window()

        elapsed = (
            datetime.now() - self.cancellation_started_at
        ).total_seconds()

        remaining = max(
            0,
            self.cancellation_period - elapsed,
        )

        # Cancellation period still active.
        if elapsed < self.cancellation_period:

            return self._result(
                status="CANCELLATION_WINDOW",
                stage=5,
                message=(
                    "Accident confirmed. "
                    "Waiting for rider cancellation."
                ),
                checks=self.checks.copy(),
                accident_confirmed=True,
                new_accident=False,
                cancellation_elapsed=round(
                    elapsed,
                    1,
                ),
                cancellation_remaining=round(
                    remaining,
                    1,
                ),
                emergency_active=False,
            )

        # Cancellation period expired.
        self.state = "EMERGENCY_ACTIVE"

        return self._result(
            status="EMERGENCY_ACTIVE",
            stage=5,
            message=(
                "Cancellation window expired. "
                "Emergency response should be initiated."
            ),
            checks=self.checks.copy(),
            accident_confirmed=True,
            new_accident=False,
            cancellation_elapsed=round(
                elapsed,
                1,
            ),
            cancellation_remaining=0,
            emergency_active=True,
        )

    # =========================================================
    # RIDER CANCELLATION
    # =========================================================

    def cancel_accident(self):

        if self.state != "CANCELLATION_WINDOW":

            return {
                "success": False,
                "message": (
                    "Accident cannot be cancelled because "
                    "the cancellation window is not active."
                ),
                "state": self.state,
            }

        self.reset()

        return {
            "success": True,
            "message": (
                "Alert cancelled by rider. "
                "AcciSafe returned to normal monitoring."
            ),
            "state": "NORMAL",
        }

    # =========================================================
    # MAIN STATE MACHINE
    # =========================================================

    def analyze(self, data: SensorData):

        # -----------------------------------------------------
        # NORMAL
        # -----------------------------------------------------

        if self.state == "NORMAL":

            impact_detected = self.check_impact(
                data.acceleration
            )

            if not impact_detected:

                return self._result(
                    status="NORMAL",
                    stage=1,
                    message="No significant impact detected.",
                    checks=self._empty_checks(),
                    accident_confirmed=False,
                    new_accident=False,
                )

            self.checks["impact_detected"] = True

            self.state = "IMPACT"
            self.current_stage = 2

        # -----------------------------------------------------
        # SPEED VERIFICATION
        # -----------------------------------------------------

        if self.state == "IMPACT":

            speed_verified = self.check_speed_verification(
                data.speed_before
            )

            if not speed_verified:

                result = self._result(
                    status="NORMAL",
                    stage=2,
                    message=(
                        "Impact detected, but motorcycle was "
                        "not moving significantly before the event."
                    ),
                    checks=self.checks.copy(),
                    accident_confirmed=False,
                    new_accident=False,
                )

                self.reset()

                return result

            self.checks["speed_verified"] = True

            self.state = "SPEED_VERIFIED"
            self.current_stage = 3

        # -----------------------------------------------------
        # SUDDEN STOP
        # -----------------------------------------------------

        if self.state == "SPEED_VERIFIED":

            sudden_stop = self.check_sudden_stop(
                data.speed_before,
                data.speed_after,
            )

            if not sudden_stop:

                result = self._result(
                    status="NORMAL",
                    stage=3,
                    message=(
                        "Impact and movement detected, "
                        "but no significant sudden stop."
                    ),
                    checks=self.checks.copy(),
                    accident_confirmed=False,
                    new_accident=False,
                )

                self.reset()

                return result

            self.checks["sudden_stop"] = True

            self.state = "SUDDEN_STOP"
            self.current_stage = 4

        # -----------------------------------------------------
        # TILT
        # -----------------------------------------------------

        if self.state == "SUDDEN_STOP":

            significant_tilt = self.check_tilt(
                data.tilt_angle
            )

            if not significant_tilt:

                result = self._result(
                    status="NORMAL",
                    stage=4,
                    message=(
                        "Sudden stop detected, but motorcycle "
                        "is not significantly tilted."
                    ),
                    checks=self.checks.copy(),
                    accident_confirmed=False,
                    new_accident=False,
                )

                self.reset()

                return result

            self.checks["significant_tilt"] = True

            self.start_observation()

        # -----------------------------------------------------
        # OBSERVATION
        # -----------------------------------------------------

        if self.state == "OBSERVING":

            return self.process_observation(
                data.speed_after
            )

        # -----------------------------------------------------
        # CANCELLATION WINDOW
        # -----------------------------------------------------

        if self.state == "CANCELLATION_WINDOW":

            return self.process_cancellation_window()

        # -----------------------------------------------------
        # EMERGENCY ACTIVE
        # -----------------------------------------------------

        if self.state == "EMERGENCY_ACTIVE":

            return self._result(
                status="EMERGENCY_ACTIVE",
                stage=5,
                message=(
                    "Emergency response is active."
                ),
                checks=self.checks.copy(),
                accident_confirmed=True,
                new_accident=False,
                cancellation_remaining=0,
                emergency_active=True,
            )

        # -----------------------------------------------------
        # FALLBACK
        # -----------------------------------------------------

        self.reset()

        return self._result(
            status="NORMAL",
            stage=1,
            message="Detection engine reset.",
            checks=self._empty_checks(),
            accident_confirmed=False,
            new_accident=False,
        )

    # =========================================================
    # RESULT
    # =========================================================

    @staticmethod
    def _result(
        status: str,
        stage: int,
        message: str,
        checks: dict,
        **metadata,
    ):

        return {
            "status": status,
            "stage": stage,
            "message": message,
            "checks": checks,
            **metadata,
        }