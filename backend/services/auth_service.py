from fastapi import Header, HTTPException
from firebase_admin import auth


def verify_firebase_token(
    authorization: str = Header(None),
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is required.",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header.",
        )

    token = authorization.split("Bearer ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Firebase ID token is missing.",
        )

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token

    except Exception as exc:
        print(
            f"Firebase token verification failed: "
            f"{type(exc).__name__}: {exc}"
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase ID token.",
        )


# =========================================================
# ADMIN AUTHENTICATION
# =========================================================

def verify_admin_token(
    authorization: str = Header(None),
):
    """
    Verify the Firebase ID token and make sure
    the authenticated user has the admin claim.
    """

    decoded_token = verify_firebase_token(
        authorization=authorization
    )

    if decoded_token.get("admin") is not True:
        raise HTTPException(
            status_code=403,
            detail="Administrator access required.",
        )

    return decoded_token