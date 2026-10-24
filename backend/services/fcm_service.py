from datetime import datetime

from firebase_admin import messaging

from backend.services.firebase_service import db


def save_fcm_token(user_id: str, token: str):
    """
    Save or update the browser's FCM registration token
    for the authenticated AcciSafe user.
    """

    if not user_id:
        raise ValueError("user_id is required.")

    if not token:
        raise ValueError("FCM token is required.")

    token_ref = (
        db.collection("notification_tokens")
        .document(user_id)
    )

    token_ref.set(
        {
            "user_id": user_id,
            "token": token,
            "platform": "web",
            "updated_at": datetime.now().isoformat(),
        },
        merge=True,
    )

    return True


def get_fcm_token(user_id: str):
    """
    Get the currently registered FCM token
    for an AcciSafe user.
    """

    if not user_id:
        return None

    token_ref = (
        db.collection("notification_tokens")
        .document(user_id)
    )

    document = token_ref.get()

    if not document.exists:
        return None

    data = document.to_dict()

    return data.get("token")


def send_push_notification(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
):
    """
    Send an FCM push notification to the user's
    registered browser.
    """

    token = get_fcm_token(user_id)

    if not token:
        print(
            f"⚠ No FCM token registered for user {user_id}"
        )
        return {
            "success": False,
            "message": "No FCM token registered for this user.",
        }

    message_data = {}

    if data:
        message_data = {
            str(key): str(value)
            for key, value in data.items()
        }

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=message_data,
        token=token,
    )

    try:
        message_id = messaging.send(message)

        print(
            f"✓ FCM notification sent: {message_id}"
        )

        return {
            "success": True,
            "message_id": message_id,
        }

    except Exception as error:
        print(
            f"✗ FCM notification failed: {error}"
        )

        return {
            "success": False,
            "message": str(error),
        }