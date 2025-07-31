from typing import Optional, List
from datetime import datetime, date
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    password_hash: str
    role: str  # 'viewer', 'depositor', 'withdrawer', 'admin'

    children: List["ChildUserLink"] = Relationship(back_populates="user")


class Child(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    access_code: str
    account_frozen: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    parents: List["ChildUserLink"] = Relationship(back_populates="child")
    account: Optional["Account"] = Relationship(back_populates="child")
    transactions: List["Transaction"] = Relationship(back_populates="child")


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
