"""
app/routers/auth.py
────────────────────
Authentication endpoints:
  POST /api/auth/register  – Create a new account
  POST /api/auth/login     – Exchange credentials for a JWT
  GET  /api/auth/me        – Return the currently authenticated user

Security notes:
  - Registration and login share the same generic error message for unknown
    email/wrong password to prevent user-enumeration attacks.
  - Passwords are never logged or returned.
  - `last_login_at` is updated on every successful login for audit purposes.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenResponse, UserRegisterRequest, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Generic error used for both "user not found" and "wrong password" to
# prevent email-enumeration attacks.
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password.",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Create a new user.

    - Validates email format and password complexity via Pydantic.
    - Hashes the password with bcrypt before persistence.
    - Returns HTTP 409 if the email or username is already taken.
    """
    hashed = hash_password(payload.password)
    user = User(
        email=payload.email.lower().strip(),
        username=payload.username,
        hashed_password=hashed,
    )
    db.add(user)
    try:
        await db.flush()   # Detect constraint violations before commit
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email or username already exists.",
        )
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT access token",
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    """
    OAuth2 password grant flow.
    `username` field accepts either the registered email address or username.
    """
    # Support login by email OR username
    identifier = form_data.username.lower().strip()
    result = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.username == identifier)
        )
    )
    user = result.scalar_one_or_none()

    # Deliberate: same error whether user is missing or password is wrong
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise _INVALID_CREDENTIALS

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact support.",
        )

    # ── Update last login timestamp ────────────────────────────────────────
    user.last_login_at = datetime.now(timezone.utc)

    # ── Issue JWT ──────────────────────────────────────────────────────────
    token = create_access_token(user.id, settings)
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return the currently authenticated user's profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> User:
    """Protected endpoint – requires a valid Bearer token."""
    return current_user
