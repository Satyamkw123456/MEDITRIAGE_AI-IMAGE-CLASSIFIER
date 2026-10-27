import contextvars
import json
import logging
import re
from typing import Any, Dict

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")

# Redaction patterns
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{9}\b")
AADHAAR_REGEX = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
JWT_REGEX = re.compile(r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+")
AUTH_BEARER_REGEX = re.compile(r"Bearer\s+[a-zA-Z0-9_\-\.]+", re.IGNORECASE)
PASSWORD_REGEX = re.compile(r"('password'|\"password\"|password)\s*[:=]\s*['\"][^'\"]+['\"]", re.IGNORECASE)
CHIEF_COMPLAINT_REGEX = re.compile(r"('chief_complaint'|\"chief_complaint\"|chief_complaint)\s*[:=]\s*['\"][^'\"]+['\"]", re.IGNORECASE)


class PHIRedactionFilter(logging.Filter):
    """
    Filters and redacts protected health information (PHI) and sensitive credentials
    from log records: emails, phones, JWTs, 12-digit numbers, chief_complaint, passwords.
    """

    @classmethod
    def redact_text(cls, text: str) -> str:
        if not text:
            return text
        text = AUTH_BEARER_REGEX.sub("Bearer [REDACTED_TOKEN]", text)
        text = JWT_REGEX.sub("[REDACTED_JWT]", text)
        text = EMAIL_REGEX.sub("[REDACTED_EMAIL]", text)
        text = PHONE_REGEX.sub("[REDACTED_PHONE]", text)
        text = AADHAAR_REGEX.sub("[REDACTED_IDENTIFIER]", text)
        text = PASSWORD_REGEX.sub(r'\1: "[REDACTED_PASSWORD]"', text)
        text = CHIEF_COMPLAINT_REGEX.sub(r'\1: "[REDACTED_PHI]"', text)
        return text

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.redact_text(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self.redact_text(str(v)) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self.redact_text(str(a)) if isinstance(a, str) else a for a in record.args)
        record.request_id = request_id_ctx.get()
        return True


class JSONLogFormatter(logging.Formatter):
    """Formats log records as structured single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "") or request_id_ctx.get(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(level: str = "INFO", log_format: str = "console"):
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)

    handler = logging.StreamHandler()
    phi_filter = PHIRedactionFilter()
    handler.addFilter(phi_filter)

    if log_format.lower() == "json":
        handler.setFormatter(JSONLogFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("[%(asctime)s] [%(levelname)s] [%(request_id)s] %(name)s: %(message)s")
        )

    root_logger.addHandler(handler)
