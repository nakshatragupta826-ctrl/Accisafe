import requests


API_URL = "http://127.0.0.1:8000/sensor/data"


SCENARIOS = {
    "normal": {
        "acceleration": 1.2,
        "speed_before": 50.0,
        "speed_after": 48.0,
        "tilt_angle": 5.0,
        "observation_seconds": 0,
        "speed_during_observation": 48.0,
        "latitude": 13.0827,
        "longitude": 80.2707,
    },

    "pothole": {
        "acceleration": 5.5,
        "speed_before": 50.0,
        "speed_after": 42.0,
        "tilt_angle": 10.0,
        "observation_seconds": 0,
        "speed_during_observation": 42.0,
        "latitude": 13.0827,
        "longitude": 80.2707,
    },

    "possible_accident": {
        "acceleration": 7.0,
        "speed_before": 60.0,
        "speed_after": 2.0,
        "tilt_angle": 65.0,
        "observation_seconds": 5,
        "speed_during_observation": 2.0,
        "latitude": 13.0827,
        "longitude": 80.2707,
    },

    "confirmed_accident": {
        "acceleration": 8.0,
        "speed_before": 65.0,
        "speed_after": 0.0,
        "tilt_angle": 72.0,
        "observation_seconds": 15,
        "speed_during_observation": 0.0,
        "latitude": 13.0827,
        "longitude": 80.2707,
    },
}


def run_scenario(name, token):
    if name not in SCENARIOS:
        print(f"\nUnknown scenario: {name}")
        print("Available scenarios:")

        for scenario in SCENARIOS:
            print(f"  - {scenario}")

        return

    data = SCENARIOS[name]

    print("\n========================================")
    print("       ACCISAFE SENSOR SIMULATOR")
    print("========================================")

    print(f"\nScenario: {name.upper()}")
    print(f"\nAcceleration : {data['acceleration']} g")
    print(f"Speed Before : {data['speed_before']} km/h")
    print(f"Speed After  : {data['speed_after']} km/h")
    print(f"Tilt Angle   : {data['tilt_angle']} degrees")
    print(f"Observation  : {data['observation_seconds']} seconds")

    print("\nSending sensor data to AcciSafe backend...")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            API_URL,
            json=data,
            headers=headers,
            timeout=5,
        )

        print(f"\nHTTP Status: {response.status_code}")

        if response.status_code == 200:

            result = response.json()

            detection = result["detection"]

            print("\n----------------------------------------")
            print("ACCIDENT DETECTION RESULT")
            print("----------------------------------------")

            print(f"Status  : {detection['status']}")
            print(f"Stage   : {detection['stage']}")
            print(f"Message : {detection['message']}")

            print("\nChecks:")

            for check, value in detection["checks"].items():
                symbol = "✓" if value else "✗"
                print(f"  [{symbol}] {check}")

            print("----------------------------------------")

        else:

            print("\nBackend returned an error:")
            print(response.text)

    except requests.exceptions.ConnectionError:

        print("\nERROR: Could not connect to AcciSafe backend.")

        print("Make sure Uvicorn is running:")

        print(
            "python -m uvicorn "
            "backend.main:app --reload"
        )

    except Exception as error:

        print(f"\nERROR: {error}")


def main():

    print("\n========================================")
    print("       ACCISAFE SENSOR SIMULATOR")
    print("========================================")

    print("\nFirebase ID token required.")
    print(
        "Get the token from the authenticated "
        "AcciSafe browser session."
    )

    token = input("\nFirebase ID token: ").strip()

    if not token:

        print("\nERROR: Firebase ID token is required.")
        return

    print("\nAvailable scenarios:")

    for scenario in SCENARIOS:
        print(f"  {scenario}")

    print("\nEnter a scenario name.")
    print("Example: normal")

    scenario = input("\nScenario: ").strip().lower()

    run_scenario(scenario, token)


if __name__ == "__main__":
    main()