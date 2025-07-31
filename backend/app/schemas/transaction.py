from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TransactionBase(BaseModel):
    child_id: int
    type: str
    amount: float
    memo: Optional[str] = None
    initiated_by: str
    initiator_id: int


class TransactionCreate(TransactionBase):
    pass


class TransactionRead(TransactionBase):
    transaction_id: int = Field(alias="id")
    timestamp: datetime

    class Config:
        model_config = {"from_attributes": True}


class LedgerResponse(BaseModel):
    balance: float
    transactions: list[TransactionRead]
