"""Authentication and authorization helpers.

This module centralizes password hashing, JWT handling and FastAPI
dependency utilities for enforcing roles and permissions.  The functions
here are used across route handlers to ensure consistent security
behavior.
"""

import base64
import hashlib
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.models import User, Child
from app.database import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import os

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"
# Default token expiration in minutes, overridable via environment variable
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def _to_bytes(value: str) -> bytes:
    return value.encode("utf-8")


def _prehash_password(password: str) -> bytes:
    """Pre-hash plaintext so bcrypt can support long passwords safely."""

    digest = hashlib.sha256(_to_bytes(password)).digest()
    return base64.b64encode(digest)


def is_password_hash(value: str) -> bool:
    """Return True when value looks like a bcrypt hash."""

    return value.startswith("$2")


def verify_password(plain_password, hashed_password):
    """Verify a plaintext password against a stored hash."""

    try:
        hashed_bytes = _to_bytes(hashed_password)
        # Preferred verification path for newly-created hashes.
        if bcrypt.checkpw(_prehash_password(plain_password), hashed_bytes):
            return True
        # Legacy compatibility for older hashes stored from raw bcrypt input.
        legacy_plain = _to_bytes(plain_password)[:72]
        return bcrypt.checkpw(legacy_plain, hashed_bytes)
    except (ValueError, TypeError):
        return False


def get_password_hash(password):
    """Hash a password for storage."""

    return bcrypt.hashpw(
        _prehash_password(password),
        bcrypt.gensalt(),
    ).decode("utf-8")


from sqlmodel import select


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


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Generate a signed JWT token containing ``data``."""

    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.permissions))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
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
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if not sub:
            raise credentials_exception
        if sub.startswith("child:"):
            child_id = int(sub.split(":", 1)[1])
            child = await get_child_by_id(db, child_id)
            if child is None:
                raise credentials_exception
            return "child", child
        else:
            result = await db.execute(
                select(User)
                .where(User.email == sub)
                .options(selectinload(User.permissions))
            )
            user = result.scalar_one_or_none()
            if user is None:
                raise credentials_exception
            return "user", user
    except (JWTError, ValueError):
        raise credentials_exception


async def get_child_by_id(db: AsyncSession, child_id: int):
    result = await db.execute(select(Child).where(Child.id == child_id))
    return result.scalars().first()


async def get_current_child(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if not sub or not sub.startswith("child:"):
            raise credentials_exception
        child_id = int(sub.split(":", 1)[1])
    except (JWTError, ValueError):
        raise credentials_exception
    child = await get_child_by_id(db, child_id)
    if child is None:
        raise credentials_exception
    return child
