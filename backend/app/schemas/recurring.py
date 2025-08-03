from pydantic import BaseModel
from typing import Optional
from datetime import date


class RecurringChargeBase(BaseModel):
    amount: float
    type: str = "debit"
    memo: Optional[str] = None
    interval_days: int
    next_run: date


class RecurringChargeCreate(RecurringChargeBase):
    pass


class RecurringChargeRead(RecurringChargeBase):
    id: int
    child_id: int
    active: bool

    class Config:
        orm_mode = True


class RecurringChargeUpdate(BaseModel):
    amount: float | None = None
    type: str | None = None
    memo: str | None = None
    interval_days: int | None = None
    next_run: date | None = None
    active: bool | None = None
