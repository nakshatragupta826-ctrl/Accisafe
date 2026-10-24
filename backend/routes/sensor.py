import threading
import time

from fastapi import APIRouter, Depends

from backend.models.sensor import SensorReading

from backend.services.accident_engine import (
    AccidentDetectionEngine,
    SensorData,
)

from backend.services.notification_service import (
    notify_emergency_contacts,
)

from backend.services.fcm_service import (
    send_push_notification,
)

from backend.services.database import (
    save_accident,
    update_accident_status,
)

from backend.services.firebase_service import (
    save_accident_to_firestore,
    update_accident_in_firestore,
)

from backend.services.auth_service import (
    verify_firebase_token,
)


router = APIRouter(
    prefix="/sensor",
    tags=["Sensor Monitoring"],
)


engine = AccidentDetectionEngine()


latest_sensor_state = {
    "sensor": None,

    # Original sensor reading that triggered the accident.
    # This is preserved throughout the observation period.
    "accident_sensor": None,

    "detection": None,
    "accident_id": None,

    # Firebase UID for the rider associated with
    # the current sensor/accident session.
    "user_id": None,

    # Firestore document ID for the current accident.
    "firestore_accident_id": None,

    "notifications": None,
    "push_notification": None,
}


# =========================================================
# AUTOMATIC EMERGENCY TIMER
# =========================================================

def automatic_emergency_timer():

    while engine.state == "CANCELLATION_WINDOW":

        time.sleep(0.1)

        if engine.state != "CANCELLATION_WINDOW":
            break

        result = engine.process_cancellation_window()

        latest_sensor_state["detection"] = result

        if result.get("emergency_active") is True:

            print(
                "\n"
                "========================================\n"
                "🚨 EMERGENCY RESPONSE ACTIVATED\n"
                "========================================\n"
            )

            accident_id = latest_sensor_state.get(
                "accident_id"
            )

            user_id = latest_sensor_state.get(
                "user_id"
            )

            emergency_message = (
                "The rider did not cancel the alert. "
                "Emergency response has been activated."
            )

            # -------------------------------------------------
            # UPDATE SQLITE
            # -------------------------------------------------

            if accident_id:

                update_accident_status(
                    accident_id=accident_id,
                    status="EMERGENCY_ACTIVE",
                    message=emergency_message,
                    user_id=user_id,
                )

            # -------------------------------------------------
            # UPDATE FIRESTORE
            # -------------------------------------------------

            firestore_id = latest_sensor_state.get(
                "firestore_accident_id"
            )

            if firestore_id:

                try:

                    update_accident_in_firestore(
                        firestore_id=firestore_id,
                        status="EMERGENCY_ACTIVE",
                        message=emergency_message,
                    )

                    print(
                        "☁ Firestore accident status "
                        "updated: EMERGENCY_ACTIVE"
                    )

                except Exception as error:

                    print(
                        "⚠ Firestore update failed: "
                        f"{error}"
                    )

                        # -------------------------------------------------
            # EMERGENCY NOTIFICATION
            # -------------------------------------------------

            sensor = (
                latest_sensor_state.get("accident_sensor")
                or latest_sensor_state.get("sensor")
            )

            if sensor:

                # ---------------------------------------------
                # 1. Generate emergency notifications
                #    for the rider's emergency contacts
                # ---------------------------------------------

                notification_result = (
                    notify_emergency_contacts(
                        accident_id=accident_id,
                        latitude=sensor["latitude"],
                        longitude=sensor["longitude"],
                        user_id=user_id,
                    )
                )

                latest_sensor_state["notifications"] = (
                    notification_result
                )

                # ---------------------------------------------
                # 2. Send FCM push notification to the
                #    authenticated rider's browser
                # ---------------------------------------------

                push_result = send_push_notification(
                    user_id=user_id,
                    title="🚨 AcciSafe Emergency Alert",
                    body=(
                        "Accident confirmed. "
                        "Emergency response has been activated."
                    ),
                    data={
                        "type": "ACCIDENT_CONFIRMED",
                        "accident_id": accident_id,
                        "latitude": sensor["latitude"],
                        "longitude": sensor["longitude"],
                    },
                )

                latest_sensor_state[
                    "push_notification"
                ] = push_result

                if push_result.get("success"):

                    print(
                        "✅ FCM emergency notification "
                        "sent successfully."
                    )

                else:

                    print(
                        "⚠ FCM emergency notification "
                        "was not sent: "
                        f"{push_result.get('message')}"
                    )

            break


# =========================================================
# START EMERGENCY TIMER
# =========================================================

def start_emergency_timer():

    timer_thread = threading.Thread(
        target=automatic_emergency_timer,
        daemon=True,
    )

    timer_thread.start()


# =========================================================
# SENSOR DATA
# =========================================================

