from typing import Optional, Literal, List
from pydantic import BaseModel, EmailStr, Field, model_validator
from app.core.password_policy import validate_password_strength

UserRole = Literal["patient", "caregiver", "clinician", "admin", "super_admin", "ops_admin"]
PublicRegisterRole = Literal["patient", "caregiver"]


class PatientProfileOut(BaseModel):
    id: int
    user_id: int
    age: Optional[int] = None
    sex: Optional[str] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    permissions: List[str] = []
    patient_profile: Optional[PatientProfileOut] = None
    profile: Optional[PatientProfileOut] = None

    model_config = {"from_attributes": True}


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: EmailStr = Field(..., description="Valid Email Address")
    password: str = Field(..., min_length=10, max_length=128, description="Password (min 10 characters)")
    role: PublicRegisterRole = Field(default="patient", description="User role: patient or caregiver")

    # Optional patient demographic fields auto-populated into PatientProfile on registration
    age: Optional[int] = Field(default=None, ge=0, le=130, description="Age in years")
    sex: Optional[str] = Field(default=None, max_length=50, description="Biological sex / gender")
    medical_history: Optional[str] = Field(default=None, description="Known chronic conditions & medications")
    allergies: Optional[str] = Field(default=None, description="Known allergies")

    @model_validator(mode="after")
    def validate_registration_payload(self) -> "UserRegister":
        self.email = self.email.strip().lower()
        validate_password_strength(self.password, self.email)
        return self


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Registered Email")
    password: str = Field(..., description="Account Password")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    mfa_required: bool = False
    mfa_token: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    jti: Optional[str] = None
    iss: Optional[str] = None
    aud: Optional[str] = None


class MfaEnrollOut(BaseModel):
    secret: str
    otpauth_uri: str


class MfaVerifyInput(BaseModel):
    code: str
    secret: Optional[str] = None


class MfaChallengeInput(BaseModel):
    mfa_token: str
    code: str
