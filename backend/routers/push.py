from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: PushKeys


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.post("/subscribe", status_code=204)
def subscribe(
    payload: SubscribeIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    existing = db.scalar(
        select(models.PushSubscription).where(
            models.PushSubscription.endpoint == payload.endpoint
        )
    )
    if existing:
        existing.user_id = user_id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        db.add(
            models.PushSubscription(
                user_id=user_id,
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
            )
        )
    db.commit()


@router.post("/unsubscribe", status_code=204)
def unsubscribe(
    payload: UnsubscribeIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    sub = db.scalar(
        select(models.PushSubscription).where(
            models.PushSubscription.endpoint == payload.endpoint,
            models.PushSubscription.user_id == user_id,
        )
    )
    if sub:
        db.delete(sub)
        db.commit()


@router.get("/status")
def push_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    count = db.scalar(
        select(models.PushSubscription).where(models.PushSubscription.user_id == user_id)
    )
    return {"subscribed": count is not None}
