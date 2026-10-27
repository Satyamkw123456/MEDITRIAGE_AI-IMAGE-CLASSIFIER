from typing import List, Optional, Dict, Any
from collections import Counter
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, require_permission, get_current_user, get_case_for_user
from app.models.case import Case
from app.models.triage import TriageResult
from app.models.quality import QualityScore
from app.models.user import User
from app.schemas.admin import AdminAnalyticsOut, SymptomCountOut, TriageCountOut, UnifiedAuditTrailOut
from app.schemas.feedback import FeedbackTrendsOut, FeedbackTrendTriageItem, FeedbackTrendConfidenceItem
from app.models.feedback import ClinicianFeedback

# Cycle 6 Control Plane imports
from app.services.admin.user_admin_service import UserAdminService
from app.services.admin.flags_settings_service import FlagsSettingsService
from app.services.admin.case_oversight_service import CaseOversightService
from app.services.admin.dpdp_service import DPDPService
from app.services.admin.approvals_service import ApprovalsService
from app.services.admin.needs_attention_service import NeedsAttentionService
from app.services.audit.audit_service import AuditService

# Cycle 7 Control Plane imports
from app.services.admin.clinical_governance_service import ClinicalGovernanceService
from app.services.admin.ai_control_service import AIControlService
from app.services.admin.support_tools_service import SupportToolsService
from app.services.admin.content_resources_service import ContentResourcesService
from app.services.admin.operations_service import OperationsService
from app.services.admin.audit_compliance_service import AuditComplianceService

from app.schemas.admin_cycle7 import (
    RuleDraftInput, RulePublishInput, RuleRollbackInput, RuleImportInput,
    QuestionnaireUpdateInput, QualityParametersUpdateInput,
    AIProviderSelectionInput, AIBudgetQuotaInput,
    PromptDraftInput, PromptSandboxInput, PromptPublishInput,
    ImpersonateStartInput, BreakGlassInput,
    I18nUpdateInput, ConsentBumpInput, ResourceInput,
    IPBlockInput, IncidentRecordInput, IncidentStatusInput, ExportVerificationInput
)

from app.schemas.admin_control_plane import (
    UserInviteCreate,
    UserUpdateInput,
    ReasonInput,
    PasswordResetInput,
    RoleAssignInput,
    TempGrantInput,
    ClinicianVerificationSubmitInput,
    ClinicianVerificationDecisionInput,
    BulkActionInput,
    FlagSetInput,
    KillSwitchToggleInput,
    SettingUpdateInput,
    SettingRollbackInput,
    PanelLayoutInput,
    AnnouncementCreateInput,
    AnnouncementUpdateInput,
    CaseReassignInput,
    DPDPRequestCreateInput,
    DPDPVerifyInput,
    DPDPErasureInput,
    DPDPCorrectionInput,
    LegalHoldToggleInput,
    ConsentVersionBumpInput,
    ApprovalDecisionInput,
    RoleCreateInput,
    RolePermissionsUpdateInput,
)

router = APIRouter(tags=["admin"])


# ============================================================================
# Existing Analytics, Audits & Feedback Trends
# ============================================================================

@router.get("/analytics", response_model=AdminAnalyticsOut, dependencies=[Depends(require_permission("perm.admin.analytics"))])
def get_admin_analytics(db: Session = Depends(get_db)):
    """Retrieves system-wide analytics for the admin dashboard."""
    total_cases = db.query(Case).count()

    complaints = db.query(Case.chief_complaint).all()
    cleaned_complaints = [c[0].strip().lower() for c in complaints if c[0]]
    symptom_counter = Counter(cleaned_complaints)
    top_symptoms = [
        SymptomCountOut(name=name.title(), count=count)
        for name, count in symptom_counter.most_common(10)
    ]

    emergency_count = db.query(Case).filter(Case.is_emergency_flag == True).count()
    triage_counts = db.query(
        TriageResult.triage_level,
        func.count(TriageResult.id)
    ).join(Case).filter(Case.is_emergency_flag == False).group_by(TriageResult.triage_level).all()

    distribution = []
    if emergency_count > 0:
        distribution.append(TriageCountOut(level="Emergency", count=emergency_count))
    for level, count in triage_counts:
        distribution.append(TriageCountOut(level=level, count=count))

    levels_seen = {d.level for d in distribution}
    for default_level in ["Emergency", "Urgent", "Routine", "Self-Care Info"]:
        if default_level not in levels_seen:
            distribution.append(TriageCountOut(level=default_level, count=0))

    severity_order = {"Emergency": 1, "Urgent": 2, "Routine": 3, "Self-Care Info": 4}
    distribution.sort(key=lambda x: severity_order.get(x.level, 99))

    return AdminAnalyticsOut(
        total_cases=total_cases,
        symptoms=top_symptoms,
        triage_distribution=distribution
    )


