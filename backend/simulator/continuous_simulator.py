import time
import requests


API_URL = "http://127.0.0.1:8000/sensor/data"
RESET_URL = "http://127.0.0.1:8000/sensor/reset"


LOCATION = {
    "latitude": 13.0827,
    "longitude": 80.2707,
}


def send_sensor(
    acceleration,
    speed_before,
    speed_after,
    tilt_angle,
    token,
):
    data = {
        "acceleration": acceleration,
        "speed_before": speed_before,
        "speed_after": speed_after,
        "tilt_angle": tilt_angle,
        "observation_seconds": 0,
        "speed_during_observation": speed_after,
        **LOCATION,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        API_URL,
        json=data,
        headers=headers,
        timeout=5,
    )

    print(f"HTTP Status: {response.status_code}")

    if response.status_code != 200:
        print("Backend error:")
        print(response.text)
        return None

    result = response.json()
    detection = result["detection"]

    print(
        f"Stage {detection['stage']} | "
        f"{detection['status']} | "
        f"{detection['message']}"
    )

    if "observation_elapsed" in detection:
        print(
            f"   Observation: "
            f"{detection['observation_elapsed']}s / "
            f"15s"
        )

    return detection


def main():

    print()
    print("========================================")
    print("     ACCISAFE CONTINUOUS SIMULATOR")
    print("========================================")

    print()
    print("Firebase ID token required.")
    print("Use the token from your authenticated AcciSafe browser session.")

    token = input("\nFirebase ID token: ").strip()

    if not token:
        print("\nERROR: Firebase ID token is required.")
        return

    print()
    print("Scenario:")
    print("1. Normal riding")
    print("2. Accident → confirmed")
    print("3. Accident → rider moves again")
    print()

    choice = input("Choose scenario: ").strip()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # -----------------------------------------------------
    # Reset backend state before test
    # -----------------------------------------------------

    try:
        reset_response = requests.post(
            RESET_URL,
            headers=headers,
            timeout=5,
        )

        print(
            f"\nBackend reset status: "
            f"{reset_response.status_code}"
        )

        if reset_response.status_code != 200:
            print("Could not reset backend:")
            print(reset_response.text)
            return

    except Exception as error:
        print("Could not reset backend:")
        print(error)
        return

    # =====================================================
    # NORMAL RIDING
    # =====================================================

    if choice == "1":

        print()
        print("Starting normal riding...")
        print()

        for _ in range(10):

            detection = send_sensor(
                acceleration=1.2,
                speed_before=50.0,
                speed_after=48.0,
                tilt_angle=5.0,
                token=token,
            )

            if detection is None:
                return

            time.sleep(1)

        return

    # =====================================================
    # ACCIDENT → CONFIRMED
    # =====================================================

    if choice == "2":

        print()
        print("Starting accident sequence...")
        print()

        # -------------------------------------------------
        # Normal riding before accident
        # -------------------------------------------------

        send_sensor(
            acceleration=1.2,
            speed_before=60.0,
            speed_after=58.0,
            tilt_angle=5.0,
            token=token,
        )

        time.sleep(1)

        # -------------------------------------------------
        # Trigger accident
        # -------------------------------------------------

        detection = send_sensor(
            acceleration=8.0,
            speed_before=65.0,
            speed_after=0.0,
            tilt_angle=72.0,
            token=token,
        )

        if detection is None:
            return

        # -------------------------------------------------
        # Continue sending stationary readings
        # -------------------------------------------------

        print()
        print("Observation period started...")
        print()

        for _ in range(20):

            detection = send_sensor(
                acceleration=0.3,
                speed_before=0.0,
                speed_after=0.0,
                tilt_angle=72.0,
                token=token,
            )

            if detection is None:
                return

            if detection["status"] == "ACCIDENT_CONFIRMED":

                print()
                print("========================================")
                print("🚨 ACCIDENT CONFIRMED")
                print("========================================")
                print()

                break

            time.sleep(1)

        return

    # =====================================================
    # ACCIDENT → RIDER MOVES AGAIN
    # =====================================================

    if choice == "3":

        print()
        print("Starting false-alarm test...")
        print()

        # -------------------------------------------------
        # Trigger accident detection
        # -------------------------------------------------

        detection = send_sensor(
            acceleration=8.0,
            speed_before=65.0,
            speed_after=0.0,
            tilt_angle=72.0,
            token=token,
        )

        if detection is None:
            return

        print()
        print("Observation period started...")
        print()

        # -------------------------------------------------
        # Stay stationary for 5 seconds
        # -------------------------------------------------

        for _ in range(5):

            detection = send_sensor(
                acceleration=0.3,
                speed_before=0.0,
                speed_after=0.0,
                tilt_angle=72.0,
                token=token,
            )

            if detection is None:
                return

            time.sleep(1)

        # -------------------------------------------------
        # Rider starts moving again
        # -------------------------------------------------

        print()
        print("Motorcycle started moving again...")
        print()

        detection = send_sensor(
            acceleration=0.8,
            speed_before=15.0,
            speed_after=15.0,
            tilt_angle=10.0,
            token=token,
        )

        if detection is None:
            return

        print()

        if detection["status"] == "NORMAL":
            print("✓ FALSE ALARM CANCELLED")
            print("✓ System returned to normal monitoring.")

        return

    print("Invalid choice.")


if __name__ == "__main__":
    main()