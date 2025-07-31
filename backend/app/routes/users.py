from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import UserCreate, UserResponse
from app.models import User
from app.database import get_session
from app.crud import create_user, get_user_by_email
from app.auth import get_password_hash, require_role

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse)
async def create_user_route(
    user: UserCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    existing = await get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = get_password_hash(user.password)
    user_model = User(name=user.name, email=user.email, password_hash=hashed)
    return await create_user(db, user_model)
