import logging
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Chore, User, Child, Transaction
from app.schemas import ChoreCreate, ChoreRead, ChoreUpdate
from app.crud import (
    create_chore,
    get_chore,
    get_chores_by_child,
    save_chore,
    delete_chore,
    create_transaction,
)
from app.auth import (
    get_current_user,
    get_current_child,
    get_current_identity,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chores", tags=["chores"])


@router.post("/child/{child_id}", response_model=ChoreRead)
async def add_chore(
    child_id: int,
    data: ChoreCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    chore = Chore(
        child_id=child_id,
        description=data.description,
        amount=data.amount,
        interval_days=data.interval_days,
        next_due=data.next_due or date.today(),
        status="pending",
        active=True,
    )
    new_chore = await create_chore(db, chore)
    logger.info("Chore created for child %s by user %s", child_id, current_user.id)
    return new_chore


@router.post("/propose", response_model=ChoreRead)
async def propose_chore(
    data: ChoreCreate,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    chore = Chore(
        child_id=child.id,
        description=data.description,
        amount=data.amount,
        interval_days=data.interval_days,
        next_due=data.next_due or date.today(),
        status="proposed",
        active=False,
        created_by_child=True,
    )
    new_chore = await create_chore(db, chore)
    logger.info("Chore proposed by child %s", child.id)
    return new_chore


@router.get("/child/{child_id}", response_model=List[ChoreRead])
async def list_chores(
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
            from app.crud import get_children_by_user

            children = await get_children_by_user(db, user.id)
            if child_id not in [c.id for c in children]:
                raise HTTPException(status_code=404, detail="Child not found")
    return await get_chores_by_child(db, child_id)


@router.get("/mine", response_model=List[ChoreRead])
async def list_my_chores(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    return await get_chores_by_child(db, child.id)


@router.post("/{chore_id}/complete", response_model=ChoreRead)
async def mark_complete(
    chore_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    chore = await get_chore(db, chore_id)
    if not chore or chore.child_id != child.id:
        raise HTTPException(status_code=404, detail="Chore not found")
    if chore.status != "pending":
        raise HTTPException(status_code=400, detail="Chore not pending")
    chore.status = "awaiting_approval"
    updated = await save_chore(db, chore)
    logger.info("Child %s marked chore %s complete", child.id, chore_id)
    return updated


@router.post("/{chore_id}/approve", response_model=ChoreRead)
async def approve_chore(
    chore_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chore = await get_chore(db, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if chore.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    if chore.status == "awaiting_approval":
        tx = Transaction(
            child_id=chore.child_id,
            type="credit",
            amount=chore.amount,
            memo=f"Chore: {chore.description}",
            initiated_by="parent",
            initiator_id=current_user.id,
        )
        await create_transaction(db, tx)
        if chore.interval_days:
            chore.next_due = (chore.next_due or date.today()) + timedelta(days=chore.interval_days)
            chore.status = "pending"
            chore.active = True
        else:
            chore.status = "completed"
            chore.active = False
        updated = await save_chore(db, chore)
        logger.info("Chore %s approved by user %s", chore_id, current_user.id)
        return updated
    if chore.status == "proposed":
        chore.status = "pending"
        chore.active = True
        updated = await save_chore(db, chore)
        logger.info("Chore %s proposal approved by user %s", chore_id, current_user.id)
        return updated
    raise HTTPException(status_code=400, detail="Nothing to approve")


@router.post("/{chore_id}/reject", response_model=ChoreRead)
async def reject_chore(
    chore_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chore = await get_chore(db, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if chore.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    if chore.status == "awaiting_approval":
        chore.status = "pending"
        updated = await save_chore(db, chore)
        logger.info("Chore %s completion rejected by user %s", chore_id, current_user.id)
        return updated
    if chore.status == "proposed":
        chore.status = "rejected"
        chore.active = False
        updated = await save_chore(db, chore)
        logger.info("Chore %s proposal rejected by user %s", chore_id, current_user.id)
        return updated
    raise HTTPException(status_code=400, detail="Nothing to reject")


@router.put("/{chore_id}", response_model=ChoreRead)
async def update_chore(
    chore_id: int,
    data: ChoreUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chore = await get_chore(db, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if chore.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(chore, field, value)
    updated = await save_chore(db, chore)
    logger.info("Chore %s updated by user %s", chore_id, current_user.id)
    return updated


@router.delete("/{chore_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chore_route(
    chore_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chore = await get_chore(db, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if current_user.role != "admin":
        from app.crud import get_children_by_user

        children = await get_children_by_user(db, current_user.id)
        if chore.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    await delete_chore(db, chore)
    logger.info("Chore %s deleted by user %s", chore_id, current_user.id)
    return None
