from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timedelta, time
from app.models import (
    User,
    Child,
    ChildUserLink,
    Transaction,
    WithdrawalRequest,
    Account,
    CertificateDeposit,
    Permission,
    UserPermissionLink,
)
from app.auth import get_password_hash, get_child_by_id
from app.acl import get_default_permissions_for_role


async def ensure_permissions_exist(db: AsyncSession, names: list[str]) -> None:
    for name in names:
        result = await db.execute(
            select(Permission).where(Permission.name == name)
        )
        perm = result.scalar_one_or_none()
        if not perm:
            db.add(Permission(name=name))
    await db.commit()


async def assign_permissions_by_names(
    db: AsyncSession, user: User, names: list[str]
) -> None:
    for name in names:
        result = await db.execute(
            select(Permission).where(Permission.name == name)
        )
        perm = result.scalar_one_or_none()
        if perm:
            exists = any(
                link.permission_id == perm.id for link in user.permission_links
            )
            if not exists:
                db.add(
                    UserPermissionLink(user_id=user.id, permission_id=perm.id)
                )
    await db.commit()


async def remove_permissions_by_names(
    db: AsyncSession, user: User, names: list[str]
) -> None:
    for name in names:
        result = await db.execute(
            select(Permission).where(Permission.name == name)
        )
        perm = result.scalar_one_or_none()
        if perm:
            link = next(
                (
                    l
                    for l in user.permission_links
                    if l.permission_id == perm.id
                ),
                None,
            )
            if link:
                await db.delete(link)
    await db.commit()


async def get_all_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.name))
    return result.scalars().all()


async def create_user(db: AsyncSession, user: User):
    if not user.password_hash.startswith("$2b$"):
        user.password_hash = get_password_hash(user.password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    defaults = get_default_permissions_for_role(user.role)
    if defaults:
        await assign_permissions_by_names(db, user, defaults)
    return user


async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.permissions))
    )
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.permissions))
    )
    return result.scalar_one_or_none()


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).options(selectinload(User.permissions)).order_by(User.id)
    )
    return result.scalars().all()


async def save_user(db: AsyncSession, user: User) -> User:
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.commit()


async def create_child(db: AsyncSession, child: Child):
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def create_child_for_user(db: AsyncSession, child: Child, user_id: int):
    db.add(child)
    await db.commit()
    await db.refresh(child)

    # Create an associated account with default interest settings
    account = Account(child_id=child.id)
    db.add(account)
    await db.commit()
    await db.refresh(account)

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
    result = await db.execute(
        select(Child).where(Child.access_code == access_code)
    )
    return result.scalars().first()


async def get_child(db: AsyncSession, child_id: int) -> Child | None:
    result = await db.execute(select(Child).where(Child.id == child_id))
    return result.scalar_one_or_none()


async def get_all_children(db: AsyncSession) -> list[Child]:
    result = await db.execute(select(Child).order_by(Child.id))
    return result.scalars().all()


async def save_child(db: AsyncSession, child: Child) -> Child:
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def delete_child(db: AsyncSession, child: Child) -> None:
    await db.delete(child)
    await db.commit()


async def set_child_frozen(
    db: AsyncSession, child_id: int, frozen: bool
) -> Child | None:
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        return None
    child.account_frozen = frozen
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def get_account_by_child(
    db: AsyncSession, child_id: int
) -> Account | None:
    result = await db.execute(
        select(Account).where(Account.child_id == child_id)
    )
    return result.scalar_one_or_none()


async def set_interest_rate(
    db: AsyncSession, child_id: int, rate: float
) -> Account | None:
    account = await get_account_by_child(db, child_id)
    if not account:
        return None
    account.interest_rate = rate
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def set_penalty_interest_rate(
    db: AsyncSession, child_id: int, rate: float
) -> Account | None:
    account = await get_account_by_child(db, child_id)
    if not account:
        return None
    account.penalty_interest_rate = rate
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def create_transaction(db: AsyncSession, tx: Transaction) -> Transaction:
    """Persist a ledger transaction."""
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def get_transaction(
    db: AsyncSession, transaction_id: int
) -> Transaction | None:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    return result.scalar_one_or_none()


async def save_transaction(db: AsyncSession, tx: Transaction) -> Transaction:
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(db: AsyncSession, tx: Transaction) -> None:
    await db.delete(tx)
    await db.commit()


async def get_transactions_by_child(
    db: AsyncSession, child_id: int
) -> list[Transaction]:
    result = await db.execute(
        select(Transaction)
        .where(Transaction.child_id == child_id)
        .order_by(Transaction.timestamp)
    )
    return result.scalars().all()


