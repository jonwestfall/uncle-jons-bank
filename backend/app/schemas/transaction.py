from pydantic import BaseModel, Field
"""Transaction-related request and response models."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    child_id: int
    type: str
    amount: float
    memo: Optional[str] = None
    initiated_by: str
    initiator_id: int


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    memo: Optional[str] = None


class TransactionRead(TransactionBase):
    transaction_id: int = Field(alias="id")
    timestamp: datetime

    class Config:
        model_config = {"from_attributes": True}


class LedgerResponse(BaseModel):
    balance: float
    transactions: list[TransactionRead]
