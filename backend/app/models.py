"""Database models used by Uncle Jon's Bank.

The models are defined with SQLModel (built on SQLAlchemy and Pydantic)
and represent users, children, accounts and financial transactions.
Comments are kept concise to avoid distracting from the field
definitions.
"""

from typing import Optional, List
from datetime import datetime, date
from sqlmodel import SQLModel, Field, Relationship


class UserPermissionLink(SQLModel, table=True):
    """Association table linking users and their granted permissions."""

    user_id: int = Field(foreign_key="user.id", primary_key=True)
    permission_id: int = Field(foreign_key="permission.id", primary_key=True)

    user: "User" = Relationship(back_populates="permission_links")
    permission: "Permission" = Relationship(back_populates="user_links")


class Permission(SQLModel, table=True):
    """Named permission that can be assigned to users."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_links: List["UserPermissionLink"] = Relationship(
        back_populates="permission"
    )
    users: List["User"] = Relationship(
        back_populates="permissions", link_model=UserPermissionLink
    )


class User(SQLModel, table=True):
    """Adult user of the system (e.g. parent or admin)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    password_hash: str
    role: str  # 'viewer', 'depositor', 'withdrawer', 'admin'

    children: List["ChildUserLink"] = Relationship(back_populates="user")
    permission_links: List["UserPermissionLink"] = Relationship(
        back_populates="user"
    )
    permissions: List[Permission] = Relationship(
        back_populates="users", link_model=UserPermissionLink
    )


class Child(SQLModel, table=True):
    """Child account holder."""
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    access_code: str = Field(unique=True)
    account_frozen: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    parents: List["ChildUserLink"] = Relationship(back_populates="child")
    account: Optional["Account"] = Relationship(back_populates="child")
    transactions: List["Transaction"] = Relationship(back_populates="child")
    withdrawal_requests: List["WithdrawalRequest"] = Relationship(
        back_populates="child"
    )


class ChildUserLink(SQLModel, table=True):
    """Many‑to‑many relationship between parents and children."""
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    child_id: int = Field(foreign_key="child.id", primary_key=True)

    user: User = Relationship(back_populates="children")
    child: Child = Relationship(back_populates="parents")


class Account(SQLModel, table=True):
    """Per‑child ledger account storing running balances and rates."""
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    balance: float = 0.0
    interest_rate: float = 0.01  # Daily rate for positive balances
    penalty_interest_rate: float = 0.02  # Daily rate applied when balance < 0
    cd_penalty_rate: float = 0.1  # Penalty for early CD withdrawal
    last_interest_applied: Optional[date] = None
    total_interest_earned: float = 0.0
    service_fee_last_charged: Optional[date] = None
    overdraft_fee_last_charged: Optional[date] = None
    overdraft_fee_charged: bool = False

    child: Child = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    """Ledger transaction representing credits and debits on a child's account."""

    id: Optional[int] = Field(
        default=None, primary_key=True, alias="transaction_id"
    )
    child_id: int = Field(foreign_key="child.id")
    type: str  # "credit" or "debit"
    amount: float
    memo: Optional[str] = None
    initiated_by: str  # "child" or "parent"
    initiator_id: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    child: Child = Relationship(back_populates="transactions")


class WithdrawalRequest(SQLModel, table=True):
    """Parent‑approved withdrawal initiated by a child."""
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    amount: float
    memo: Optional[str] = None
    status: str = "pending"  # pending, approved, denied
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None
    approver_id: Optional[int] = Field(default=None, foreign_key="user.id")
    denial_reason: Optional[str] = None

    child: Child = Relationship(back_populates="withdrawal_requests")
    approver: Optional[User] = Relationship()


class RecurringCharge(SQLModel, table=True):
    """Scheduled transaction that repeats every ``interval_days``."""
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    amount: float
    type: str = "debit"  # "credit" or "debit"
    memo: Optional[str] = None
    interval_days: int
    next_run: date
    active: bool = True

    child: Child = Relationship()


class CertificateDeposit(SQLModel, table=True):
    """Simple certificate of deposit offering a fixed return."""
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    parent_id: int = Field(foreign_key="user.id")
    amount: float
    interest_rate: float
    term_days: int
    status: str = "offered"  # offered, accepted, rejected, redeemed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    matures_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None

    child: Child = Relationship()
    parent: User = Relationship()


class Settings(SQLModel, table=True):
    """Singleton table storing site‑wide configuration values."""
    id: Optional[int] = Field(default=1, primary_key=True)
    site_name: str = "Uncle Jon's Bank"
    default_interest_rate: float = 0.01
    default_penalty_interest_rate: float = 0.02
    default_cd_penalty_rate: float = 0.1
    service_fee_amount: float = 0.0
    service_fee_is_percentage: bool = False
    overdraft_fee_amount: float = 0.0
    overdraft_fee_is_percentage: bool = False
    overdraft_fee_daily: bool = False
    currency_symbol: str = "$"
