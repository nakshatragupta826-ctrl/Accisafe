from fastapi import APIRouter, Query

from backend.services.hospital_service import get_nearby_hospitals


router = APIRouter(prefix="/hospitals", tags=["Nearby Hospitals"])


@router.get("/nearby")
def nearby_hospitals(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.5, le=20.0),
    limit: int = Query(8, ge=1, le=20),
):
    return get_nearby_hospitals(latitude, longitude, radius_km, limit)
