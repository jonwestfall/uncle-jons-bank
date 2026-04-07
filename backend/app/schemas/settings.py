"""Pydantic models for application configuration settings."""

from typing import Annotated

from pydantic import BaseModel, Field

from app.schemas.validation import MAX_MONEY_AMOUNT, MAX_RATE, SanitizedShortText


class SettingsRead(BaseModel):
    site_name: str
    site_url: str
    default_interest_rate: float
    default_penalty_interest_rate: float
    default_cd_penalty_rate: float
    service_fee_amount: float
    service_fee_is_percentage: bool
    overdraft_fee_amount: float
    overdraft_fee_is_percentage: bool
    overdraft_fee_daily: bool
    currency_symbol: str
    public_registration_disabled: bool


class SettingsUpdate(BaseModel):
    site_name: Annotated[str, SanitizedShortText] | None = None
    site_url: str | None = Field(default=None, min_length=1, max_length=500)
    default_interest_rate: float | None = Field(default=None, ge=0, le=MAX_RATE)
    default_penalty_interest_rate: float | None = Field(default=None, ge=0, le=MAX_RATE)
    default_cd_penalty_rate: float | None = Field(default=None, ge=0, le=MAX_RATE)
    service_fee_amount: float | None = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    service_fee_is_percentage: bool | None = None
    overdraft_fee_amount: float | None = Field(default=None, ge=0, le=MAX_MONEY_AMOUNT)
    overdraft_fee_is_percentage: bool | None = None
    overdraft_fee_daily: bool | None = None
    currency_symbol: str | None = Field(default=None, min_length=1, max_length=8)
    public_registration_disabled: bool | None = None
