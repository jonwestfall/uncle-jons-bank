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
    transactions: List["Transaction"] = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id")
    amount: float
    type: str  # deposit, withdrawal, interest, penalty, bonus
    memo: Optional[str] = None
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    date: datetime = Field(default_factory=datetime.utcnow)
    promotion_id: Optional[int] = Field(default=None)
    status: str = "approved"  # pending, approved, denied
    denial_reason: Optional[str] = None

    account: Account = Relationship(back_populates="transactions")
