import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.services.chat.chat_service import ChatService


router = APIRouter()


class CreateSessionRequest(BaseModel):
    case_id: Optional[int] = None
    mode: str = Field(default="companion", description="companion | copilot")


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ConfirmProposalRequest(BaseModel):
    case_id: int
    proposal_data: Dict[str, Any]


@router.post("/sessions")
def create_or_get_chat_session(
    req: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates or retrieves an active chat session scoped by (user_id, case_id, mode)."""
    session = ChatService.create_or_get_session(
        user_id=current_user.id,
        case_id=req.case_id,
        mode=req.mode,
        user_role=current_user.role,
        db=db,
    )
    return {
        "session_id": session.id,
        "case_id": session.case_id,
        "mode": session.mode,
        "status": session.status,
        "created_at": session.created_at.isoformat(),
    }


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all chat messages for a session with RBAC authorization check."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    if session.user_id != current_user.id and current_user.role not in ["clinician", "super_admin"]:
        raise HTTPException(status_code=403, detail="Cross-patient access prohibited.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {
        "session_id": session_id,
        "messages": [
            {
                "id": m.id,
                "sender_role": m.sender_role,
                "message_text": m.message_text,
                "grounding_ids": m.grounding_ids,
                "safety_flags": m.safety_flags,
                "amendment_proposal": m.amendment_proposal,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/sessions/{session_id}/messages")
async def send_chat_message(
    session_id: int,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes user message through full pre-filter, RAG, and post-filter guardrails."""
    result = await ChatService.process_user_message(
        session_id=session_id,
        user_message=req.message,
        user_id=current_user.id,
        db=db,
    )
    return result


@router.get("/sessions/{session_id}/stream")
async def stream_chat_session(
    session_id: int,
    message: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) streaming endpoint for chat interactions."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    if session.user_id != current_user.id and current_user.role not in ["clinician", "super_admin"]:
        raise HTTPException(status_code=403, detail="Cross-patient access prohibited.")

    async def event_generator():
        yield f"event: start\ndata: {json.dumps({'session_id': session_id})}\n\n"
        
        result = await ChatService.process_user_message(
            session_id=session_id,
            user_message=message,
            user_id=current_user.id,
            db=db,
        )

        # Stream chunks of the response
        full_text = result.get("response_text", "")
        chunk_size = 15
        for i in range(0, len(full_text), chunk_size):
            chunk = full_text[i:i + chunk_size]
            yield f"event: token\ndata: {json.dumps({'token': chunk})}\n\n"
            await asyncio.sleep(0.01)

        # Emit completion metadata
        completion_data = {
            "is_emergency": result.get("is_emergency", False),
            "is_crisis": result.get("is_crisis", False),
            "safety_flags": result.get("safety_flags", {}),
            "amendment_proposal": result.get("amendment_proposal"),
        }
        yield f"event: end\ndata: {json.dumps(completion_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/proposals/confirm")
def confirm_amendment_proposal(
    req: ConfirmProposalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirms chat amendment proposal -> creates new revision + triggers deterministic re-triage."""
    res = ChatService.confirm_amendment_proposal(
        case_id=req.case_id,
        proposal_data=req.proposal_data,
        actor_id=current_user.id,
        db=db,
    )
    return res
