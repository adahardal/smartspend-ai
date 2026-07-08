from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/insights", tags=["insights"])

MIN_OCCURRENCES = 2
GAP_MIN_DAYS = 24
GAP_MAX_DAYS = 40
AMOUNT_TOLERANCE = 0.15


class SubscriptionOut(BaseModel):
    description: str
    category_name: str | None
    amount: float
    occurrences: int
    first_date: date
    last_date: date
    next_expected_date: date
    confidence: str


def _normalize(desc: str) -> str:
    return " ".join(desc.strip().lower().split())


@router.get("/subscriptions", response_model=list[SubscriptionOut])
def detect_subscriptions(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    transactions = list(
        db.scalars(
            select(models.Transaction)
            .where(
                models.Transaction.user_id == user_id,
                models.Transaction.type == "expense",
                models.Transaction.description.isnot(None),
            )
            .order_by(models.Transaction.date)
        )
    )

    groups: dict[str, list[models.Transaction]] = defaultdict(list)
    for t in transactions:
        key = _normalize(t.description or "")
        if key:
            groups[key].append(t)

    category_names = {
        c.id: c.name
        for c in db.scalars(
            select(models.Category).where(models.Category.user_id == user_id)
        )
    }

    results: list[SubscriptionOut] = []
    for txs in groups.values():
        if len(txs) < MIN_OCCURRENCES:
            continue

        txs_sorted = sorted(txs, key=lambda t: t.date)
        amounts = [float(t.amount) for t in txs_sorted]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount <= 0:
            continue
        if (max(amounts) - min(amounts)) / avg_amount > AMOUNT_TOLERANCE:
            continue

        gaps = [
            (txs_sorted[i].date - txs_sorted[i - 1].date).days
            for i in range(1, len(txs_sorted))
        ]
        if not all(GAP_MIN_DAYS <= g <= GAP_MAX_DAYS for g in gaps):
            continue

        avg_gap = round(sum(gaps) / len(gaps))
        last = txs_sorted[-1]

        cat_counts: dict[int, int] = defaultdict(int)
        for t in txs_sorted:
            if t.category_id:
                cat_counts[t.category_id] += 1
        cat_id = max(cat_counts, key=cat_counts.get) if cat_counts else None

        results.append(
            SubscriptionOut(
                description=last.description or "",
                category_name=category_names.get(cat_id),
                amount=round(avg_amount, 2),
                occurrences=len(txs_sorted),
                first_date=txs_sorted[0].date,
                last_date=last.date,
                next_expected_date=last.date + timedelta(days=avg_gap),
                confidence="high" if len(txs_sorted) >= 3 else "medium",
            )
        )

    results.sort(key=lambda r: r.amount, reverse=True)
    return results
