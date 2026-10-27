from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class UserInviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(..., description="Role: patient, caregiver, clinician, admin, super_admin")
    full_name: str
    phone_number: Optional[str] = None
    reason: str = Field(..., min_length=3, description="Operational reason for account creation")


class UserUpdateInput(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    is_active: Optional[bool] = None
    reason: str = Field(..., min_length=3)


class ReasonInput(BaseModel):
    reason: str = Field(..., min_length=3, description="Operational reason for sensitive action")
    ticket_ref: Optional[str] = None


class PasswordResetInput(BaseModel):
    new_password: Optional[str] = None
    reason: str = Field(..., min_length=3)


class RoleAssignInput(BaseModel):
    new_role: str = Field(..., description="New role to assign")
    reason: str = Field(..., min_length=3)


class TempGrantInput(BaseModel):
    permission_code: str
    duration_minutes: int = Field(default=60, ge=1, le=43200)
    reason: str = Field(..., min_length=3)


class ClinicianVerificationSubmitInput(BaseModel):
    registration_number: str = Field(..., min_length=3)
    credential_doc_url: str = Field(..., min_length=5)


class ClinicianVerificationDecisionInput(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    reason: str = Field(..., min_length=3)


class BulkActionInput(BaseModel):
    action_type: str = Field(..., description="suspend, reactivate, revoke_sessions, force_reconsent")
    user_ids: List[int] = Field(..., min_length=1)
    params: Optional[Dict[str, Any]] = None
    reason: str = Field(..., min_length=3)


class FlagSetInput(BaseModel):
    flag_name: str
    flag_type: str = Field(default="boolean", description="boolean, percentage_rollout, per_role, per_user, scheduled")
    enabled: bool = True
    percentage: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    allowed_roles: Optional[List[str]] = None
    allowed_user_ids: Optional[List[int]] = None
    effective_at: Optional[datetime] = None
    reason: str = Field(..., min_length=3)


class KillSwitchToggleInput(BaseModel):
    enabled: bool = Field(..., description="True to activate kill switch, False to deactivate")
    reason: str = Field(..., min_length=3)


class SettingUpdateInput(BaseModel):
    namespace: str
    key: str
    value: Any
    reason: str = Field(..., min_length=3)


class SettingRollbackInput(BaseModel):
    namespace: str
    key: str
    target_version: int = Field(..., ge=1)
    reason: str = Field(..., min_length=3)


class PanelLayoutInput(BaseModel):
    role: str
    layout_config: Dict[str, Any]
    reason: str = Field(..., min_length=3)


class AnnouncementCreateInput(BaseModel):
    title: str
    message: str
    audience: str = Field(default="all", description="all, patient, clinician, admin")
    banner_type: str = Field(default="info", description="info, warning, maintenance")
    effective_at: datetime
    expires_at: Optional[datetime] = None
    reason: str = Field(..., min_length=3)


class AnnouncementUpdateInput(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    audience: Optional[str] = None
    banner_type: Optional[str] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    reason: str = Field(..., min_length=3)


class CaseReassignInput(BaseModel):
    new_clinician_id: int
    reason: str = Field(..., min_length=3)


class DPDPRequestCreateInput(BaseModel):
    user_id: int
    request_type: str = Field(..., description="ACCESS, CORRECTION, ERASURE, WITHDRAWAL")
    payload: Optional[Dict[str, Any]] = None


class DPDPVerifyInput(BaseModel):
    reason: str = Field(..., min_length=3)


class DPDPErasureInput(BaseModel):
    reason: str = Field(..., min_length=3)


class DPDPCorrectionInput(BaseModel):
    corrections: Dict[str, Any]
    reason: str = Field(..., min_length=3)


class LegalHoldToggleInput(BaseModel):
    target_type: str = Field(..., description="'request' or 'case'")
    target_id: int
    enabled: bool
    reason: str = Field(..., min_length=5, description="Mandatory detailed legal justification")


class ConsentVersionBumpInput(BaseModel):
    new_version: str = Field(..., min_length=2)
    reason: str = Field(..., min_length=3)


class ApprovalDecisionInput(BaseModel):
    decision: str = Field(..., description="'APPROVE' or 'REJECT'")
    notes: Optional[str] = None


class RoleCreateInput(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    reason: str = Field(..., min_length=3)


class RolePermissionsUpdateInput(BaseModel):
    permissions: List[str] = Field(..., description="Complete set of permissions assigned to this role")
    reason: str = Field(..., min_length=3)
