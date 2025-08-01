from typing import Optional, List
from datetime import datetime, date
from sqlmodel import SQLModel, Field, Relationship


class UserPermissionLink(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    permission_id: int = Field(foreign_key="permission.id", primary_key=True)

    user: "User" = Relationship(back_populates="permission_links")
    permission: "Permission" = Relationship(back_populates="user_links")


class Permission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_links: List["UserPermissionLink"] = Relationship(back_populates="permission")
    users: List["User"] = Relationship(
        back_populates="permissions", link_model=UserPermissionLink
    )


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    password_hash: str
    role: str  # 'viewer', 'depositor', 'withdrawer', 'admin'

    children: List["ChildUserLink"] = Relationship(back_populates="user")
    permission_links: List["UserPermissionLink"] = Relationship(back_populates="user")
    permissions: List[Permission] = Relationship(
        back_populates="users", link_model=UserPermissionLink
    )


class Child(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    access_code: str
    account_frozen: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    parents: List["ChildUserLink"] = Relationship(back_populates="child")
    account: Optional["Account"] = Relationship(back_populates="child")
    transactions: List["Transaction"] = Relationship(back_populates="child")
    withdrawal_requests: List["WithdrawalRequest"] = Relationship(
        back_populates="child"
    )


class ChildUserLink(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    child_id: int = Field(foreign_key="child.id", primary_key=True)

    user: User = Relationship(back_populates="children")
    child: Child = Relationship(back_populates="parents")


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    balance: float = 0.0
    interest_rate: float = 0.01  # Daily rate (e.g., 0.01 = 1%)
    last_interest_applied: Optional[date] = None
    total_interest_earned: float = 0.0

    child: Child = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    """Ledger transaction representing credits and debits on a child's account."""

    id: Optional[int] = Field(default=None, primary_key=True, alias="transaction_id")
    child_id: int = Field(foreign_key="child.id")
    type: str  # "credit" or "debit"
    amount: float
    memo: Optional[str] = None
    initiated_by: str  # "child" or "parent"
    initiator_id: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    child: Child = Relationship(back_populates="transactions")


class WithdrawalRequest(SQLModel, table=True):
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
