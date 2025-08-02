from pydantic import BaseModel


class SettingsRead(BaseModel):
    site_name: str
    default_interest_rate: float
    default_penalty_interest_rate: float
    default_cd_penalty_rate: float
    service_fee_amount: float
    service_fee_is_percentage: bool
    overdraft_fee_amount: float
    overdraft_fee_is_percentage: bool
    overdraft_fee_daily: bool


class SettingsUpdate(BaseModel):
    site_name: str | None = None
    default_interest_rate: float | None = None
    default_penalty_interest_rate: float | None = None
    default_cd_penalty_rate: float | None = None
    service_fee_amount: float | None = None
    service_fee_is_percentage: bool | None = None
    overdraft_fee_amount: float | None = None
    overdraft_fee_is_percentage: bool | None = None
    overdraft_fee_daily: bool | None = None
