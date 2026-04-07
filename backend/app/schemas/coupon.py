from pydantic import BaseModel
from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import Field, field_validator

from app.schemas.validation import (
    MAX_MONEY_AMOUNT,
    SanitizedMemo,
    SanitizedShortText,
    normalize_optional_text,
)


class CouponBase(BaseModel):
    amount: float = Field(ge=0, le=MAX_MONEY_AMOUNT)
    memo: Optional[Annotated[str, SanitizedMemo]] = None
    expiration: Optional[datetime] = None
    max_uses: int = Field(default=1, ge=1, le=1000)
    scope: Literal["child", "my_children", "all_children"] = "child"
    child_id: Optional[int] = None

    @field_validator("memo", mode="before")
    @classmethod
    def _normalize_memo(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class CouponCreate(CouponBase):
    pass


class CouponRead(CouponBase):
    id: int
    code: str
    uses_remaining: int
    created_by: int
    qr_code: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CouponRedeem(BaseModel):
    code: Annotated[str, SanitizedShortText]

    @field_validator("code", mode="before")
    @classmethod
    def _normalize_code(cls, value: str) -> str:
        return normalize_optional_text(value) or ""


class CouponRedemptionRead(BaseModel):
    id: int
    coupon: CouponRead
    child_id: int
    redeemed_at: datetime

    class Config:
        from_attributes = True
