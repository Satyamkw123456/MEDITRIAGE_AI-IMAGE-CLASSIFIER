import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.chat import ChatSession, ChatMessage
from app.models.case import Case
from app.models.triage import TriageResult
from app.models.domain_substrate import CaregiverLink
from app.models.user import User
from app.services.chat.crisis_filter import CrisisFilter
from app.services.chat.emergency_filter import EmergencyFilter
from app.services.chat.post_filter import PostFilter
from app.services.ai.gateway import AIGateway
from app.services.ai.gemini_provider import GeminiProvider
from app.models.chat import get_utc_now
from app.services.lifecycle.lifecycle_service import LifecycleService
from app.schemas.lifecycle import CaseAmendInput
from app.schemas.intake import SymptomInput


logger = logging.getLogger(__name__)

SESSION_MAX_MESSAGES = 50


class ChatService:
    """
    Orchestrates Companion (patient/caregiver) and Copilot (clinician) chat sessions.
    Strictly preserves:
      - INV-01: Chatbot NEVER directly changes or lowers triage urgency level.
      - INV-08: Cross-patient data isolation enforced at service and API layer.
      - Deterministic emergency & crisis intercept independent of LLM availability.
      - Proposed amendments requiring explicit user confirmation to trigger LifecycleService.
    """

    @classmethod
    def create_or_get_session(
        cls,
        user_id: int,
        case_id: Optional[int],
        mode: str = "companion",  # companion | copilot
        user_role: str = "patient",
        db: Optional[Session] = None,
    ) -> ChatSession:
        if not db:
            raise ValueError("Database session required")

        # 1. Scope and Authorization verification
        if case_id:
            case = db.query(Case).filter(Case.id == case_id).first()
            if not case:
                raise HTTPException(status_code=404, detail=f"Case #{case_id} not found.")

            # Cross-patient check
            if mode == "companion":
                case_owner_user_id = case.patient.user_id if case.patient else None
                if case_owner_user_id != user_id and user_role not in ["clinician", "super_admin"]:
                    # Check caregiver links
                    is_caregiver = (
                        db.query(CaregiverLink)
                        .filter(CaregiverLink.caregiver_id == user_id)
                        .filter(CaregiverLink.patient_id == case_owner_user_id)
                        .first()
                    )
                    if not is_caregiver:
                        raise HTTPException(
                            status_code=403,
                            detail="Access denied: Cross-patient access prohibited.",
                        )
            elif mode == "copilot":
                if user_role not in ["clinician", "ops_admin", "super_admin"]:
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied: Copilot mode requires clinician or administrator role.",
                    )

        # 2. Retrieve existing active session or create new
        query = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .filter(ChatSession.mode == mode)
            .filter(ChatSession.status == "active")
        )
        if case_id:
            query = query.filter(ChatSession.case_id == case_id)
        else:
            query = query.filter(ChatSession.case_id.is_(None))

        session = query.first()
        if not session:
            now = get_utc_now()
            session = ChatSession(
                user_id=user_id,
                case_id=case_id,
                mode=mode,
                status="active",
                created_at=now,
                updated_at=now,
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        return session

    @classmethod
    def detect_amendment_proposal(cls, text: str) -> Optional[Dict[str, Any]]:
        """Detects if user mentions new symptoms, vitals, or condition updates."""
        clean = text.lower()
        proposal = None

        new_symptom_triggers = ["i also have", "also developed", "experiencing", "now i feel", "started feeling"]
        for trig in new_symptom_triggers:
            if trig in clean:
                symptom_text = clean.split(trig, 1)[1].split(".")[0].strip()
                if symptom_text and len(symptom_text) > 2:
                    proposal = {
                        "proposal_type": "new_symptom",
                        "status": "PROPOSED",
                        "proposed_change": {"symptom": symptom_text.title(), "severity": 6},
                        "summary": f"Add newly reported symptom: {symptom_text.title()}",
                    }
                    break

        if "bp is" in clean or "blood pressure is" in clean:
            proposal = {
                "proposal_type": "vitals_update",
                "status": "PROPOSED",
                "proposed_change": {"source_text": text},
                "summary": "Update patient reported blood pressure readings",
            }

        return proposal

    @classmethod
    async def process_user_message(
        cls,
        session_id: int,
        user_message: str,
        user_id: int,
        db: Session,
        gateway: Optional[AIGateway] = None,
    ) -> Dict[str, Any]:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")

        # Ensure user owns session
        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="Cross-patient access prohibited.")

        # Message cap enforcement
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count()
        if msg_count >= SESSION_MAX_MESSAGES:
            raise HTTPException(
                status_code=429,
                detail=f"Session message cap reached ({SESSION_MAX_MESSAGES} messages). Please start a new session.",
            )

        now = get_utc_now()

        # 1. Persist User Message
        user_msg_rec = ChatMessage(
            session_id=session_id,
            sender_role="user",
            message_text=user_message,
            created_at=now,
        )
        db.add(user_msg_rec)
        db.commit()

        # 2. Crisis & Hopelessness Pre-Filter Check
        if CrisisFilter.check_crisis_language(user_message):
            crisis_res = CrisisFilter.build_crisis_response(db)
            assistant_msg = ChatMessage(
                session_id=session_id,
                sender_role="assistant",
                message_text=crisis_res["response_text"],
                safety_flags=crisis_res["safety_flags"],
                created_at=get_utc_now(),
            )
            db.add(assistant_msg)
            db.commit()
            return {
                "response_text": crisis_res["response_text"],
                "is_crisis": True,
                "is_emergency": False,
                "safety_flags": crisis_res["safety_flags"],
                "amendment_proposal": None,
            }

        # 3. Deterministic Emergency Pre-Filter Check (Runs BEFORE and independent of any LLM call)
        case_data = None
        if session.case_id:
            case = db.query(Case).filter(Case.id == session.case_id).first()
            if case:
                t_res = (
                    db.query(TriageResult)
                    .filter(TriageResult.case_id == case.id)
                    .filter(TriageResult.is_current.in_(["true", "True"]))
                    .first()
                )
                case_data = {
                    "age": 70,
                    "symptoms": [{"symptom": case.chief_complaint}],
                    "triage_level": t_res.triage_level if t_res else "Routine",
                }

        is_emergency, emerg_reason = EmergencyFilter.check_emergency(user_message, case_data=case_data)
        if is_emergency:
            emerg_res = EmergencyFilter.build_emergency_response(emerg_reason or "Acute symptom presentation")
            assistant_msg = ChatMessage(
                session_id=session_id,
                sender_role="assistant",
                message_text=emerg_res["response_text"],
                safety_flags=emerg_res["safety_flags"],
                created_at=get_utc_now(),
            )
            db.add(assistant_msg)
            db.commit()
            return {
                "response_text": emerg_res["response_text"],
                "is_crisis": False,
                "is_emergency": True,
                "safety_flags": emerg_res["safety_flags"],
                "amendment_proposal": None,
            }

        # 4. Check for Amendment Proposal
        amendment_proposal = cls.detect_amendment_proposal(user_message)

        # 5. RAG Retrieval & Context Assembly
        grounding_ids = ["case_summary"]
        context_str = f"Patient context: Case #{session.case_id or 'General'}. Mode: {session.mode}."
        if session.case_id and case_data:
            context_str += f" Chief complaint: {case_data.get('symptoms', [{}])[0].get('symptom', '')}. Urgency: {case_data.get('triage_level')}."
            grounding_ids.append(f"case_{session.case_id}")

        # 6. LLM Generation via Port / Gateway
        gw = gateway or AIGateway(provider=GeminiProvider())
        system_prompt = (
            "You are MediTriage AI Assistant in " + session.mode.upper() + " mode. "
            "You provide empathetic, evidence-based clinical information. "
            "Never assert a definitive medical diagnosis. Never advise medication dosages or say 'stop taking'. "
            "Always advise discussing modifications with a qualified physician."
        )

        try:
            # We call the provider's generate_raw or fallback
            stream_chunks = []
            async for token in gw.provider.stream_text(
                system=system_prompt,
                user=f"Context: {context_str}\n\nUser Question: {user_message}",
            ):
                stream_chunks.append(token)
            raw_response = "".join(stream_chunks)
        except Exception as e:
            logger.warning(f"LLM streaming unavailable in chat ({e}), deploying structured deterministic response.")
            raw_response = (
                f"Thank you for sharing this update. Based on your health assessment record "
                f"({case_data.get('triage_level', 'Routine') if case_data else 'Active'}), "
                "we recommend continuing to monitor your symptoms closely and reviewing these details with your physician."
            )

        # 7. Post-Filter Guardrails
        filtered_text, filter_report = PostFilter.filter_response(
            raw_response,
            citations=grounding_ids,
            is_clinician_copilot=(session.mode == "copilot"),
        )

        # 8. Persist Assistant Message
        assistant_msg = ChatMessage(
            session_id=session_id,
            sender_role="assistant",
            message_text=filtered_text,
            grounding_ids=grounding_ids,
            safety_flags={"post_filter_flags": filter_report.get("flags", [])},
            amendment_proposal=amendment_proposal,
            created_at=get_utc_now(),
        )
        db.add(assistant_msg)
        db.commit()

        return {
            "response_text": filtered_text,
            "is_crisis": False,
            "is_emergency": False,
            "safety_flags": assistant_msg.safety_flags,
            "grounding_ids": grounding_ids,
            "amendment_proposal": amendment_proposal,
        }

    @classmethod
    def confirm_amendment_proposal(
        cls,
        case_id: int,
        proposal_data: Dict[str, Any],
        actor_id: int,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Routes confirmed chat amendment proposal through Cycle 2's LifecycleService.create_revision.
        Triggers deterministic re-triage under governed lifecycle controls.
        Chat layer NEVER mutates triage_results directly!
        """
        # Fetch existing case
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found.")

        proposed_change = proposal_data.get("proposed_change", {})
        amended_symptoms: List[SymptomInput] = []
        if case.symptoms:
            for s in case.symptoms:
                amended_symptoms.append(
                    SymptomInput(
                        symptom=s.symptom,
                        severity=s.severity or 5,
                        duration=s.duration,
                        body_location=s.body_location,
                    )
                )
        else:
            amended_symptoms.append(SymptomInput(symptom=case.chief_complaint, severity=5))

        if "symptom" in proposed_change:
            amended_symptoms.append(
                SymptomInput(
                    symptom=proposed_change["symptom"],
                    severity=proposed_change.get("severity", 5),
                )
            )

        amend_input = CaseAmendInput(
            chief_complaint=case.chief_complaint,
            symptoms=amended_symptoms,
            reason=proposal_data.get("summary", "Confirmed chat amendment proposal"),
        )

        actor = db.query(User).filter(User.id == actor_id).first()
        if not actor:
            raise HTTPException(status_code=404, detail="Actor not found.")

        updated_case, rev_no = LifecycleService.amend_case(
            db=db,
            case_id=case_id,
            user=actor,
            data=amend_input,
        )

        return {
            "status": "confirmed_and_retriaged",
            "case_id": case_id,
            "new_revision_number": rev_no,
            "re_triage_triggered": True,
        }
