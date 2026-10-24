from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    acceleration: float = Field(
        ...,
        description="Acceleration magnitude in g"
    )

    speed_before: float = Field(
        ...,
        description="GPS speed before impact in km/h"
    )

    speed_after: float = Field(
        ...,
        description="GPS speed immediately after impact in km/h"
    )

    tilt_angle: float = Field(
        ...,
        description="Motorcycle tilt angle in degrees"
    )

    observation_seconds: int = Field(
        ...,
        description="Time elapsed during observation period"
    )

    speed_during_observation: float = Field(
        ...,
        description="Motorcycle speed during observation in km/h"
    )

    latitude: float = Field(
        ...,
        description="GPS latitude"
    )

    longitude: float = Field(
        ...,
        description="GPS longitude"
    )