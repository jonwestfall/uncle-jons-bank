from datetime import datetime
import base64
import uuid
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.auth import require_permissions, get_current_user, get_current_identity
from app.acl import PERM_DEPOSIT
from app.models import Coupon, CouponRedemption, Transaction, Child, User
from app.schemas import (
    CouponCreate,
    CouponRead,
    CouponRedeem,
    CouponRedemptionRead,
)
from app.crud import (
    create_coupon,
    get_coupon_by_code,
    list_coupons_by_creator,
    save_coupon,
    create_coupon_redemption,
    list_redemptions_by_child,
    create_transaction,
    get_child_user_link,
)

try:  # optional dependency
    import qrcode
except Exception:  # pragma: no cover - gracefully handle missing library
    qrcode = None

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _generate_qr(code: str) -> str | None:
    if not qrcode:
        return None
    img = qrcode.make(code)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@router.post("/", response_model=CouponRead)
async def create_coupon_route(
    data: CouponCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permissions(PERM_DEPOSIT)),
):
    if current_user.role != "admin" and data.scope == "all_children":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if data.scope == "child":
        if data.child_id is None:
            raise HTTPException(status_code=400, detail="child_id required")
        link = await get_child_user_link(db, current_user.id, data.child_id)
        if not link:
            raise HTTPException(status_code=404, detail="Child not found")
    code = uuid.uuid4().hex[:8]
    qr = _generate_qr(code)
    coupon = Coupon(
        code=code,
        amount=data.amount,
        memo=data.memo,
        expiration=data.expiration,
        max_uses=data.max_uses,
        uses_remaining=data.max_uses,
        created_by=current_user.id,
        scope=data.scope,
        child_id=data.child_id if data.scope == "child" else None,
        qr_code=qr,
    )
    return await create_coupon(db, coupon)


@router.get("/", response_model=list[CouponRead])
async def list_coupons(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await list_coupons_by_creator(db, current_user.id)


@router.post("/redeem", response_model=CouponRedemptionRead)
async def redeem_coupon_route(
    data: CouponRedeem,
    db: AsyncSession = Depends(get_session),
    identity: tuple[str, Child | User] = Depends(get_current_identity),
):
    kind, obj = identity
    if kind != "child":
        raise HTTPException(status_code=403, detail="Only children can redeem")
    child: Child = obj
    coupon = await get_coupon_by_code(db, data.code)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    if coupon.expiration and coupon.expiration < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Coupon expired")
    if coupon.uses_remaining <= 0:
        raise HTTPException(status_code=400, detail="Coupon already redeemed")
    if coupon.scope == "child" and coupon.child_id != child.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if coupon.scope == "my_children":
        link = await get_child_user_link(db, coupon.created_by, child.id)
        if not link:
            raise HTTPException(status_code=403, detail="Not authorized")
    tx = Transaction(
        child_id=child.id,
        type="credit",
        amount=coupon.amount,
        memo=coupon.memo,
        initiated_by="child",
        initiator_id=child.id,
    )
    await create_transaction(db, tx)
    redemption = CouponRedemption(coupon_id=coupon.id, child_id=child.id)
    redemption = await create_coupon_redemption(db, redemption)
    redemption.coupon = coupon
    coupon.uses_remaining -= 1
    await save_coupon(db, coupon)
    return redemption


@router.get("/redemptions", response_model=list[CouponRedemptionRead])
async def list_my_redemptions(
    db: AsyncSession = Depends(get_session),
    identity: tuple[str, Child | User] = Depends(get_current_identity),
):
    kind, obj = identity
    if kind != "child":
        raise HTTPException(status_code=403, detail="Only children can view")
    child: Child = obj
    return await list_redemptions_by_child(db, child.id)
