"""
app/schemas/user.py
────────────────────
Pydantic v2 schemas for User input validation and API responses.
These are SEPARATE from the SQLAlchemy ORM model to enforce the
presentation/persistence boundary and prevent accidental password leakage.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Request Schemas ────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    """Validates user registration input."""
    email: EmailStr
    username: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_\-]+$",  # alphanumeric + _ -  only
        description="3-50 chars, letters/digits/underscore/hyphen only",
    )
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """Enforce basic complexity: at least one digit and one letter."""
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not has_letter or not has_digit:
            raise ValueError(
                "Password must contain at least one letter and one digit."
            )
        return v


class UserLoginRequest(BaseModel):
    """Validates login credentials.
    We accept email OR username in the 'username' field (OAuth2 password grant).
    """
    username: str  # OAuth2PasswordRequestForm field name
    password: str


# ── Response Schemas ───────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Safe user representation – never expose hashed_password."""
    id: uuid.UUID
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}  # Enables ORM → Pydantic conversion


class TokenResponse(BaseModel):
    """Returned after successful login / token refresh."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """Contents decoded from a JWT – used internally by auth dependencies."""
    sub: str  # user UUID as string
    exp: int  # expiry unix timestamp
