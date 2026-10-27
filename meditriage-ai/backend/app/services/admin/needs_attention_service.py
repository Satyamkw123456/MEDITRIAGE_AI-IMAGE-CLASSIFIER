from typing import Dict, Any, List
from datetime import timedelta
from sqlalchemy.orm import Session

from app.core.utils import get_utc_now
from app.models.user import User
from app.models.case import Case
from app.models.triage import TriageResult
from app.models.admin_action import AdminAction
from app.models.domain_substrate import DataRightsRequest, JobRun, EmergencyCard
from app.models.support_ops import EmergencyResource
from app.services.audit.audit_service import AuditService


class NeedsAttentionService:
    """
    AC-12 "Needs Attention" Central Aggregator.
    Aggregates operational risk across 8 mission-critical categories.
    Every metric links directly to a filtered worklist or governed action; zero dead-end counters.
    """

    @classmethod
    def get_needs_attention_summary(cls, db: Session) -> Dict[str, Any]:
        now = get_utc_now()

        # 1. Unacknowledged red-flag emergencies
        unack_red_flags_count = (
            db.query(Case)
            .filter(
                Case.is_emergency_flag == True,
                Case.acknowledged_at.is_(None),
                Case.deleted_at.is_(None)
            )
            .count()
        )

        # 2. Pending dual-control approvals
        pending_approvals_count = (
            db.query(AdminAction)
            .filter(
                AdminAction.status == "PENDING_APPROVAL",
                AdminAction.approver_id.is_(None)
            )
            .count()
        )

        # 3. Data rights requests nearing SLA expiration (within 24 hours or overdue)
        sla_threshold = now + timedelta(hours=24)
        data_rights_near_sla_count = (
            db.query(DataRightsRequest)
            .filter(
                DataRightsRequest.status.in_(["PENDING", "IN_PROGRESS"]),
                DataRightsRequest.due_date <= sla_threshold
            )
            .count()
        )

        # 4. Failing job runs
        failing_jobs_count = (
            db.query(JobRun)
            .filter(JobRun.status == "FAILED")
            .count()
        )

        # 5. Stale emergency numbers / directory resources (> 90 days)
        stale_threshold = now - timedelta(days=90)
        stale_resources_count = (
            db.query(EmergencyResource)
            .filter(
                EmergencyResource.is_active == True,
                (EmergencyResource.last_verified_at == None) | (EmergencyResource.last_verified_at < stale_threshold)
            )
            .count()
        )
        patient_ids_with_card = {
            c[0] for c in db.query(EmergencyCard.user_id).filter(EmergencyCard.payload.isnot(None)).all()
        }
        active_patient_ids = {
            u[0] for u in db.query(User.id).filter(User.role == "patient", User.is_suspended == False).all()
        }
        missing_card_count = len(active_patient_ids - patient_ids_with_card)
        stale_emergency_count = stale_resources_count if stale_resources_count > 0 else missing_card_count

        # 6. AI error / fallback-rate spikes
        # Detect fallback triage results or recent error indicators
        ai_fallback_count = (
            db.query(TriageResult)
            .filter(
                TriageResult.is_current.in_(["true", "True"]),
                TriageResult.source.in_(["DETERMINISTIC_FALLBACK", "FALLBACK_RULE", "RULE_FALLBACK"])
            )
            .count()
        )

        # 7. Audit chain verification status
        chain_verification = AuditService.verify_chain(db)
        is_chain_broken = chain_verification.get("status") == "broken"
        chain_issue_count = 1 if is_chain_broken else 0

        # 8. Unverified clinician applications
        unverified_clinicians_count = (
            db.query(User)
            .filter(
                User.role == "clinician",
                User.clinician_verification_status.in_(["pending", "unverified"])
            )
            .count()
        )

        categories: List[Dict[str, Any]] = [
            {
                "category": "unacknowledged_red_flags",
                "title": "Unacknowledged Red Flags",
                "count": unack_red_flags_count,
                "severity": "critical" if unack_red_flags_count > 0 else "info",
                "action_url": "/admin/cases?is_emergency=true&acknowledged=false",
                "summary": f"{unack_red_flags_count} emergent case(s) requiring immediate clinical acknowledgment.",
                "metadata": {"urgent": unack_red_flags_count > 0},
            },
            {
                "category": "pending_approvals",
                "title": "Pending Dual-Control Approvals",
                "count": pending_approvals_count,
                "severity": "high" if pending_approvals_count > 0 else "info",
                "action_url": "/admin/approvals",
                "summary": f"{pending_approvals_count} dual-control admin action(s) awaiting second-party review.",
                "metadata": {"requires_dual_control": True},
            },
            {
                "category": "data_rights_near_sla",
                "title": "DPDP Data Rights Near SLA",
                "count": data_rights_near_sla_count,
                "severity": "high" if data_rights_near_sla_count > 0 else "info",
                "action_url": "/admin/dpdp?near_sla=true",
                "summary": f"{data_rights_near_sla_count} DPDP request(s) nearing or past 72-hour statutory deadline.",
                "metadata": {"sla_window_hours": 24},
            },
            {
                "category": "failing_jobs",
                "title": "Failing System Jobs",
                "count": failing_jobs_count,
                "severity": "medium" if failing_jobs_count > 0 else "info",
                "action_url": "/admin/jobs?status=failed",
                "summary": f"{failing_jobs_count} background job(s) in failed state.",
                "metadata": {},
            },
            {
                "category": "stale_emergency_numbers",
                "title": "Missing / Stale Emergency Contacts",
                "count": stale_emergency_count,
                "severity": "medium" if stale_emergency_count > 0 else "info",
                "action_url": "/admin/users?filter=stale_emergency",
                "summary": f"{stale_emergency_count} patient(s) without registered emergency contact numbers.",
                "metadata": {},
            },
            {
                "category": "ai_fallback_rate_spikes",
                "title": "AI Gateway Fallbacks & Spikes",
                "count": ai_fallback_count,
                "severity": "high" if ai_fallback_count > 5 else "info",
                "action_url": "/admin/analytics/ai-gateway",
                "summary": f"{ai_fallback_count} case(s) evaluated via deterministic fallback.",
                "metadata": {"fallback_count": ai_fallback_count},
            },
            {
                "category": "audit_chain_status",
                "title": "Cryptographic Audit Chain Integrity",
                "count": chain_issue_count,
                "severity": "critical" if is_chain_broken else "info",
                "action_url": "/admin/audit/chain",
                "summary": chain_verification.get("message", "Audit chain verified intact."),
                "metadata": {
                    "chain_status": chain_verification.get("status", "intact"),
                    "total_records": chain_verification.get("total_records", 0),
                    "broken_record_id": chain_verification.get("broken_record_id"),
                },
            },
            {
                "category": "unverified_clinicians",
                "title": "Unverified Clinician Registrations",
                "count": unverified_clinicians_count,
                "severity": "medium" if unverified_clinicians_count > 0 else "info",
                "action_url": "/admin/users/clinicians?status=pending",
                "summary": f"{unverified_clinicians_count} clinician account(s) pending medical license verification.",
                "metadata": {"provably_inactive": True},
            },
        ]

        total_urgent = sum(
            c["count"] for c in categories if c["severity"] in ("critical", "high")
        )

        return {
            "timestamp": now.isoformat(),
            "total_categories": len(categories),
            "total_urgent_items": total_urgent,
            "categories": categories,
        }
