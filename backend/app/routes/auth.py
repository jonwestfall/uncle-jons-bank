# app/routes/auth.py
"""Authentication endpoints: login, refresh, logout, and registration."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from sqlmodel import select

from app.auth import (
    authenticate_user,
    create_token_pair,
    decode_and_validate_token,
    parse_subject,
    revoke_token_from_payload,
    verify_password,
    oauth2_scheme,
)
from app.crud import create_user, get_settings
from app.database import get_session
from app.models import Child, User
from app.schemas.user import UserCreate, UserLogin, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


@router.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session),
):
    """OAuth2 password flow used by interactive docs and external clients."""

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning("Failed OAuth login for %s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_invalid_credentials",
                "message": "Invalid email or password",
            },
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "auth_account_pending",
                "message": "Account awaiting approval",
            },
        )
    logger.info("User %s logged in via OAuth form", user.email)
    return create_token_pair(subject=f"user:{user.id}")


@router.post("/login")
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_session)):
    """JSON-based login used by the frontend."""

    user = await authenticate_user(db=db, email=user_in.email, password=user_in.password)
    if not user:
        logger.warning("Failed login for %s", user_in.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_invalid_credentials",
                "message": "Invalid email or password",
            },
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "auth_account_pending",
                "message": "Account awaiting approval",
            },
        )
    logger.info("User %s logged in", user.email)
    return create_token_pair(subject=f"user:{user.id}")


@router.post("/refresh")
async def refresh_tokens(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_session),
):
    """Rotate a valid refresh token and issue a new token pair."""

    payload = await decode_and_validate_token(data.refresh_token, db, expected_type="refresh")

    try:
        kind, entity_id = parse_subject(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if kind == "user":
        result = await db.execute(
            select(User)
            .where(User.id == entity_id)
            .options(selectinload(User.permissions))
        )
        user = result.scalar_one_or_none()
        if not user or user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    else:
        result = await db.execute(select(Child).where(Child.id == entity_id))
        child = result.scalar_one_or_none()
        if not child or child.account_frozen:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

    await revoke_token_from_payload(db, payload, reason="refresh_rotation")
    return create_token_pair(subject=payload["sub"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: LogoutRequest | None = None,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_session),
):
    """Revoke the current access token and optional refresh token."""

    access_payload = await decode_and_validate_token(token, db, expected_type="access")
    await revoke_token_from_payload(db, access_payload, reason="logout")

    if data and data.refresh_token:
        refresh_payload = await decode_and_validate_token(
            data.refresh_token,
            db,
            expected_type="refresh",
        )
        if refresh_payload.get("sub") != access_payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refresh token subject does not match access token",
            )
        await revoke_token_from_payload(db, refresh_payload, reason="logout")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/needs-admin")
async def needs_admin(db: AsyncSession = Depends(get_session)):
    """Return ``True`` if no users exist and an admin must be created."""

    result = await db.execute(select(func.count()).select_from(User))
    return {"needs_admin": result.scalar() == 0}


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_session)):
    """Register a new parent account or create the initial admin."""

    result = await db.execute(select(func.count()).select_from(User))
    is_first_user = result.scalar() == 0

    if not is_first_user:
        settings = await get_settings(db)
        if settings.public_registration_disabled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registration disabled",
            )

    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "auth_email_registered",
                "message": "Email is already registered.",
            },
        )

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=user_in.password,
        role="admin" if is_first_user else "parent",
        status="active" if is_first_user else "pending",
    )
    new_user = await create_user(db, new_user)
    logger.info(
        "User %s registered%s",
        new_user.email,
        " as initial admin" if is_first_user else "",
    )
    return new_user
