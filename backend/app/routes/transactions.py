from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession


from app.database import get_session
from app.models import Transaction
from app.schemas import TransactionCreate, TransactionRead, LedgerResponse
from app.crud import create_transaction, get_transactions_by_child, calculate_balance

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionRead)
async def add_transaction(transaction: TransactionCreate, db: AsyncSession = Depends(get_session)):
    tx_model = Transaction(
        child_id=transaction.child_id,
        type=transaction.type,
        amount=transaction.amount,
        memo=transaction.memo,
        initiated_by=transaction.initiated_by,
        initiator_id=transaction.initiator_id,
    )
    return await create_transaction(db, tx_model)


@router.get("/child/{child_id}", response_model=LedgerResponse)
async def get_ledger(child_id: int, db: AsyncSession = Depends(get_session)):
    transactions = await get_transactions_by_child(db, child_id)
    balance = await calculate_balance(db, child_id)
    return {"balance": balance, "transactions": transactions}
