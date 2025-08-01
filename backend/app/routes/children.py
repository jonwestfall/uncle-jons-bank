from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ChildCreate, ChildRead, ChildLogin, InterestRateUpdate
from app.models import Child, User
from app.database import get_session
from app.crud import (
    create_child_for_user,
    get_children_by_user,
    get_child_by_id,
    get_child_by_access_code,
    set_child_frozen,
    set_interest_rate,
    get_account_by_child,
    recalc_interest,
)
from app.acl import Permission, require_permission
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
    current_user: User = Depends(require_permission(Permission.ADD_CHILD)),
):
    existing = await get_child_by_access_code(db, child.access_code)
    if existing:
        raise HTTPException(status_code=400, detail="Access code already in use")
    child_model = Child(
        first_name=child.first_name,
        access_code=child.access_code,
        account_frozen=child.frozen,
    )
    new_child = await create_child_for_user(db, child_model, current_user.id)
    account = await get_account_by_child(db, new_child.id)
    return ChildRead(
        id=new_child.id,
        first_name=new_child.first_name,
        account_frozen=new_child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.get("/", response_model=list[ChildRead])
async def list_children(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    children = await get_children_by_user(db, current_user.id)
    result = []
    for c in children:
        account = await get_account_by_child(db, c.id)
        result.append(
            ChildRead(
                id=c.id,
                first_name=c.first_name,
                account_frozen=c.account_frozen,
                interest_rate=account.interest_rate if account else None,
                total_interest_earned=(
                    account.total_interest_earned if account else None
                ),
            )
        )
    return result


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
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/{child_id}/freeze", response_model=ChildRead)
async def freeze_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission(Permission.MANAGE_FREEZE)),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    updated = await set_child_frozen(db, child_id, True)
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/{child_id}/unfreeze", response_model=ChildRead)
async def unfreeze_child(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission(Permission.MANAGE_FREEZE)),
):
    child = await get_child_by_id(db, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    updated = await set_child_frozen(db, child_id, False)
    account = await get_account_by_child(db, child_id)
    return ChildRead(
        id=updated.id,
        first_name=updated.first_name,
        account_frozen=updated.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.put("/{child_id}/interest-rate", response_model=ChildRead)
async def update_interest_rate(
    child_id: int,
    data: InterestRateUpdate,
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
    account = await set_interest_rate(db, child_id, data.interest_rate)
    await recalc_interest(db, child_id)
    return ChildRead(
        id=child.id,
        first_name=child.first_name,
        account_frozen=child.account_frozen,
        interest_rate=account.interest_rate if account else None,
        total_interest_earned=account.total_interest_earned if account else None,
    )


@router.post("/login")
async def child_login(
    credentials: ChildLogin,
    db: AsyncSession = Depends(get_session),
):
    child = await get_child_by_access_code(db, credentials.access_code)
    if not child:
        raise HTTPException(status_code=401, detail="Invalid access code")
    if child.account_frozen:
        raise HTTPException(status_code=403, detail="Account is frozen")
    token = create_access_token(
        data={"sub": f"child:{child.id}"}, expires_delta=timedelta(minutes=60)
    )
    return {"access_token": token, "token_type": "bearer"}
