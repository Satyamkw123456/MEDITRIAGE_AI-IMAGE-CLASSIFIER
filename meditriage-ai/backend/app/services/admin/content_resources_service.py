from datetime import timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.config_version import ConfigVersion
from app.models.support_ops import EmergencyResource
from app.models.user import User
from app.services.config.config_service import ConfigService
from app.services.audit.audit_service import AuditService
from app.core.utils import get_utc_now


DEFAULT_I18N_STRINGS: Dict[str, Any] = {
    "locales": ["en", "hi", "mr"],
    "strings": {
        "common.welcome": {
            "en": "Welcome to MediTriage AI",
            "hi": "मेडीट्राइएज एआई में आपका स्वागत है",
            "mr": "मेडीट्रायज एआय मध्ये आपले स्वागत आहे"
        },
        "common.emergency_alert": {
            "en": "Emergency Detected: Call 108 or go to nearest emergency room immediately.",
            "hi": "आपातकालीन स्थिति: तुरंत 108 पर कॉल करें या नजदीकी अस्पताल जाएं।",
            "mr": "तातडीची परिस्थिती: त्वरित 108 वर कॉल करा किंवा जवळच्या रुग्णालयात जा."
        }
    }
}

DEFAULT_CONSENT_TEXT: Dict[str, Any] = {
    "version": "1.0.0",
    "title": "Digital Personal Data Protection (DPDP) Patient Consent",
    "text": "By proceeding, you consent to the processing of your clinical health data under the Digital Personal Data Protection Act, 2023.",
    "effective_date": "2026-09-01T00:00:00Z"
}

DEFAULT_AI_HUB_CARDS: Dict[str, Any] = {
    "daily_checkin": {
        "title": "Daily Health Check-in",
        "description": "Quick daily symptom and vital signs monitoring for chronic care patients."
    },
    "medication_review": {
        "title": "Medication Shield",
        "description": "Screen current prescriptions against Beers and STOPP/START criteria."
    },
    "visit_prep": {
        "title": "Clinical Visit Preparation",
        "description": "Synthesize symptoms and trajectory questions to ask your doctor."
    }
}


