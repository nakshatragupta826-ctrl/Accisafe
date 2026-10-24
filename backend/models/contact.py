from pydantic import BaseModel, Field


class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    relationship: str = Field(..., min_length=1, max_length=50)


class EmergencyContactUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    relationship: str = Field(..., min_length=1, max_length=50)
    active: bool = True


class EmergencyContact(BaseModel):
    id: int
    name: str
    phone: str
    relationship: str
    active: bool
    created_at: str


class EmergencyContactListResponse(BaseModel):
    count: int
    contacts: list[EmergencyContact]