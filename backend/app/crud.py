"""Asynchronous CRUD helpers for the application's data models.

Each function in this module encapsulates a specific database operation
using SQLModel and SQLAlchemy.  Centralizing the logic keeps route
handlers light and makes behavior easier to test.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy import func, case
from datetime import datetime, date, timedelta, time
from app.models import (
    User,
    Child,
    ChildUserLink,
    Transaction,
    WithdrawalRequest,
    Account,
    CertificateDeposit,
    RecurringCharge,
    Chore,
    Permission,
    UserPermissionLink,
    Settings,
    ShareCode,
    Loan,
    LoanTransaction,
    Message,
    Coupon,
    CouponRedemption,
    EducationModule,
    QuizQuestion,
    Badge,
    ChildBadge,
)
from app.auth import get_password_hash, get_child_by_id
from app.acl import get_default_permissions_for_role, ALL_PERMISSIONS
import uuid


async def ensure_permissions_exist(db: AsyncSession, names: list[str]) -> None:
    """Ensure that a set of permission records exists in the database."""

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
    """Assign named permissions to a user if not already granted."""
    for name in names:
        result = await db.execute(
            select(Permission).where(Permission.name == name)
        )
        perm = result.scalar_one_or_none()
        if perm:
            link_result = await db.execute(
                select(UserPermissionLink)
                    .where(
                        UserPermissionLink.user_id == user.id,
                        UserPermissionLink.permission_id == perm.id,
                    )
            )
            link = link_result.scalar_one_or_none()
            if not link:
                db.add(
                    UserPermissionLink(user_id=user.id, permission_id=perm.id)
                )
    await db.commit()


async def remove_permissions_by_names(
    db: AsyncSession, user: User, names: list[str]
) -> None:
    """Remove the specified permissions from a user."""
    for name in names:
        result = await db.execute(
            select(Permission).where(Permission.name == name)
        )
        perm = result.scalar_one_or_none()
        if perm:
            await db.execute(
                delete(UserPermissionLink)
                .where(
                    UserPermissionLink.user_id == user.id,
                    UserPermissionLink.permission_id == perm.id,
                )
            )
    await db.commit()


async def get_all_permissions(db: AsyncSession) -> list[Permission]:
    """Return all permissions ordered alphabetically."""

    result = await db.execute(select(Permission).order_by(Permission.name))
    return result.scalars().all()


async def get_settings(db: AsyncSession) -> Settings:
    """Fetch the singleton settings record, creating it if necessary."""
    result = await db.execute(select(Settings).where(Settings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = Settings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def save_settings(db: AsyncSession, settings: Settings) -> Settings:
    """Persist settings changes and return the refreshed object."""

    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def create_user(db: AsyncSession, user: User):
    """Create a new user, hashing the password and assigning defaults."""

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
    """Return a user by email or ``None`` if not found."""
    result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.permissions))
    )
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    """Load a user by primary key."""
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.permissions))
    )
    return result.scalar_one_or_none()


async def get_all_users(db: AsyncSession) -> list[User]:
    """Return all users with permissions eagerly loaded."""

    result = await db.execute(
        select(User).options(selectinload(User.permissions)).order_by(User.id)
    )
    return result.scalars().all()


async def save_user(db: AsyncSession, user: User) -> User:
    """Persist changes to an existing user."""

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User) -> None:
    """Remove a user from the database."""

    await db.delete(user)
    await db.commit()


async def create_child(db: AsyncSession, child: Child):
    """Persist a new child record."""

    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def create_child_for_user(db: AsyncSession, child: Child, user_id: int):
    """Create a child, associated account, and link in a single transaction."""
    settings = await get_settings(db)
    db.add(child)
    await db.flush()  # ensure child.id is populated

    # Create an associated account with default interest settings
    account = Account(
        child_id=child.id,
        interest_rate=settings.default_interest_rate,
        penalty_interest_rate=settings.default_penalty_interest_rate,
        cd_penalty_rate=settings.default_cd_penalty_rate,
    )
    db.add(account)

    link = ChildUserLink(
        user_id=user_id,
        child_id=child.id,
        permissions=ALL_PERMISSIONS,
        is_owner=True,
    )
    db.add(link)

    await db.commit()
    await db.refresh(child)
    return child


async def get_children_by_user(db: AsyncSession, user_id: int):
    """Return all children associated with a given parent user."""
    query = (
        select(Child)
        .join(ChildUserLink)
        .where(ChildUserLink.user_id == user_id)
    )
    result = await db.execute(query)
    return result.scalars().all()


async def get_child_by_access_code(db: AsyncSession, access_code: str):
    """Return a child by their unique access code."""
    result = await db.execute(
        select(Child).where(Child.access_code == access_code)
    )
    return result.scalars().first()


async def get_child(db: AsyncSession, child_id: int) -> Child | None:
    """Fetch a child by id or ``None`` if not found."""
    result = await db.execute(select(Child).where(Child.id == child_id))
    return result.scalar_one_or_none()


async def get_all_children(db: AsyncSession) -> list[Child]:
    """Return all children ordered by id."""

    result = await db.execute(select(Child).order_by(Child.id))
    return result.scalars().all()


async def save_child(db: AsyncSession, child: Child) -> Child:
    """Persist changes to a child record."""

    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def delete_child(db: AsyncSession, child: Child) -> None:
    """Remove a child record."""
    await db.execute(
        delete(Transaction).where(Transaction.child_id == child.id)
    )
    await db.execute(
        delete(Account).where(Account.child_id == child.id)
    )
    await db.execute(
        delete(ChildUserLink).where(ChildUserLink.child_id == child.id)
    )
    await db.delete(child)
    await db.commit()


async def set_child_frozen(
    db: AsyncSession, child_id: int, frozen: bool
) -> Child:
    """Toggle whether a child's account is frozen."""
    result = await db.execute(select(Child).where(Child.id == child_id))
    child = result.scalar_one_or_none()
    if not child:
        raise ValueError("Child not found")
    child.account_frozen = frozen
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def get_child_user_link(
    db: AsyncSession, user_id: int, child_id: int
) -> ChildUserLink | None:
    result = await db.execute(
        select(ChildUserLink).where(
            ChildUserLink.user_id == user_id,
            ChildUserLink.child_id == child_id,
        )
    )
    return result.scalar_one_or_none()


