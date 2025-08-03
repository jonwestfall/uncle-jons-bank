from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
"""Routes for managing children's certificates of deposit."""

from app.auth import require_role, get_current_child
from app.models import CertificateDeposit, Child, User, Transaction
from app.schemas import CDCreate, CDRead
from app.crud import (
    create_cd,
    get_cd,
    save_cd,
    get_cds_by_child,
    get_children_by_user,
    calculate_balance,
    create_transaction,
    post_transaction_update,
)

router = APIRouter(prefix="/cds", tags=["cds"])


@router.post("/", response_model=CDRead)
async def create_cd_offer(
    data: CDCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    if current_user.role != "admin":
        children = await get_children_by_user(db, current_user.id)
        if data.child_id not in [c.id for c in children]:
            raise HTTPException(status_code=404, detail="Child not found")
    cd = CertificateDeposit(
        child_id=data.child_id,
        parent_id=current_user.id,
        amount=data.amount,
        interest_rate=data.interest_rate,
        term_days=data.term_days,
    )
    return await create_cd(db, cd)


@router.get("/child", response_model=list[CDRead])
async def my_cds(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    return await get_cds_by_child(db, child.id)


async def _get_child_cd(
    db: AsyncSession, cd_id: int, child_id: int
) -> CertificateDeposit:
    cd = await get_cd(db, cd_id)
    if not cd or cd.child_id != child_id:
        raise HTTPException(status_code=404, detail="CD not found")
    return cd


@router.post("/{cd_id}/accept", response_model=CDRead)
async def accept_cd(
    cd_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    cd = await _get_child_cd(db, cd_id, child.id)
    if cd.status != "offered":
        raise HTTPException(status_code=400, detail="Cannot accept")
    balance = await calculate_balance(db, child.id)
    if balance < cd.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    await create_transaction(
        db,
        Transaction(
            child_id=child.id,
            type="debit",
            amount=cd.amount,
            memo=f"CD #{cd.id} purchase",
            initiated_by="child",
            initiator_id=child.id,
        ),
    )
    await post_transaction_update(db, child.id)
    cd.status = "accepted"
    cd.accepted_at = datetime.utcnow()
    cd.matures_at = cd.accepted_at + timedelta(days=cd.term_days)
    await save_cd(db, cd)
    return cd


@router.post("/{cd_id}/reject", response_model=CDRead)
async def reject_cd(
    cd_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    cd = await _get_child_cd(db, cd_id, child.id)
    if cd.status != "offered":
        raise HTTPException(status_code=400, detail="Cannot reject")
    cd.status = "rejected"
    await save_cd(db, cd)
    return cd


@router.post("/{cd_id}/redeem", response_model=CDRead)
async def redeem_cd_route(
    cd_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    cd = await get_cd(db, cd_id)
    if not cd:
        raise HTTPException(status_code=404, detail="CD not found")
    from app.crud import redeem_cd

    cd = await redeem_cd(db, cd)
    return cd


@router.post("/{cd_id}/redeem-early", response_model=CDRead)
async def redeem_cd_early_route(
    cd_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    cd = await _get_child_cd(db, cd_id, child.id)
    if cd.status != "accepted":
        raise HTTPException(status_code=400, detail="Cannot redeem")
    from app.crud import redeem_cd

    cd = await redeem_cd(db, cd)
    return cd
