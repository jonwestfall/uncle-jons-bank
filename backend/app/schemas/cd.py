"""Schemas for certificate of deposit operations."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.validation import MAX_MONEY_AMOUNT, MAX_RATE


class CDCreate(BaseModel):
    child_id: int
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    interest_rate: float = Field(ge=0, le=MAX_RATE)
    term_days: int = Field(ge=0, le=3650)


class CDRead(BaseModel):
    id: int
    child_id: int
    parent_id: int
    amount: float
    interest_rate: float
    term_days: int
    status: Literal["offered", "accepted", "rejected", "redeemed"]
    created_at: datetime
    accepted_at: Optional[datetime] = None
    matures_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None

    class Config:
        model_config = {"from_attributes": True}
