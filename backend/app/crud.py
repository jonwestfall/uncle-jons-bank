from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.models import (
    User,
    Child,
    ChildUserLink,
    Transaction,
    WithdrawalRequest,
)
from app.auth import get_password_hash, get_child_by_id

async def create_user(db: AsyncSession, user: User):
    if not user.password_hash.startswith("$2b$"):
        user.password_hash = get_password_hash(user.password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def create_child(db: AsyncSession, child: Child):
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def create_child_for_user(db: AsyncSession, child: Child, user_id: int):
    db.add(child)
    await db.commit()
    await db.refresh(child)

    link = ChildUserLink(user_id=user_id, child_id=child.id)
    db.add(link)
    await db.commit()
    return child

async def get_children_by_user(db: AsyncSession, user_id: int):
    query = (
        select(Child)
        .join(ChildUserLink)
        .where(ChildUserLink.user_id == user_id)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def get_child_by_access_code(db: AsyncSession, access_code: str):
    result = await db.execute(select(Child).where(Child.access_code == access_code))
    return result.scalar_one_or_none()


async def set_child_frozen(db: AsyncSession, child_id: int, frozen: bool) -> Child | None:
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        return None
    child.account_frozen = frozen
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def create_transaction(db: AsyncSession, tx: Transaction) -> Transaction:
    """Persist a ledger transaction."""
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def get_transaction(db: AsyncSession, transaction_id: int) -> Transaction | None:
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    return result.scalar_one_or_none()


async def save_transaction(db: AsyncSession, tx: Transaction) -> Transaction:
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(db: AsyncSession, tx: Transaction) -> None:
    await db.delete(tx)
    await db.commit()


async def get_transactions_by_child(db: AsyncSession, child_id: int) -> list[Transaction]:
    result = await db.execute(
        select(Transaction).where(Transaction.child_id == child_id).order_by(Transaction.timestamp)
    )
    return result.scalars().all()


async def calculate_balance(db: AsyncSession, child_id: int) -> float:
    transactions = await get_transactions_by_child(db, child_id)
    balance = 0.0
    for tx in transactions:
        if tx.type == "credit":
            balance += tx.amount
        else:
            balance -= tx.amount
    return balance


async def create_withdrawal_request(db: AsyncSession, req: WithdrawalRequest) -> WithdrawalRequest:
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_pending_withdrawals_for_parent(db: AsyncSession, parent_id: int) -> list[WithdrawalRequest]:
    query = (
        select(WithdrawalRequest)
        .join(Child)
        .join(ChildUserLink)
        .where(ChildUserLink.user_id == parent_id, WithdrawalRequest.status == "pending")
        .order_by(WithdrawalRequest.requested_at)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def get_withdrawal_requests_by_child(db: AsyncSession, child_id: int) -> list[WithdrawalRequest]:
    result = await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.child_id == child_id).order_by(WithdrawalRequest.requested_at.desc())
    )
    return result.scalars().all()


async def get_withdrawal_request(db: AsyncSession, request_id: int) -> WithdrawalRequest | None:
    result = await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == request_id))
    return result.scalar_one_or_none()


async def save_withdrawal_request(db: AsyncSession, req: WithdrawalRequest) -> WithdrawalRequest:
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req
