from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ChildCreate, ChildRead
from app.models import Child, User
from app.database import get_session
from app.crud import create_child_for_user
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/children", tags=["children"])

@router.post("/", response_model=ChildRead)
async def create_child_route(
    child: ChildCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child_model = Child(
        first_name=child.first_name,
        access_code=child.access_code,
        account_frozen=child.frozen,
    )
    return await create_child_for_user(db, child_model, current_user.id)
