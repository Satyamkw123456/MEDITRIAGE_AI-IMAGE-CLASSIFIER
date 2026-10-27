from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.consent import router as consent_router
from app.api.v1.cases import router as cases_router
from app.api.v1.admin import router as admin_router
from app.api.v1.chat import router as chat_router
from app.api.v1.ai_hub import router as ai_hub_router
from app.api.v1.patient_extras import router as patient_extras_router
from app.api.v1.skin_triage import router as skin_triage_router

api_router = APIRouter()

# Register authentication and RBAC endpoints
api_router.include_router(auth_router)

# Register Consent and Legal Disclaimer endpoints
api_router.include_router(consent_router)

# Register Patient Intake and Cases endpoints
api_router.include_router(cases_router)

# Register Admin endpoints
api_router.include_router(admin_router, prefix="/admin")

# Register Chat endpoints
api_router.include_router(chat_router, prefix="/chat", tags=["Chat"])

# Register AI Hub endpoints
api_router.include_router(ai_hub_router, prefix="/ai-hub", tags=["AI Hub"])

# Register Patient Extras (Emergency Card, Caregivers, Public Resources)
api_router.include_router(patient_extras_router)

# Register Skin & Wound Image Triage (Triage Flow module)
api_router.include_router(skin_triage_router)
