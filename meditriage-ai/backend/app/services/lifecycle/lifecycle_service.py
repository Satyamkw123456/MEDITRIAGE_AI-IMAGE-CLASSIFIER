from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.case import Case
from app.models.symptom import SymptomEntry
from app.models.vitals import Vitals
from app.models.triage import TriageResult
from app.models.case_revision import CaseRevision
from app.models.case_comment import CaseComment
from app.models.user import User
from app.db.repository import CaseRepository
from app.schemas.lifecycle import CaseAmendInput, ClinicianSummaryEditInput, TriageOverrideInput
from app.services.audit.audit_service import AuditService


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LifecycleService:
    @staticmethod
    def get_max_revision_no(db: Session, case_id: int) -> int:
        res = db.query(func.max(CaseRevision.revision_no)).filter(CaseRevision.case_id == case_id).scalar()
        return res if res is not None else 0

    @staticmethod
    def get_max_triage_version(db: Session, case_id: int) -> int:
        res = db.query(func.max(TriageResult.version)).filter(TriageResult.case_id == case_id).scalar()
        return res if res is not None else 0

    @classmethod
    def create_revision(
        cls,
        db: Session,
        case_id: int,
        actor: User,
        change_type: str,
        field_path: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None
    ) -> CaseRevision:
        next_rev = cls.get_max_revision_no(db, case_id) + 1
        rev = CaseRevision(
            case_id=case_id,
            revision_no=next_rev,
            actor_id=actor.id,
            actor_role=actor.role,
            change_type=change_type,
            field_path=field_path,
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            created_at=get_utc_now()
        )
        db.add(rev)
        db.flush()
        return rev

    @classmethod
    def amend_case(cls, db: Session, case_id: int, user: User, data: CaseAmendInput) -> Tuple[Case, int]:
        repo = CaseRepository(db)
        case = repo.get_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found or soft-deleted.")

        if user.role == "caregiver":
            from app.services.patient.caregiver_service import CaregiverService
            CaregiverService.check_amend_permission(db, caregiver_id=user.id, patient_id=case.patient_id)

        current_rev = cls.get_max_revision_no(db, case_id)
        if data.expected_revision_no is not None and data.expected_revision_no != current_rev:
            raise KeyError(f"CONCURRENCY_CONFLICT: Expected revision {data.expected_revision_no} but current revision is {current_rev}")

        latest_vitals = case.vitals[0] if (case.vitals and isinstance(case.vitals, list)) else case.vitals
        before_state = {
            "chief_complaint": case.chief_complaint,
            "is_emergency_flag": case.is_emergency_flag,
            "emergency_rule_fired": case.emergency_rule_fired,
            "symptoms": [{"symptom": s.symptom, "severity": s.severity, "duration": s.duration, "location": s.body_location} for s in case.symptoms],
            "vitals": {"temp": latest_vitals.temperature, "pulse": latest_vitals.pulse, "bp": latest_vitals.blood_pressure, "spo2": latest_vitals.spo2} if latest_vitals else None
        }

        # Check red-flag retraction
        had_red_flag = case.is_emergency_flag or (case.emergency_rule_fired is not None and "RED_FLAG" in str(case.emergency_rule_fired))

        # Update Chief Complaint
        if data.chief_complaint:
            case.chief_complaint = data.chief_complaint

        # Update Symptoms
        if data.symptoms is not None:
            db.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).delete()
            for sym in data.symptoms:
                db.add(SymptomEntry(
                    case_id=case_id,
                    symptom=sym.symptom,
                    duration=sym.duration,
                    severity=sym.severity,
                    body_location=sym.body_location
                ))

        # Update Vitals
        if data.vitals is not None:
            db.query(Vitals).filter(Vitals.case_id == case_id).delete()
            db.add(Vitals(
                case_id=case_id,
                temperature=data.vitals.temperature,
                pulse=data.vitals.pulse,
                blood_pressure=data.vitals.blood_pressure,
                spo2=data.vitals.spo2
            ))

        db.flush()
        db.refresh(case)

        from app.services.rules.consensus_engine import ConsensusDecisionEngine

        primary_sym = case.symptoms[0] if case.symptoms else None
        curr_vitals = case.vitals[0] if (case.vitals and isinstance(case.vitals, list)) else case.vitals
        patient_age = case.patient.age if case.patient else 65

        vitals_dict = {
            "temperature": curr_vitals.temperature if curr_vitals else None,
            "pulse": curr_vitals.pulse if curr_vitals else None,
            "blood_pressure": curr_vitals.blood_pressure if curr_vitals else None,
            "spo2": curr_vitals.spo2 if curr_vitals else None,
        } if curr_vitals else None

        symptoms_payload = [
            {"symptom": s.symptom, "severity": s.severity, "duration": s.duration, "body_location": s.body_location}
            for s in case.symptoms
        ]

        consensus_res = ConsensusDecisionEngine.evaluate_case(
            chief_complaint=case.chief_complaint,
            age=patient_age,
            severity=primary_sym.severity if primary_sym else 5,
            symptom_duration=primary_sym.duration if primary_sym and primary_sym.duration else "1 day",
            body_location=primary_sym.body_location if primary_sym and primary_sym.body_location else "General",
            comorbidities=case.patient.medical_history if case.patient else None,
            vitals=vitals_dict,
            symptoms=symptoms_payload,
            db=db,
        )

        if consensus_res.is_emergency:
            case.is_emergency_flag = True
            case.emergency_rule_fired = consensus_res.emergency_rule_fired
        else:
            if had_red_flag:
                case.red_flag_retracted = True
            case.is_emergency_flag = False
            case.emergency_rule_fired = None

        # Re-trigger Triage Scoring & Atomic Triage Supersede
        db.query(TriageResult).filter(TriageResult.case_id == case_id).update({"is_current": "false"}, synchronize_session=False)
        prev_triage_version = cls.get_max_triage_version(db, case_id)
        next_triage_version = prev_triage_version + 1

        triage_rec = TriageResult(
            case_id=case_id,
            triage_level=consensus_res.final_level,
            risk_score=consensus_res.risk_score,
            explanation=consensus_res.explanation,
            decision_trace=consensus_res.decision_trace,
            version=next_triage_version,
            is_current="true",
            source="ENGINE"
        )
        db.add(triage_rec)

        after_vitals = case.vitals[0] if (case.vitals and isinstance(case.vitals, list)) else case.vitals
        after_state = {
            "chief_complaint": case.chief_complaint,
            "is_emergency_flag": case.is_emergency_flag,
            "emergency_rule_fired": case.emergency_rule_fired,
            "red_flag_retracted": case.red_flag_retracted,
            "symptoms": [{"symptom": s.symptom, "severity": s.severity, "duration": s.duration, "location": s.body_location} for s in case.symptoms],
            "vitals": {"temp": after_vitals.temperature, "pulse": after_vitals.pulse, "bp": after_vitals.blood_pressure, "spo2": after_vitals.spo2} if after_vitals else None
        }

        change_type = "PATIENT_AMEND" if user.role in ("patient", "caregiver") else "CLINICIAN_AMEND"
        rev = cls.create_revision(
            db, case_id, user, change_type,
            field_path="intake", before_state=before_state, after_state=after_state, reason=data.reason
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="CASE_AMEND",
            target_type="case",
            target_id=str(case_id),
            db=db,
            before_state=before_state,
            after_state=after_state,
            reason=data.reason
        )

        db.commit()
        db.refresh(case)
        return case, rev.revision_no

    @classmethod
    def add_comment(cls, db: Session, case_id: int, user: User, comment_text: str) -> CaseComment:
        repo = CaseRepository(db)
        case = repo.get_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found or soft-deleted.")

        comment = CaseComment(
            case_id=case_id,
            user_id=user.id,
            author_role=user.role,
            comment_text=comment_text.strip(),
            created_at=get_utc_now()
        )
        db.add(comment)
        db.flush()

        cls.create_revision(
            db, case_id, user, "COMMENT_ADDED",
            field_path="comments", after_state={"comment": comment_text.strip()}
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="CASE_COMMENT",
            target_type="case",
            target_id=str(case_id),
            db=db,
            after_state={"comment_id": comment.id}
        )

        db.commit()
        db.refresh(comment)
        return comment

    @classmethod
    def override_summary(cls, db: Session, case_id: int, user: User, data: ClinicianSummaryEditInput) -> TriageResult:
        repo = CaseRepository(db)
        case = repo.get_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found or soft-deleted.")

        curr_triage = db.query(TriageResult).filter(TriageResult.case_id == case_id, TriageResult.is_current == "true").first()
        prev_level = curr_triage.triage_level if curr_triage else ("Emergency" if case.is_emergency_flag else "Routine")
        prev_score = curr_triage.risk_score if curr_triage else 50.0

        db.query(TriageResult).filter(TriageResult.case_id == case_id).update({"is_current": "false"}, synchronize_session=False)
        next_ver = cls.get_max_triage_version(db, case_id) + 1

        new_triage = TriageResult(
            case_id=case_id,
            triage_level=prev_level,
            risk_score=prev_score,
            explanation=data.summary_text.strip(),
            version=next_ver,
            is_current="true",
            source="CLINICIAN_OVERRIDE"
        )
        db.add(new_triage)
        db.flush()

        cls.create_revision(
            db, case_id, user, "CLINICIAN_SUMMARY_EDIT",
            field_path="summary", after_state={"summary": data.summary_text.strip()}, reason=data.reason
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="SUMMARY_OVERRIDE",
            target_type="case",
            target_id=str(case_id),
            db=db,
            after_state={"triage_version": next_ver, "summary_text": data.summary_text.strip()},
            reason=data.reason
        )

        db.commit()
        db.refresh(new_triage)
        return new_triage

    @classmethod
    def override_triage(cls, db: Session, case_id: int, user: User, data: TriageOverrideInput) -> TriageResult:
        repo = CaseRepository(db)
        case = repo.get_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found or soft-deleted.")

        if not data.reason or len(data.reason.strip()) < 10:
            raise ValueError("Override reason is required and must be at least 10 characters long.")

        curr_triage = db.query(TriageResult).filter(TriageResult.case_id == case_id, TriageResult.is_current == "true").first()
        is_curr_emergency = case.is_emergency_flag or (curr_triage and curr_triage.triage_level == "Emergency")

        target_level = data.new_triage_level.strip()
        is_target_emergency = (target_level == "Emergency")

        # Emergency Downgrade check
        if is_curr_emergency and not is_target_emergency:
            if not data.confirm_emergency_downgrade or len(data.reason.strip()) < 20:
                raise ValueError("Lowering an Emergency triage level requires explicit confirm_emergency_downgrade=True and a detailed clinical reason of at least 20 characters.")

        # Update Case emergency flag
        case.is_emergency_flag = is_target_emergency
        if not is_target_emergency:
            case.emergency_rule_fired = None

        db.query(TriageResult).filter(TriageResult.case_id == case_id).update({"is_current": "false"}, synchronize_session=False)
        next_ver = cls.get_max_triage_version(db, case_id) + 1

        new_triage = TriageResult(
            case_id=case_id,
            triage_level=target_level,
            risk_score=99.0 if is_target_emergency else 50.0,
            explanation=f"Clinician Override: {data.reason.strip()}",
            version=next_ver,
            is_current="true",
            source="CLINICIAN_OVERRIDE",
            supersedes_id=curr_triage.id if curr_triage else None
        )
        db.add(new_triage)
        db.flush()

        cls.create_revision(
            db, case_id, user, "TRIAGE_OVERRIDE",
            field_path="triage_level",
            before_state={"triage_level": curr_triage.triage_level if curr_triage else "Emergency"},
            after_state={"triage_level": target_level},
            reason=data.reason.strip()
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="TRIAGE_OVERRIDE",
            target_type="case",
            target_id=str(case_id),
            db=db,
            before_state={"triage_level": curr_triage.triage_level if curr_triage else "Emergency"},
            after_state={"triage_level": target_level},
            reason=data.reason.strip()
        )

        db.commit()
        db.refresh(new_triage)
        return new_triage

    @classmethod
    def soft_delete_case(cls, db: Session, case_id: int, user: User) -> Case:
        repo = CaseRepository(db)
        case = repo.get_case(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found or already soft-deleted.")

        now = get_utc_now()
        case.deleted_at = now
        case.deleted_by = user.id
        case.purge_after = now + timedelta(days=30)

        cls.create_revision(
            db, case_id, user, "SOFT_DELETED",
            field_path="deleted_at",
            after_state={"deleted_at": now.isoformat(), "purge_after": case.purge_after.isoformat()}
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="CASE_SOFT_DELETE",
            target_type="case",
            target_id=str(case_id),
            db=db,
            after_state={"deleted_at": now.isoformat(), "purge_after": case.purge_after.isoformat()}
        )

        db.commit()
        db.refresh(case)
        return case

    @classmethod
    def restore_case(cls, db: Session, case_id: int, user: User) -> Case:
        repo = CaseRepository(db)
        case = repo.get_case(case_id, include_deleted=True)
        if not case:
            raise ValueError(f"Case {case_id} not found.")
        if case.deleted_at is None:
            raise ValueError(f"Case {case_id} is not deleted.")

        case.deleted_at = None
        case.deleted_by = None
        case.purge_after = None

        cls.create_revision(
            db, case_id, user, "RESTORED",
            field_path="deleted_at",
            after_state={"restored_at": get_utc_now().isoformat()}
        )

        AuditService.write_admin_action(
            actor_id=user.id,
            action_code="CASE_RESTORE",
            target_type="case",
            target_id=str(case_id),
            db=db,
            after_state={"restored_at": get_utc_now().isoformat()}
        )

        db.commit()
        db.refresh(case)
        return case

    @classmethod
    def purge_expired_cases(cls, db: Session, user: User) -> int:
        now = get_utc_now()
        expired_cases = db.query(Case).filter(Case.deleted_at.isnot(None), Case.purge_after <= now).all()
        purged_count = 0

        for case in expired_cases:
            case_id = case.id
            # 1. Hard-delete PHI sub-rows (symptoms, vitals)
            db.query(SymptomEntry).filter(SymptomEntry.case_id == case_id).delete()
            db.query(Vitals).filter(Vitals.case_id == case_id).delete()

            # 2. Overwrite PHI columns on Case
            case.chief_complaint = "[PURGED_PHI]"
            case.emergency_rule_fired = None

            # 3. Write audit log entry (Audit trail metadata survives!)
            AuditService.write_admin_action(
                actor_id=user.id,
                action_code="CASE_PURGED_PHI",
                target_type="case",
                target_id=str(case_id),
                db=db,
                after_state={"purged_at": now.isoformat(), "case_id": case_id}
            )
            purged_count += 1

        db.commit()
        return purged_count

        db.commit()
        return purged_count

    @classmethod
    def get_revisions_with_diffs(cls, db: Session, case_id: int) -> List[Dict[str, Any]]:
        revs = db.query(CaseRevision).filter(CaseRevision.case_id == case_id).order_by(CaseRevision.revision_no.asc()).all()
        result = []

        for rev in revs:
            diffs = []
            if rev.before_state and rev.after_state:
                for k in rev.after_state:
                    old_v = rev.before_state.get(k)
                    new_v = rev.after_state.get(k)
                    if old_v != new_v:
                        diffs.append({
                            "field": k,
                            "old_value": old_v,
                            "new_value": new_v,
                            "description": f"{k}: {old_v} -> {new_v}"
                        })
            result.append({
                "id": rev.id,
                "case_id": rev.case_id,
                "revision_no": rev.revision_no,
                "actor_id": rev.actor_id,
                "actor_role": rev.actor_role,
                "change_type": rev.change_type,
                "field_path": rev.field_path,
                "reason": rev.reason,
                "diffs": diffs,
                "created_at": rev.created_at
            })
        return result
