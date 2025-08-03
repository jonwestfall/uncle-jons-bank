"""Regression test for recalculating interest after rate changes."""

from datetime import datetime, timedelta

import asyncio
import pathlib
import sys

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import User, Child, Transaction
from app.crud import (
    create_child_for_user,
    create_transaction,
    recalc_interest,
    set_interest_rate,
    get_transactions_by_child,
)
from app.auth import get_password_hash


def test_interest_rate_change_not_retroactive():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        TestSession = async_sessionmaker(engine, expire_on_commit=False)

        async with TestSession() as session:
            parent = User(
                name="Parent",
                email="parent@example.com",
                password_hash=get_password_hash("pass"),
                role="parent",
            )
            session.add(parent)
            await session.commit()
            await session.refresh(parent)

            child = await create_child_for_user(
                session, Child(first_name="Kid", access_code="KID"), parent.id
            )

            start_time = datetime.utcnow() - timedelta(days=5)
            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="credit",
                    amount=100,
                    memo="Deposit",
                    initiated_by="parent",
                    initiator_id=parent.id,
                    timestamp=start_time,
                ),
            )

            await recalc_interest(session, child.id)
            txs_before = await get_transactions_by_child(session, child.id)
            interest_before = [t.amount for t in txs_before if t.memo == "Interest"]

            await set_interest_rate(session, child.id, 0.02)
            await recalc_interest(session, child.id)
            txs_after = await get_transactions_by_child(session, child.id)
            interest_after = [t.amount for t in txs_after if t.memo == "Interest"]

            assert interest_after == interest_before

    asyncio.run(run())
