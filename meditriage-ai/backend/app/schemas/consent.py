from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class ConsentRecordCreate(BaseModel):
    consent_type: str = Field(default="triage_evaluation", description="Type of clinical/data consent")
    version: str = Field(default="v1.0-dpdp2023", description="Version identifier of the legal disclaimer")
    granted: bool = Field(default=True, description="Consent granted status")
    granted_by: str = Field(default="patient", description="Consent source: 'patient' or 'caregiver'")
    caregiver_name: Optional[str] = Field(default=None, description="Name of the caregiver if granted_by is caregiver")
    caregiver_relationship: Optional[str] = Field(default=None, description="Relationship of caregiver to patient (e.g. Son, Daughter, Spouse)")


class ConsentLogOut(BaseModel):
    id: int
    user_id: int
    consent_type: str
    version: str
    granted: bool
    granted_by: str
    caregiver_name: Optional[str] = None
    caregiver_relationship: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsentStatusOut(BaseModel):
    has_consent: bool
    latest_consent: Optional[ConsentLogOut] = None
