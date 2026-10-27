import hashlib
import os
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_DEFAULTS = {
    "dev-insecure-secret-key-change-me",
    "temporary-dev-secret-key-change-in-production",
}


class Settings(BaseSettings):
    PROJECT_NAME: str = "MediTriage AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Security
    SECRET_KEY: str = "dev-secret-key-meditriage-secure-local-2026-audit"
    AUDIT_HMAC_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./meditriage.db"
    SQL_ECHO: bool = False

    # Skin / wound image triage (Triage Flow module)
    SKIN_MODEL_PATH: str = ""  # Keras DermNet ResNet weights; empty => classifier unavailable (graceful degrade)
    SKIN_MAX_UPLOAD_BYTES: int = 5_000_000
    SKIN_MAX_ANALYSES_PER_CASE: int = 5

    # CORS
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    )

    # Transport / Rate limiting / Logging
    TRUSTED_PROXIES: str = "127.0.0.1,::1,localhost,testclient"
    RATE_LIMIT_BACKEND: str = "memory"
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "console"  # json | console

    # AI & LLM Settings
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    AI_MODEL_NAME: str = "gemini-flash-lite-latest"
    AI_PROMPT_VERSION: str = "v1.0-geriatric-differential"
    AI_DATA_MODE: str = "synthetic"  # synthetic | real (default synthetic)
    AI_PAID_TIER_ATTESTED: bool = False
    AI_TIMEOUT_SECONDS: float = 10.0
    AI_MAX_RETRIES: int = 2
    AI_CIRCUIT_BREAKER_FAILURES: int = 3
    AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS: float = 30.0
    AI_CACHE_TTL_SECONDS: int = 300
    DUAL_CONTROL_MODE: str = "demo"  # strict | demo (default demo)
    CONFIG_CACHE_TTL_SECONDS: int = 5  # max 5s TTL for governed config cache

    @property
    def docs_enabled(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_and_secrets(self) -> "Settings":
        if not self.SECRET_KEY or not self.SECRET_KEY.strip():
            raise ValueError("SECRET_KEY cannot be empty in any environment.")

        is_test = bool(os.environ.get("PYTEST_CURRENT_TEST"))

        # Derive AUDIT_HMAC_KEY in development or test if missing
        if not self.AUDIT_HMAC_KEY:
            if self.ENVIRONMENT == "development" or is_test:
                self.AUDIT_HMAC_KEY = hashlib.sha256(
                    b"audit:" + self.SECRET_KEY.encode("utf-8")
                ).hexdigest()
            else:
                raise ValueError("AUDIT_HMAC_KEY must be explicitly configured in non-development environments.")

        # Ensure AUDIT_HMAC_KEY never collides with SECRET_KEY
        if self.AUDIT_HMAC_KEY == self.SECRET_KEY:
            raise ValueError("AUDIT_HMAC_KEY cannot be identical to SECRET_KEY.")

        # Non-development enforcement
        if self.ENVIRONMENT != "development":
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters long in non-development environments.")
            if self.SECRET_KEY in KNOWN_DEFAULTS:
                raise ValueError("SECRET_KEY cannot be a known default string outside development.")
            if not is_test and "sqlite" in self.DATABASE_URL.lower():
                raise ValueError("SQLite is prohibited in non-development environments. Configure PostgreSQL.")
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError("Wildcard CORS origins ('*') are prohibited in non-development environments.")
            if not is_test and self.DUAL_CONTROL_MODE != "strict":
                raise ValueError("DUAL_CONTROL_MODE must be 'strict' in non-development environments.")
            if not self.AI_DATA_MODE or self.AI_DATA_MODE not in ("synthetic", "real"):
                raise ValueError("AI_DATA_MODE must be explicitly set to 'synthetic' or 'real'.")
            if not is_test:
                self.COOKIE_SECURE = True

        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
