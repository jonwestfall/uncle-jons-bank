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
    settings = await get_settings(db)
    return SettingsRead(
        site_name=settings.site_name,
        default_interest_rate=settings.default_interest_rate,
        default_penalty_interest_rate=settings.default_penalty_interest_rate,
        default_cd_penalty_rate=settings.default_cd_penalty_rate,
    )


@router.put("/", response_model=SettingsRead)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
):
    settings = await get_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    updated = await save_settings(db, settings)
    return SettingsRead(
        site_name=updated.site_name,
        default_interest_rate=updated.default_interest_rate,
        default_penalty_interest_rate=updated.default_penalty_interest_rate,
        default_cd_penalty_rate=updated.default_cd_penalty_rate,
    )
