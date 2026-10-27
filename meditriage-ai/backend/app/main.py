import uuid
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import request_id_ctx, setup_logging

setup_logging(level=settings.LOG_LEVEL, log_format=settings.LOG_FORMAT)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "MediTriage AI is a clinical decision-support prototype tailored for geriatric "
        "triage and emergency resource optimization. It is NOT a diagnostic replacement."
    ),
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.docs_enabled else None,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
)


class SecurityHeadersMiddleware:
    """Pure-ASGI middleware adding defense-in-depth HTTP security headers."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_dict = {
            k.decode("latin1").lower(): v.decode("latin1")
            for k, v in scope.get("headers", [])
        }
        req_id = headers_dict.get("x-request-id") or str(uuid.uuid4())
        token = request_id_ctx.set(req_id)
        path = scope.get("path", "")

        async def send_with_security_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                sec_headers = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"permissions-policy", b"camera=(), microphone=(self), geolocation=()"),
                    (b"cross-origin-opener-policy", b"same-origin"),
                    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
                    (b"x-request-id", req_id.encode("latin1")),
                ]
                if path.startswith("/api/v1"):
                    sec_headers.append((b"cache-control", b"no-store"))
                if settings.ENVIRONMENT == "production":
                    sec_headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))

                headers.extend(sec_headers)
                message["headers"] = headers

            await send(message)

        try:
            await self.app(scope, receive, send_with_security_headers)
        finally:
            request_id_ctx.reset(token)


app.add_middleware(SecurityHeadersMiddleware)

# Explicit CORS allowlist with restricted methods and headers
if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )

# Include API v1 routes
from app.api.v1.router import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify backend operational status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["System"])
async def root():
    """Root endpoint with project metadata and clinical disclaimer."""
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "disclaimer": "Clinical decision-support prototype only. Not for diagnostic use or emergency substitution.",
        "docs_url": "/docs",
    }