async def link_child_to_user(
    db: AsyncSession, child_id: int, user_id: int, permissions: list[str], is_owner=False
) -> ChildUserLink:
    link = ChildUserLink(
        user_id=user_id,
        child_id=child_id,
        permissions=permissions,
        is_owner=is_owner,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def remove_child_link(db: AsyncSession, child_id: int, user_id: int) -> None:
    await db.execute(
        delete(ChildUserLink).where(
            ChildUserLink.child_id == child_id,
            ChildUserLink.user_id == user_id,
        )
    )
    await db.commit()


async def get_parents_for_child(
    db: AsyncSession, child_id: int
) -> list[ChildUserLink]:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(ChildUserLink)
        .where(ChildUserLink.child_id == child_id)
        .options(selectinload(ChildUserLink.user))
    )
    return result.scalars().all()


async def create_share_code(
    db: AsyncSession, child_id: int, creator_id: int, permissions: list[str]
) -> ShareCode:
    code = uuid.uuid4().hex[:8]
    share = ShareCode(
        code=code, child_id=child_id, created_by=creator_id, permissions=permissions
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


async def get_share_code(db: AsyncSession, code: str) -> ShareCode | None:
    result = await db.execute(select(ShareCode).where(ShareCode.code == code))
    return result.scalar_one_or_none()


async def mark_share_code_used(
    db: AsyncSession, share: ShareCode, user_id: int
) -> ShareCode:
    share.used_by = user_id
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


async def get_account_by_child(
    db: AsyncSession, child_id: int
) -> Account | None:
    """Return the account associated with a child if it exists."""
    result = await db.execute(
        select(Account).where(Account.child_id == child_id)
    )
    return result.scalar_one_or_none()


async def get_all_accounts(db: AsyncSession) -> list[Account]:
    """Return all account records."""

    result = await db.execute(select(Account))
    return result.scalars().all()


async def set_interest_rate(
    db: AsyncSession, child_id: int, rate: float
) -> Account:
    """Update the standard interest rate for an account."""
    account = await get_account_by_child(db, child_id)
    if not account:
        raise ValueError("Account not found")
    account.interest_rate = rate
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def set_penalty_interest_rate(
    db: AsyncSession, child_id: int, rate: float
) -> Account:
    """Update the penalty interest rate used for negative balances."""
    account = await get_account_by_child(db, child_id)
    if not account:
        raise ValueError("Account not found")
    account.penalty_interest_rate = rate
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def set_cd_penalty_rate(
    db: AsyncSession, child_id: int, rate: float
) -> Account:
    """Update the early withdrawal penalty rate for certificates."""
    account = await get_account_by_child(db, child_id)
    if not account:
        raise ValueError("Account not found")
    account.cd_penalty_rate = rate
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
    """Return a transaction by id or ``None`` if missing."""
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    return result.scalar_one_or_none()


async def save_transaction(db: AsyncSession, tx: Transaction) -> Transaction:
    """Persist updates to a transaction."""

    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(db: AsyncSession, tx: Transaction) -> None:
    """Remove a transaction from the ledger."""

    await db.delete(tx)
    await db.commit()


async def get_transactions_by_child(
    db: AsyncSession, child_id: int
) -> list[Transaction]:
    """Return all transactions for a child ordered by time."""

    result = await db.execute(
        select(Transaction)
        .where(Transaction.child_id == child_id)
        .order_by(Transaction.timestamp)
    )
    return result.scalars().all()


async def get_all_transactions(db: AsyncSession) -> list[Transaction]:
    """Return the full ledger across all children."""

    result = await db.execute(
        select(Transaction).order_by(Transaction.timestamp)
    )
    return result.scalars().all()


async def calculate_balance(db: AsyncSession, child_id: int) -> float:
    """Calculate the running balance for a child's account."""

    total = func.coalesce(
        func.sum(
            case(
                (Transaction.type == "credit", Transaction.amount),
                else_=-Transaction.amount,
            )
        ),
        0.0,
    )
    result = await db.execute(
        select(total).where(Transaction.child_id == child_id)
    )
    return float(result.scalar_one())


async def recalc_interest(db: AsyncSession, child_id: int) -> None:
    """Recalculate and post daily interest transactions."""
    account = await get_account_by_child(db, child_id)
    if not account:
        raise ValueError("Account not found")

    # Determine starting point for recalculation
    first_tx_result = await db.execute(
        select(func.min(Transaction.timestamp)).where(
            Transaction.child_id == child_id
        )
    )
    first_tx_time = first_tx_result.scalar_one_or_none()
    if not first_tx_time:
        account.last_interest_applied = date.today()
        db.add(account)
        await db.commit()
        return

    start_date = account.last_interest_applied or first_tx_time.date()
    today = date.today()

    # Balance prior to start_date
    bal_before_result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == "credit", Transaction.amount),
                        else_=-Transaction.amount,
                    )
                ),
                0.0,
            )
        ).where(
            Transaction.child_id == child_id,
            Transaction.timestamp < datetime.combine(start_date, time.min),
        )
    )
    current_balance = float(bal_before_result.scalar_one())

    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.child_id == child_id,
            Transaction.timestamp >= datetime.combine(start_date, time.min),
        )
        .order_by(Transaction.timestamp)
    )
    txs = list(result.scalars().all())

    total_interest = account.total_interest_earned
    tx_idx = 0

    day = start_date
    while day < today:
        while tx_idx < len(txs) and txs[tx_idx].timestamp.date() == day:
            tx = txs[tx_idx]
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


