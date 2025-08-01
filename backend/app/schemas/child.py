from pydantic import BaseModel, Field
from typing import Optional


class ChildCreate(BaseModel):
    first_name: str
    access_code: str
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
    access_code: str


class InterestRateUpdate(BaseModel):
    interest_rate: float


class PenaltyRateUpdate(BaseModel):
    penalty_interest_rate: float


class CDPenaltyRateUpdate(BaseModel):
    cd_penalty_rate: float


class ChildUpdate(BaseModel):
    first_name: str | None = None
    access_code: str | None = None
    frozen: bool | None = None
