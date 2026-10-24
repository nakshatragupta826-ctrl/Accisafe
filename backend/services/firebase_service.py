import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore


BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

SERVICE_ACCOUNT_PATH = os.path.join(
    BASE_DIR,
    "backend",
    "firebase-service-account.json",
)


def initialize_firebase():
    """Initialize Firebase Admin SDK once and return Firestore client."""

    if not firebase_admin._apps:

        if not os.path.exists(SERVICE_ACCOUNT_PATH):
            raise FileNotFoundError(
                f"Firebase service account not found: "
                f"{SERVICE_ACCOUNT_PATH}"
            )

        cred = credentials.Certificate(
            SERVICE_ACCOUNT_PATH
        )

        firebase_admin.initialize_app(cred)

    return firestore.client()


db = initialize_firebase()


def test_firestore_connection():
    """Test the Firestore connection."""

    test_ref = (
        db
        .collection("_system")
        .document("connection_test")
    )

    test_ref.set(
        {
            "system": "AcciSafe",
            "status": "connected",
            "message": (
                "Firebase Firestore connection successful"
            ),
        }
    )

    return {
        "success": True,
        "message": (
            "Successfully connected to Firebase Firestore"
        ),
    }


def save_accident_to_firestore(accident):
    """
    Save an AcciSafe accident to Firestore.

    Returns the Firestore document ID.
    """

    accident_data = {
        "timestamp": accident.get(
            "timestamp",
            datetime.now().isoformat(),
        ),
        "latitude": accident.get("latitude"),
        "longitude": accident.get("longitude"),
        "acceleration": accident.get("acceleration"),
        "speed_before": accident.get("speed_before"),
        "speed_after": accident.get("speed_after"),
        "tilt_angle": accident.get("tilt_angle"),
        "observation_seconds": accident.get(
            "observation_seconds",
            0,
        ),
        "status": accident.get("status"),
        "stage": accident.get("stage"),
        "message": accident.get("message"),
        "user_id": accident.get("user_id"),
    }

    doc_ref = (
        db
        .collection("accidents")
        .document()
    )

    doc_ref.set(accident_data)

    return doc_ref.id


def update_accident_in_firestore(
    firestore_id,
    status,
    message,
):
    """
    Update the status of an existing Firestore accident.
    """

    if not firestore_id:
        return False

    doc_ref = (
        db
        .collection("accidents")
        .document(firestore_id)
    )

    doc_ref.update(
        {
            "status": status,
            "message": message,
            "updated_at": datetime.now().isoformat(),
        }
    )

    return True