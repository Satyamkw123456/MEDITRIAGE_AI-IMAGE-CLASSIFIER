import csv
import hmac
import hashlib
import io
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.core.utils import get_utc_now
from app.models.admin_action import AdminAction
from app.models.support_ops import BreakGlassReveal, SecurityIncident
from app.models.config_version import ConfigVersion
from app.models.user import User
from app.services.audit.audit_service import AuditService
from app.services.config.config_service import ConfigService


DEFAULT_RETENTION_POLICIES: Dict[str, Any] = {
    "active_cases_retention_years": 7,
    "soft_deleted_retention_days": 90,
    "audit_logs_retention_years": 10,
    "chat_sessions_retention_days": 30,
    "impersonation_session_max_minutes": 15,
    "break_glass_max_minutes": 10,
    "last_reviewed_at": "2026-09-28T00:00:00Z"
}


class AuditComplianceService:
    """
    AC-10: Audit & Compliance Service.
    Unified audit explorer with cryptographic chain verification,
    HMAC-signed export with tamper detection, admin/break-glass reports,
    data retention governance, and security incident breach management.
    """

    # ------------------------------------------------------------------------
    # Audit Explorer & Chain Verification
    # ------------------------------------------------------------------------

    @classmethod
    def query_audit_trail(
        cls,
        db: Session,
        actor_id: Optional[int] = None,
        action: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Queries unified cryptographic administrative action trail."""
        query = db.query(AdminAction)
        if actor_id:
            query = query.filter(AdminAction.actor_id == actor_id)
        if action:
            query = query.filter(AdminAction.action_code == action)
        if target_type:
            query = query.filter(AdminAction.target_type == target_type)
        if target_id is not None:
            query = query.filter(AdminAction.target_id == target_id)
        if date_from:
            query = query.filter(AdminAction.created_at >= date_from)
        if date_to:
            query = query.filter(AdminAction.created_at <= date_to)

        total = query.count()
        records = query.order_by(AdminAction.id.desc()).offset(offset).limit(limit).all()

        chain_verification = AuditService.verify_chain(db)

        items = []
        for r in records:
            items.append({
                "id": r.id,
                "actor_id": r.actor_id,
                "action": r.action_code,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "reason": r.reason,
                "changes_summary": (r.after_state or {}).get("summary", ""),
                "prev_hash": r.prev_hash,
                "entry_hash": r.entry_hash,
                "payload": r.after_state,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return {
            "total": total,
            "chain_status": chain_verification.get("status", "intact"),
            "chain_verified_records": chain_verification.get("total_records", 0),
            "records": items,
        }

    # ------------------------------------------------------------------------
    # Signed Export & Cryptographic Tamper Detection
    # ------------------------------------------------------------------------

    @classmethod
    def generate_signed_export(
        cls,
        db: Session,
        format_type: str = "json",
        limit: int = 500,
    ) -> Dict[str, Any]:
        """
        Exports audit trail into JSON or CSV signed with HMAC-SHA256 signature
        to detect post-export tampering.
        """
        actions = db.query(AdminAction).order_by(AdminAction.id.asc()).limit(limit).all()
        records_data = []
        for a in actions:
            records_data.append({
                "id": a.id,
                "actor_id": a.actor_id,
                "action": a.action_code,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "reason": a.reason,
                "changes_summary": (a.after_state or {}).get("summary", ""),
                "prev_hash": a.prev_hash,
                "entry_hash": a.entry_hash,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        exported_at = get_utc_now().isoformat()
        canonical_content = json.dumps(records_data, sort_keys=True, separators=(",", ":"))
        signature = hmac.new(
            settings.AUDIT_HMAC_KEY.encode("utf-8"),
            canonical_content.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if format_type.lower() == "csv":
            csv_output = io.StringIO()
            fieldnames = ["id", "actor_id", "action", "target_type", "target_id", "reason", "changes_summary", "prev_hash", "entry_hash", "created_at"]
            writer = csv.DictWriter(csv_output, fieldnames=fieldnames)
            writer.writeheader()
            for row in records_data:
                writer.writerow(row)
            csv_text = csv_output.getvalue()
            # Include signature header in CSV export
            signed_csv = f"# HMAC-SHA256: {signature}\n# Exported-At: {exported_at}\n" + csv_text
            return {
                "format": "csv",
                "signature": signature,
                "exported_at": exported_at,
                "total_records": len(records_data),
                "content": signed_csv,
            }

        return {
            "format": "json",
            "signature": signature,
            "exported_at": exported_at,
            "total_records": len(records_data),
            "data": records_data,
        }

    @classmethod
    def verify_signed_export(cls, export_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verifies the cryptographic HMAC signature of an exported audit file.
        Returns is_valid=False if any character was modified after export.
        """
        signature = export_payload.get("signature")
        if not signature:
            return {"is_valid": False, "reason": "Missing cryptographic signature"}

        records_data = export_payload.get("data")
        if records_data is None:
            # Check if CSV string content
            content = export_payload.get("content", "")
            # Extract header lines
            lines = content.splitlines()
            csv_lines = [l for l in lines if not l.startswith("#")]
            csv_body = "\n".join(csv_lines)
            reader = csv.DictReader(io.StringIO(csv_body))
            parsed = []
            for r in reader:
                r["id"] = int(r["id"]) if r["id"] else None
                r["actor_id"] = int(r["actor_id"]) if r["actor_id"] else None
                r["target_id"] = int(r["target_id"]) if r.get("target_id") else None
                parsed.append(r)
            records_data = parsed

        canonical_content = json.dumps(records_data, sort_keys=True, separators=(",", ":"))
        expected_sig = hmac.new(
            settings.AUDIT_HMAC_KEY.encode("utf-8"),
            canonical_content.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        is_valid = hmac.compare_digest(signature, expected_sig)
        return {
            "is_valid": is_valid,
            "signature": signature,
            "expected_signature": expected_sig,
            "tampered": not is_valid,
            "record_count": len(records_data),
        }

    # ------------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------------

    @classmethod
    def get_break_glass_report(cls, db: Session, limit: int = 100) -> Dict[str, Any]:
        """Generates formal break-glass PHI disclosure compliance report."""
        reveals = db.query(BreakGlassReveal).order_by(BreakGlassReveal.id.desc()).limit(limit).all()
        now = get_utc_now()
        out = []
        for r in reveals:
            exp = r.expires_at.replace(tzinfo=timezone.utc) if r.expires_at and r.expires_at.tzinfo is None else r.expires_at
            out.append({
                "reveal_id": r.id,
                "user_id": r.user_id,
                "case_id": r.case_id,
                "reason": r.reason,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                "is_expired": (exp <= now) if exp else True,
            })
        return {
            "generated_at": now.isoformat(),
            "total_reveals": len(out),
            "reveals": out,
        }

    # ------------------------------------------------------------------------
    # Retention Policies
    # ------------------------------------------------------------------------

    @classmethod
    def get_retention_policies(cls, db: Session) -> Dict[str, Any]:
        """Retrieves active statutory retention rules."""
        data = ConfigService.get_published(namespace="retention", key="policies", db=db)
        if not data:
            data = DEFAULT_RETENTION_POLICIES
        return data

    @classmethod
    def update_retention_policies(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Publishes updated data retention policies."""
        return ConfigService.publish_config(
            namespace="retention",
            key="policies",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Updated retention policies: {reason or 'Administrative update'}"
        )

    # ------------------------------------------------------------------------
    # Security Incident (Breach Record) Manager
    # ------------------------------------------------------------------------

    @classmethod
    def list_incidents(cls, db: Session) -> List[Dict[str, Any]]:
        """Lists recorded security and data breach incidents."""
        incidents = db.query(SecurityIncident).order_by(SecurityIncident.id.desc()).all()
        return [
            {
                "id": inc.id,
                "incident_code": inc.incident_code,
                "title": inc.title,
                "severity": inc.severity,
                "description": inc.description,
                "affected_accounts_count": inc.affected_accounts_count,
                "reported_by": inc.reported_by,
                "status": inc.status,
                "remediation_notes": inc.remediation_notes,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
                "updated_at": inc.updated_at.isoformat() if inc.updated_at else None,
            }
            for inc in incidents
        ]

    @classmethod
    def record_incident(
        cls,
        title: str,
        severity: str,
        description: str,
        affected_accounts_count: int,
        actor: User,
        db: Session,
        incident_code: Optional[str] = None,
        remediation_notes: Optional[str] = None,
    ) -> SecurityIncident:
        """Records a new security breach incident pursuant to DPDP Act incident logging."""
        code = incident_code or f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{hashlib.md5(title.encode()).hexdigest()[:6].upper()}"
        now = get_utc_now()
        inc = SecurityIncident(
            incident_code=code,
            title=title,
            severity=severity.upper(),
            description=description,
            affected_accounts_count=affected_accounts_count,
            reported_by=actor.id,
            status="OPEN",
            remediation_notes=remediation_notes,
            created_at=now,
            updated_at=now,
        )
        db.add(inc)
        db.commit()
        db.refresh(inc)

        AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="SECURITY_INCIDENT_RECORDED",
            target_type="security_incident",
            target_id=str(inc.id),
            reason=f"Recorded security incident {code}",
            after_state={"incident_code": code, "severity": severity, "affected": affected_accounts_count, "summary": f"Incident {code}: {title} (Severity: {severity})"},
            db=db,
        )
        return inc

    @classmethod
    def update_incident_status(
        cls,
        incident_id: int,
        status: str,
        remediation_notes: str,
        actor: User,
        db: Session,
    ) -> SecurityIncident:
        """Updates status of a security incident."""
        inc = db.query(SecurityIncident).filter(SecurityIncident.id == incident_id).first()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        inc.status = status.upper()
        inc.remediation_notes = remediation_notes
        inc.updated_at = get_utc_now()
        db.commit()
        db.refresh(inc)

        AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="SECURITY_INCIDENT_UPDATE",
            target_type="security_incident",
            target_id=str(inc.id),
            reason=f"Status changed to {status.upper()}",
            after_state={"status": status.upper(), "summary": f"Updated incident {inc.incident_code} to {status.upper()}"},
            db=db,
        )
        return inc
