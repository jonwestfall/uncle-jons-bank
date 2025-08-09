from datetime import date
from typing import Optional
from pydantic import BaseModel


class ChoreBase(BaseModel):
    description: str
    amount: float
    interval_days: Optional[int] = None
    next_due: Optional[date] = None


class ChoreCreate(ChoreBase):
    pass


class ChoreRead(ChoreBase):
    id: int
    child_id: int
    status: str
    active: bool
    created_by_child: bool

    class Config:
        from_attributes = True


class ChoreUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    interval_days: Optional[int] = None
    next_due: Optional[date] = None
    active: Optional[bool] = None
    status: Optional[str] = None
