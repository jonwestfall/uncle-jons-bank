"""Transaction-related request and response models."""

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    SanitizedMemo,
    normalize_optional_text,
)


class TransactionBase(BaseModel):
    child_id: int
    type: Literal["credit", "debit"]
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    memo: Optional[Annotated[str, SanitizedMemo]] = None
    initiated_by: Literal["child", "parent", "system"]
    initiator_id: int

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: Optional[Literal["credit", "debit"]] = None
    amount: Optional[float] = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    memo: Optional[Annotated[str, SanitizedMemo]] = None

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class TransactionRead(TransactionBase):
    transaction_id: int = Field(alias="id")
    timestamp: datetime

    class Config:
        model_config = {"from_attributes": True}


class LedgerResponse(BaseModel):
    balance: float
    transactions: list[TransactionRead]
