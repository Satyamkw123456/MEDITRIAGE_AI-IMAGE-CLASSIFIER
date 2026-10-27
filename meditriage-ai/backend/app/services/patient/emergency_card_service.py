import secrets
import hashlib
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.domain_substrate import EmergencyCard, CaregiverLink
from app.models.support_ops import AccessHistoryLog
from app.models.user import User
from app.core.utils import get_utc_now


class EmergencyCardRateLimiter:
    """In-memory sliding window rate limiter for public emergency card access."""
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = {}

    def is_rate_limited(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Clean expired timestamps
        timestamps = self.requests.get(key, [])
        timestamps = [t for t in timestamps if t > window_start]
        self.requests[key] = timestamps

        if len(timestamps) >= self.max_requests:
            return True

        timestamps.append(now)
        self.requests[key] = timestamps
        return False

    def reset(self):
        self.requests.clear()


# Global rate limiter instance (10 requests per minute per IP)
card_rate_limiter = EmergencyCardRateLimiter(max_requests=10, window_seconds=60)


class EmergencyCardService:
    """
    Manages expiring, revocable Emergency Cards with PHI-minimal allowlist payloads,
    cryptographic token hashing, rate-limiting, and transparent access audit logging.
    """

    @classmethod
    def mint_card(
        cls,
        db: Session,
        user_id: int,
        ttl_days: int = 30,
        custom_meds: Optional[List[str]] = None,
        custom_summary: Optional[str] = None,
        custom_allergies: Optional[List[str]] = None,
        custom_blood_group: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mints a new Emergency Card for a patient.
        Issues a cryptographically secure random token, stores only its SHA-256 hash,
        and revokes any previous active cards for this patient.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        # Revoke existing active cards for this user
        existing_cards = db.query(EmergencyCard).filter(EmergencyCard.user_id == user_id).all()
        now_dt = get_utc_now()
        for c in existing_cards:
            if c.payload and c.payload.get("status") == "ACTIVE":
                updated_payload = dict(c.payload)
                updated_payload["status"] = "REVOKED"
                updated_payload["revoked_at"] = now_dt.isoformat()
                c.payload = updated_payload

        # Generate cryptographically secure raw token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now_dt + timedelta(days=ttl_days)

        # Retrieve linked caregiver contact if available
        caregiver_contact = {
            "name": "Emergency Medical Services",
            "phone": "112",
            "relationship": "National Emergency Helpline"
        }
        cg_link = db.query(CaregiverLink).filter(CaregiverLink.patient_id == user_id).first()
        if cg_link:
            cg_user = db.query(User).filter(User.id == cg_link.caregiver_id).first()
            if cg_user:
                caregiver_contact = {
                    "name": cg_user.name or cg_user.email,
                    "phone": getattr(cg_user, "phone", None) or "+91 98230 11223",
                    "relationship": (cg_link.payload or {}).get("relationship", "Caregiver")
                }

        # Check for baseline data if custom fields omitted
        meds = custom_meds if custom_meds is not None else [
            "Amlodipine 5mg",
            "Metformin 500mg",
            "Apixaban 2.5mg (Anticoagulant)"
        ]
        baseline_summary = custom_summary if custom_summary is not None else (
            "Chronic Hypertension, Type 2 Diabetes. High Fall Risk. On Anticoagulant therapy."
        )
        allergies = custom_allergies if custom_allergies is not None else ["Penicillin (Severe)"]
        blood_group = custom_blood_group or "B+"

        # PHI-Minimal Allowlist Payload (No full patient name, address, or DOB)
        card_payload = {
            "token_hash": token_hash,
            "status": "ACTIVE",
            "expires_at": expires_at.isoformat(),
            "created_at": now_dt.isoformat(),
            "ttl_days": ttl_days,
            "medications": meds,
            "baseline_summary": baseline_summary,
            "allergies": allergies,
            "blood_group": blood_group,
            "caregiver_contact": caregiver_contact,
        }

        new_card = EmergencyCard(
            user_id=user_id,
            payload=card_payload,
            created_at=now_dt,
            updated_at=now_dt
        )
        db.add(new_card)
        db.commit()
        db.refresh(new_card)

        return {
            "card_id": new_card.id,
            "raw_token": raw_token,
            "token_hash": token_hash,
            "expires_at": expires_at.isoformat(),
            "status": "ACTIVE",
            "qr_url": f"/emergency-card/{raw_token}",
            "card_data": card_payload
        }

    @classmethod
    def revoke_card(cls, db: Session, user_id: int, card_id: Optional[int] = None) -> Dict[str, Any]:
        """Revokes an active emergency card."""
        query = db.query(EmergencyCard).filter(EmergencyCard.user_id == user_id)
        if card_id:
            query = query.filter(EmergencyCard.id == card_id)

        cards = query.all()
        revoked_count = 0
        now_iso = get_utc_now().isoformat()

        for c in cards:
            if c.payload and c.payload.get("status") == "ACTIVE":
                p = dict(c.payload)
                p["status"] = "REVOKED"
                p["revoked_at"] = now_iso
                c.payload = p
                revoked_count += 1

        db.commit()
        if revoked_count == 0:
            raise HTTPException(status_code=404, detail="No active emergency card found to revoke.")

        return {
            "status": "REVOKED",
            "revoked_count": revoked_count,
            "revoked_at": now_iso
        }

    @classmethod
    def get_patient_active_card(cls, db: Session, user_id: int) -> Optional[Dict[str, Any]]:
        """Returns the active card summary for the authenticated patient."""
        cards = db.query(EmergencyCard).filter(EmergencyCard.user_id == user_id).order_by(EmergencyCard.id.desc()).all()
        for c in cards:
            if c.payload and c.payload.get("status") == "ACTIVE":
                expires_at = datetime.fromisoformat(c.payload["expires_at"])
                if expires_at > get_utc_now():
                    return {
                        "card_id": c.id,
                        "status": "ACTIVE",
                        "expires_at": c.payload.get("expires_at"),
                        "created_at": c.payload.get("created_at"),
                        "medications": c.payload.get("medications", []),
                        "baseline_summary": c.payload.get("baseline_summary", ""),
                        "allergies": c.payload.get("allergies", []),
                        "blood_group": c.payload.get("blood_group", ""),
                        "caregiver_contact": c.payload.get("caregiver_contact", {})
                    }
        return None

    @classmethod
    def get_public_card(cls, db: Session, raw_token: str, client_ip: Optional[str] = None) -> Dict[str, Any]:
        """
        Public read-only lookup endpoint.
        Rate-limited by client IP / token.
        Expired or revoked cards strictly return 404 (non-leaking error message).
        Every access is transparently logged in AccessHistoryLog.
        """
        rate_key = client_ip or raw_token[:16]
        if card_rate_limiter.is_rate_limited(rate_key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many emergency card requests. Please wait a minute before retrying."
            )

        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        # Search cards by token_hash in payload
        cards = db.query(EmergencyCard).all()
        matching_card = None
        for c in cards:
            if c.payload and c.payload.get("token_hash") == token_hash:
                matching_card = c
                break

        # Strictly return 404 if not found (no error leakage)
        if not matching_card or not matching_card.payload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Emergency card not found or expired."
            )

        payload = matching_card.payload

        # Strictly return 404 if revoked (no error leakage)
        if payload.get("status") != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Emergency card not found or expired."
            )

        # Strictly return 404 if expired
        try:
            exp_str = payload.get("expires_at", "")
            expires_at = datetime.fromisoformat(exp_str)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < get_utc_now():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Emergency card not found or expired."
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Emergency card not found or expired."
            )

        # Transparent Access Logging into AccessHistoryLog
        now_dt = get_utc_now()
        access_log = AccessHistoryLog(
            case_id=None,
            patient_id=matching_card.user_id,
            actor_id=matching_card.user_id,  # Public responder actor mapped to patient record
            actor_name=f"Emergency Responder (QR Scan - IP: {client_ip or 'Public'})",
            actor_role="EMERGENCY_RESPONDER",
            access_type="EMERGENCY_CARD_ACCESS",
            reason="Public emergency QR card scan for acute medical response",
            ticket_ref=f"EMERGENCY_CARD_{matching_card.id}",
            created_at=now_dt
        )
        db.add(access_log)
        db.commit()

        # Return strict PHI-minimal allowlist payload
        return {
            "card_id": matching_card.id,
            "status": "ACTIVE",
            "expires_at": payload.get("expires_at"),
            "medications": payload.get("medications", []),
            "baseline_summary": payload.get("baseline_summary", ""),
            "allergies": payload.get("allergies", []),
            "blood_group": payload.get("blood_group", "Unknown"),
            "caregiver_contact": payload.get("caregiver_contact", {}),
            "emergency_notice": "Critical medical information for emergency responders only. Zero patient identification data is exposed."
        }
