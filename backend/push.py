import json
import logging
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)

_VAPID_CLAIMS_SUB = os.environ.get("VAPID_SUBJECT", "mailto:example@example.com")


def send_push_to_user(db: Session, user_id: str, title: str, body: str) -> None:
    """Best-effort: send a Web Push notification to all of a user's subscribed
    devices. Never raises — a push failure (network error, expired
    subscription, misconfiguration) must not fail the request that triggered
    it (e.g. creating a transaction). No-op if VAPID keys aren't configured."""
    private_key = os.environ.get("VAPID_PRIVATE_KEY")
    if not private_key:
        return

    try:
        from pywebpush import WebPushException, webpush
    except Exception:
        logger.exception("pywebpush unavailable, skipping push notification")
        return

    subs = list(
        db.scalars(
            select(models.PushSubscription).where(
                models.PushSubscription.user_id == user_id
            )
        ).all()
    )

    for sub in subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=private_key,
                vapid_claims={"sub": _VAPID_CLAIMS_SUB},
            )
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                db.delete(sub)
                db.commit()
            else:
                logger.warning("Push send failed for subscription %s: %s", sub.id, exc)
        except Exception:
            logger.exception("Unexpected error sending push to subscription %s", sub.id)
