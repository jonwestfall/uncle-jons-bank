from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Loan, LoanTransaction, Child, User, Transaction
from app.schemas import LoanCreate, LoanRead, LoanApprove, LoanPayment, LoanRateUpdate
from app.auth import get_current_child, require_permissions
from app.acl import PERM_OFFER_LOAN, PERM_MANAGE_LOAN
from app.crud import (
    create_loan,
    get_loan,
    save_loan,
    get_loans_by_child,
    record_loan_transaction,
    get_child_user_link,
    create_transaction,
    post_transaction_update,
)

router = APIRouter(prefix="/loans", tags=["loans"])


@router.post("/", response_model=LoanRead)
async def request_loan(
    data: LoanCreate,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    loan = Loan(child_id=child.id, amount=data.amount, purpose=data.purpose)
    return await create_loan(db, loan)


@router.get("/child", response_model=list[LoanRead])
async def my_loans(
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    return await get_loans_by_child(db, child.id)


@router.post("/{loan_id}/accept", response_model=LoanRead)
async def accept_loan(
    loan_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    loan = await get_loan(db, loan_id)
    if not loan or loan.child_id != child.id:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != "approved":
        raise HTTPException(status_code=400, detail="Cannot accept")
    await create_transaction(
        db,
        Transaction(
            child_id=child.id,
            type="credit",
            amount=loan.amount,
            memo=f"Loan #{loan.id} disbursement",
            initiated_by="child",
            initiator_id=child.id,
        ),
    )
    await post_transaction_update(db, child.id)
    await record_loan_transaction(
        db,
        LoanTransaction(
            loan_id=loan.id,
            type="disbursement",
            amount=loan.amount,
            memo="Loan disbursement",
        ),
    )
    loan.status = "active"
    loan.last_interest_applied = date.today()
    loan.principal_remaining = loan.amount
    await save_loan(db, loan)
    return loan


@router.post("/{loan_id}/close", response_model=LoanRead)
async def close_loan(
    loan_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_MANAGE_LOAN)),
):
    loan = await get_loan(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, loan.child_id)
        if not link or (PERM_MANAGE_LOAN not in link.permissions and not link.is_owner):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    loan.status = "closed"
    await record_loan_transaction(
        db,
        LoanTransaction(
            loan_id=loan.id,
            type="close",
            amount=0,
            memo="Loan closed",
        ),
    )
    await save_loan(db, loan)
    return loan


@router.post("/{loan_id}/approve", response_model=LoanRead)
async def approve_loan_route(
    loan_id: int,
    data: LoanApprove,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_OFFER_LOAN)),
):
    loan = await get_loan(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, loan.child_id)
        if not link or (PERM_OFFER_LOAN not in link.permissions and not link.is_owner):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    loan.status = "approved"
    loan.parent_id = current_user.id
    loan.interest_rate = data.interest_rate
    loan.terms = data.terms
    loan.principal_remaining = loan.amount
    await save_loan(db, loan)
    return loan


@router.post("/{loan_id}/deny", response_model=LoanRead)
async def deny_loan_route(
    loan_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_OFFER_LOAN)),
):
    loan = await get_loan(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, loan.child_id)
        if not link or (PERM_OFFER_LOAN not in link.permissions and not link.is_owner):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    loan.status = "denied"
    loan.parent_id = current_user.id
    await save_loan(db, loan)
    return loan


@router.post("/{loan_id}/decline", response_model=LoanRead)
async def decline_loan(
    loan_id: int,
    child: Child = Depends(get_current_child),
    db: AsyncSession = Depends(get_session),
):
    loan = await get_loan(db, loan_id)
    if not loan or loan.child_id != child.id:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != "approved":
        raise HTTPException(status_code=400, detail="Cannot decline")
    loan.status = "declined"
    await save_loan(db, loan)
    return loan


@router.get("/child/{child_id}", response_model=list[LoanRead])
async def parent_loans(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_MANAGE_LOAN)),
):
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, child_id)
        if not link or (
            PERM_MANAGE_LOAN not in link.permissions
            and PERM_OFFER_LOAN not in link.permissions
            and not link.is_owner
        ):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return await get_loans_by_child(db, child_id)


@router.post("/{loan_id}/interest", response_model=LoanRead)
async def update_interest_rate(
    loan_id: int,
    data: LoanRateUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_MANAGE_LOAN)),
):
    loan = await get_loan(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, loan.child_id)
        if not link or (PERM_MANAGE_LOAN not in link.permissions and not link.is_owner):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    loan.interest_rate = data.interest_rate
    await record_loan_transaction(
        db,
        LoanTransaction(
            loan_id=loan.id,
            type="rate_change",
            amount=0,
            memo=f"Interest rate changed to {data.interest_rate}",
        ),
    )
    await save_loan(db, loan)
    return loan


@router.post("/{loan_id}/payment", response_model=LoanRead)
async def record_payment(
    loan_id: int,
    data: LoanPayment,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_MANAGE_LOAN)),
):
    loan = await get_loan(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, loan.child_id)
        if not link or (PERM_MANAGE_LOAN not in link.permissions and not link.is_owner):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    await create_transaction(
        db,
        Transaction(
            child_id=loan.child_id,
            type="debit",
            amount=data.amount,
            memo=f"Loan #{loan.id} payment",
            initiated_by="parent",
            initiator_id=current_user.id,
        ),
    )
    await post_transaction_update(db, loan.child_id)
    await record_loan_transaction(
        db,
        LoanTransaction(
            loan_id=loan.id,
            type="payment",
            amount=data.amount,
            memo="Payment",
        ),
    )
    loan.principal_remaining = round(loan.principal_remaining - data.amount, 2)
    if loan.principal_remaining <= 0:
        loan.status = "closed"
    await save_loan(db, loan)
    return loan
