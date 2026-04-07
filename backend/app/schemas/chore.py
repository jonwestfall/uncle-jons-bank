from datetime import date
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    SanitizedMemo,
    normalize_optional_text,
)


class ChoreBase(BaseModel):
    description: Annotated[str, SanitizedMemo]
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    interval_days: Optional[int] = Field(default=None, ge=1, le=3650)
    next_due: Optional[date] = None

    @field_validator("description", mode="before")
    @classmethod
    def _normalize_description(cls, value: str) -> str:
        return normalize_optional_text(value) or ""


class ChoreCreate(ChoreBase):
    pass


class ChoreRead(ChoreBase):
    id: int
    child_id: int
    status: Literal[
        "pending",
        "awaiting_approval",
        "completed",
        "proposed",
        "rejected",
    ]
    active: bool
    created_by_child: bool

    class Config:
        from_attributes = True


class ChoreUpdate(BaseModel):
    description: Optional[Annotated[str, SanitizedMemo]] = None
    amount: Optional[float] = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    interval_days: Optional[int] = Field(default=None, ge=1, le=3650)
    next_due: Optional[date] = None
    active: Optional[bool] = None
    status: Optional[
        Literal["pending", "awaiting_approval", "completed", "proposed", "rejected"]
    ] = None

    @field_validator("description", mode="before")
    @classmethod
    def _normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)
