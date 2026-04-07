"""Schemas for recurring charges applied to child accounts."""

from datetime import date
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    SanitizedMemo,
    normalize_optional_text,
)


class RecurringChargeBase(BaseModel):
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    type: Literal["credit", "debit"] = "debit"
    memo: Optional[Annotated[str, SanitizedMemo]] = None
    interval_days: int = Field(ge=1, le=3650)
    next_run: date

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class RecurringChargeCreate(RecurringChargeBase):
    pass


class RecurringChargeRead(RecurringChargeBase):
    id: int
    child_id: int
    active: bool

    model_config = ConfigDict(from_attributes=True)


class RecurringChargeUpdate(BaseModel):
    amount: float | None = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    type: Literal["credit", "debit"] | None = None
    memo: Annotated[str, SanitizedMemo] | None = None
    interval_days: int | None = Field(default=None, ge=1, le=3650)
    next_run: date | None = None
    active: bool | None = None

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)
