import asyncio
import pathlib
import sys
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import User, Child, Loan, LoanTransaction
from app.crud import recalc_loan_interest
from app.auth import get_password_hash


def test_loan_interest_catch_up():
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

            loan = Loan(
                child_id=child.id,
                parent_id=parent.id,
                amount=100,
                interest_rate=0.01,
                status="active",
                principal_remaining=100,
                last_interest_applied=date.today() - timedelta(days=5),
            )
            session.add(loan)
            await session.commit()
            await session.refresh(loan)

            await recalc_loan_interest(session, loan)
            await session.refresh(loan)

            assert round(loan.principal_remaining, 2) == 105.10

            result = await session.execute(
                select(LoanTransaction).where(
                    LoanTransaction.loan_id == loan.id,
                    LoanTransaction.type == "interest",
                )
            )
            txs = result.scalars().all()
            assert len(txs) == 5
            assert loan.last_interest_applied == date.today()

    asyncio.run(run())