@router.get("/audit-logs", response_model=List[UnifiedAuditTrailOut], dependencies=[Depends(require_permission("perm.admin.audit"))])
def get_audit_logs(
    case_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    confidence_band: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Case)
    if case_id is not None:
        query = query.filter(Case.id == case_id)
    if start_date is not None:
        query = query.filter(Case.created_at >= start_date)
    if end_date is not None:
        query = query.filter(Case.created_at <= end_date)
    if confidence_band is not None:
        query = query.join(QualityScore).filter(QualityScore.confidence_band == confidence_band)

    cases = query.all()
    results = []
    for c in cases:
        results.append(
            UnifiedAuditTrailOut(
                case_id=c.id,
                created_at=c.created_at,
                rule_triage=c.triage_result,
                quality_score=c.quality_score,
                ai_logs=c.ai_audit_logs
            )
        )
    return results


@router.get("/feedback-trends", response_model=FeedbackTrendsOut, dependencies=[Depends(require_permission("perm.admin.feedback"))])
def get_feedback_trends(db: Session = Depends(get_db)):
    query = (
        db.query(ClinicianFeedback, TriageResult, QualityScore)
        .join(Case, ClinicianFeedback.case_id == Case.id)
        .outerjoin(TriageResult, Case.id == TriageResult.case_id)
        .outerjoin(QualityScore, Case.id == QualityScore.case_id)
    ).all()

    triage_stats = {}
    confidence_stats = {}

    for feedback, triage, quality in query:
        triage_lvl = triage.triage_level if triage else "Emergency"
        if triage_lvl not in triage_stats:
            triage_stats[triage_lvl] = {"total": 0, "rejected": 0}
        triage_stats[triage_lvl]["total"] += 1
        if feedback.feedback_status == "Rejected":
            triage_stats[triage_lvl]["rejected"] += 1

        conf_band = quality.confidence_band if quality and quality.confidence_band else "Unknown"
        if conf_band not in confidence_stats:
            confidence_stats[conf_band] = {"total": 0, "rejected": 0}
        confidence_stats[conf_band]["total"] += 1
        if feedback.feedback_status == "Rejected":
            confidence_stats[conf_band]["rejected"] += 1

    by_triage = []
    for level, stats in triage_stats.items():
        by_triage.append(FeedbackTrendTriageItem(
            triage_level=level,
            total_feedbacks=stats["total"],
            rejected_count=stats["rejected"],
            rejection_rate=stats["rejected"] / stats["total"] if stats["total"] > 0 else 0.0
        ))

    by_confidence = []
    for band, stats in confidence_stats.items():
        by_confidence.append(FeedbackTrendConfidenceItem(
            confidence_band=band,
            total_feedbacks=stats["total"],
            rejected_count=stats["rejected"],
            rejection_rate=stats["rejected"] / stats["total"] if stats["total"] > 0 else 0.0
        ))

    return FeedbackTrendsOut(
        by_triage_level=by_triage,
        by_confidence_band=by_confidence
    )


# ============================================================================
# AC-01: Identity & Access Management
# ============================================================================

@router.get("/users")
def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_suspended: Optional[bool] = None,
    verification_status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "id",
    sort_desc: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.list_users(
        db=db,
        role=role,
        is_active=is_active,
        is_suspended=is_suspended,
        verification_status=verification_status,
        search=search,
        sort_by=sort_by,
        sort_desc=sort_desc,
        limit=limit,
        offset=offset,
    )


