from pydantic import BaseModel, Field
from typing import Optional
"""Schemas for certificate of deposit operations."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CDCreate(BaseModel):
    child_id: int
    amount: float
    interest_rate: float
    term_days: int


class CDRead(BaseModel):
    id: int
    child_id: int
    parent_id: int
    amount: float
    interest_rate: float
    term_days: int
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None
    matures_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None

    class Config:
        model_config = {"from_attributes": True}
