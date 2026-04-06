"""Authentication and authorization helpers.

This module centralizes password hashing, JWT handling and FastAPI
dependency utilities for enforcing roles and permissions.
"""

import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.database import get_session
from app.models import Child, RevokedToken, User


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


SECRET_KEY = _require_env("SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "uncle-jons-bank")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "uncle-jons-bank-api")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 14))
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def _to_bytes(value: str) -> bytes:
    return value.encode("utf-8")


def _prehash_password(password: str) -> bytes:
    """Pre-hash plaintext so bcrypt can support long passwords safely."""

    digest = hashlib.sha256(_to_bytes(password)).digest()
    return base64.b64encode(digest)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_password_hash(value: str) -> bool:
    """Return ``True`` when value looks like a bcrypt hash."""

    return value.startswith("$2")


def verify_password(plain_password, hashed_password):
    """Verify a plaintext password against a stored hash."""

    try:
        hashed_bytes = _to_bytes(hashed_password)
        if bcrypt.checkpw(_prehash_password(plain_password), hashed_bytes):
            return True
        legacy_plain = _to_bytes(plain_password)[:72]
        return bcrypt.checkpw(legacy_plain, hashed_bytes)
    except (ValueError, TypeError):
        return False


def get_password_hash(password):
    """Hash a password for storage."""

    return bcrypt.hashpw(_prehash_password(password), bcrypt.gensalt()).decode("utf-8")


async def authenticate_user(db: AsyncSession, email: str, password: str):
    """Return the user if credentials are valid, otherwise ``None``."""

    result = await db.execute(
        select(User).where(User.email == email).options(selectinload(User.permissions))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def _build_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict | None = None,
) -> str:
    now = _utcnow()
    payload = {
        "sub": subject,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
        "typ": token_type,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Generate a signed access JWT token from ``data``."""

    subject = data.get("sub")
    if not subject:
        raise ValueError("JWT subject (sub) is required")
    extra_claims = {k: v for k, v in data.items() if k != "sub"}
    return _build_token(
        subject=subject,
        token_type="access",
        expires_delta=expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims=extra_claims,
    )


def create_refresh_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Generate a signed refresh JWT token for ``subject``."""

    return _build_token(
        subject=subject,
        token_type="refresh",
        expires_delta=expires_delta or timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES),
    )


def create_token_pair(subject: str) -> dict[str, str]:
    """Issue an access/refresh token pair for a stable subject id."""

    return {
        "access_token": create_access_token({"sub": subject}),
        "refresh_token": create_refresh_token(subject),
        "token_type": "bearer",
    }


async def is_token_revoked(db: AsyncSession, jti: str) -> bool:
    result = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    return result.scalar_one_or_none() is not None


async def revoke_token(
    db: AsyncSession,
    jti: str,
    subject: str,
    token_type: str,
    expires_at: datetime,
    reason: str = "manual",
) -> RevokedToken:
    result = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    revoked = RevokedToken(
        jti=jti,
        subject=subject,
        token_type=token_type,
        reason=reason,
        expires_at=expires_at.astimezone(timezone.utc).replace(tzinfo=None),
        revoked_at=_utcnow().replace(tzinfo=None),
    )
    db.add(revoked)
    await db.commit()
    await db.refresh(revoked)
    return revoked


async def revoke_token_from_payload(
    db: AsyncSession,
    payload: dict,
    reason: str = "manual",
) -> RevokedToken:
    exp = payload.get("exp")
    if exp is None:
        raise ValueError("Token payload missing exp")
    expires_at = datetime.fromtimestamp(int(exp), tz=timezone.utc)
    return await revoke_token(
        db=db,
        jti=payload["jti"],
        subject=payload["sub"],
        token_type=payload.get("typ", "unknown"),
        expires_at=expires_at,
        reason=reason,
    )


async def purge_expired_revoked_tokens(db: AsyncSession) -> int:
    result = await db.execute(
        select(RevokedToken).where(RevokedToken.expires_at < _utcnow().replace(tzinfo=None))
    )
    expired = result.scalars().all()
    if not expired:
        return 0
    for record in expired:
        await db.delete(record)
    await db.commit()
    return len(expired)


def parse_subject(subject: str) -> tuple[str, int]:
    """Return token subject as ``(kind, id)`` where kind is user/child."""

    if not subject or ":" not in subject:
        raise ValueError("Malformed subject")
    kind, raw_id = subject.split(":", 1)
    if kind not in {"user", "child"}:
        raise ValueError("Unsupported subject kind")
    entity_id = int(raw_id)
    if entity_id <= 0:
        raise ValueError("Invalid subject id")
    return kind, entity_id


async def decode_and_validate_token(
    token: str,
    db: AsyncSession,
    expected_type: str | None = "access",
) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={
                "require_sub": True,
                "require_exp": True,
                "require_iat": True,
                "require_nbf": True,
                "require_iss": True,
                "require_aud": True,
                "require_jti": True,
            },
        )
    except JWTError:
        raise credentials_exception

    if expected_type and payload.get("typ") != expected_type:
        raise credentials_exception

    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti:
        raise credentials_exception

    if await is_token_revoked(db, jti):
        raise credentials_exception

    return payload


async def get_child_by_id(db: AsyncSession, child_id: int):
    result = await db.execute(select(Child).where(Child.id == child_id))
    return result.scalars().first()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    payload = await decode_and_validate_token(token, db, expected_type="access")
    try:
        kind, entity_id = parse_subject(payload.get("sub", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if kind != "user":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    result = await db.execute(
        select(User).where(User.id == entity_id).options(selectinload(User.permissions))
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
    """Return ("user", User) or ("child", Child) based on JWT subject."""

    payload = await decode_and_validate_token(token, db, expected_type="access")
    try:
        kind, entity_id = parse_subject(payload.get("sub", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if kind == "child":
        child = await get_child_by_id(db, entity_id)
        if child is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return "child", child

    result = await db.execute(
        select(User).where(User.id == entity_id).options(selectinload(User.permissions))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return "user", user


async def get_current_child(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    payload = await decode_and_validate_token(token, db, expected_type="access")
    try:
        kind, entity_id = parse_subject(payload.get("sub", ""))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    if kind != "child":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    child = await get_child_by_id(db, entity_id)
    if child is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return child
