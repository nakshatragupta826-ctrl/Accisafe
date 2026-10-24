from pydantic import BaseModel


class AccidentRecord(BaseModel):
    id: int
    timestamp: str
    latitude: float
    longitude: float
    acceleration: float
    speed_before: float
    speed_after: float
    tilt_angle: float
    observation_seconds: int
    status: str
    stage: int
    message: str


class AccidentHistoryResponse(BaseModel):
    count: int
    accidents: list[AccidentRecord]