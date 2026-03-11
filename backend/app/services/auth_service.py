"""
app/services/auth_service.py
─────────────────────────────
Handles all authentication concerns:
  - Password hashing with bcrypt (via passlib)
  - JWT creation and verification
  - FastAPI dependency that resolves the current authenticated user

Security notes:
  - bcrypt auto-generates a salt per hash; no manual salting needed.
  - JWTs are signed with HS256 using a high-entropy SECRET_KEY.
  - Tokens have a short expiry (configurable) to limit exposure on theft.
  - We raise HTTP 401 (not 403) when a token is invalid/expired so as not
    to leak whether a resource exists.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenPayload

# ── Password Hashing ──────────────────────────────────────────────────────────
# bcrypt is the industry standard; deprecated=["auto"] means old schemes
# are automatically re-hashed on next login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 Scheme ─────────────────────────────────────────────────────────────
# FastAPI will extract the token from the "Authorization: Bearer <token>" header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password Utilities ────────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of the provided plaintext password."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time comparison between a plaintext password and its hash.
    Returns True if they match.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Utilities ─────────────────────────────────────────────────────────────

def create_access_token(
    user_id: uuid.UUID,
    settings: Settings,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        user_id:      The UUID of the authenticated user (becomes the `sub` claim).
        settings:     App settings (secret key, algorithm, expiry).
        expires_delta: Override the default token lifetime.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str, settings: Settings) -> TokenPayload:
    """
    Decode and validate a JWT access token.

    Raises:
        HTTPException 401 if the token is invalid, expired, or malformed.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: str = payload.get("sub")
        exp: int = payload.get("exp")
        if user_id is None or exp is None:
            raise credentials_exception
        return TokenPayload(sub=user_id, exp=exp)
    except JWTError:
        raise credentials_exception


# ── FastAPI Dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """
    FastAPI dependency that validates the Bearer token and returns the
    corresponding User ORM object.

    Usage:
        async def my_route(user: User = Depends(get_current_user)): ...
    """
    token_data = decode_access_token(token, settings)

    try:
        user_uuid = uuid.UUID(token_data.sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )
    return user