async def apply_service_fee(
    db: AsyncSession, account: Account, settings: Settings, today: date
) -> None:
    """Apply a monthly service fee on the first day of the month."""
    if today.day != 1:
        return
    if account.service_fee_last_charged and account.service_fee_last_charged.month == today.month and account.service_fee_last_charged.year == today.year:
        return
    balance = await calculate_balance(db, account.child_id)
    fee = (
        abs(balance) * settings.service_fee_amount
        if settings.service_fee_is_percentage
        else settings.service_fee_amount
    )
    fee = round(fee, 2)
    if fee <= 0:
        return
    tx = Transaction(
        child_id=account.child_id,
        type="debit",
        amount=fee,
        memo="Service Fee",
        initiated_by="system",
        initiator_id=0,
        timestamp=datetime.combine(today, time.min),
    )
    await create_transaction(db, tx)
    account.service_fee_last_charged = today
    db.add(account)
    await db.commit()


async def apply_overdraft_fee(
    db: AsyncSession, account: Account, settings: Settings, today: date
) -> None:
    """Charge an overdraft fee when an account balance is negative."""
    balance = await calculate_balance(db, account.child_id)
    if balance < 0:
        fee = (
            abs(balance) * settings.overdraft_fee_amount
            if settings.overdraft_fee_is_percentage
            else settings.overdraft_fee_amount
        )
        fee = round(fee, 2)
        if fee > 0:
            if settings.overdraft_fee_daily:
                if account.overdraft_fee_last_charged != today:
                    tx = Transaction(
                        child_id=account.child_id,
                        type="debit",
                        amount=fee,
                        memo="Overdraft Fee",
                        initiated_by="system",
                        initiator_id=0,
                    )
                    await create_transaction(db, tx)
                    account.overdraft_fee_last_charged = today
            else:
                if not account.overdraft_fee_charged:
                    tx = Transaction(
                        child_id=account.child_id,
                        type="debit",
                        amount=fee,
                        memo="Overdraft Fee",
                        initiated_by="system",
                        initiator_id=0,
                    )
                    await create_transaction(db, tx)
                    account.overdraft_fee_charged = True
                    account.overdraft_fee_last_charged = today
    else:
        if account.overdraft_fee_charged or account.overdraft_fee_last_charged:
            account.overdraft_fee_charged = False
            account.overdraft_fee_last_charged = None
    db.add(account)
    await db.commit()


