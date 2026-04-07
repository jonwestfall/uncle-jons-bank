"""Pydantic models for child accounts and updates."""

from typing import Annotated, Optional

from pydantic import BaseModel, Field

from app.schemas.validation import (
    MAX_RATE,
    SanitizedAccessCode,
    SanitizedName,
)


class ChildCreate(BaseModel):
    first_name: Annotated[str, SanitizedName]
    access_code: Annotated[str, SanitizedAccessCode]
    frozen: Optional[bool] = False


class ChildRead(BaseModel):
    id: int
    first_name: str
    frozen: bool = Field(alias="account_frozen")
    interest_rate: float | None = None
    penalty_interest_rate: float | None = None
    cd_penalty_rate: float | None = None
    total_interest_earned: float | None = None

    class Config:
        model_config = {"from_attributes": True}


class ChildLogin(BaseModel):
    access_code: Annotated[str, SanitizedAccessCode]


class InterestRateUpdate(BaseModel):
    interest_rate: float = Field(ge=0, le=MAX_RATE)


class PenaltyRateUpdate(BaseModel):
    penalty_interest_rate: float = Field(ge=0, le=MAX_RATE)


class CDPenaltyRateUpdate(BaseModel):
    cd_penalty_rate: float = Field(ge=0, le=MAX_RATE)


class ChildUpdate(BaseModel):
    first_name: Annotated[str, SanitizedName] | None = None
    access_code: Annotated[str, SanitizedAccessCode] | None = None
    frozen: bool | None = None


class AccessCodeUpdate(BaseModel):
    access_code: Annotated[str, SanitizedAccessCode]
