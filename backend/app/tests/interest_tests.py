"""Utilities for validating interest calculation logic."""

from typing import List
from datetime import datetime, timedelta, date

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlmodel import SQLModel

from sqlmodel import select

from app.database import async_session, create_db_and_tables
from app.models import User, Child, Transaction, Permission, UserPermissionLink
from app.crud import (
    ensure_permissions_exist,
    create_child_for_user,
    create_transaction,
    recalc_interest,
    get_transactions_by_child,
    calculate_balance,
    get_account_by_child,
)
from app.auth import get_password_hash
from app.acl import ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS


async def run_interest_test(persist: bool = False, days: int = 5) -> dict:
    """Create backdated transactions and verify interest calculations.

    ``days`` specifies how many days from today the initial transactions are
    backdated (positive) or postdated (negative).
    """
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
        for perm_name in ROLE_DEFAULT_PERMISSIONS["parent"]:
            result = await session.execute(
                select(Permission).where(Permission.name == perm_name)
            )
            perm = result.scalar_one()
            link = UserPermissionLink(user_id=parent.id, permission_id=perm.id)
            session.add(link)
        await session.commit()

        child_pos = await create_child_for_user(
            session, Child(first_name="Saver", access_code="SAV"), parent.id
        )
        child_neg = await create_child_for_user(
            session, Child(first_name="Spender", access_code="SPN"), parent.id
        )

        if days >= 0:
            start_time = datetime.utcnow() - timedelta(days=days)
        else:
            start_time = datetime.utcnow() + timedelta(days=-days)

        await create_transaction(
            session,
            Transaction(
                child_id=child_pos.id,
                type="credit",
                amount=100,
                memo="Initial Deposit",
                initiated_by="parent",
                initiator_id=parent.id,
                timestamp=start_time,
            ),
        )
        await recalc_interest(session, child_pos.id)
        txs = await get_transactions_by_child(session, child_pos.id)
        expected_days = max(0, (date.today() - start_time.date()).days)
        interest_txs = [t for t in txs if t.memo == "Interest" and t.type == "credit"]
        if len(interest_txs) == expected_days and expected_days > 0:
            results.append("Interest applied to positive balance")
        elif expected_days == 0 and not interest_txs:
            results.append("No interest due yet")
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
                timestamp=start_time,
            ),
        )
        await recalc_interest(session, child_neg.id)
        txs2 = await get_transactions_by_child(session, child_neg.id)
        interest_txs2 = [t for t in txs2 if t.memo == "Interest" and t.type == "debit"]
        if len(interest_txs2) == expected_days and (expected_days > 0 or not interest_txs2):
            results.append("Penalty interest applied" if expected_days > 0 else "No penalty interest due yet")
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