async def post_transaction_update(db: AsyncSession, child_id: int) -> None:
    await recalc_interest(db, child_id)
    settings = await get_settings(db)
    account = await get_account_by_child(db, child_id)
    if account:
        await apply_overdraft_fee(db, account, settings, date.today())


async def apply_promotion(
    db: AsyncSession,
    amount: float,
    is_percentage: bool,
    credit: bool,
    memo: str | None = None,
) -> int:
    """Apply a promotional credit or debit to every account."""

    accounts = await get_all_accounts(db)
    count = 0
    for account in accounts:
        balance = await calculate_balance(db, account.child_id)
        adj = amount * balance if is_percentage else amount
        adj = round(adj, 2)
        if adj == 0:
            continue
        tx = Transaction(
            child_id=account.child_id,
            type="credit" if credit else "debit",
            amount=abs(adj),
            memo=memo or "Promotion",
            initiated_by="system",
            initiator_id=0,
        )
        await create_transaction(db, tx)
        await post_transaction_update(db, account.child_id)
        count += 1
    return count


async def create_withdrawal_request(
    db: AsyncSession, req: WithdrawalRequest
) -> WithdrawalRequest:
    """Persist a pending withdrawal request."""

    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_pending_withdrawals_for_parent(
    db: AsyncSession, parent_id: int
) -> list[WithdrawalRequest]:
    """Return pending withdrawal requests for children of a parent."""
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
    """Return withdrawal requests for a specific child."""
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.child_id == child_id)
        .order_by(WithdrawalRequest.requested_at.desc())
    )
    return result.scalars().all()


async def get_withdrawal_request(
    db: AsyncSession, request_id: int
) -> WithdrawalRequest | None:
    """Return a single withdrawal request by id."""
    result = await db.execute(
        select(WithdrawalRequest).where(WithdrawalRequest.id == request_id)
    )
    return result.scalar_one_or_none()


async def save_withdrawal_request(
    db: AsyncSession, req: WithdrawalRequest
) -> WithdrawalRequest:
    """Persist changes to a withdrawal request."""

    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def create_cd(
    db: AsyncSession, cd: CertificateDeposit
) -> CertificateDeposit:
    """Create a certificate of deposit record."""

    db.add(cd)
    await db.commit()
    await db.refresh(cd)
    return cd


