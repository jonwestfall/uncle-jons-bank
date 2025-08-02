import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import RecurringCharge, User, Child
from app.schemas import (
    RecurringChargeCreate,
    RecurringChargeRead,
    RecurringChargeUpdate,
)
from app.crud import (
    create_recurring_charge,
    get_recurring_charge,
    get_recurring_charges_by_child,
    save_recurring_charge,
    delete_recurring_charge,
)
from app.auth import (
    require_permissions,
    get_current_user,
    get_current_identity,
    get_current_child,
)
from app.acl import (
    PERM_ADD_RECURRING,
    PERM_EDIT_RECURRING,
    PERM_DELETE_RECURRING,
    PERM_VIEW_TRANSACTIONS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recurring", tags=["recurring"])


@router.post("/child/{child_id}", response_model=RecurringChargeRead)
async def add_recurring_charge(
    child_id: int,
    data: RecurringChargeCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_ADD_RECURRING)),
):
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    rc = RecurringCharge(
        child_id=child_id,
        amount=data.amount,
        memo=data.memo,
        interval_days=data.interval_days,
        next_run=data.next_run,
    )
    new_rc = await create_recurring_charge(db, rc)
    logger.info(
        "Recurring charge created for child %s by user %s", child_id, current_user.id
    )
    return new_rc


@router.get("/child/{child_id}", response_model=List[RecurringChargeRead])
async def list_recurring_charges(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    identity: tuple[str, Child | User] = Depends(get_current_identity),
):
    kind, obj = identity
    if kind == "child":
        child = obj
        if child.id != child_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        user: User = obj
        if user.role != "admin":
            user_perms = {p.name for p in user.permissions}
            if PERM_VIEW_TRANSACTIONS not in user_perms:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            from app.crud import get_children_by_user

            children = await get_children_by_user(db, user.id)
            if child_id not in [c.id for c in children]:
                raise HTTPException(status_code=404, detail="Child not found")
    return await get_recurring_charges_by_child(db, child_id)


@router.get("/mine", response_model=List[RecurringChargeRead])
async def list_my_recurring_charges(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    return await get_recurring_charges_by_child(db, child.id)


@router.put("/{charge_id}", response_model=RecurringChargeRead)
async def update_recurring_charge(
    charge_id: int,
    data: RecurringChargeUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_EDIT_RECURRING)),
):
    rc = await get_recurring_charge(db, charge_id)
    if not rc:
        raise HTTPException(status_code=404, detail="Recurring charge not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if rc.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rc, field, value)
    updated = await save_recurring_charge(db, rc)
    logger.info("Recurring charge %s updated by user %s", charge_id, current_user.id)
    return updated


@router.delete("/{charge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_charge_route(
    charge_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_DELETE_RECURRING)),
):
    rc = await get_recurring_charge(db, charge_id)
    if not rc:
        raise HTTPException(status_code=404, detail="Recurring charge not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if rc.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    await delete_recurring_charge(db, rc)
    logger.info("Recurring charge %s deleted by user %s", charge_id, current_user.id)
    return None
