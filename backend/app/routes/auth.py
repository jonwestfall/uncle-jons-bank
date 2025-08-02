# app/routes/auth.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import (
    create_access_token,
    get_password_hash,
    verify_password,
    authenticate_user,
)
from app.database import get_session
from app.models import User

from sqlmodel import select
from app.schemas.user import UserCreate, UserResponse, UserLogin
from datetime import timedelta

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session),
):
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
    logger.info("User %s logged in via OAuth form", user.email)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=60)
    )
    return {"access_token": access_token, "token_type": "bearer"}



@router.post("/login")
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_session)):
    user = await authenticate_user(
        db=db, email=user_in.email, password=user_in.password
    )
    if not user:
        logger.warning("Failed login for %s", user_in.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_invalid_credentials",
                "message": "Invalid email or password",
            },
        )
    logger.info("User %s logged in", user.email)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=60)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_session)):
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

    hashed_pw = get_password_hash(user_in.password)

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pw,
        role="parent"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info("User %s registered", new_user.email)

    return new_user

