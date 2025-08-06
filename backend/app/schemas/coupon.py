from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CouponBase(BaseModel):
    amount: float
    memo: Optional[str] = None
    expiration: Optional[datetime] = None
    max_uses: int = 1
    scope: str = "child"  # child, my_children, all_children
    child_id: Optional[int] = None


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
    code: str


class CouponRedemptionRead(BaseModel):
    id: int
    coupon: CouponRead
    child_id: int
    redeemed_at: datetime

    class Config:
        from_attributes = True
