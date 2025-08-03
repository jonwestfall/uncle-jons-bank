from pydantic import BaseModel
"""Schemas for child withdrawal requests and admin responses."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class WithdrawalRequestCreate(BaseModel):
    amount: float
    memo: Optional[str] = None


class WithdrawalRequestRead(BaseModel):
    id: int
    child_id: int
    amount: float
    memo: Optional[str] = None
    status: str
    requested_at: datetime
    responded_at: Optional[datetime] = None
    denial_reason: Optional[str] = None

    class Config:
        model_config = {"from_attributes": True}


class DenyRequest(BaseModel):
    reason: str
