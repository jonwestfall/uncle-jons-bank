from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import UserCreate, UserRead
from app.models import User
from app.database import get_session
from app.crud import create_user, get_user_by_email

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserRead)
async def create_user_route(user: UserCreate, db: AsyncSession = Depends(get_session)):
    existing = await get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_model = User(name=user.name, email=user.email, password_hash=user.password)  # Hash later!
    return await create_user(db, user_model)
