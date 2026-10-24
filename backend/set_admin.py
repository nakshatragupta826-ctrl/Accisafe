import os
import sys

# Add the AcciSafe project root to Python's import path
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from firebase_admin import auth
from backend.services.firebase_service import initialize_firebase


# =========================================================
# ENTER YOUR ACCISAFE FIREBASE LOGIN EMAIL HERE
# =========================================================

ADMIN_EMAIL = "nakshatragupta826@gmail.com"


# Initialize Firebase Admin SDK
initialize_firebase()


# Find the Firebase user
user = auth.get_user_by_email(ADMIN_EMAIL)


# Preserve any existing custom claims
current_claims = user.custom_claims or {}


# Give this user administrator privileges
current_claims["admin"] = True


# Save the custom claims
auth.set_custom_user_claims(
    user.uid,
    current_claims,
)


print()
print("========================================")
print("       ACCISAFE ADMIN SETUP")
print("========================================")
print(f"Email : {user.email}")
print(f"UID   : {user.uid}")
print("Admin : True")
print("========================================")
print()
print("✅ Administrator role assigned successfully.")
print("ℹ️ Log out and log back into AcciSafe")
print("   to obtain a fresh Firebase ID token.")
print()