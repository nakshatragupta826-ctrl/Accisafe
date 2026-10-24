from fastapi import APIRouter, Depends

from backend.models.accident import AccidentHistoryResponse
from backend.services.auth_service import verify_firebase_token
from backend.services.database import get_all_accidents


router = APIRouter(
    prefix="/accidents",
    tags=["Accident History"],
)


@router.get(
    "/",
    response_model=AccidentHistoryResponse,
)
def accident_history(
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    accidents = get_all_accidents(
        user_id=user_id
    )

    return {
        "count": len(accidents),
        "accidents": accidents,
    }