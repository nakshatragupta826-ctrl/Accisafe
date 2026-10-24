from fastapi import APIRouter, Depends, HTTPException

from backend.models.contact import (
    EmergencyContact,
    EmergencyContactCreate,
    EmergencyContactListResponse,
    EmergencyContactUpdate,
)

from backend.services.auth_service import verify_firebase_token

from backend.services.database import (
    add_emergency_contact,
    delete_emergency_contact,
    get_all_emergency_contacts,
    get_emergency_contact,
    update_emergency_contact,
)


router = APIRouter(
    prefix="/contacts",
    tags=["Emergency Contacts"],
)


@router.get(
    "/",
    response_model=EmergencyContactListResponse,
)
def get_contacts(
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    contacts = get_all_emergency_contacts(
        user_id=user_id
    )

    return {
        "count": len(contacts),
        "contacts": contacts,
    }


@router.get(
    "/{contact_id}",
    response_model=EmergencyContact,
)
def get_contact(
    contact_id: int,
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    contact = get_emergency_contact(
        contact_id,
        user_id=user_id,
    )

    if contact is None:
        raise HTTPException(
            status_code=404,
            detail="Emergency contact not found.",
        )

    return contact


@router.post(
    "/",
    response_model=EmergencyContact,
)
def create_contact(
    contact: EmergencyContactCreate,
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    contact_id = add_emergency_contact(
        name=contact.name,
        phone=contact.phone,
        relationship=contact.relationship,
        user_id=user_id,
    )

    return get_emergency_contact(
        contact_id,
        user_id=user_id,
    )


@router.put(
    "/{contact_id}",
    response_model=EmergencyContact,
)
def update_contact(
    contact_id: int,
    contact: EmergencyContactUpdate,
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    updated = update_emergency_contact(
        contact_id=contact_id,
        name=contact.name,
        phone=contact.phone,
        relationship=contact.relationship,
        active=contact.active,
        user_id=user_id,
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Emergency contact not found.",
        )

    return get_emergency_contact(
        contact_id,
        user_id=user_id,
    )


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    decoded_token=Depends(verify_firebase_token),
):
    user_id = decoded_token["uid"]

    deleted = delete_emergency_contact(
        contact_id,
        user_id=user_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Emergency contact not found.",
        )

    return {
        "success": True,
        "message": "Emergency contact deleted successfully.",
    }