@router.post("/users/clinicians/submit-verification")
def submit_clinician_verification(
    payload: ClinicianVerificationSubmitInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allows a clinician user to submit their license/registration credentials for review."""
    return UserAdminService.submit_clinician_verification(
        db=db,
        user_id=current_user.id,
        registration_number=payload.registration_number,
        credential_doc_url=payload.credential_doc_url,
    )


@router.post("/users/clinicians/{user_id}/verify")
def decide_clinician_verification(
    user_id: int,
    payload: ClinicianVerificationDecisionInput,
    current_user: User = Depends(require_permission("perm.admin.clinicians.verify")),
    db: Session = Depends(get_db),
):
    """Admin decides clinician verification (approves or rejects)."""
    return UserAdminService.decide_clinician_verification(
        db=db,
        actor=current_user,
        user_id=user_id,
        decision=payload.decision,
        reason=payload.reason,
    )


@router.get("/users/caregiver-links")
def list_caregiver_links(
    patient_id: Optional[int] = None,
    caregiver_id: Optional[int] = None,
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.list_caregiver_links(db=db, patient_id=patient_id, caregiver_id=caregiver_id)


@router.delete("/users/caregiver-links/{link_id}")
def revoke_caregiver_link(
    link_id: int,
    reason: Optional[str] = Query(None),
    payload: Optional[ReasonInput] = None,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    effective_reason = (payload.reason if payload and payload.reason else None) or reason or "Caregiver link revoked"
    return UserAdminService.revoke_caregiver_link(
        db=db, actor=current_user, link_id=link_id, reason=effective_reason
    )


@router.post("/users/bulk")
def execute_bulk_action(
    payload: BulkActionInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.execute_bulk_action(
        db=db,
        actor=current_user,
        action_type=payload.action_type,
        user_ids=payload.user_ids,
        params=payload.params,
        reason=payload.reason,
    )


@router.get("/users/lockouts/list")
def list_lockouts(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.list_lockouts(db=db, limit=limit, offset=offset)


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.get_user_detail(db=db, user_id=user_id)


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user_invite(
    payload: UserInviteCreate,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.create_user_invite(
        db=db,
        actor=current_user,
        email=payload.email,
        role=payload.role,
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        reason=payload.reason,
    )


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.update_user(
        db=db,
        actor=current_user,
        user_id=user_id,
        data=payload.model_dump(exclude_unset=True, exclude={"reason"}),
        reason=payload.reason,
    )


@router.post("/users/{user_id}/suspend")
def suspend_user(
    user_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.suspend_user(
        db=db, actor=current_user, user_id=user_id, reason=payload.reason, ticket_ref=payload.ticket_ref
    )


@router.post("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.reactivate_user(
        db=db, actor=current_user, user_id=user_id, reason=payload.reason, ticket_ref=payload.ticket_ref
    )


@router.post("/users/{user_id}/revoke-sessions")
def revoke_sessions(
    user_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.users.sessions")),
    db: Session = Depends(get_db),
):
    return UserAdminService.revoke_user_sessions(
        db=db, actor=current_user, user_id=user_id, reason=payload.reason, ticket_ref=payload.ticket_ref
    )


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordResetInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.reset_user_password(
        db=db, actor=current_user, user_id=user_id, new_password=payload.new_password, reason=payload.reason
    )


@router.post("/users/{user_id}/reset-mfa")
def reset_mfa(
    user_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.reset_user_mfa(
        db=db, actor=current_user, user_id=user_id, reason=payload.reason, ticket_ref=payload.ticket_ref
    )


@router.post("/users/{user_id}/assign-role")
def assign_role(
    user_id: int,
    payload: RoleAssignInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.assign_user_role(
        db=db, actor=current_user, user_id=user_id, new_role=payload.new_role, reason=payload.reason
    )


@router.post("/users/{user_id}/grants")
def grant_temporary_permission(
    user_id: int,
    payload: TempGrantInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.grant_temporary_permission(
        db=db,
        actor=current_user,
        user_id=user_id,
        permission_code=payload.permission_code,
        duration_minutes=payload.duration_minutes,
        reason=payload.reason,
    )


@router.delete("/users/{user_id}/grants/{grant_id}")
def revoke_temporary_permission(
    user_id: int,
    grant_id: int,
    reason: Optional[str] = Query(None),
    payload: Optional[ReasonInput] = None,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    effective_reason = (payload.reason if payload and payload.reason else None) or reason or "Temporary permission grant revoked"
    return UserAdminService.revoke_temporary_permission(
        db=db, actor=current_user, grant_id=grant_id, reason=effective_reason
    )


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.unlock_user(
        db=db, actor=current_user, user_id=user_id, reason=payload.reason
    )


# ============================================================================
# Role & Permission Matrix Management
# ============================================================================

@router.get("/roles")
def list_roles(
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.list_roles(db=db)


@router.post("/roles", status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreateInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.create_role(
        db=db,
        actor=current_user,
        code=payload.code,
        description=payload.description,
        permissions=payload.permissions,
        reason=payload.reason,
    )


@router.get("/permissions")
def list_permissions(
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.list_permissions(db=db)


@router.get("/roles/{role_code}/permissions")
def get_role_permissions(
    role_code: str,
    current_user: User = Depends(require_permission("perm.admin.users.read")),
    db: Session = Depends(get_db),
):
    return UserAdminService.get_role_permissions(db=db, role_code=role_code)


@router.put("/roles/{role_code}/permissions")
def update_role_permissions(
    role_code: str,
    payload: RolePermissionsUpdateInput,
    current_user: User = Depends(require_permission("perm.admin.users.manage")),
    db: Session = Depends(get_db),
):
    return UserAdminService.update_role_permissions(
        db=db,
        actor=current_user,
        role_code=role_code,
        permissions=payload.permissions,
        reason=payload.reason,
    )


# ============================================================================
# AC-02: Feature Flags, Settings & Kill Switches
# ============================================================================

@router.get("/flags")
def list_flags(
    environment: str = "production",
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.list_flags(db=db, environment=environment)


@router.post("/flags")
def set_flag(
    payload: FlagSetInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.set_flag(
        db=db,
        actor=current_user,
        flag_name=payload.flag_name,
        flag_type=payload.flag_type,
        enabled=payload.enabled,
        percentage=payload.percentage,
        allowed_roles=payload.allowed_roles,
        allowed_user_ids=payload.allowed_user_ids,
        effective_at=payload.effective_at,
        reason=payload.reason,
    )


@router.get("/kill-switches")
def list_kill_switches(
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.list_kill_switches(db=db)


@router.post("/kill-switches/{name}/toggle")
def toggle_kill_switch(
    name: str,
    payload: KillSwitchToggleInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.toggle_kill_switch(
        db=db,
        actor=current_user,
        switch_name=name,
        enabled=payload.enabled,
        reason=payload.reason,
    )


@router.get("/settings")
def list_settings(
    namespace: Optional[str] = None,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.list_settings(db=db, namespace=namespace)


@router.post("/settings")
def update_setting(
    payload: SettingUpdateInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.update_setting(
        db=db,
        actor=current_user,
        namespace=payload.namespace,
        key=payload.key,
        value=payload.value,
        reason=payload.reason,
    )


@router.post("/settings/rollback")
def rollback_setting(
    payload: SettingRollbackInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.rollback_setting(
        db=db,
        actor=current_user,
        namespace=payload.namespace,
        key=payload.key,
        target_version=payload.target_version,
        reason=payload.reason,
    )


@router.get("/panel-layout")
def get_panel_layout(
    role: str = "patient",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.get_panel_layout(db=db, role=role)


@router.post("/panel-layout")
def update_panel_layout(
    payload: PanelLayoutInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.update_panel_layout(
        db=db,
        actor=current_user,
        role=payload.role,
        layout_config=payload.layout_config,
        reason=payload.reason,
    )


@router.get("/announcements")
def list_announcements(
    audience: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.list_announcements(
        db=db, audience=audience or current_user.role, active_only=active_only
    )


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreateInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.create_announcement(
        db=db,
        actor=current_user,
        title=payload.title,
        message=payload.message,
        audience=payload.audience,
        banner_type=payload.banner_type,
        effective_at=payload.effective_at,
        expires_at=payload.expires_at,
        reason=payload.reason,
    )


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdateInput,
    current_user: User = Depends(require_permission("perm.admin.flags.manage")),
    db: Session = Depends(get_db),
):
    return FlagsSettingsService.update_announcement(
        db=db,
        actor=current_user,
        announcement_id=announcement_id,
        data=payload.dict(exclude_unset=True, exclude={"reason"}),
        reason=payload.reason,
    )


# ============================================================================
# AC-05: Case & Queue Oversight
# ============================================================================

@router.get("/cases/metadata-search")
def search_cases_metadata_only(
    case_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    triage_level: Optional[str] = None,
    is_emergency_flag: Optional[bool] = None,
    status: Optional[str] = None,
    assigned_clinician_id: Optional[int] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    sort_by: str = "id",
    sort_desc: bool = True,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    """
    Zero-PHI metadata-only search. Returns strictly approved metadata fields.
    Chief complaints, symptoms, patient names, and demographic details are never returned.
    """
    return CaseOversightService.metadata_only_search(
        db=db,
        case_id=case_id,
        patient_id=patient_id,
        triage_level=triage_level,
        is_emergency_flag=is_emergency_flag,
        status=status,
        assigned_clinician_id=assigned_clinician_id,
        created_after=created_after,
        created_before=created_before,
        sort_by=sort_by,
        sort_desc=sort_desc,
        limit=limit,
        offset=offset,
    )


@router.get("/cases/worklists")
def get_oversight_worklists(
    unreviewed_threshold_hours: int = 24,
    confidence_threshold: float = 0.60,
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    return CaseOversightService.get_worklists(
        db=db,
        unreviewed_threshold_hours=unreviewed_threshold_hours,
        confidence_threshold=confidence_threshold,
    )


@router.post("/cases/{case_id}/reassign")
def reassign_case_clinician(
    payload: CaseReassignInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    return CaseOversightService.reassign_clinician(
        db=db,
        actor=current_user,
        case_id=case.id,
        new_clinician_id=payload.new_clinician_id,
        reason=payload.reason,
    )


@router.post("/cases/{case_id}/force-reopen")
def force_reopen_case(
    payload: ReasonInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    return CaseOversightService.force_reopen_case(
        db=db, actor=current_user, case_id=case.id, reason=payload.reason
    )


@router.post("/cases/{case_id}/restore")
def restore_soft_deleted_case(
    payload: ReasonInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    return CaseOversightService.restore_case(
        db=db, actor=current_user, case_id=case.id, reason=payload.reason
    )


@router.post("/cases/{case_id}/archive")
def archive_case(
    payload: ReasonInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    return CaseOversightService.archive_case(
        db=db, actor=current_user, case_id=case.id, reason=payload.reason
    )


@router.post("/cases/{case_id}/purge-request")
def request_case_purge(
    payload: ReasonInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("perm.admin.cases.oversight")),
    db: Session = Depends(get_db),
):
    """
    Submits a case purge request for dual-control sign-off.
    Unconditionally blocked if active legal hold is present.
    """
    return CaseOversightService.request_case_purge(
        db=db, actor=current_user, case_id=case.id, reason=payload.reason
    )


# ============================================================================
# AC-06: DPDP Data Rights Queue & Consent Ledger
# ============================================================================

@router.get("/dpdp/requests")
def list_dpdp_requests(
    status_filter: Optional[str] = None,
    request_type: Optional[str] = None,
    overdue_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.list_requests(
        db=db,
        status_filter=status_filter,
        request_type=request_type,
        overdue_only=overdue_only,
        limit=limit,
        offset=offset,
    )


@router.post("/dpdp/requests", status_code=status.HTTP_201_CREATED)
def create_dpdp_request(
    payload: DPDPRequestCreateInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new DPDP request (accessible by patient or admin)."""
    # If not admin, patient can only create for self
    if current_user.role not in ("admin", "super_admin") and payload.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create data rights request for another user."
        )
    req = DPDPService.create_request(
        db=db, user_id=payload.user_id, request_type=payload.request_type, payload=payload.payload
    )
    return {"status": "created", "request_id": req.id, "due_date": req.due_date.isoformat()}


