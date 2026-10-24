from fastapi import APIRouter, Depends

from backend.services.auth_service import verify_admin_token
from backend.services.database import get_all_accidents_for_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/test")
def admin_test(decoded_token=Depends(verify_admin_token)):
    return {
        "success": True,
        "message": "Admin authentication successful.",
        "uid": decoded_token["uid"],
        "admin": decoded_token.get("admin"),
    }


@router.get("/accidents")
def get_admin_accidents(
    decoded_token=Depends(verify_admin_token),
):
    accidents = get_all_accidents_for_admin()

    return {
        "count": len(accidents),
        "accidents": accidents,
    }