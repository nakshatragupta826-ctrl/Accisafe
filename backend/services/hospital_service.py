import json
import math
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def _distance_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _query_overpass(latitude: float, longitude: float, radius_m: int):
    query = f"""
[out:json][timeout:20];
(
  node[amenity=hospital](around:{radius_m},{latitude},{longitude});
  way[amenity=hospital](around:{radius_m},{latitude},{longitude});
  relation[amenity=hospital](around:{radius_m},{latitude},{longitude});
);
out center tags;
""".strip()

    data = urlencode({"data": query}).encode("utf-8")
    last_error = None
    for endpoint in OVERPASS_URLS:
        request = Request(
            endpoint,
            data=data,
            headers={"User-Agent": "AcciSafe/1.0 hospital lookup"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=35) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc

    raise URLError(last_error or "No Overpass endpoint available")


def find_nearby_hospitals(latitude: float, longitude: float, radius_km: float = 5.0, limit: int = 8):
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid GPS coordinates.")

    radius_m = max(500, min(int(radius_km * 1000), 20000))
    raw = _query_overpass(latitude, longitude, radius_m)
    hospitals = []

    for element in raw.get("elements", []):
        tags = element.get("tags", {})
        center = element.get("center", {})
        lat = element.get("lat", center.get("lat"))
        lon = element.get("lon", center.get("lon"))
        if lat is None or lon is None:
            continue

        name = tags.get("name") or tags.get("official_name") or "Unnamed Hospital"
        distance = _distance_km(latitude, longitude, float(lat), float(lon))
        address_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:suburb"),
            tags.get("addr:city"),
        ]
        address = ", ".join(part for part in address_parts if part) or "Address unavailable"

        hospitals.append({
            "name": name,
            "latitude": float(lat),
            "longitude": float(lon),
            "distance_km": round(distance, 2),
            "address": address,
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "website": tags.get("website") or tags.get("contact:website"),
            "emergency": tags.get("emergency") in {"yes", "designated"},
            "maps_url": (
                "https://www.google.com/maps/dir/?api=1"
                f"&destination={float(lat)},{float(lon)}"
            ),
        })

    hospitals.sort(key=lambda item: item["distance_km"])

    # Deduplicate hospitals that may appear as multiple OSM elements.
    unique = []
    seen = set()
    for hospital in hospitals:
        key = (round(hospital["latitude"], 5), round(hospital["longitude"], 5), hospital["name"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(hospital)
        if len(unique) >= limit:
            break

    return unique


def get_nearby_hospitals(latitude: float, longitude: float, radius_km: float = 5.0, limit: int = 8):
    try:
        hospitals = find_nearby_hospitals(latitude, longitude, radius_km, limit)
        return {
            "success": True,
            "count": len(hospitals),
            "latitude": latitude,
            "longitude": longitude,
            "radius_km": radius_km,
            "hospitals": hospitals,
        }
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return {
            "success": False,
            "count": 0,
            "latitude": latitude,
            "longitude": longitude,
            "radius_km": radius_km,
            "hospitals": [],
            "message": f"Hospital lookup is temporarily unavailable: {exc}",
        }
