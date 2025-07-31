from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ChildCreate, ChildRead, ChildLogin
from app.models import Child, User
from app.database import get_session
from app.crud import (
    create_child_for_user,
    get_children_by_user,
    get_child_by_id,
    get_child_by_access_code,
)
from app.auth import (
    get_current_user,
    require_role,
    create_access_token,
)

router = APIRouter(prefix="/children", tags=["children"])

@router.post("/", response_model=ChildRead)
async def create_child_route(
    child: ChildCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    existing = await get_child_by_access_code(db, child.access_code)
    if existing:
        raise HTTPException(status_code=400, detail="Access code already in use")
    child_model = Child(
        first_name=child.first_name,
        access_code=child.access_code,
        account_frozen=child.frozen,
    )
    return await create_child_for_user(db, child_model, current_user.id)


@router.get("/", response_model=list[ChildRead])
async def list_children(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    return await get_children_by_user(db, current_user.id)


@router.get("/{child_id}", response_model=ChildRead)
async def get_child_route(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    return child


@router.post("/login")
async def child_login(
    credentials: ChildLogin,
    db: AsyncSession = Depends(get_session),
):
    child = await get_child_by_access_code(db, credentials.access_code)
    if not child:
        raise HTTPException(status_code=401, detail="Invalid access code")
    token = create_access_token(
        data={"sub": f"child:{child.id}"}, expires_delta=timedelta(minutes=60)
    )
    return {"access_token": token, "token_type": "bearer"}