async def get_cd(db: AsyncSession, cd_id: int) -> CertificateDeposit | None:
    """Return a CD by id or ``None`` if not found."""
    result = await db.execute(
        select(CertificateDeposit).where(CertificateDeposit.id == cd_id)
    )
    return result.scalar_one_or_none()


async def save_cd(
    db: AsyncSession, cd: CertificateDeposit
) -> CertificateDeposit:
    """Persist updates to a certificate of deposit."""

    db.add(cd)
    await db.commit()
    await db.refresh(cd)
    return cd


async def get_cds_by_child(
    db: AsyncSession, child_id: int
) -> list[CertificateDeposit]:
    """Return all CDs for a particular child."""
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
        account = await get_account_by_child(db, cd.child_id)
        penalty_rate = account.cd_penalty_rate if account else 0.1
        await create_transaction(
            db,
            Transaction(
                child_id=cd.child_id,
                type="debit",
                amount=round(cd.amount * penalty_rate, 2),
                memo=f"CD #{cd.id} early withdrawal penalty",
                initiated_by="system",
                initiator_id=0,
            ),
        )

    cd.status = "redeemed"
    cd.redeemed_at = datetime.utcnow()
    await save_cd(db, cd)
    await recalc_interest(db, cd.child_id)
    settings = await get_settings(db)
    account = await get_account_by_child(db, cd.child_id)
    if account:
        await apply_overdraft_fee(db, account, settings, date.today())
    return cd


async def redeem_matured_cds(db: AsyncSession) -> None:
    """Redeem all CDs that have reached their maturity date."""
    result = await db.execute(
        select(CertificateDeposit).where(
            CertificateDeposit.status == "accepted",
            CertificateDeposit.matures_at <= datetime.utcnow(),
        )
    )
    cds = result.scalars().all()
    for cd in cds:
        await redeem_cd(db, cd)


async def create_recurring_charge(db: AsyncSession, rc: RecurringCharge) -> RecurringCharge:
    """Store a new recurring charge definition."""

    db.add(rc)
    await db.commit()
    await db.refresh(rc)
    return rc


async def get_recurring_charge(db: AsyncSession, rc_id: int) -> RecurringCharge | None:
    """Fetch a recurring charge by id."""
    result = await db.execute(
        select(RecurringCharge).where(RecurringCharge.id == rc_id)
    )
    return result.scalar_one_or_none()


async def get_recurring_charges_by_child(
    db: AsyncSession, child_id: int
) -> list[RecurringCharge]:
    """List all recurring charges scheduled for a child."""
    result = await db.execute(
        select(RecurringCharge).where(RecurringCharge.child_id == child_id)
    )
    return result.scalars().all()


async def save_recurring_charge(db: AsyncSession, rc: RecurringCharge) -> RecurringCharge:
    db.add(rc)
    await db.commit()
    await db.refresh(rc)
    return rc


async def delete_recurring_charge(db: AsyncSession, rc: RecurringCharge) -> None:
    """Remove a recurring charge from the database."""

    await db.delete(rc)
    await db.commit()


async def process_due_recurring_charges(db: AsyncSession) -> None:
    """Process and apply any recurring charges that are due today."""

    today = date.today()
    result = await db.execute(
        select(RecurringCharge).where(
            RecurringCharge.active == True,  # noqa: E712
            RecurringCharge.next_run <= today,
        )
    )
    charges = result.scalars().all()
    for charge in charges:
        while charge.next_run <= today and charge.active:
            await create_transaction(
                db,
                Transaction(
                    child_id=charge.child_id,
                    type=charge.type,
                    amount=charge.amount,
                    memo=charge.memo,
                    initiated_by="system",
                    initiator_id=0,
                ),
            )
            charge.next_run = charge.next_run + timedelta(days=charge.interval_days)
            db.add(charge)
            await db.commit()
            await db.refresh(charge)


# --- Loan helpers -------------------------------------------------------


async def create_loan(db: AsyncSession, loan: Loan) -> Loan:
    """Persist a new loan request."""

    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


async def get_loan(db: AsyncSession, loan_id: int) -> Loan | None:
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    return result.scalar_one_or_none()