@router.post("/data")
def receive_sensor_data(
    sensor: SensorReading,
    decoded_token=Depends(verify_firebase_token),
):

    user_id = decoded_token["uid"]
    accident_id = None

    # Remember the state before processing this reading.
    previous_state = engine.state

    data = SensorData(
        acceleration=sensor.acceleration,
        speed_before=sensor.speed_before,
        speed_after=sensor.speed_after,
        tilt_angle=sensor.tilt_angle,
        observation_seconds=0,
        speed_during_observation=sensor.speed_after,
    )

    result = engine.analyze(data)

    # -----------------------------------------------------
    # Store latest sensor reading
    # -----------------------------------------------------

    latest_sensor_state["sensor"] = sensor.model_dump()

    # Store authenticated rider.
    latest_sensor_state["user_id"] = user_id

    # -----------------------------------------------------
    # PRESERVE ORIGINAL CRASH READING
    # -----------------------------------------------------

    if (
        previous_state == "NORMAL"
        and result.get("checks", {}).get(
            "impact_detected"
        ) is True
        and result.get("status") == "OBSERVING"
    ):

        latest_sensor_state["accident_sensor"] = (
            sensor.model_dump()
        )

        # Associate this accident session with
        # the authenticated Firebase user.
        latest_sensor_state["user_id"] = user_id

       # -----------------------------------------------------
    # FALSE ALARM
    # -----------------------------------------------------

    if (
        result.get("status") == "NORMAL"
        and previous_state != "NORMAL"
    ):

        # -------------------------------------------------
        # Record the event in accident history.
        #
        # Scenario 3 reaches NORMAL again before
        # new_accident becomes True, so previously
        # nothing was saved to the database.
        # -------------------------------------------------

        accident_sensor = (
            latest_sensor_state.get("accident_sensor")
        )

        if accident_sensor:

            false_alarm_result = {
                "status": "FALSE_ALARM",
                "stage": result.get("stage", 5),
                "message": (
                    "Potential accident cancelled automatically "
                    "because the rider resumed normal movement."
                ),
                "checks": result.get("checks", {}),
                "accident_confirmed": False,
                "new_accident": False,
                "emergency_active": False,
            }

            # ---------------------------------------------
            # SAVE FALSE ALARM TO SQLITE
            # ---------------------------------------------

            false_alarm_id = save_accident(
                SensorReading(**accident_sensor),
                false_alarm_result,
                user_id=user_id,
            )

            print(
                "✓ False alarm recorded in accident history: "
                f"#{false_alarm_id}"
            )

            # ---------------------------------------------
            # SAVE FALSE ALARM TO FIRESTORE
            # ---------------------------------------------

            firestore_false_alarm = {
                **accident_sensor,
                "status": "FALSE_ALARM",
                "stage": result.get("stage", 5),
                "message": (
                    "Potential accident cancelled automatically "
                    "because the rider resumed normal movement."
                ),
                "observation_seconds": 0,
                "user_id": user_id,
            }

            try:

                firestore_id = save_accident_to_firestore(
                    firestore_false_alarm
                )

                print(
                    "☁ Firestore false alarm saved: "
                    f"{firestore_id}"
                )

            except Exception as error:

                print(
                    "⚠ Firestore false alarm save failed: "
                    f"{error}"
                )

        # ---------------------------------------------
        # CLEAR CURRENT LIVE ACCIDENT STATE
        # ---------------------------------------------

        latest_sensor_state["accident_sensor"] = None

        latest_sensor_state[
            "firestore_accident_id"
        ] = None

        latest_sensor_state["accident_id"] = None

        latest_sensor_state["user_id"] = None

    # =====================================================
    # NEW ACCIDENT CONFIRMED
    # =====================================================

    if result.get("new_accident") is True:

        # Use original crash reading rather than the
        # stationary observation reading.

        accident_sensor = (
            latest_sensor_state.get("accident_sensor")
            or sensor.model_dump()
        )

        # -------------------------------------------------
        # SAVE TO SQLITE
        # -------------------------------------------------

        accident_id = save_accident(
            SensorReading(**accident_sensor),
            result,
            user_id=user_id,
        )

        latest_sensor_state["accident_id"] = (
            accident_id
        )

        latest_sensor_state["user_id"] = user_id

        # -------------------------------------------------
        # SAVE TO FIRESTORE
        # -------------------------------------------------

        firestore_accident = {
            **accident_sensor,
            "status": result.get(
                "status",
                "ACCIDENT_CONFIRMED",
            ),
            "stage": result.get("stage"),
            "message": result.get("message"),
            "observation_seconds": 0,
            "user_id": user_id,
        }

        try:

            firestore_id = (
                save_accident_to_firestore(
                    firestore_accident
                )
            )

            latest_sensor_state[
                "firestore_accident_id"
            ] = firestore_id

            print(
                "☁ Firestore accident saved: "
                f"{firestore_id}"
            )

        except Exception as error:

            # Firebase failure must NOT stop the
            # local accident detection system.

            latest_sensor_state[
                "firestore_accident_id"
            ] = None

            print(
                "⚠ Firestore save failed: "
                f"{error}"
            )

        # Clear previous notification information.

        latest_sensor_state["notifications"] = None
        latest_sensor_state["push_notification"] = None

        # Start automatic cancellation timer.

        start_emergency_timer()

    return {
        "latitude": sensor.latitude,
        "longitude": sensor.longitude,
        "accident_id": accident_id,
        "detection": result,
    }


