from datetime import date, timedelta
import asyncio
import pathlib
import sys

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import User, Child, RecurringCharge
from app.crud import (
    create_child_for_user,
    create_recurring_charge,
    process_due_recurring_charges,
    get_transactions_by_child,
)
from app.auth import get_password_hash


def test_recurring_charge_posts_transaction():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        async with Session() as session:
            parent = User(
                name="Parent",
                email="p@example.com",
                password_hash=get_password_hash("pass"),
                role="parent",
            )
            session.add(parent)
            await session.commit()
            await session.refresh(parent)
            child = await create_child_for_user(
                session, Child(first_name="Kid", access_code="K1"), parent.id
            )
            rc = RecurringCharge(
                child_id=child.id,
                amount=5,
                memo="Allowance",
                interval_days=7,
                next_run=date.today() - timedelta(days=7),
            )
            await create_recurring_charge(session, rc)
            await process_due_recurring_charges(session)
            txs = await get_transactions_by_child(session, child.id)
            assert any(t.memo == "Allowance" and t.amount == 5 for t in txs)
            result = await session.execute(select(RecurringCharge).where(RecurringCharge.id == rc.id))
            updated = result.scalar_one()
            assert updated.next_run > date.today()
    asyncio.run(run())
