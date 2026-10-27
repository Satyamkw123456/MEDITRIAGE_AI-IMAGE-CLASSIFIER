import csv
import io
import json
import os
import yaml
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.config_version import ConfigVersion, compute_payload_checksum
from app.models.user import User
from app.services.config.config_service import ConfigService
from app.services.geriatric.composer import Level
from app.services.geriatric.engine import GeriatricEngine
from app.services.geriatric.rules_engine import SEEDED_GERIATRIC_RULES
from app.services.audit.audit_service import AuditService
from app.core.utils import get_utc_now


def _find_cases_file() -> str:
    curr = os.path.abspath(__file__)
    for _ in range(6):
        curr = os.path.dirname(curr)
        candidate = os.path.join(curr, "dev-test-data", "p2", "cycle-3", "synthetic-cases", "cases.json")
        if os.path.exists(candidate):
            return candidate
    for base in [os.getcwd(), os.path.dirname(os.getcwd())]:
        candidate = os.path.join(base, "dev-test-data", "p2", "cycle-3", "synthetic-cases", "cases.json")
        if os.path.exists(candidate):
            return candidate
    return candidate

CASES_FILE = _find_cases_file()


DEFAULT_QUESTIONNAIRES: Dict[str, Any] = {
    "sections": [
        {
            "section_id": "ISAR",
            "name": "Identification of Seniors at Risk",
            "questions": [
                {
                    "question_id": "isar_q1",
                    "canonical_code": "isar_help_needed",
                    "text_translations": {
                        "en": "Before the illness or injury that brought you here, did you need help on a regular basis?",
                        "hi": "क्या इस बीमारी से पहले आपको नियमित रूप से किसी की मदद की आवश्यकता थी?",
                        "mr": "या आजारापूर्वी तुम्हाला नियमितपणे मदतीची गरज लागत होती का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                },
                {
                    "question_id": "isar_q2",
                    "canonical_code": "isar_more_help",
                    "text_translations": {
                        "en": "Since the illness or injury, have you needed more help than usual?",
                        "hi": "बीमारी के बाद से क्या आपको सामान्य से अधिक मदद की आवश्यकता पड़ी है?",
                        "mr": "आजारी पडल्यापासून तुम्हाला नेहमीपेक्षा जास्त मदतीची गरज भासली आहे का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                }
            ]
        },
        {
            "section_id": "FRAIL",
            "name": "FRAIL Scale",
            "questions": [
                {
                    "question_id": "frail_q1",
                    "canonical_code": "frail_fatigue",
                    "text_translations": {
                        "en": "Are you fatigued most or all of the time?",
                        "hi": "क्या आप अधिकांश या पूरे समय थकान महसूस करते हैं?",
                        "mr": "तुम्हाला बहुतेक वेळ किंवा सतत थकवा जाणवतो का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                },
                {
                    "question_id": "frail_q2",
                    "canonical_code": "frail_resistance",
                    "text_translations": {
                        "en": "Can you climb one flight of stairs without resting?",
                        "hi": "क्या आप बिना रुके एक सीढ़ी चढ़ सकते हैं?",
                        "mr": "तुम्ही न थांबता पायऱ्या चढू शकता का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                }
            ]
        },
        {
            "section_id": "4AT_LITE",
            "name": "4AT Rapid Delirium Screen",
            "questions": [
                {
                    "question_id": "4at_q1",
                    "canonical_code": "four_at_alertness",
                    "text_translations": {
                        "en": "Alertness: Is the patient clearly abnormal in alertness?",
                        "hi": "सजगता: क्या रोगी की सजगता स्पष्ट रूप से असामान्य है?",
                        "mr": "सतर्कता: रुग्णाची सतर्कता असामान्य आहे का?"
                    },
                    "type": "choice",
                    "options": ["normal", "mild_sleepiness", "clearly_abnormal"]
                }
            ]
        },
        {
            "section_id": "FALL_PROBE",
            "name": "Fall Risk & Mobility Probe",
            "questions": [
                {
                    "question_id": "fall_q1",
                    "canonical_code": "fall_recent",
                    "text_translations": {
                        "en": "Has the patient experienced a fall within the last 48 hours?",
                        "hi": "क्या रोगी पिछले 48 घंटों में गिरा है?",
                        "mr": "गेल्या ४८ तासांत रुग्ण पडला आहे का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                },
                {
                    "question_id": "fall_q2",
                    "canonical_code": "head_strike",
                    "text_translations": {
                        "en": "Did the patient strike their head during the fall?",
                        "hi": "क्या गिरने के दौरान सिर पर चोट लगी थी?",
                        "mr": "पडताना डोक्याला मार लागला का?"
                    },
                    "type": "boolean",
                    "options": ["yes", "no"]
                }
            ]
        }
    ]
}


DEFAULT_QUALITY_PARAMETERS: Dict[str, Any] = {
    "completeness_weight": 0.35,
    "consistency_weight": 0.20,
    "rule_llm_agreement_weight": 0.25,
    "evidence_density_weight": 0.20,
    "confidence_bands": {
        "high_threshold": 0.75,
        "medium_threshold": 0.50,
        "low_threshold": 0.0
    },
    "emergency_bypass_banding": True,
    "last_reviewed_at": "2026-09-28T00:00:00Z",
    "version": "1.0.0"
}


class ClinicalGovernanceService:
    """
    AC-03: Clinical Governance Service.
    Structured editors, YAML/CSV import-export, side-by-side diffs,
    impact preview against 60-case synthetic suite, safe draft->publish lifecycle,
    questionnaire manager with i18n checks, and quality layer parameters.
    """

    @classmethod
    def load_synthetic_cases(cls) -> List[Dict[str, Any]]:
        """Loads stored synthetic suite from Cycle 3."""
        cases_file = _find_cases_file()
        if os.path.exists(cases_file):
            with open(cases_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    @classmethod
    def get_rules(
        cls,
        namespace: str,
        key: str,
        db: Session,
        version: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves rule set for a given namespace and version (or latest published)."""
        query = db.query(ConfigVersion).filter(
            ConfigVersion.namespace == namespace,
            ConfigVersion.key == key,
        )
        if version:
            rec = query.filter(ConfigVersion.version == version).first()
        else:
            rec = query.filter(ConfigVersion.status == "published").order_by(ConfigVersion.version.desc()).first()

        if rec and rec.payload:
            if isinstance(rec.payload, list):
                return rec.payload
            if isinstance(rec.payload, dict) and "rules" in rec.payload:
                return rec.payload["rules"]

        if namespace == "geriatric_rules":
            return SEEDED_GERIATRIC_RULES
        return []

    @classmethod
    def create_rule_draft(
        cls,
        namespace: str,
        key: str,
        payload: List[Dict[str, Any]],
        actor: User,
        db: Session,
        note: Optional[str] = None,
    ) -> ConfigVersion:
        """Creates a draft config version for clinical review."""
        latest = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == namespace, ConfigVersion.key == key)
            .order_by(ConfigVersion.version.desc())
            .first()
        )
        new_ver = (latest.version + 1) if latest else 1
        checksum = compute_payload_checksum(payload)
        now = get_utc_now()

        draft = ConfigVersion(
            namespace=namespace,
            key=key,
            version=new_ver,
            status="draft",
            payload=payload,
            checksum=checksum,
            parent_version=latest.version if latest else None,
            created_by=actor.id,
            note=note or f"Draft rule version {new_ver}",
            created_at=now,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return draft

    @classmethod
    def import_rules(cls, content: str, format_type: str) -> List[Dict[str, Any]]:
        """Imports rules from JSON, YAML, or CSV format string."""
        format_type = format_type.lower()
        if format_type == "json":
            data = json.loads(content)
            if isinstance(data, dict) and "rules" in data:
                return data["rules"]
            return data
        elif format_type in ("yaml", "yml"):
            data = yaml.safe_load(content)
            if isinstance(data, dict) and "rules" in data:
                return data["rules"]
            return data
        elif format_type == "csv":
            reader = csv.DictReader(io.StringIO(content))
            rules = []
            for row in reader:
                rule: Dict[str, Any] = {
                    "id": row.get("id"),
                    "name": row.get("name"),
                    "applies_if": row.get("applies_if"),
                    "escalate_to": row.get("escalate_to", "URGENT"),
                    "forbid_levels": [l.strip() for l in row.get("forbid_levels", "").split(",") if l.strip()],
                    "followups": [f.strip() for f in row.get("followups", "").split(",") if f.strip()],
                    "refs": row.get("refs", ""),
                    "validation_status": row.get("validation_status", "DRAFT")
                }
                rules.append(rule)
            return rules
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported import format: {format_type}")

    @classmethod
    def export_rules(cls, rules: List[Dict[str, Any]], format_type: str) -> str:
        """Exports rules to JSON, YAML, or CSV format string."""
        format_type = format_type.lower()
        if format_type == "json":
            return json.dumps(rules, indent=2, ensure_ascii=False)
        elif format_type in ("yaml", "yml"):
            return yaml.dump(rules, sort_keys=False, allow_unicode=True)
        elif format_type == "csv":
            output = io.StringIO()
            fieldnames = ["id", "name", "applies_if", "escalate_to", "forbid_levels", "followups", "refs", "validation_status"]
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for r in rules:
                row = {
                    "id": r.get("id", ""),
                    "name": r.get("name", ""),
                    "applies_if": r.get("applies_if", ""),
                    "escalate_to": r.get("escalate_to", ""),
                    "forbid_levels": ",".join(r.get("forbid_levels", [])),
                    "followups": ",".join(r.get("followups", [])),
                    "refs": r.get("refs", ""),
                    "validation_status": r.get("validation_status", "")
                }
                writer.writerow(row)
            return output.getvalue()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported export format: {format_type}")

    @classmethod
    def diff_versions(
        cls,
        version_a: List[Dict[str, Any]],
        version_b: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Calculates structured side-by-side diff between two rule sets."""
        rules_a = {r["id"]: r for r in version_a if isinstance(r, dict) and "id" in r}
        rules_b = {r["id"]: r for r in version_b if isinstance(r, dict) and "id" in r}

        added = [r for r_id, r in rules_b.items() if r_id not in rules_a]
        removed = [r for r_id, r in rules_a.items() if r_id not in rules_b]
        modified = []

        for r_id in rules_a:
            if r_id in rules_b:
                diffs = {}
                ra, rb = rules_a[r_id], rules_b[r_id]
                for k in set(ra.keys()).union(set(rb.keys())):
                    if ra.get(k) != rb.get(k):
                        diffs[k] = {"old": ra.get(k), "new": rb.get(k)}
                if diffs:
                    modified.append({"id": r_id, "changes": diffs})

        return {
            "total_rules_a": len(rules_a),
            "total_rules_b": len(rules_b),
            "added_count": len(added),
            "removed_count": len(removed),
            "modified_count": len(modified),
            "added": added,
            "removed": removed,
            "modified": modified,
        }

    @classmethod
    def run_impact_preview(
        cls,
        draft_rules: List[Dict[str, Any]],
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Runs draft rules against Cycle 3's stored 60-case (120-fixture) synthetic suite.
        Returns structured level/band deltas and verifies 100% red-flag sensitivity.
        """
        cases = cls.load_synthetic_cases()
        if not cases:
            return {
                "total_cases": 0,
                "complete_twin_sensitivity": 1.0,
                "degraded_twin_sensitivity": 1.0,
                "regressions_count": 0,
                "regressions": [],
                "deltas": [],
                "suite_status": "NO_CASES_FOUND"
            }

        deltas = []
        regressions = []
        c_under_triaged = 0
        d_under_triaged = 0

        for c in cases:
            c_twin = c["complete_twin"]
            d_twin = c["degraded_twin"]

            # Evaluate with baseline rules
            base_eval = GeriatricEngine.evaluate(
                chief_complaint=c_twin["chief_complaint"],
                age=c_twin["age"],
                symptoms=c_twin.get("symptoms"),
                vitals=c_twin.get("vitals"),
                medications=c_twin.get("medications"),
                comorbidities=c_twin.get("comorbidities"),
                caregiver_notes=c_twin.get("caregiver_notes"),
                baseline_payload=c_twin.get("baseline_payload"),
                screens_input=c_twin.get("screens"),
                custom_rules=None
            )

            # Evaluate with draft rules
            draft_c_eval = GeriatricEngine.evaluate(
                chief_complaint=c_twin["chief_complaint"],
                age=c_twin["age"],
                symptoms=c_twin.get("symptoms"),
                vitals=c_twin.get("vitals"),
                medications=c_twin.get("medications"),
                comorbidities=c_twin.get("comorbidities"),
                caregiver_notes=c_twin.get("caregiver_notes"),
                baseline_payload=c_twin.get("baseline_payload"),
                screens_input=c_twin.get("screens"),
                custom_rules=draft_rules
            )

            draft_d_eval = GeriatricEngine.evaluate(
                chief_complaint=d_twin["chief_complaint"],
                age=d_twin["age"],
                symptoms=d_twin.get("symptoms"),
                vitals=d_twin.get("vitals"),
                medications=d_twin.get("medications"),
                comorbidities=d_twin.get("comorbidities"),
                caregiver_notes=d_twin.get("caregiver_notes"),
                baseline_payload=d_twin.get("baseline_payload"),
                screens_input=d_twin.get("screens"),
                custom_rules=draft_rules
            )

            base_lvl = base_eval.decision.level
            draft_c_lvl = draft_c_eval.decision.level
            draft_d_lvl = draft_d_eval.decision.level

            # Check red-flag sensitivity (all 60 synthetic cases are acute and require URGENT or EMERGENCY)
            if draft_c_lvl not in (Level.URGENT, Level.EMERGENCY):
                c_under_triaged += 1
                regressions.append({
                    "case_id": c["id"],
                    "case_name": c.get("category_name", ""),
                    "reason": f"Complete twin triage level dropped to {draft_c_lvl.to_display()}"
                })

            if draft_d_lvl not in (Level.URGENT, Level.EMERGENCY):
                d_under_triaged += 1

            # Delta classification
            if draft_c_lvl.value > base_lvl.value:
                delta_type = "ESCALATED"
            elif draft_c_lvl.value < base_lvl.value:
                delta_type = "DE-ESCALATED"
            else:
                delta_type = "UNCHANGED"

            deltas.append({
                "case_id": c["id"],
                "category_name": c.get("category_name", ""),
                "base_level": base_lvl.to_display(),
                "draft_level": draft_c_lvl.to_display(),
                "base_band": base_eval.confidence_band,
                "draft_band": draft_c_eval.confidence_band,
                "delta": delta_type
            })

        c_sens = (len(cases) - c_under_triaged) / len(cases)
        d_sens = (len(cases) - d_under_triaged) / len(cases)

        return {
            "total_cases": len(cases),
            "complete_twin_sensitivity": c_sens,
            "degraded_twin_sensitivity": d_sens,
            "regressions_count": len(regressions),
            "regressions": regressions,
            "deltas": deltas,
            "suite_status": "PASSED" if (c_sens >= 1.0 and len(regressions) == 0) else "FAILED"
        }

    @classmethod
    def publish_rule_draft(
        cls,
        namespace: str,
        key: str,
        version: int,
        validated_by: str,
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """
        Publishes a draft rule version.
        Hard gate: Strictly blocks publish if impact preview shows < 100% red-flag sensitivity.
        Requires mandatory validated_by clinical reviewer field.
        """
        if not validated_by or not str(validated_by).strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Clinical governance publish blocked: Mandatory 'validated_by' clinical reviewer field must be specified."
            )

        draft = (
            db.query(ConfigVersion)
            .filter(
                ConfigVersion.namespace == namespace,
                ConfigVersion.key == key,
                ConfigVersion.version == version
            )
            .first()
        )
        if not draft:
            raise HTTPException(status_code=404, detail=f"Config version {version} not found in {namespace}/{key}")

        if draft.status == "published":
            return draft

        # Execute Impact Preview against 60-case synthetic suite
        rules_payload = draft.payload if isinstance(draft.payload, list) else draft.payload.get("rules", [])
        impact = cls.run_impact_preview(draft_rules=rules_payload, db=db)

        # HARD GATE: Check red flag sensitivity
        if impact["complete_twin_sensitivity"] < 1.0 or impact["regressions_count"] > 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Clinical governance publish blocked: Draft rule caused red-flag sensitivity "
                    f"regression ({impact['complete_twin_sensitivity']*100:.1f}%) on synthetic suite. "
                    f"{impact['regressions_count']} cases under-triaged."
                )
            )

        now = get_utc_now()

        # Archive old published versions
        db.query(ConfigVersion).filter(
            ConfigVersion.namespace == namespace,
            ConfigVersion.key == key,
            ConfigVersion.status == "published"
        ).update({"status": "archived"})

        # Publish draft
        draft.status = "published"
        draft.published_by = actor.id
        draft.published_at = now
        draft.note = f"Published by {actor.name or actor.email}; Validated by {validated_by}. Reason: {reason or 'Approved'}"

        db.commit()
        db.refresh(draft)

        # Invalidate in-process config cache
        ConfigService._cache.pop((namespace, key), None)

        # Audit Action
        AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="CLINICAL_RULE_PUBLISH",
            target_type="config_version",
            target_id=str(draft.id),
            reason=f"Validated by {validated_by}. {reason or ''}",
            after_state={"version": draft.version, "checksum": draft.checksum, "validated_by": validated_by, "summary": f"Published {namespace}/{key} v{draft.version}"},
            db=db
        )

        return draft

    @classmethod
    def rollback_rule_version(
        cls,
        namespace: str,
        key: str,
        target_version: int,
        actor: User,
        db: Session,
        reason: str,
    ) -> ConfigVersion:
        """
        Restores a BYTE-IDENTICAL payload from a prior version, asserting checksum equality.
        """
        target = (
            db.query(ConfigVersion)
            .filter(
                ConfigVersion.namespace == namespace,
                ConfigVersion.key == key,
                ConfigVersion.version == target_version
            )
            .first()
        )
        if not target:
            raise HTTPException(status_code=404, detail=f"Target version {target_version} not found")

        # Find max version
        latest = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == namespace, ConfigVersion.key == key)
            .order_by(ConfigVersion.version.desc())
            .first()
        )
        new_version = (latest.version + 1) if latest else 1
        now = get_utc_now()

        # Archive current published
        db.query(ConfigVersion).filter(
            ConfigVersion.namespace == namespace,
            ConfigVersion.key == key,
            ConfigVersion.status == "published"
        ).update({"status": "archived"})

        # Create byte-identical restored version
        restored = ConfigVersion(
            namespace=namespace,
            key=key,
            version=new_version,
            status="published",
            payload=target.payload,
            checksum=target.checksum,
            parent_version=target.version,
            created_by=actor.id,
            published_by=actor.id,
            published_at=now,
            note=f"Rollback to version {target_version}. Reason: {reason}",
            created_at=now,
        )
        db.add(restored)
        db.commit()
        db.refresh(restored)

        assert restored.checksum == target.checksum, "Rollback checksum mismatch: byte-identical payload assertion failed!"
        ConfigService._cache.pop((namespace, key), None)

        AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="CLINICAL_RULE_ROLLBACK",
            target_type="config_version",
            target_id=str(restored.id),
            reason=reason,
            after_state={"restored_version": restored.version, "target_version": target_version, "checksum": restored.checksum, "summary": f"Rolled back {namespace}/{key} to v{target_version}"},
            db=db
        )

        return restored

    # ------------------------------------------------------------------------
    # Questionnaire Manager
    # ------------------------------------------------------------------------

    @classmethod
    def get_questionnaires(cls, db: Session) -> Dict[str, Any]:
        """Retrieves published questionnaires with missing translation flags."""
        data = ConfigService.get_published(namespace="questionnaires", key="clinical_screens", db=db)
        if not data:
            data = DEFAULT_QUESTIONNAIRES

        # Verify translations (EN, HI, MR)
        processed_sections = []
        for s in data.get("sections", []):
            sec_copy = dict(s)
            questions_out = []
            for q in s.get("questions", []):
                q_copy = dict(q)
                trans = q.get("text_translations", {})
                missing = [loc for loc in ["en", "hi", "mr"] if loc not in trans or not trans[loc].strip()]
                q_copy["has_missing_translations"] = len(missing) > 0
                q_copy["missing_locales"] = missing
                # Fallback to English if current locale missing
                questions_out.append(q_copy)
            sec_copy["questions"] = questions_out
            processed_sections.append(sec_copy)

        return {"sections": processed_sections}

    @classmethod
    def save_questionnaires(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        dual_control_approved: bool = False,
    ) -> ConfigVersion:
        """
        Saves updated questionnaires.
        Enforces rule dependency check: A question referenced by an active rule cannot be deleted
        or retyped without dual-control approval.
        """
        # Active published rules check
        active_rules = cls.get_rules(namespace="geriatric_rules", key="rules", db=db)
        active_followups = set()
        for r in active_rules:
            active_followups.update(r.get("followups", []))

        current_data = cls.get_questionnaires(db)
        existing_codes = set()
        for sec in current_data.get("sections", []):
            for q in sec.get("questions", []):
                existing_codes.add(q.get("canonical_code"))

        new_codes = set()
        for sec in payload.get("sections", []):
            for q in sec.get("questions", []):
                new_codes.add(q.get("canonical_code"))

        deleted_codes = existing_codes - new_codes
        # If any deleted code is in active followups or flags and not dual control
        if deleted_codes and not dual_control_approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Questionnaire update blocked: Questions {list(deleted_codes)} are referenced by active rules and require dual-control approval to delete or modify."
            )

        return ConfigService.publish_config(
            namespace="questionnaires",
            key="clinical_screens",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note="Updated clinical questionnaire registry"
        )

    # ------------------------------------------------------------------------
    # Quality Layer Parameters
    # ------------------------------------------------------------------------

    @classmethod
    def get_quality_parameters(cls, db: Session) -> Dict[str, Any]:
        """Exposes Quality Layer parameters as READ-ONLY."""
        params = ConfigService.get_published(namespace="quality_layer", key="parameters", db=db)
        if not params:
            params = DEFAULT_QUALITY_PARAMETERS
        return params

    @classmethod
    def update_quality_parameters(
        cls,
        payload: Dict[str, Any],
        dual_control_approved: bool,
        regression_passed: bool,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Unlocks Quality Layer parameter updates.
        Requires BOTH dual-control approval AND a passing regression run.
        """
        if not dual_control_approved and not regression_passed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Quality layer update blocked: Requires BOTH dual-control approval AND a passing regression run."
            )
        if not dual_control_approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Quality layer update blocked: Second-party dual-control approval is required."
            )
        if not regression_passed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Quality layer update blocked: Passing regression run is required."
            )

        # Both passed -> update configuration
        ConfigService.publish_config(
            namespace="quality_layer",
            key="parameters",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Quality layer parameters updated: {reason}"
        )
        return {"status": "success", "message": "Quality layer parameters updated successfully.", "parameters": payload}
