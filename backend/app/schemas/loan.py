from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    MAX_RATE,
    SanitizedLongText,
    SanitizedMemo,
    normalize_optional_text,
)


class LoanCreate(BaseModel):
    child_id: int
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    purpose: Optional[Annotated[str, SanitizedMemo]] = None

    @field_validator("purpose", mode="before")
    @classmethod
    def _normalize_purpose(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class LoanRead(BaseModel):
    id: int
    child_id: int
    parent_id: Optional[int]
    amount: float
    purpose: Optional[str]
    interest_rate: float
    terms: Optional[str]
    status: str
    principal_remaining: float
    created_at: datetime

    class Config:
        from_attributes = True


class LoanApprove(BaseModel):
    interest_rate: float = Field(ge=0, le=MAX_RATE)
    terms: Optional[Annotated[str, SanitizedLongText]] = None

    @field_validator("terms", mode="before")
    @classmethod
    def _normalize_terms(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class LoanPayment(BaseModel):
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)


class LoanRateUpdate(BaseModel):
    interest_rate: float = Field(ge=0, le=MAX_RATE)
