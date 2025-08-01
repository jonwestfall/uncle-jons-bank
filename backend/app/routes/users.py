from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import UserCreate, UserResponse, UserMeResponse
from app.models import User
from app.database import get_session
from app.crud import create_user, get_user_by_email
from app.auth import get_password_hash, require_role, get_current_user

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


@router.get("/me", response_model=UserMeResponse)
async def read_current_user(current_user: User = Depends(get_current_user)):
    """Return details for the authenticated user."""
    return UserMeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        permissions=[p.name for p in current_user.permissions],
    )
