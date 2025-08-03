"""Endpoints for viewing and updating site-wide settings."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app.auth import require_role
from app.schemas import SettingsRead, SettingsUpdate
from app.crud import get_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=SettingsRead)
async def read_settings(db: AsyncSession = Depends(get_session)):
    """Retrieve the current configuration values."""
    settings = await get_settings(db)
    return SettingsRead(
        site_name=settings.site_name,
        default_interest_rate=settings.default_interest_rate,
        default_penalty_interest_rate=settings.default_penalty_interest_rate,
        default_cd_penalty_rate=settings.default_cd_penalty_rate,
        service_fee_amount=settings.service_fee_amount,
        service_fee_is_percentage=settings.service_fee_is_percentage,
        overdraft_fee_amount=settings.overdraft_fee_amount,
        overdraft_fee_is_percentage=settings.overdraft_fee_is_percentage,
        overdraft_fee_daily=settings.overdraft_fee_daily,
        currency_symbol=settings.currency_symbol,
    )


@router.put("/", response_model=SettingsRead)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    """Update settings; only admins may change configuration."""
    settings = await get_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    updated = await save_settings(db, settings)
    return SettingsRead(
        site_name=updated.site_name,
        default_interest_rate=updated.default_interest_rate,
        default_penalty_interest_rate=updated.default_penalty_interest_rate,
        default_cd_penalty_rate=updated.default_cd_penalty_rate,
        service_fee_amount=updated.service_fee_amount,
        service_fee_is_percentage=updated.service_fee_is_percentage,
        overdraft_fee_amount=updated.overdraft_fee_amount,
        overdraft_fee_is_percentage=updated.overdraft_fee_is_percentage,
        overdraft_fee_daily=updated.overdraft_fee_daily,
        currency_symbol=updated.currency_symbol,
    )
