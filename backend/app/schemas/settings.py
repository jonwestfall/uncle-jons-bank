from pydantic import BaseModel


class SettingsRead(BaseModel):
    site_name: str
    default_interest_rate: float
    default_penalty_interest_rate: float
    default_cd_penalty_rate: float


class SettingsUpdate(BaseModel):
    site_name: str | None = None
    default_interest_rate: float | None = None
    default_penalty_interest_rate: float | None = None
    default_cd_penalty_rate: float | None = None
