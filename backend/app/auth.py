"""Authentication and authorization helpers.

This module centralizes password hashing, JWT handling and FastAPI
dependency utilities for enforcing roles and permissions. The functions
here are used across route handlers to ensure consistent security
behavior.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.database import get_session
from app.models import Child, RevokedToken, User

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
JWT_ISSUER = os.getenv("JWT_ISSUER", "uncle-jons-bank")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "uncle-jons-bank-api")
# Default token expiration in minutes, overridable via environment variable
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 14))
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def validate_auth_settings() -> None:
    """Validate required auth environment settings.

    Called from application startup to fail fast if deployment is insecure.
    """

    if not SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is required and must be set before application startup"
        )


def verify_password(plain_password, hashed_password):
    """Verify a plaintext password against a stored hash."""

    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """Hash a password for storage."""

    return pwd_context.hash(password)


async def authenticate_user(db: AsyncSession, email: str, password: str):
    """Return the user if credentials are valid, otherwise ``None``."""

    result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.permissions))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def _build_token(
    *,
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict | None = None,
) -> str:
    """Generate a signed JWT token with required standard claims."""

    validate_auth_settings()
    now = datetime.now(timezone.utc)
    to_encode = {
        "sub": subject,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": now + expires_delta,
        "jti": str(uuid4()),
        "type": token_type,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(
    *,
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """Generate a signed short-lived JWT access token."""

    return _build_token(
        subject=subject,
        token_type="access",
        expires_delta=expires_delta
        or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims=extra_claims,
    )


def create_refresh_token(
    *,
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """Generate a signed long-lived JWT refresh token."""

    return _build_token(
        subject=subject,
        token_type="refresh",
        expires_delta=expires_delta
        or timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES),
        extra_claims=extra_claims,
    )


async def revoke_token(
    db: AsyncSession,
    *,
    jti: str,
    token_type: str,
    subject: str,
    expires_at: datetime,
    reason: str | None = None,
) -> RevokedToken:
    """Persist a revoked token identifier in the server-side block list."""

    existing = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    record = existing.scalar_one_or_none()
    if record:
        return record
    revoked = RevokedToken(
        jti=jti,
        token_type=token_type,
        subject=subject,
        expires_at=expires_at,
        reason=reason,
    )
    db.add(revoked)
    await db.commit()
    await db.refresh(revoked)
    return revoked


async def is_token_revoked(db: AsyncSession, jti: str) -> bool:
    """Return ``True`` if a token identifier has been revoked."""

    result = await db.execute(select(RevokedToken.id).where(RevokedToken.jti == jti))
    return result.first() is not None


async def purge_expired_revocations(db: AsyncSession) -> None:
    """Delete revocation records that have already expired."""

    now = datetime.now(timezone.utc)
    result = await db.execute(select(RevokedToken).where(RevokedToken.expires_at < now))
    for record in result.scalars().all():
        await db.delete(record)
    await db.commit()


async def decode_and_validate_token(
    db: AsyncSession,
    token: str,
    *,
    expected_type: str | None = "access",
) -> dict:
    """Decode JWT, validate standard claims and revocation status."""

    validate_auth_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require_exp": True, "require_iat": True, "require_nbf": True},
        )
    except JWTError as exc:
        raise credentials_exception from exc

    sub = payload.get("sub")
    jti = payload.get("jti")
    token_type = payload.get("type")
    if not sub or not jti or not token_type:
        raise credentials_exception
    if expected_type and token_type != expected_type:
        raise credentials_exception

    if await is_token_revoked(db, jti):
        raise credentials_exception
    return payload


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    payload = await decode_and_validate_token(db, token, expected_type="access")
    sub: str = payload["sub"]
    if not sub.startswith("user:"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    try:
        user_id = int(sub.split(":", 1)[1])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.permissions))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user


def require_role(*roles: str):
    """Dependency factory to require a user role."""

    async def role_dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency


def require_permissions(*perms: str):
    """Dependency factory to require one or more permissions."""

    async def perm_dependency(current_user: User = Depends(get_current_user)):
        if current_user.role == "admin":
            return current_user
        user_perms = {p.name for p in current_user.permissions}
        for perm in perms:
            if perm not in user_perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions",
                )
        return current_user

    return perm_dependency


async def get_current_identity(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
) -> tuple[str, User | Child]:
    """Return ("user", User) or ("child", Child) based on token subject."""

    payload = await decode_and_validate_token(db, token, expected_type="access")
    sub: str = payload["sub"]

    if sub.startswith("child:"):
        try:
            child_id = int(sub.split(":", 1)[1])
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            ) from exc
        child = await get_child_by_id(db, child_id)
        if child is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return "child", child

    if sub.startswith("user:"):
        try:
            user_id = int(sub.split(":", 1)[1])
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            ) from exc
        result = await db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.permissions))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return "user", user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )


async def get_child_by_id(db: AsyncSession, child_id: int):
    result = await db.execute(select(Child).where(Child.id == child_id))
    return result.scalars().first()


async def get_current_child(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    payload = await decode_and_validate_token(db, token, expected_type="access")
    sub: str = payload["sub"]
    if not sub.startswith("child:"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    try:
        child_id = int(sub.split(":", 1)[1])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
    child = await get_child_by_id(db, child_id)
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return child