@router.get("/dpdp/requests/{request_id}")
def get_dpdp_request(
    request_id: int,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.get_request(db=db, request_id=request_id)


@router.post("/dpdp/requests/{request_id}/verify")
def verify_dpdp_identity(
    request_id: int,
    payload: DPDPVerifyInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.verify_identity(
        db=db, actor=current_user, request_id=request_id, reason=payload.reason
    )


@router.post("/dpdp/requests/{request_id}/erasure")
def execute_dpdp_erasure(
    request_id: int,
    payload: DPDPErasureInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.execute_erasure(
        db=db, actor=current_user, request_id=request_id, reason=payload.reason
    )


@router.post("/dpdp/requests/{request_id}/correction")
def execute_dpdp_correction(
    request_id: int,
    payload: DPDPCorrectionInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.execute_correction(
        db=db,
        actor=current_user,
        request_id=request_id,
        corrections=payload.corrections,
        reason=payload.reason,
    )


@router.post("/dpdp/requests/{request_id}/reject")
def reject_dpdp_request(
    request_id: int,
    payload: ReasonInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.reject_request(
        db=db, actor=current_user, request_id=request_id, reason=payload.reason
    )


@router.post("/dpdp/legal-hold")
def toggle_legal_hold(
    payload: LegalHoldToggleInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.toggle_legal_hold(
        db=db,
        actor=current_user,
        target_type=payload.target_type,
        target_id=payload.target_id,
        enabled=payload.enabled,
        reason=payload.reason,
    )


@router.get("/dpdp/consent-ledger")
def get_consent_ledger(
    user_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.get_consent_ledger(db=db, user_id=user_id, limit=limit, offset=offset)


@router.post("/dpdp/consent-version-bump")
def bump_consent_version(
    payload: ConsentVersionBumpInput,
    current_user: User = Depends(require_permission("perm.admin.dpdp.manage")),
    db: Session = Depends(get_db),
):
    return DPDPService.bump_consent_version(
        db=db, actor=current_user, new_version=payload.new_version, reason=payload.reason
    )


# ============================================================================
# AC-11: Approvals Center (Dual Control)
# ============================================================================

@router.get("/approvals")
def list_pending_approvals(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_permission("perm.admin.approvals.manage")),
    db: Session = Depends(get_db),
):
    return ApprovalsService.list_pending_approvals(db=db, limit=limit, offset=offset)


@router.get("/approvals/{action_id}")
def get_approval_detail(
    action_id: int,
    current_user: User = Depends(require_permission("perm.admin.approvals.manage")),
    db: Session = Depends(get_db),
):
    return ApprovalsService.get_approval(db=db, action_id=action_id)


@router.post("/approvals/{action_id}/decide")
def decide_approval(
    action_id: int,
    payload: ApprovalDecisionInput,
    current_user: User = Depends(require_permission("perm.admin.approvals.manage")),
    db: Session = Depends(get_db),
):
    return ApprovalsService.decide_approval(
        db=db,
        actor=current_user,
        action_id=action_id,
        decision=payload.decision,
        notes=payload.notes,
    )


# ============================================================================
# AC-12: Needs Attention Unified Home & Audit Chain
# ============================================================================

@router.get("/needs-attention")
def get_needs_attention(
    current_user: User = Depends(require_permission("perm.admin.analytics")),
    db: Session = Depends(get_db),
):
    """
    Central Aggregator returning 8 worklist items with deep links.
    Zero dead-end counters.
    """
    return NeedsAttentionService.get_needs_attention_summary(db=db)


@router.get("/audit-chain/verify")
def verify_audit_chain(
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    """Cryptographic audit chain verification walking admin_actions from id 1."""
    return AuditService.verify_chain(db=db)


# ============================================================================
# AC-03: Clinical Governance
# ============================================================================

@router.get("/clinical/rules")
def get_clinical_rules(
    namespace: str = Query("geriatric_rules"),
    key: str = Query("rules"),
    version: Optional[int] = Query(None),
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    rules = ClinicalGovernanceService.get_rules(namespace, key, db, version)
    has_unreviewed = any(
        isinstance(r, dict) and (not r.get("reviewed_by")) for r in rules
    )
    banner = "UNREVIEWED RULESET" if has_unreviewed else None
    return {
        "namespace": namespace,
        "key": key,
        "version": version,
        "rules": rules,
        "banner": banner,
        "is_unreviewed": has_unreviewed,
    }


@router.post("/clinical/rules/draft", status_code=201)
def create_clinical_rule_draft(
    payload: RuleDraftInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    draft = ClinicalGovernanceService.create_rule_draft(
        namespace=payload.namespace,
        key=payload.key,
        payload=payload.payload,
        actor=current_user,
        db=db,
        note=payload.note,
    )
    return {
        "status": "draft_created",
        "id": draft.id,
        "namespace": draft.namespace,
        "key": draft.key,
        "version": draft.version,
        "checksum": draft.checksum,
    }


@router.post("/clinical/rules/import")
def import_clinical_rules(
    payload: RuleImportInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
):
    rules = ClinicalGovernanceService.import_rules(payload.content, payload.format)
    return {"status": "success", "format": payload.format, "total_rules": len(rules), "rules": rules}


@router.post("/clinical/rules/export")
def export_clinical_rules(
    payload: Dict[str, Any],
    format_type: str = Query("json"),
    current_user: User = Depends(require_permission("perm.clinical.governance")),
):
    rules = payload.get("rules", [])
    exported_content = ClinicalGovernanceService.export_rules(rules, format_type)
    return {"format": format_type, "content": exported_content}


@router.post("/clinical/rules/diff")
def diff_clinical_rules(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.clinical.governance")),
):
    v_a = payload.get("version_a", [])
    v_b = payload.get("version_b", [])
    return ClinicalGovernanceService.diff_versions(v_a, v_b)


@router.post("/clinical/rules/impact-preview")
def impact_preview_clinical_rules(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    draft_rules = payload.get("rules") or payload.get("payload") or []
    return ClinicalGovernanceService.run_impact_preview(draft_rules=draft_rules, db=db)


@router.post("/clinical/rules/publish")
def publish_clinical_rule(
    payload: RulePublishInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.publish_rule_draft(
        namespace=payload.namespace,
        key=payload.key,
        version=payload.version,
        validated_by=payload.validated_by,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.post("/clinical/rules/rollback")
def rollback_clinical_rule(
    payload: RuleRollbackInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.rollback_rule_version(
        namespace=payload.namespace,
        key=payload.key,
        target_version=payload.target_version,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/clinical/questionnaires")
def get_questionnaires(
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.get_questionnaires(db=db)


@router.post("/clinical/questionnaires")
def update_questionnaires(
    payload: QuestionnaireUpdateInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.save_questionnaires(
        payload=payload.payload,
        actor=current_user,
        db=db,
        dual_control_approved=payload.dual_control_approved,
    )


@router.get("/clinical/quality-parameters")
def get_quality_parameters(
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.get_quality_parameters(db=db)


@router.post("/clinical/quality-parameters/unlock")
def update_quality_parameters(
    payload: QualityParametersUpdateInput,
    current_user: User = Depends(require_permission("perm.clinical.governance")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.update_quality_parameters(
        payload=payload.payload,
        dual_control_approved=payload.dual_control_approved,
        regression_passed=payload.regression_passed,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


# ============================================================================
# AC-04: AI Control Center
# ============================================================================

@router.get("/ai/models")
def get_ai_models_selection(
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return ClinicalGovernanceService.get_rules(namespace="ai_config", key="provider_model_selection", db=db) or AIControlService.get_provider_model_selection(db=db)


@router.post("/ai/models")
def update_ai_models_selection(
    payload: AIProviderSelectionInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.update_provider_model_selection(
        payload=payload.payload,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/ai/prompts")
def list_ai_prompts(
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return {"prompts": AIControlService.list_prompts(db=db)}


@router.post("/ai/prompts/draft", status_code=201)
def create_ai_prompt_draft(
    payload: PromptDraftInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    draft = AIControlService.create_prompt_draft(
        prompt_key=payload.prompt_key,
        system_template=payload.system_template,
        user_template=payload.user_template,
        actor=current_user,
        db=db,
        note=payload.note,
    )
    return {"status": "created", "id": draft.id, "key": draft.key, "version": draft.version, "checksum": draft.checksum}


@router.post("/ai/prompts/sandbox-run")
def run_ai_prompt_sandbox(
    payload: PromptSandboxInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
):
    return AIControlService.run_prompt_sandbox(
        system_template=payload.system_template,
        user_template=payload.user_template,
        test_case_payload=payload.test_case_payload,
        is_live=payload.is_live,
    )


@router.post("/ai/prompts/publish")
def publish_ai_prompt(
    payload: PromptPublishInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.publish_prompt(
        prompt_key=payload.prompt_key,
        version=payload.version,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/ai/budgets")
def get_ai_budgets_and_quotas(
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.get_budgets_quotas(db=db)


@router.post("/ai/budgets")
def update_ai_budgets_and_quotas(
    payload: AIBudgetQuotaInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.update_budgets_quotas(
        payload=payload.payload,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/ai/usage")
def get_ai_usage_metrics(
    hours: int = Query(24, ge=1, le=720),
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.get_usage_metrics(db=db, hours=hours)


@router.get("/ai/usage/logs/{log_id}")
def get_scrubbed_ai_log(
    log_id: int,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.get_scrubbed_audit_log(log_id=log_id, db=db)


@router.get("/ai/status")
def get_ai_control_status(
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.get_ai_status(db=db)


@router.post("/ai/kill-switch")
def toggle_ai_kill_switch(
    payload: KillSwitchToggleInput,
    current_user: User = Depends(require_permission("perm.ai.manage")),
    db: Session = Depends(get_db),
):
    return AIControlService.toggle_global_ai_kill_switch(
        enabled=payload.enabled,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


# ============================================================================
# AC-07: Support Tools
# ============================================================================

@router.post("/support/impersonate")
def start_impersonation_session(
    payload: ImpersonateStartInput,
    current_user: User = Depends(require_permission("support.impersonate")),
    db: Session = Depends(get_db),
):
    return SupportToolsService.start_impersonation(
        admin=current_user,
        target_user_id=payload.target_user_id,
        reason=payload.reason,
        ticket_ref=payload.ticket_ref,
        duration_minutes=payload.duration_minutes,
        db=db,
    )


@router.post("/support/impersonate/{session_id}/stop")
def stop_impersonation_session(
    session_id: int,
    current_user: User = Depends(require_permission("support.impersonate")),
    db: Session = Depends(get_db),
):
    return SupportToolsService.stop_impersonation(
        session_id=session_id,
        admin=current_user,
        db=db,
    )


@router.post("/support/cases/{case_id}/break-glass")
def execute_break_glass(
    payload: BreakGlassInput,
    case: Case = Depends(get_case_for_user(write=True, include_deleted=True)),
    current_user: User = Depends(require_permission("phi.reveal")),
    db: Session = Depends(get_db),
):
    return SupportToolsService.execute_break_glass_reveal(
        admin=current_user,
        case_id=case.id,
        reason=payload.reason,
        duration_minutes=payload.duration_minutes,
        db=db,
    )


@router.get("/support/break-glass/list")
def list_break_glass_reveals(
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return {"reveals": SupportToolsService.list_break_glass_reveals(db=db)}


@router.get("/support/cases/{case_id}/access-history")
def get_support_access_history(
    case: Case = Depends(get_case_for_user(include_deleted=True)),
    current_user: User = Depends(require_permission("perm.cases.read")),
    db: Session = Depends(get_db),
):
    return {"history": SupportToolsService.get_patient_access_history(patient_id=case.patient_id, case_id=case.id, db=db)}


# ============================================================================
# AC-08: Content & Resources
# ============================================================================

@router.get("/content/i18n")
def get_i18n_content(
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.get_i18n_strings(db=db)


@router.post("/content/i18n")
def update_i18n_content(
    payload: I18nUpdateInput,
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.update_i18n_strings(
        payload=payload.payload,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/content/consent")
def get_consent_content(
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.get_consent_text(db=db)


@router.post("/content/consent/bump")
def bump_consent_content(
    payload: ConsentBumpInput,
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.bump_consent_version(
        new_version=payload.new_version,
        title=payload.title,
        text=payload.text,
        actor=current_user,
        db=db,
        reason=payload.reason,
    )


@router.get("/content/resources")
def list_emergency_resources(
    category: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return {"resources": ContentResourcesService.list_resources(db=db, category=category)}


@router.post("/content/resources", status_code=201)
def create_emergency_resource(
    payload: ResourceInput,
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    res = ContentResourcesService.create_or_update_resource(
        data=payload.model_dump(),
        actor=current_user,
        db=db,
    )
    return {"status": "created", "resource_id": res.id, "name": res.name}


@router.post("/content/resources/{resource_id}/verify")
def verify_emergency_resource(
    resource_id: int,
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    res = ContentResourcesService.verify_resource(resource_id=resource_id, actor=current_user, db=db)
    return {"status": "verified", "resource_id": res.id, "last_verified_at": res.last_verified_at.isoformat()}


@router.get("/content/ai-hub-cards")
def get_ai_hub_cards_copy(
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.get_ai_hub_copy(db=db)


@router.post("/content/ai-hub-cards")
def update_ai_hub_cards_copy(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.admin.content")),
    db: Session = Depends(get_db),
):
    return ContentResourcesService.update_ai_hub_copy(
        payload=payload,
        actor=current_user,
        db=db,
    )


# ============================================================================
# AC-09: Operations
# ============================================================================

@router.get("/operations/jobs")
def list_system_jobs(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return {"jobs": OperationsService.list_jobs(db=db)}


@router.post("/operations/jobs/run")
def trigger_system_job(
    job_name: str = Query(..., description="Job identifier"),
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.trigger_job_run(job_name=job_name, db=db)


@router.post("/operations/jobs/retry/{job_id}")
def retry_system_job(
    job_id: int,
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.retry_job(job_id=job_id, db=db)


@router.post("/operations/scheduler/pause")
def pause_scheduler(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.pause_scheduler(actor=current_user, db=db)


@router.post("/operations/scheduler/resume")
def resume_scheduler(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.resume_scheduler(actor=current_user, db=db)


@router.get("/operations/health")
def get_system_health(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.get_health_status(db=db)


@router.get("/operations/rag/sources")
def list_rag_corpus_sources(
    current_user: User = Depends(require_permission("perm.ops.manage")),
):
    return {"sources": OperationsService.list_rag_sources()}


@router.post("/operations/rag/sources/disable")
def disable_rag_corpus_source(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    source = payload.get("source_identifier") or payload.get("source_name")
    if not source:
        raise HTTPException(status_code=400, detail="source_identifier required")
    return OperationsService.disable_rag_source(
        source_identifier=source,
        actor=current_user,
        db=db,
        reason=payload.get("reason"),
    )


@router.post("/operations/rag/sources/enable")
def enable_rag_corpus_source(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    source = payload.get("source_identifier") or payload.get("source_name")
    if not source:
        raise HTTPException(status_code=400, detail="source_identifier required")
    return OperationsService.enable_rag_source(
        source_identifier=source,
        actor=current_user,
        db=db,
    )


@router.post("/operations/rag/reindex")
def trigger_rag_reindex(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.trigger_reindex(actor=current_user, db=db)


@router.get("/operations/rate-limits")
def get_rate_limits(
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.get_rate_limit_and_blocklist(db=db)


@router.post("/operations/rate-limits/block-ip")
def block_ip_address(
    payload: IPBlockInput,
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.add_ip_block(
        ip=payload.ip,
        reason=payload.reason,
        actor=current_user,
        db=db,
    )


@router.post("/operations/rate-limits/unblock-ip")
def unblock_ip_address(
    ip: str = Query(..., description="IP to unblock"),
    current_user: User = Depends(require_permission("perm.ops.manage")),
    db: Session = Depends(get_db),
):
    return OperationsService.remove_ip_block(ip=ip, actor=current_user, db=db)


@router.get("/operations/logs")
def view_system_logs(
    level: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_permission("perm.ops.manage")),
):
    return {"logs": OperationsService.get_phi_free_logs(level=level, service=service, limit=limit)}


@router.get("/operations/backup-status")
def get_backup_status(
    current_user: User = Depends(require_permission("perm.ops.manage")),
):
    return OperationsService.get_backup_status()


# ============================================================================
# AC-10: Audit & Compliance
# ============================================================================

@router.get("/audit/explorer")
def query_audit_explorer(
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    target_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return AuditComplianceService.query_audit_trail(
        db=db,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        limit=limit,
        offset=offset,
    )


@router.get("/audit/export")
def export_signed_audit_trail(
    format_type: str = Query("json", description="json or csv"),
    limit: int = Query(500, ge=1, le=5000),
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return AuditComplianceService.generate_signed_export(
        db=db,
        format_type=format_type,
        limit=limit,
    )


@router.post("/audit/export/verify")
def verify_audit_export_signature(
    payload: ExportVerificationInput,
    current_user: User = Depends(require_permission("perm.admin.audit")),
):
    return AuditComplianceService.verify_signed_export(payload.model_dump())


@router.get("/audit/reports/break-glass")
def get_break_glass_report(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return AuditComplianceService.get_break_glass_report(db=db, limit=limit)


@router.get("/audit/retention")
def get_retention_policies(
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return AuditComplianceService.get_retention_policies(db=db)


@router.post("/audit/retention")
def update_retention_policies(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return AuditComplianceService.update_retention_policies(
        payload=payload,
        actor=current_user,
        db=db,
    )


@router.get("/audit/incidents")
def list_security_incidents(
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    return {"incidents": AuditComplianceService.list_incidents(db=db)}


@router.post("/audit/incidents", status_code=201)
def record_security_incident(
    payload: IncidentRecordInput,
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    inc = AuditComplianceService.record_incident(
        title=payload.title,
        severity=payload.severity,
        description=payload.description,
        affected_accounts_count=payload.affected_accounts_count,
        actor=current_user,
        db=db,
        incident_code=payload.incident_code,
        remediation_notes=payload.remediation_notes,
    )
    return {"status": "created", "incident_id": inc.id, "incident_code": inc.incident_code}


@router.patch("/audit/incidents/{incident_id}")
def update_security_incident_status(
    incident_id: int,
    payload: IncidentStatusInput,
    current_user: User = Depends(require_permission("perm.admin.audit")),
    db: Session = Depends(get_db),
):
    inc = AuditComplianceService.update_incident_status(
        incident_id=incident_id,
        status=payload.status,
        remediation_notes=payload.remediation_notes,
        actor=current_user,
        db=db,
    )
    return {"status": "updated", "incident_id": inc.id, "current_status": inc.status}