async def get_loans_by_child(db: AsyncSession, child_id: int) -> list[Loan]:
    result = await db.execute(select(Loan).where(Loan.child_id == child_id))
    return result.scalars().all()


async def save_loan(db: AsyncSession, loan: Loan) -> Loan:
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


async def record_loan_transaction(db: AsyncSession, tx: LoanTransaction) -> LoanTransaction:
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def recalc_loan_interest(db: AsyncSession, loan: Loan) -> None:
    """Accrue interest on a loan for any missed days."""

    today = date.today()
    if loan.status != "active":
        return

    start_day = loan.last_interest_applied or loan.created_at.date()
    if start_day >= today:
        return

    day = start_day
    while day < today:
        interest = round(loan.principal_remaining * loan.interest_rate, 2)
        if interest != 0:
            loan.principal_remaining += interest
            await record_loan_transaction(
                db,
                LoanTransaction(
                    loan_id=loan.id,
                    type="interest",
                    amount=interest,
                    memo="Interest",
                    timestamp=datetime.combine(day + timedelta(days=1), time.min),
                ),
            )
        day += timedelta(days=1)

    loan.last_interest_applied = today
    await save_loan(db, loan)


async def get_active_loans(db: AsyncSession) -> list[Loan]:
    result = await db.execute(select(Loan).where(Loan.status == "active"))
    return result.scalars().all()


async def process_loan_interest(db: AsyncSession) -> None:
    loans = await get_active_loans(db)
    for loan in loans:
        await recalc_loan_interest(db, loan)


# --- Chore helpers ------------------------------------------------------


async def create_chore(db: AsyncSession, chore: Chore) -> Chore:
    """Persist a new chore."""

    db.add(chore)
    await db.commit()
    await db.refresh(chore)
    return chore


async def get_chore(db: AsyncSession, chore_id: int) -> Chore | None:
    result = await db.execute(select(Chore).where(Chore.id == chore_id))
    return result.scalar_one_or_none()


async def get_chores_by_child(db: AsyncSession, child_id: int) -> list[Chore]:
    result = await db.execute(select(Chore).where(Chore.child_id == child_id))
    return result.scalars().all()


async def save_chore(db: AsyncSession, chore: Chore) -> Chore:
    db.add(chore)
    await db.commit()
    await db.refresh(chore)
    return chore


async def delete_chore(db: AsyncSession, chore: Chore) -> None:
    await db.delete(chore)
    await db.commit()


# --- Messaging helpers ----------------------------------------------------

async def create_message(db: AsyncSession, message: Message) -> Message:
    """Persist a new message."""

    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_message(db: AsyncSession, message_id: int) -> Message | None:
    result = await db.execute(select(Message).where(Message.id == message_id))
    return result.scalar_one_or_none()