class ContentResourcesService:
    """
    AC-08: Content & Resources Service.
    i18n string editor, consent text versioning with automatic user re-consent flagging,
    emergency resource directory with 90-day stale calculation, and AI Hub card copy.
    """

    # ------------------------------------------------------------------------
    # i18n String Editor
    # ------------------------------------------------------------------------

    @classmethod
    def get_i18n_strings(cls, db: Session) -> Dict[str, Any]:
        """Retrieves active translation bundles."""
        data = ConfigService.get_published(namespace="i18n", key="strings", db=db)
        if not data:
            data = DEFAULT_I18N_STRINGS
        return data

    @classmethod
    def update_i18n_strings(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Publishes updated i18n translation strings."""
        return ConfigService.publish_config(
            namespace="i18n",
            key="strings",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Updated i18n translations: {reason or 'Administrative update'}"
        )

    # ------------------------------------------------------------------------
    # Consent & Disclaimer Text Versioning
    # ------------------------------------------------------------------------

    @classmethod
    def get_consent_text(cls, db: Session) -> Dict[str, Any]:
        """Retrieves active statutory consent & disclaimer text."""
        data = ConfigService.get_published(namespace="content", key="consent_disclaimer", db=db)
        if not data:
            data = DEFAULT_CONSENT_TEXT
        return data

    @classmethod
    def bump_consent_version(
        cls,
        new_version: str,
        text: str,
        title: str,
        actor: User,
        db: Session,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Bumps the statutory consent version and flags all affected users for re-consent.
        Wires directly to User.requires_reconsent.
        """
        now = get_utc_now()
        payload = {
            "version": new_version,
            "title": title,
            "text": text,
            "effective_date": now.isoformat(),
        }
        cfg = ConfigService.publish_config(
            namespace="content",
            key="consent_disclaimer",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Bumped consent version to {new_version}. Reason: {reason}"
        )

        # Flag all active patients for mandatory re-consent
        updated_count = (
            db.query(User)
            .filter(User.role.in_(["patient", "caregiver"]))
            .update({"requires_reconsent": True}, synchronize_session="fetch")
        )
        db.commit()

        AuditService.write_admin_action(
            actor_id=actor.id,
            action_code="CONSENT_VERSION_BUMP",
            target_type="config_version",
            target_id=str(cfg.id),
            reason=reason,
            after_state={"new_version": new_version, "affected_users": updated_count, "summary": f"Bumped consent version to {new_version}; flagged {updated_count} users for re-consent"},
            db=db
        )

        return {
            "status": "success",
            "version": new_version,
            "effective_date": now.isoformat(),
            "users_flagged_for_reconsent": updated_count,
        }

    # ------------------------------------------------------------------------
    # Emergency Resource Directory & Stale Tracking
    # ------------------------------------------------------------------------

    @classmethod
    def list_resources(cls, db: Session, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists directory resources with staleness status."""
        query = db.query(EmergencyResource).filter(EmergencyResource.is_active == True)
        if category:
            query = query.filter(EmergencyResource.category == category)

        resources = query.order_by(EmergencyResource.name).all()
        now = get_utc_now()
        stale_threshold = now - timedelta(days=90)

        out = []
        for r in resources:
            v_date = r.last_verified_at
            if v_date and v_date.tzinfo is None:
                v_date = v_date.replace(tzinfo=timezone.utc)
            is_stale = (v_date is None) or (v_date < stale_threshold)
            days_since = (now - v_date).days if v_date else None

            out.append({
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "phone_number": r.phone_number,
                "city_region": r.city_region,
                "last_verified_at": r.last_verified_at.isoformat() if r.last_verified_at else None,
                "is_stale": is_stale,
                "days_since_verification": days_since,
            })
        return out

    @classmethod
    def get_stale_resources(cls, db: Session) -> List[EmergencyResource]:
        """Returns all resources unverified for more than 90 days."""
        now = get_utc_now()
        stale_threshold = now - timedelta(days=90)
        return (
            db.query(EmergencyResource)
            .filter(
                EmergencyResource.is_active == True,
                (EmergencyResource.last_verified_at == None) | (EmergencyResource.last_verified_at < stale_threshold)
            )
            .all()
        )

    @classmethod
    def create_or_update_resource(
        cls,
        data: Dict[str, Any],
        actor: User,
        db: Session,
        resource_id: Optional[int] = None,
    ) -> EmergencyResource:
        """Creates or updates an emergency directory resource."""
        now = get_utc_now()
        if resource_id:
            res = db.query(EmergencyResource).filter(EmergencyResource.id == resource_id).first()
            if not res:
                raise HTTPException(status_code=404, detail="Resource not found")
            for k, v in data.items():
                if hasattr(res, k):
                    setattr(res, k, v)
            res.updated_at = now
        else:
            res = EmergencyResource(
                name=data["name"],
                category=data["category"],
                phone_number=data["phone_number"],
                city_region=data["city_region"],
                last_verified_at=data.get("last_verified_at", now),
                is_active=data.get("is_active", True),
                created_at=now,
                updated_at=now,
            )
            db.add(res)

        db.commit()
        db.refresh(res)
        return res

    @classmethod
    def verify_resource(cls, resource_id: int, actor: User, db: Session) -> EmergencyResource:
        """Marks a directory resource as verified with current timestamp."""
        res = db.query(EmergencyResource).filter(EmergencyResource.id == resource_id).first()
        if not res:
            raise HTTPException(status_code=404, detail="Resource not found")
        res.last_verified_at = get_utc_now()
        db.commit()
        db.refresh(res)
        return res

    # ------------------------------------------------------------------------
    # AI Hub Card Copy Editor
    # ------------------------------------------------------------------------

    @classmethod
    def get_ai_hub_copy(cls, db: Session) -> Dict[str, Any]:
        """Retrieves AI Hub service card UI copy."""
        data = ConfigService.get_published(namespace="content", key="ai_hub_copy", db=db)
        if not data:
            data = DEFAULT_AI_HUB_CARDS
        return data

    @classmethod
    def update_ai_hub_copy(
        cls,
        payload: Dict[str, Any],
        actor: User,
        db: Session,
        reason: Optional[str] = None,
    ) -> ConfigVersion:
        """Publishes updated AI Hub service card descriptions."""
        return ConfigService.publish_config(
            namespace="content",
            key="ai_hub_copy",
            payload=payload,
            actor_id=actor.id,
            db=db,
            note=f"Updated AI Hub card copy: {reason or 'Administrative update'}"
        )
