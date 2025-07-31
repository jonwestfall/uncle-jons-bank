from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ChildCreate, ChildRead
from app.models import Child
from app.database import get_session
from app.crud import create_child

router = APIRouter(prefix="/children", tags=["children"])

@router.post("/", response_model=ChildRead)
async def create_child_route(child: ChildCreate, db: AsyncSession = Depends(get_session)):
    child_model = Child(**child.dict(), user_id=1)  # TODO: use real user_id later
    return await create_child(db, child_model)
