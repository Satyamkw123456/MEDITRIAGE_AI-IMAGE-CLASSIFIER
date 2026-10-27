from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class RuleDraftInput(BaseModel):
    namespace: str = Field(default="geriatric_rules", description="geriatric_rules, drug_rules, drug_brand_map")
    key: str = Field(default="rules")
    payload: List[Dict[str, Any]]
    note: Optional[str] = None


class RulePublishInput(BaseModel):
    namespace: str = Field(default="geriatric_rules")
    key: str = Field(default="rules")
    version: int
    validated_by: str = Field(..., description="Mandatory clinical reviewer ID or name")
    reason: Optional[str] = None


class RuleRollbackInput(BaseModel):
    namespace: str = Field(default="geriatric_rules")
    key: str = Field(default="rules")
    target_version: int
    reason: str


class RuleImportInput(BaseModel):
    content: str
    format: str = Field(default="json", description="json, yaml, or csv")


class QuestionnaireUpdateInput(BaseModel):
    payload: Dict[str, Any]
    dual_control_approved: bool = False


class QualityParametersUpdateInput(BaseModel):
    payload: Dict[str, Any]
    dual_control_approved: bool = False
    regression_passed: bool = False
    reason: str


class AIProviderSelectionInput(BaseModel):
    payload: Dict[str, Any]
    reason: Optional[str] = None


class AIBudgetQuotaInput(BaseModel):
    payload: Dict[str, Any]
    reason: Optional[str] = None


class PromptDraftInput(BaseModel):
    prompt_key: str
    system_template: str
    user_template: str
    note: Optional[str] = None


class PromptSandboxInput(BaseModel):
    system_template: str
    user_template: str
    test_case_payload: Dict[str, Any]
    is_live: bool = False


class PromptPublishInput(BaseModel):
    prompt_key: str
    version: int
    reason: Optional[str] = None


class ImpersonateStartInput(BaseModel):
    target_user_id: int
    reason: str
    ticket_ref: str
    duration_minutes: int = Field(default=15, le=15, ge=1)


class BreakGlassInput(BaseModel):
    reason: str
    duration_minutes: int = Field(default=10, le=10, ge=1)


class I18nUpdateInput(BaseModel):
    payload: Dict[str, Any]
    reason: Optional[str] = None


class ConsentBumpInput(BaseModel):
    new_version: str
    title: str
    text: str
    reason: str


class ResourceInput(BaseModel):
    name: str
    category: str = Field(description="hospital, ambulance, helpline")
    phone_number: str
    city_region: str
    last_verified_at: Optional[str] = None
    is_active: bool = True


class IPBlockInput(BaseModel):
    ip: str
    reason: str


class RateLimitInput(BaseModel):
    requests_per_minute: int
    burst_limit: int


class IncidentRecordInput(BaseModel):
    title: str
    severity: str = Field(description="LOW, MEDIUM, HIGH, CRITICAL")
    description: str
    affected_accounts_count: int = 0
    incident_code: Optional[str] = None
    remediation_notes: Optional[str] = None


class IncidentStatusInput(BaseModel):
    status: str = Field(description="OPEN, INVESTIGATING, CONTAINED, RESOLVED, CLOSED")
    remediation_notes: str


class ExportVerificationInput(BaseModel):
    signature: str
    data: Optional[List[Dict[str, Any]]] = None
    content: Optional[str] = None
