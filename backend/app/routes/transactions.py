from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


from app.database import get_session
from app.models import Transaction
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
    recalc_interest,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionRead)
async def add_transaction(
    transaction: TransactionCreate, db: AsyncSession = Depends(get_session)
):
    tx_model = Transaction(
        child_id=transaction.child_id,
        type=transaction.type,
        amount=transaction.amount,
        memo=transaction.memo,
        initiated_by=transaction.initiated_by,
        initiator_id=transaction.initiator_id,
    )
    new_tx = await create_transaction(db, tx_model)
    await recalc_interest(db, transaction.child_id)
    return new_tx


@router.put("/{transaction_id}", response_model=TransactionRead)
async def update_transaction_route(
    transaction_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_session),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    updated = await save_transaction(db, tx)
    await recalc_interest(db, tx.child_id)
    return updated


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_route(
    transaction_id: int,
    db: AsyncSession = Depends(get_session),
):
    tx = await get_transaction(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await delete_transaction(db, tx)
    await recalc_interest(db, tx.child_id)


@router.get("/child/{child_id}", response_model=LedgerResponse)
async def get_ledger(child_id: int, db: AsyncSession = Depends(get_session)):
    transactions = await get_transactions_by_child(db, child_id)
    balance = await calculate_balance(db, child_id)
    return {"balance": balance, "transactions": transactions}
