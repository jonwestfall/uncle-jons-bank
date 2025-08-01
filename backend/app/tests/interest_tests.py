from typing import List
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from app.database import async_session, create_db_and_tables
from app.models import User, Child, Transaction
from app.crud import (
    ensure_permissions_exist,
    create_user,
    create_child_for_user,
    create_transaction,
    recalc_interest,
    get_transactions_by_child,
    calculate_balance,
    get_account_by_child,
)
from app.auth import get_password_hash
from app.acl import ALL_PERMISSIONS


async def run_interest_test(persist: bool = False) -> dict:
    """Create backdated transactions and verify interest calculations."""
    results: List[str] = []
    success = True

    if persist:
        TestSession = async_session
        await create_db_and_tables()
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        TestSession = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    async with TestSession() as session:
        await ensure_permissions_exist(session, ALL_PERMISSIONS)
        parent = User(
            name="Interest Parent",
            email="interest@example.com",
            password_hash=get_password_hash("parentpass"),
            role="parent",
        )
        session.add(parent)
        await session.commit()
        await session.refresh(parent)

        child_pos = await create_child_for_user(
            session, Child(first_name="Saver", access_code="SAV"), parent.id
        )
        child_neg = await create_child_for_user(
            session, Child(first_name="Spender", access_code="SPN"), parent.id
        )

        five_days = datetime.utcnow() - timedelta(days=5)

        await create_transaction(
            session,
            Transaction(
                child_id=child_pos.id,
                type="credit",
                amount=100,
                memo="Initial Deposit",
                initiated_by="parent",
                initiator_id=parent.id,
                timestamp=five_days,
            ),
        )
        await recalc_interest(session, child_pos.id)
        txs = await get_transactions_by_child(session, child_pos.id)
        if any(tx.memo == "Interest" and tx.type == "credit" for tx in txs):
            results.append("Interest applied to positive balance")
        else:
            results.append("Interest missing for positive balance")
            success = False

        await create_transaction(
            session,
            Transaction(
                child_id=child_neg.id,
                type="debit",
                amount=50,
                memo="Initial Debit",
                initiated_by="parent",
                initiator_id=parent.id,
                timestamp=five_days,
            ),
        )
        await recalc_interest(session, child_neg.id)
        txs2 = await get_transactions_by_child(session, child_neg.id)
        if any(tx.memo == "Interest" and tx.type == "debit" for tx in txs2):
            results.append("Penalty interest applied")
        else:
            results.append("Penalty interest missing")
            success = False

        bal_pos = await calculate_balance(session, child_pos.id)
        bal_neg = await calculate_balance(session, child_neg.id)
        account_pos = await get_account_by_child(session, child_pos.id)
        account_neg = await get_account_by_child(session, child_neg.id)

        results.append(
            f"Positive balance: {bal_pos:.2f}, interest earned: {account_pos.total_interest_earned:.2f}"
        )
        results.append(
            f"Negative balance: {bal_neg:.2f}, interest earned: {account_neg.total_interest_earned:.2f}"
        )

    return {"success": success, "details": results}


if __name__ == "__main__":
    import asyncio
    print(asyncio.run(run_interest_test()))
