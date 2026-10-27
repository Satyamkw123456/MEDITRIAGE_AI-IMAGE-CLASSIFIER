from typing import Dict, Any, Optional
from datetime import timezone
from sqlalchemy.orm import Session
from app.models.admin_action import AdminAction, compute_admin_action_hash, get_utc_now


class AuditService:
    """Tamper-Evident SHA-256 Hash-Chained Audit Service (INV-06)."""

    @staticmethod
    def write_admin_action(
        actor_id: int,
        action_code: str,
        target_type: str,
        target_id: str,
        db: Session,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None,
        ticket_ref: Optional[str] = None,
        status: str = "APPLIED",
        approver_id: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        self_approved_demo: bool = False,
    ) -> AdminAction:
        """Appends a new cryptographic SHA-256 hash-chained admin action record."""
        # Get last entry in chain
        last_entry = db.query(AdminAction).order_by(AdminAction.id.desc()).first()
        prev_h = last_entry.entry_hash if last_entry and last_entry.entry_hash else ("0" * 64)

        now = get_utc_now()
        ts_str = now.isoformat()

        entry_h = compute_admin_action_hash(
            prev_hash=prev_h,
            actor_id=actor_id,
            action_code=action_code,
            target_type=target_type,
            target_id=str(target_id),
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            status=status,
            timestamp_str=ts_str,
        )

        record = AdminAction(
            actor_id=actor_id,
            action_code=action_code,
            target_type=target_type,
            target_id=str(target_id),
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            ticket_ref=ticket_ref,
            status=status,
            approver_id=approver_id,
            approved_at=now if approver_id else None,
            idempotency_key=idempotency_key,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent,
            prev_hash=prev_h,
            entry_hash=entry_h,
            self_approved_demo=self_approved_demo,
            created_at=now,
        )

        db.add(record)
        db.flush()
        return record

    @staticmethod
    def verify_chain(db: Session) -> Dict[str, Any]:
        """
        Walks the admin_actions table sequentially from id 1, recomputes hashes,
        and reports 'intact' or 'broken at record #N'.
        """
        records = db.query(AdminAction).order_by(AdminAction.id.asc()).all()
        if not records:
            return {"status": "intact", "total_records": 0, "message": "Chain is empty and intact."}

        expected_prev = "0" * 64
        for idx, rec in enumerate(records):
            # Verify prev_hash matches preceding entry_hash
            if idx > 0:
                expected_prev = records[idx - 1].entry_hash

            if rec.prev_hash != expected_prev and idx > 0:
                return {
                    "status": "broken",
                    "broken_record_id": rec.id,
                    "reason": "Previous hash mismatch",
                    "expected_prev_hash": expected_prev,
                    "actual_prev_hash": rec.prev_hash,
                }

            # Recompute entry hash using canonical UTC timestamp
            if rec.created_at:
                created_dt = rec.created_at.astimezone(timezone.utc) if rec.created_at.tzinfo else rec.created_at.replace(tzinfo=timezone.utc)
                ts_str = created_dt.isoformat()
            else:
                ts_str = ""
            calc_hash = compute_admin_action_hash(
                prev_hash=rec.prev_hash,
                actor_id=rec.actor_id,
                action_code=rec.action_code,
                target_type=rec.target_type,
                target_id=str(rec.target_id),
                before_state=rec.before_state,
                after_state=rec.after_state,
                reason=rec.reason,
                status=rec.status,
                timestamp_str=ts_str,
            )

            if rec.entry_hash != calc_hash:
                return {
                    "status": "broken",
                    "broken_record_id": rec.id,
                    "reason": "Payload digest mismatch (tampering detected)",
                    "expected_entry_hash": calc_hash,
                    "actual_entry_hash": rec.entry_hash,
                }

        return {
            "status": "intact",
            "total_records": len(records),
            "message": f"Chain verified intact across all {len(records)} admin action records.",
        }