async def get_all_transactions(db: AsyncSession) -> list[Transaction]:
    result = await db.execute(
        select(Transaction).order_by(Transaction.timestamp)
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


async def recalc_interest(db: AsyncSession, child_id: int) -> None:
    account = await get_account_by_child(db, child_id)
    if not account:
        return

    # Remove previously generated interest transactions
    await db.execute(
        delete(Transaction).where(
            Transaction.child_id == child_id,
            Transaction.initiated_by == "system",
            Transaction.memo == "Interest",
        )
    )
    await db.commit()

    transactions = await db.execute(
        select(Transaction)
        .where(
            Transaction.child_id == child_id,
            Transaction.initiated_by != "system",
        )
        .order_by(Transaction.timestamp)
    )
    base_txs = list(transactions.scalars().all())

    if not base_txs:
        account.total_interest_earned = 0.0
        await db.commit()
        return

    start_date = base_txs[0].timestamp.date()
    current_balance = 0.0
    tx_idx = 0
    today = date.today()
    total_interest = 0.0
    day = start_date

    while day < today:
        while (
            tx_idx < len(base_txs) and base_txs[tx_idx].timestamp.date() == day
        ):
            tx = base_txs[tx_idx]
            if tx.type == "credit":
                current_balance += tx.amount
            else:
                current_balance -= tx.amount
            tx_idx += 1

        rate = (
            account.interest_rate
            if current_balance >= 0
            else account.penalty_interest_rate
        )
        interest = current_balance * rate
        if interest != 0:
            tx_time = datetime.combine(day + timedelta(days=1), time.min)
            interest_tx = Transaction(
                child_id=child_id,
                type="credit" if interest >= 0 else "debit",
                amount=abs(interest),
                memo="Interest",
                initiated_by="system",
                initiator_id=0,
                timestamp=tx_time,
            )
            db.add(interest_tx)
            current_balance += interest
            total_interest += interest

        day += timedelta(days=1)

    account.total_interest_earned = total_interest
    account.last_interest_applied = today
    db.add(account)
    await db.commit()


async def create_withdrawal_request(
    db: AsyncSession, req: WithdrawalRequest
) -> WithdrawalRequest:
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_pending_withdrawals_for_parent(
    db: AsyncSession, parent_id: int
) -> list[WithdrawalRequest]:
    query = (
        select(WithdrawalRequest)
        .join(Child)
        .join(ChildUserLink)
        .where(
            ChildUserLink.user_id == parent_id,
            WithdrawalRequest.status == "pending",
        )
        .order_by(WithdrawalRequest.requested_at)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def get_withdrawal_requests_by_child(
    db: AsyncSession, child_id: int
) -> list[WithdrawalRequest]:
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.child_id == child_id)
        .order_by(WithdrawalRequest.requested_at.desc())
    )
    return result.scalars().all()


async def get_withdrawal_request(
    db: AsyncSession, request_id: int
) -> WithdrawalRequest | None:
    result = await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.id == request_id)
    )
    return result.scalar_one_or_none()


async def save_withdrawal_request(
    db: AsyncSession, req: WithdrawalRequest
) -> WithdrawalRequest:
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def create_cd(
    db: AsyncSession, cd: CertificateDeposit
) -> CertificateDeposit:
    db.add(cd)
    await db.commit()
    await db.refresh(cd)
    return cd


async def get_cd(db: AsyncSession, cd_id: int) -> CertificateDeposit | None:
    result = await db.execute(
        select(CertificateDeposit).where(CertificateDeposit.id == cd_id)
    )
    return result.scalar_one_or_none()


async def save_cd(
    db: AsyncSession, cd: CertificateDeposit
) -> CertificateDeposit:
    db.add(cd)
    await db.commit()
    await db.refresh(cd)
    return cd


async def get_cds_by_child(
    db: AsyncSession, child_id: int
) -> list[CertificateDeposit]:
    result = await db.execute(
        select(CertificateDeposit)
        .where(CertificateDeposit.child_id == child_id)
        .order_by(CertificateDeposit.created_at)
    )
    return result.scalars().all()


async def redeem_cd(
    db: AsyncSession, cd: CertificateDeposit, treat_as_mature: bool = False
) -> CertificateDeposit:
    """Redeem a CD either at maturity or early.

    When ``treat_as_mature`` is ``True`` the CD pays out as though it reached
    maturity even if the ``matures_at`` date is in the future. This is used by
    the testing helper.
    """

    from .crud import create_transaction, recalc_interest  # avoid circular

    if cd.status != "accepted":
        return cd

    matured = treat_as_mature
    if cd.matures_at:
        matured = matured or datetime.utcnow() >= cd.matures_at

    if matured:
        payout = round(cd.amount * (1 + cd.interest_rate), 2)
        await create_transaction(
            db,
            Transaction(
                child_id=cd.child_id,
                type="credit",
                amount=payout,
                memo=f"CD #{cd.id} maturity",
                initiated_by="system",
                initiator_id=0,
            ),
        )
    else:
        await create_transaction(
            db,
            Transaction(
                child_id=cd.child_id,
                type="credit",
                amount=cd.amount,
                memo=f"CD #{cd.id} early withdrawal",
                initiated_by="system",
                initiator_id=0,
            ),
        )
        await create_transaction(
            db,
            Transaction(
                child_id=cd.child_id,
                type="debit",
                amount=round(cd.amount * 0.1, 2),
                memo=f"CD #{cd.id} early withdrawal penalty",
                initiated_by="system",
                initiator_id=0,
            ),
        )

    cd.status = "redeemed"
    cd.redeemed_at = datetime.utcnow()
    await save_cd(db, cd)
    await recalc_interest(db, cd.child_id)
    return cd


async def redeem_matured_cds(db: AsyncSession) -> None:
    result = await db.execute(
        select(CertificateDeposit).where(
            CertificateDeposit.status == "accepted",
            CertificateDeposit.matures_at <= datetime.utcnow(),
        )
    )
    cds = result.scalars().all()
    for cd in cds:
        await redeem_cd(db, cd)
