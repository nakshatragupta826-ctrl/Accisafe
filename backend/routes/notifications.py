from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.services.auth_service import verify_firebase_token
from backend.services.fcm_service import save_fcm_token


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


class FCMTokenRequest(BaseModel):
    token: str


@router.post("/token")
def register_fcm_token(
    request: FCMTokenRequest,
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    if not request.token:
        raise HTTPException(
            status_code=400,
            detail="FCM token is required.",
        )

    save_fcm_token(
        user_id=user_id,
        token=request.token,
    )

    return {
        "success": True,
        "message": "FCM token registered successfully.",
    }