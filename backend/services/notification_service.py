"""
AcciSafe emergency notification service (Telegram version).

Put this file at: backend/services/notification_service.py

What it does
------------
1. Saves one notification record per active emergency contact.
2. Sends an instant Telegram message with the emergency alert and Google Maps link.
3. Updates each record's status:
        GENERATED = saved only (Telegram credentials not set in .env)
        SENT      = successfully dispatched via Telegram Bot API
        FAILED    = transmission failed
"""

import os
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from backend.services.database import (
    get_active_emergency_contacts,
    get_connection,
    save_notification,
)


def update_notification_status(notification_id: int, status: str):
    connection = get_connection()
    try:
        connection.execute(
            "UPDATE notifications SET status = ? WHERE id = ?",
            (status, notification_id),
        )
        connection.commit()
    finally:
        connection.close()
    return True


def create_emergency_message(latitude: float, longitude: float):
    maps_link = (
        "https://www.google.com/maps/search/"
        f"?api=1&query={latitude},{longitude}"
    )

    return (
        "🚨 *ACCISAFE EMERGENCY ALERT* 🚨\n\n"
        "A possible motorcycle accident has been "
        "confirmed by AcciSafe.\n\n"
        f"📍 *Location:* `{latitude}, {longitude}`\n"
        f"🗺 [View Location on Google Maps]({maps_link})\n\n"
        "⚠️ *Please contact the rider or emergency services immediately!*"
    )


def _send_telegram_message(token: str, chat_id: str, message: str):
    """Sends a formatted message to Telegram using the official Telegram Bot API."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False,
    }

    response = requests.post(url, json=payload, timeout=15)

    if response.status_code >= 400:
        raise RuntimeError(f"Telegram API HTTP error {response.status_code}: {response.text}")

    return response.json()


def notify_emergency_contacts(
    accident_id: int,
    latitude: float,
    longitude: float,
    user_id=None,
):
    contacts = get_active_emergency_contacts(user_id=user_id)

    if not contacts:
        print("⚠ No active emergency contacts configured.")
        return {
            "success": False,
            "notifications_created": 0,
            "notifications_sent_or_queued": 0,
            "notifications": [],
            "message": "No active emergency contacts found.",
        }

    message = create_emergency_message(latitude, longitude)
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    is_configured = bool(bot_token and chat_id)

    if not is_configured:
        print(
            "ℹ Telegram is not fully configured (TELEGRAM_BOT_TOKEN / "
            "TELEGRAM_CHAT_ID missing in .env). Alerts are saved but NOT sent."
        )

    notifications = []
    sent_count = 0

    for contact in contacts:
        notification_id = save_notification(
            accident_id=accident_id,
            contact_id=contact["id"],
            contact_name=contact["name"],
            contact_phone=contact["phone"],
            message=message,
            latitude=latitude,
            longitude=longitude,
            status="GENERATED",
            user_id=user_id,
        )

        channels, errors = [], []
        status = "GENERATED"

        if is_configured:
            try:
                _send_telegram_message(bot_token, chat_id, message)
                channels.append("TELEGRAM")
                status = "SENT"
                print(f"✅ Telegram alert dispatched for emergency contact {contact['name']}")
            except Exception as error:
                status = "FAILED"
                errors.append(str(error))
                print(f"⚠ Telegram alert for {contact['name']} failed - {error}")

            update_notification_status(notification_id, status)

        if status == "SENT":
            sent_count += 1

        notifications.append(
            {
                "id": notification_id,
                "contact_id": contact["id"],
                "contact_name": contact["name"],
                "contact_phone": contact["phone"],
                "status": status,
                "channels": channels,
                "errors": errors,
                "message": message,
            }
        )

    return {
        "success": True,
        "notifications_created": len(notifications),
        "notifications_sent_or_queued": sent_count,
        "alerts_configured": is_configured,
        "notifications": notifications,
    }