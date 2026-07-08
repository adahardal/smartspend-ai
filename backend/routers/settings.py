from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


class SettingsOut(BaseModel):
    period_start_day: int | None


class SettingsIn(BaseModel):
    period_start_day: int | None = Field(default=None, ge=1, le=31)


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    settings = db.get(models.UserSettings, user_id)
    return SettingsOut(period_start_day=settings.period_start_day if settings else None)


@router.put("", response_model=SettingsOut)
def update_settings(
    payload: SettingsIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    settings = db.get(models.UserSettings, user_id)
    if settings is None:
        settings = models.UserSettings(user_id=user_id)
        db.add(settings)

    settings.period_start_day = payload.period_start_day
    db.commit()
    db.refresh(settings)
    return SettingsOut(period_start_day=settings.period_start_day)
