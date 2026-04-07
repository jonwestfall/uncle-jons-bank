import asyncio
import pathlib
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.auth import get_password_hash
from app.crud import (
    apply_overdraft_fee,
    calculate_balance,
    create_transaction,
    recalc_interest,
)
from app.models import Account, Child, Settings, Transaction, User
from app.money import quantize_money


def test_cumulative_interest_quantized_each_day():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        test_session = async_sessionmaker(engine, expire_on_commit=False)

        async with test_session() as session:
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

            start_date = date.today() - timedelta(days=4)
            account = Account(
                child_id=child.id,
                interest_rate=Decimal("0.005000"),
                penalty_interest_rate=Decimal("0.020000"),
                last_interest_applied=start_date,
            )
            session.add(account)
            await session.commit()

            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="credit",
                    amount=Decimal("100.00"),
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
            interest_amounts = [quantize_money(t.amount) for t in txs]

            expected_interest: list[Decimal] = []
            running = Decimal("100.00")
            for _ in range(4):
                daily_interest = quantize_money(running * Decimal("0.005000"))
                expected_interest.append(daily_interest)
                running = quantize_money(running + daily_interest)

            assert interest_amounts == expected_interest
            assert quantize_money(refreshed.total_interest_earned) == quantize_money(
                sum(expected_interest, Decimal("0.00"))
            )

    asyncio.run(run())


def test_overdraft_fee_compounding_daily_percentage():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        test_session = async_sessionmaker(engine, expire_on_commit=False)

        async with test_session() as session:
            parent = User(
                name="Parent",
                email="parent2@example.com",
                password_hash=get_password_hash("pass"),
                role="parent",
            )
            child = Child(first_name="Kid", access_code="KID2")
            session.add(parent)
            session.add(child)
            await session.commit()
            await session.refresh(parent)
            await session.refresh(child)
            account = Account(
                child_id=child.id,
                interest_rate=Decimal("0.000000"),
                penalty_interest_rate=Decimal("0.000000"),
            )
            session.add(account)
            await session.commit()
            await session.refresh(account)

            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="debit",
                    amount=Decimal("100.00"),
                    memo="Overdraft",
                    initiated_by="parent",
                    initiator_id=parent.id,
                ),
            )

            settings = Settings(
                overdraft_fee_amount=Decimal("0.100000"),
                overdraft_fee_is_percentage=True,
                overdraft_fee_daily=True,
            )
            day1 = date.today() - timedelta(days=2)
            day2 = date.today() - timedelta(days=1)
            day3 = date.today()

            await apply_overdraft_fee(session, account, settings, day1)
            await apply_overdraft_fee(session, account, settings, day2)
            await apply_overdraft_fee(session, account, settings, day3)

            result = await session.execute(
                select(Transaction)
                .where(
                    Transaction.child_id == child.id,
                    Transaction.memo == "Overdraft Fee",
                )
                .order_by(Transaction.id)
            )
            fee_txs = result.scalars().all()
            fee_amounts = [quantize_money(t.amount) for t in fee_txs]
            assert fee_amounts == [
                Decimal("10.00"),
                Decimal("11.00"),
                Decimal("12.10"),
            ]

    asyncio.run(run())


def test_reconciliation_zero_tolerance():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        test_session = async_sessionmaker(engine, expire_on_commit=False)

        async with test_session() as session:
            parent = User(
                name="Parent",
                email="parent3@example.com",
                password_hash=get_password_hash("pass"),
                role="parent",
            )
            child = Child(first_name="Kid", access_code="KID3")
            session.add(parent)
            session.add(child)
            await session.commit()
            await session.refresh(parent)
            await session.refresh(child)

            start_date = date.today() - timedelta(days=2)
            account = Account(
                child_id=child.id,
                interest_rate=Decimal("0.010000"),
                penalty_interest_rate=Decimal("0.020000"),
                last_interest_applied=start_date,
            )
            session.add(account)
            await session.commit()

            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="credit",
                    amount=Decimal("100.00"),
                    memo="Deposit",
                    initiated_by="parent",
                    initiator_id=parent.id,
                    timestamp=datetime.combine(start_date, time.min),
                ),
            )
            await recalc_interest(session, child.id)

            balance = await calculate_balance(session, child.id)

            tx_result = await session.execute(
                select(Transaction).where(Transaction.child_id == child.id)
            )
            txs = tx_result.scalars().all()
            manual = Decimal("0.00")
            for tx in txs:
                if tx.type == "credit":
                    manual = quantize_money(manual + tx.amount)
                else:
                    manual = quantize_money(manual - tx.amount)

            reconciliation_delta = quantize_money(balance - manual)
            assert reconciliation_delta == Decimal("0.00")

    asyncio.run(run())
