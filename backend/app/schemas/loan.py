from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class LoanCreate(BaseModel):
    child_id: int
    amount: float
    purpose: Optional[str] = None


class LoanRead(BaseModel):
    id: int
    child_id: int
    parent_id: Optional[int]
    amount: float
    purpose: Optional[str]
    interest_rate: float
    status: str
    principal_remaining: float
    created_at: datetime

    class Config:
        from_attributes = True


class LoanApprove(BaseModel):
    interest_rate: float


class LoanPayment(BaseModel):
    amount: float
