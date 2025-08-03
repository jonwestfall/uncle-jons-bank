"""Helpers for testing certificate of deposit flows."""

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlmodel import SQLModel, select

from app.database import async_session, create_db_and_tables
from app.models import (
    User,
    Child,
    CertificateDeposit,
    Permission,
    UserPermissionLink,
)
from app.crud import (
    ensure_permissions_exist,
    create_child_for_user,
    create_transaction,
    recalc_interest,
    create_cd,
    redeem_cd,
    get_transactions_by_child,
)
from app.auth import get_password_hash
from app.acl import ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS
from app.models import Transaction


async def run_cd_issue_test(
    persist: bool = False, days: int = 30, rate: float = 0.05
) -> dict:
    results = []
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
            name="CD Parent",
            email="cdparent@example.com",
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
            session.add(
                UserPermissionLink(user_id=parent.id, permission_id=perm.id)
            )
        await session.commit()

        child = await create_child_for_user(
            session, Child(first_name="CDKid", access_code="CDK"), parent.id
        )

        await create_transaction(
            session,
            Transaction(
                child_id=child.id,
                type="credit",
                amount=100,
                memo="Initial",
                initiated_by="parent",
                initiator_id=parent.id,
            ),
        )
        await recalc_interest(session, child.id)

        cd = await create_cd(
            session,
            CertificateDeposit(
                child_id=child.id,
                parent_id=parent.id,
                amount=50,
                interest_rate=rate,
                term_days=days,
            ),
        )

    return {"success": True, "cd_id": cd.id}


async def run_cd_redeem_test(cd_id: int, persist: bool = False) -> dict:
    """Redeem the given CD as if it matured today."""
    if persist:
        TestSession = async_session
        await create_db_and_tables()
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        TestSession = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

    async with TestSession() as session:
        cd = await session.get(CertificateDeposit, cd_id)
        if not cd:
            return {"success": False, "error": "CD not found"}
        await redeem_cd(session, cd, treat_as_mature=True)
        txs = await get_transactions_by_child(session, cd.child_id)
        payout = round(cd.amount * (1 + cd.interest_rate), 2)
        paid = any(
            tx.type == "credit" and tx.amount == payout and tx.memo.startswith("CD")
            for tx in txs
        )

    return {"success": paid}
