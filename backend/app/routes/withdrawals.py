from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.auth import get_current_child, require_role, get_current_user
from app.models import WithdrawalRequest, Transaction, Child, ChildUserLink, User
from app.crud import (
    create_withdrawal_request,
    get_pending_withdrawals_for_parent,
    get_withdrawal_requests_by_child,
    get_withdrawal_request,
    save_withdrawal_request,
    create_transaction,
    get_children_by_user,
    post_transaction_update,
)
from app.schemas import WithdrawalRequestCreate, WithdrawalRequestRead, DenyRequest

router = APIRouter(prefix="/withdrawals", tags=["withdrawals"])


@router.post("/", response_model=WithdrawalRequestRead)
async def request_withdrawal(
    data: WithdrawalRequestCreate,
    db: AsyncSession = Depends(get_session),
    child: Child = Depends(get_current_child),
):
    req = WithdrawalRequest(child_id=child.id, amount=data.amount, memo=data.memo)
    return await create_withdrawal_request(db, req)


@router.get("/mine", response_model=list[WithdrawalRequestRead])
async def my_requests(
    db: AsyncSession = Depends(get_session),
    child: Child = Depends(get_current_child),
):
    return await get_withdrawal_requests_by_child(db, child.id)


@router.get("/", response_model=list[WithdrawalRequestRead])
async def pending_requests(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    return await get_pending_withdrawals_for_parent(db, current_user.id)


async def _ensure_parent_owns_request(db: AsyncSession, req: WithdrawalRequest, parent_id: int) -> None:
    children = await get_children_by_user(db, parent_id)
    if req.child_id not in [c.id for c in children]:
        raise HTTPException(status_code=404, detail="Request not found")


@router.post("/{request_id}/approve", response_model=WithdrawalRequestRead)
async def approve_request(
    request_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    req = await get_withdrawal_request(db, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    await _ensure_parent_owns_request(db, req, current_user.id)

    tx = Transaction(
        child_id=req.child_id,
        type="debit",
        amount=req.amount,
        memo=req.memo,
        initiated_by="child",
        initiator_id=req.child_id,
    )
    await create_transaction(db, tx)
    await post_transaction_update(db, req.child_id)

    req.status = "approved"
    req.responded_at = datetime.utcnow()
    req.approver_id = current_user.id
    await save_withdrawal_request(db, req)
    return req


@router.post("/{request_id}/deny", response_model=WithdrawalRequestRead)
async def deny_request(
    request_id: int,
    reason: DenyRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("parent", "admin")),
):
    req = await get_withdrawal_request(db, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    await _ensure_parent_owns_request(db, req, current_user.id)
    req.status = "denied"
    req.denial_reason = reason.reason
    req.responded_at = datetime.utcnow()
    req.approver_id = current_user.id
    await save_withdrawal_request(db, req)
    return req