# =========================================================
# LATEST SENSOR STATE
# =========================================================

@router.get("/latest")
def get_latest_sensor_data(
    decoded_token=Depends(verify_firebase_token),
):

    user_id = decoded_token["uid"]

    # Only return the current sensor state if it
    # belongs to the authenticated rider.
    state_user_id = latest_sensor_state.get("user_id")

    if state_user_id is not None and state_user_id != user_id:
        return {
            "sensor": None,
            "accident_sensor": None,
            "detection": None,
            "accident_id": None,
            "user_id": user_id,
            "firestore_accident_id": None,
            "notifications": None,
        }

    return latest_sensor_state


# =========================================================
# DETECTION CONFIGURATION
# =========================================================

@router.get("/config")
def get_detection_configuration(
    decoded_token=Depends(verify_firebase_token),
):

    return {
        "impact_threshold_g":
            engine.impact_threshold,

        "minimum_speed_threshold_kmh":
            engine.minimum_speed_threshold,

        "speed_drop_threshold_kmh":
            engine.speed_drop_threshold,

        "tilt_threshold_degrees":
            engine.tilt_threshold,

        "observation_period_seconds":
            engine.observation_period,

        "stationary_speed_threshold_kmh":
            engine.stationary_speed_threshold,

        "cancellation_period_seconds":
            engine.cancellation_period,
    }


# =========================================================
# RIDER CANCEL
# =========================================================

@router.post("/cancel")
def cancel_accident(
    decoded_token=Depends(verify_firebase_token),
):

    user_id = decoded_token["uid"]

    state_user_id = latest_sensor_state.get(
        "user_id"
    )

    # Prevent one rider from cancelling another
    # rider's active accident session.
    if (
        state_user_id is not None
        and state_user_id != user_id
    ):
        return {
            "success": False,
            "message": "No active accident belongs to this rider.",
        }

    accident_id = latest_sensor_state.get(
        "accident_id"
    )

    result = engine.cancel_accident()

    if result["success"]:

        cancellation_message = (
            "The rider cancelled the emergency alert "
            "during the cancellation window."
        )

        # -------------------------------------------------
        # UPDATE SQLITE
        # -------------------------------------------------

        if accident_id:

            update_accident_status(
                accident_id=accident_id,
                status="CANCELLED",
                message=cancellation_message,
                user_id=user_id,
            )

        # -------------------------------------------------
        # UPDATE FIRESTORE
        # -------------------------------------------------

        firestore_id = latest_sensor_state.get(
            "firestore_accident_id"
        )

        if firestore_id:

            try:

                update_accident_in_firestore(
                    firestore_id=firestore_id,
                    status="CANCELLED",
                    message=cancellation_message,
                )

                print(
                    "☁ Firestore accident status "
                    "updated: CANCELLED"
                )

            except Exception as error:

                print(
                    "⚠ Firestore update failed: "
                    f"{error}"
                )

        latest_sensor_state[
            "accident_sensor"
        ] = None

        latest_sensor_state["detection"] = {

            "status": "CANCELLED",

            "stage": 5,

            "message": (
                "Emergency alert cancelled by the rider."
            ),

            "checks": engine.checks.copy(),

            "accident_confirmed": False,

            "new_accident": False,

            "emergency_active": False,
        }

    return result


# =========================================================
# RESET
# =========================================================

@router.post("/reset")
def reset_detection_engine(
    decoded_token=Depends(verify_firebase_token),
):

    user_id = decoded_token["uid"]

    state_user_id = latest_sensor_state.get(
        "user_id"
    )

    # Only allow the rider who owns the current
    # session to reset it.
    if (
        state_user_id is not None
        and state_user_id != user_id
    ):
        return {
            "status": "UNCHANGED",
            "message": (
                "The current sensor session belongs "
                "to another rider."
            ),
        }

    engine.reset()

    latest_sensor_state["sensor"] = None

    latest_sensor_state[
        "accident_sensor"
    ] = None

    latest_sensor_state["accident_id"] = None

    latest_sensor_state["user_id"] = None

    latest_sensor_state[
        "firestore_accident_id"
    ] = None

    latest_sensor_state["notifications"] = None
    latest_sensor_state["push_notification"] = None

    latest_sensor_state["detection"] = {

        "status": "NORMAL",

        "stage": 1,

        "message": (
            "AcciSafe detection engine reset. "
            "Monitoring active."
        ),

        "checks": engine.checks.copy(),

        "accident_confirmed": False,

        "new_accident": False,

        "emergency_active": False,
    }

    return {

        "status": "NORMAL",

        "message": (
            "AcciSafe detection engine "
            "reset successfully."
        ),
    }