async def list_inbox(
    db: AsyncSession, *, user_id: int | None = None, child_id: int | None = None, archived: bool = False
) -> list[Message]:
    stmt = select(Message).where(Message.recipient_archived == archived)
    if user_id is not None:
        stmt = stmt.where(Message.recipient_user_id == user_id)
    if child_id is not None:
        stmt = stmt.where(Message.recipient_child_id == child_id)
    stmt = stmt.order_by(Message.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_sent(
    db: AsyncSession, *, user_id: int | None = None, child_id: int | None = None, archived: bool = False
) -> list[Message]:
    stmt = select(Message).where(Message.sender_archived == archived)
    if user_id is not None:
        stmt = stmt.where(Message.sender_user_id == user_id)
    if child_id is not None:
        stmt = stmt.where(Message.sender_child_id == child_id)
    stmt = stmt.order_by(Message.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def archive_message(
    db: AsyncSession,
    message: Message,
    *,
    as_sender: bool = False,
) -> Message:
    if as_sender:
        message.sender_archived = True
    else:
        message.recipient_archived = True
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_all_messages(db: AsyncSession) -> list[Message]:
    result = await db.execute(select(Message).order_by(Message.created_at.desc()))
    return result.scalars().all()


# Coupon utilities

async def create_coupon(db: AsyncSession, coupon: Coupon) -> Coupon:
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


async def get_coupon_by_code(db: AsyncSession, code: str) -> Coupon | None:
    result = await db.execute(select(Coupon).where(Coupon.code == code))
    return result.scalar_one_or_none()


async def get_coupon(db: AsyncSession, coupon_id: int) -> Coupon | None:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    return result.scalar_one_or_none()


async def list_all_coupons(
    db: AsyncSession, search: str | None = None, scope: str | None = None
) -> list[Coupon]:
    stmt = select(Coupon).order_by(Coupon.created_at.desc())
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            Coupon.code.ilike(like) | Coupon.memo.ilike(like)
        )
    if scope:
        stmt = stmt.where(Coupon.scope == scope)
    result = await db.execute(stmt)
    return result.scalars().all()


async def delete_coupon(db: AsyncSession, coupon: Coupon) -> None:
    await db.delete(coupon)
    await db.commit()


async def list_coupons_by_creator(db: AsyncSession, user_id: int) -> list[Coupon]:
    result = await db.execute(
        select(Coupon)
        .where(Coupon.created_by == user_id)
        .order_by(Coupon.created_at.desc())
    )
    return result.scalars().all()


async def save_coupon(db: AsyncSession, coupon: Coupon) -> Coupon:
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


async def create_coupon_redemption(
    db: AsyncSession, redemption: CouponRedemption
) -> CouponRedemption:
    db.add(redemption)
    await db.commit()
    await db.refresh(redemption)
    return redemption


async def list_redemptions_by_child(
    db: AsyncSession, child_id: int
) -> list[CouponRedemption]:
    result = await db.execute(
        select(CouponRedemption)
        .where(CouponRedemption.child_id == child_id)
        .options(selectinload(CouponRedemption.coupon))
        .order_by(CouponRedemption.redeemed_at.desc())
    )
    return result.scalars().all()


async def ensure_education_content(db: AsyncSession) -> None:
    """Seed the database with built-in educational modules and badges."""

    from app.education_content import EDUCATION_MODULES

    for data in EDUCATION_MODULES:
        result = await db.execute(
            select(EducationModule).where(EducationModule.slug == data["slug"])
        )
        module = result.scalar_one_or_none()
        if not module:
            module = EducationModule(
                slug=data["slug"], title=data["title"], content=data["content"], enabled=True
            )
            db.add(module)
            await db.flush()
            badge = Badge(name=data["badge"], module_id=module.id)
            db.add(badge)
            for q in data["questions"]:
                db.add(
                    QuizQuestion(
                        module_id=module.id,
                        prompt=q["prompt"],
                        options=q["options"],
                        answer_index=q["answer"],
                    )
                )
    await db.commit()


async def get_enabled_modules(db: AsyncSession) -> list[EducationModule]:
    result = await db.execute(
        select(EducationModule)
        .where(EducationModule.enabled == True)  # noqa: E712
        .options(selectinload(EducationModule.questions))
        .order_by(EducationModule.id)
    )
    return result.scalars().all()


async def get_questions_for_module(db: AsyncSession, module_id: int) -> list[QuizQuestion]:
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.module_id == module_id).order_by(QuizQuestion.id)
    )
    return result.scalars().all()


async def get_badge_for_module(db: AsyncSession, module_id: int) -> Badge | None:
    result = await db.execute(select(Badge).where(Badge.module_id == module_id))
    return result.scalar_one_or_none()


async def get_child_badges(db: AsyncSession, child_id: int) -> list[Badge]:
    result = await db.execute(
        select(Badge)
        .join(ChildBadge, ChildBadge.badge_id == Badge.id)
        .where(ChildBadge.child_id == child_id)
        .order_by(Badge.id)
    )
    return result.scalars().all()


async def award_badge_for_module(
    db: AsyncSession,
    child_id: int,
    module_id: int,
    awarded_by: int | None = None,
    source: str = "quiz",
) -> bool:
    badge = await get_badge_for_module(db, module_id)
    if not badge:
        return False
    result = await db.execute(
        select(ChildBadge).where(
            ChildBadge.child_id == child_id, ChildBadge.badge_id == badge.id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return False
    db.add(
        ChildBadge(
            child_id=child_id,
            badge_id=badge.id,
            awarded_by_user_id=awarded_by,
            source=source,
        )
    )
    await db.commit()
    return True
