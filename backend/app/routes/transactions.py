import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


"""Endpoints for recording and viewing ledger transactions."""

from app.database import get_session
from app.models import Transaction, User, Child
from app.schemas import (
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
    LedgerResponse,
)
from app.crud import (
    create_transaction,
    get_transactions_by_child,
    calculate_balance,
    get_transaction,
    save_transaction,
    delete_transaction,
    post_transaction_update,
    get_child_user_link,
)
from app.auth import require_permissions, get_current_user, get_current_identity
from app.acl import (
    PERM_ADD_TRANSACTION,
    PERM_VIEW_TRANSACTIONS,
    PERM_DELETE_TRANSACTION,
    PERM_EDIT_TRANSACTION,
    PERM_DEPOSIT,
    PERM_DEBIT,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionRead)
async def add_transaction(
    transaction: TransactionCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_ADD_TRANSACTION)),
):
    """Create a new credit or debit transaction."""
    user_perm_names = {p.name for p in current_user.permissions}
    if current_user.role != "admin":
        if transaction.type == "credit" and PERM_DEPOSIT not in user_perm_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        if transaction.type == "debit" and PERM_DEBIT not in user_perm_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )

    if current_user.role != "admin":
        link = await get_child_user_link(db, current_user.id, transaction.child_id)
        if not link:
            raise HTTPException(status_code=404, detail="Child not found")
        perm_needed = PERM_DEPOSIT if transaction.type == "credit" else PERM_DEBIT
        if perm_needed not in link.permissions and not link.is_owner:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    tx_model = Transaction(
        child_id=transaction.child_id,
        type=transaction.type,
        amount=transaction.amount,
        memo=transaction.memo,
        initiated_by=transaction.initiated_by,
        initiator_id=transaction.initiator_id,
    )
    new_tx = await create_transaction(db, tx_model)
    logger.info(
        "Transaction %s %s for child %s by user %s",
        transaction.type,
        transaction.amount,
        transaction.child_id,
        current_user.id,
    )
    await post_transaction_update(db, transaction.child_id)
    return new_tx


@router.put("/{transaction_id}", response_model=TransactionRead)
async def update_transaction_route(
    transaction_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_EDIT_TRANSACTION)),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    updated = await save_transaction(db, tx)
    logger.info("Transaction %s updated by user %s", transaction_id, current_user.id)
    await post_transaction_update(db, tx.child_id)
    return updated


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_route(
    transaction_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_DELETE_TRANSACTION)),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await delete_transaction(db, tx)
    logger.info("Transaction %s deleted by user %s", transaction_id, current_user.id)
    await post_transaction_update(db, tx.child_id)


@router.get("/child/{child_id}", response_model=LedgerResponse)
async def get_ledger(
    child_id: int,
    db: AsyncSession = Depends(get_session),
    identity: tuple[str, Child | User] = Depends(get_current_identity),
):
    """Return the full ledger and balance for a child."""
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
            link = await get_child_user_link(db, user.id, child_id)
            if not link:
                raise HTTPException(status_code=404, detail="Child not found")
            if (
                PERM_VIEW_TRANSACTIONS not in link.permissions
                and not link.is_owner
            ):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
    transactions = await get_transactions_by_child(db, child_id)
    balance = await calculate_balance(db, child_id)
    return {"balance": balance, "transactions": transactions}
