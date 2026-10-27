from typing import Dict, Any
import logging
from sqlalchemy.orm import Session

from app.models.chat import ChatSession, ChatMessage, get_utc_now
from app.models.domain_substrate import JobRun


logger = logging.getLogger(__name__)


class JobScheduler:
    """
    Minimal JobScheduler port supporting background administrative jobs and retention policies.
    Records all job execution metadata in the job_runs substrate table.
    """

    @classmethod
    def run_retention_purge_job(cls, db: Session) -> Dict[str, Any]:
        """
        Scans soft-deleted records (chat_sessions, medications, etc.)
        where deleted_at IS NOT NULL and purge_after <= now, then hard-deletes them.
        """
        now = get_utc_now()
        job_run = JobRun(
            job_name="chat_retention_purge",
            status="RUNNING",
            payload={"started_at": now.isoformat()},
            created_at=now,
        )
        db.add(job_run)
        db.commit()
        db.refresh(job_run)

        purged_sessions = 0
        purged_messages = 0

        try:
            # 1. Find expired soft-deleted sessions
            expired_sessions = (
                db.query(ChatSession)
                .filter(ChatSession.deleted_at.isnot(None))
                .filter(ChatSession.purge_after <= now)
                .all()
            )

            purged_sessions = len(expired_sessions)
            for s in expired_sessions:
                # Count and delete related messages
                msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
                purged_messages += msg_count
                db.delete(s)

            db.commit()

            job_run.status = "COMPLETED"
            job_run.payload = {
                "started_at": now.isoformat(),
                "completed_at": get_utc_now().isoformat(),
                "purged_sessions_count": purged_sessions,
                "purged_messages_count": purged_messages,
            }
            db.commit()

            return {
                "status": "success",
                "job_run_id": job_run.id,
                "purged_sessions": purged_sessions,
                "purged_messages": purged_messages,
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Retention purge job failed: {e}")
            job_run.status = "FAILED"
            job_run.payload = {
                "started_at": now.isoformat(),
                "error": str(e),
            }
            db.commit()
            return {"status": "failed", "error": str(e)}
