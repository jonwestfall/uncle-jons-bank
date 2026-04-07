"""Schemas for child withdrawal requests and admin responses."""

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    SanitizedLongText,
    SanitizedMemo,
    normalize_optional_text,
)


class WithdrawalRequestCreate(BaseModel):
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    memo: Optional[Annotated[str, SanitizedMemo]] = None

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class WithdrawalRequestRead(BaseModel):
    id: int
    child_id: int
    amount: float
    memo: Optional[str] = None
    status: Literal["pending", "approved", "denied", "cancelled"]
    requested_at: datetime
    responded_at: Optional[datetime] = None
    denial_reason: Optional[str] = None

    class Config:
        model_config = {"from_attributes": True}


class DenyRequest(BaseModel):
    reason: Annotated[str, SanitizedLongText]

    @field_validator("reason", mode="before")
    @classmethod
    def _normalize_reason(cls, value: str) -> str:
        return normalize_optional_text(value) or ""
