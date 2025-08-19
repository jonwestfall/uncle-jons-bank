import asyncio
import pathlib
import sys
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, select

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from app.models import (
    User,
    Child,
    Account,
    Transaction,
    CertificateDeposit,
)
from app.auth import get_password_hash
from app.crud import create_transaction, redeem_matured_cds


def test_cd_redemption_after_downtime():
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

            created_at = datetime.utcnow().replace(microsecond=0) - timedelta(days=10)
            matures_at = created_at + timedelta(days=5)

            account = Account(
                child_id=child.id,
                interest_rate=0.0,
                penalty_interest_rate=0.0,
                last_interest_applied=created_at.date(),
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
                    memo="Funding",
                    initiated_by="parent",
                    initiator_id=parent.id,
                    timestamp=created_at,
                ),
            )
            await create_transaction(
                session,
                Transaction(
                    child_id=child.id,
                    type="debit",
                    amount=100,
                    memo="CD purchase",
                    initiated_by="system",
                    initiator_id=0,
                    timestamp=created_at,
                ),
            )

            cd = CertificateDeposit(
                child_id=child.id,
                parent_id=parent.id,
                amount=100,
                interest_rate=0.1,
                term_days=5,
                status="accepted",
                created_at=created_at,
                matures_at=matures_at,
            )
            session.add(cd)
            await session.commit()
            await session.refresh(cd)

            await redeem_matured_cds(session)

            result = await session.execute(
                select(Transaction).where(
                    Transaction.child_id == child.id,
                    Transaction.memo == f"CD #{cd.id} maturity",
                )
            )
            payout_tx = result.scalar_one()
            assert payout_tx.timestamp == matures_at
            assert round(payout_tx.amount, 2) == 110.0

            refreshed = await session.get(Account, account.id)
            assert refreshed.last_interest_applied == datetime.utcnow().date()

            result = await session.execute(
                select(Transaction).where(Transaction.child_id == child.id)
            )
            txs = result.scalars().all()
            balance = 0
            for t in txs:
                balance += t.amount if t.type == "credit" else -t.amount
            assert round(balance, 2) == 110.0

    asyncio.run(run())
