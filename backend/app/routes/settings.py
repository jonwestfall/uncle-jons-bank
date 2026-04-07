"""Endpoints for viewing and updating site-wide settings."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app.auth import require_role
from app.schemas import SettingsRead, SettingsUpdate
from app.crud import get_settings, save_settings
from app.schemas.validation import MAX_RATE

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=SettingsRead)
async def read_settings(db: AsyncSession = Depends(get_session)):
    """Retrieve the current configuration values."""
    settings = await get_settings(db)
    return SettingsRead(
        site_name=settings.site_name,
        site_url=settings.site_url,
        default_interest_rate=settings.default_interest_rate,
        default_penalty_interest_rate=settings.default_penalty_interest_rate,
        default_cd_penalty_rate=settings.default_cd_penalty_rate,
        service_fee_amount=settings.service_fee_amount,
        service_fee_is_percentage=settings.service_fee_is_percentage,
        overdraft_fee_amount=settings.overdraft_fee_amount,
        overdraft_fee_is_percentage=settings.overdraft_fee_is_percentage,
        overdraft_fee_daily=settings.overdraft_fee_daily,
        currency_symbol=settings.currency_symbol,
        public_registration_disabled=settings.public_registration_disabled,
    )


@router.put("/", response_model=SettingsRead)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    """Update settings; only admins may change configuration."""
    if data.default_interest_rate is not None and not 0 <= data.default_interest_rate <= MAX_RATE:
        raise HTTPException(status_code=400, detail="Default interest rate must be between 0 and 1")
    if (
        data.default_penalty_interest_rate is not None
        and not 0 <= data.default_penalty_interest_rate <= MAX_RATE
    ):
        raise HTTPException(status_code=400, detail="Default penalty interest rate must be between 0 and 1")
    if data.default_cd_penalty_rate is not None and not 0 <= data.default_cd_penalty_rate <= MAX_RATE:
        raise HTTPException(status_code=400, detail="Default CD penalty rate must be between 0 and 1")
    if data.service_fee_is_percentage and data.service_fee_amount is not None and data.service_fee_amount > 1:
        raise HTTPException(status_code=400, detail="Service fee percentage must be between 0 and 1")
    if data.overdraft_fee_is_percentage and data.overdraft_fee_amount is not None and data.overdraft_fee_amount > 1:
        raise HTTPException(status_code=400, detail="Overdraft fee percentage must be between 0 and 1")

    settings = await get_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    updated = await save_settings(db, settings)
    return SettingsRead(
        site_name=updated.site_name,
        site_url=updated.site_url,
        default_interest_rate=updated.default_interest_rate,
        default_penalty_interest_rate=updated.default_penalty_interest_rate,
        default_cd_penalty_rate=updated.default_cd_penalty_rate,
        service_fee_amount=updated.service_fee_amount,
        service_fee_is_percentage=updated.service_fee_is_percentage,
        overdraft_fee_amount=updated.overdraft_fee_amount,
        overdraft_fee_is_percentage=updated.overdraft_fee_is_percentage,
        overdraft_fee_daily=updated.overdraft_fee_daily,
        currency_symbol=updated.currency_symbol,
        public_registration_disabled=updated.public_registration_disabled,
    )
