import asyncio
import pathlib
import sys
from datetime import date, datetime, timedelta, time

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import User, Child, Account, Transaction
from app.auth import get_password_hash
from app.crud import create_transaction, recalc_interest


def test_account_interest_catch_up():
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
            child = Child(first_name="Kid", access_code="KID")
            session.add(parent)
            session.add(child)
            await session.commit()
            await session.refresh(parent)
            await session.refresh(child)

            start_date = date.today() - timedelta(days=5)
            account = Account(
                child_id=child.id,
                interest_rate=0.01,
                penalty_interest_rate=0.02,
                last_interest_applied=start_date,
            )
            session.add(account)
            await session.commit()
            await session.refresh(account)

            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="credit",
                    amount=100,
                    memo="Initial deposit",
                    initiated_by="parent",
                    initiator_id=parent.id,
                    timestamp=datetime.combine(start_date, time.min),
                ),
            )

            await recalc_interest(session, child.id)
            refreshed = await session.get(Account, account.id)

            result = await session.execute(
                select(Transaction)
                .where(
                    Transaction.child_id == child.id,
                    Transaction.memo == "Interest",
                )
                .order_by(Transaction.timestamp)
            )
            txs = result.scalars().all()
            assert len(txs) == 5
            assert refreshed.last_interest_applied == date.today()
            assert round(refreshed.total_interest_earned, 2) == 5.10

    asyncio.run(run())
