from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/insights", tags=["insights"])

MIN_OCCURRENCES = 2
GAP_MIN_DAYS = 24
GAP_MAX_DAYS = 40
AMOUNT_TOLERANCE = 0.15

MIN_CATEGORY_AMOUNT = 50.0
SIGNIFICANT_CHANGE_PCT = 20.0
MAX_HIGHLIGHTS = 5


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


class Highlight(BaseModel):
    kind: str  # "up" | "down" | "info"
    text: str


def _month_range(offset: int) -> tuple[date, date]:
    today = date.today()
    year, month = today.year, today.month + offset
    while month < 1:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _category_totals(
    db: Session, user_id: str, start: date, end: date
) -> dict[str, float]:
    rows = db.execute(
        select(
            func.coalesce(models.Category.name, "Kategorisiz"),
            func.sum(models.Transaction.amount),
        )
        .select_from(models.Transaction)
        .join(
            models.Category,
            models.Transaction.category_id == models.Category.id,
            isouter=True,
        )
        .where(
            models.Transaction.user_id == user_id,
            models.Transaction.type == "expense",
            models.Transaction.date >= start,
            models.Transaction.date < end,
        )
        .group_by(models.Category.name)
    )
    return {name: float(total) for name, total in rows}


def _total_expense(db: Session, user_id: str, start: date, end: date) -> float:
    total = db.scalar(
        select(func.coalesce(func.sum(models.Transaction.amount), 0)).where(
            models.Transaction.user_id == user_id,
            models.Transaction.type == "expense",
            models.Transaction.date >= start,
            models.Transaction.date < end,
        )
    )
    return float(total)


@router.get("/highlights", response_model=list[Highlight])
def get_highlights(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    this_start, this_end = _month_range(0)
    last_start, last_end = _month_range(-1)

    this_cats = _category_totals(db, user_id, this_start, this_end)
    last_cats = _category_totals(db, user_id, last_start, last_end)
    this_total = _total_expense(db, user_id, this_start, this_end)
    last_total = _total_expense(db, user_id, last_start, last_end)

    highlights: list[Highlight] = []

    if last_total > 0:
        change_pct = (this_total - last_total) / last_total * 100
        if abs(change_pct) >= SIGNIFICANT_CHANGE_PCT:
            direction = "arttı" if change_pct > 0 else "azaldı"
            highlights.append(
                Highlight(
                    kind="up" if change_pct > 0 else "down",
                    text=(
                        f"Bu ay toplam harcaman geçen aya göre %{abs(change_pct):.0f} "
                        f"{direction} ({this_total:.0f} TL / {last_total:.0f} TL)."
                    ),
                )
            )

    category_changes: list[tuple[float, str, float, float, float | None]] = []
    for name in set(this_cats) | set(last_cats):
        cur = this_cats.get(name, 0.0)
        prev = last_cats.get(name, 0.0)
        if max(cur, prev) < MIN_CATEGORY_AMOUNT:
            continue
        if prev == 0:
            category_changes.append((cur, name, cur, prev, None))
            continue
        pct = (cur - prev) / prev * 100
        if abs(pct) >= SIGNIFICANT_CHANGE_PCT:
            category_changes.append((abs(cur - prev), name, cur, prev, pct))

    category_changes.sort(key=lambda c: c[0], reverse=True)
    for _, name, cur, prev, pct in category_changes:
        if pct is None:
            highlights.append(
                Highlight(
                    kind="info",
                    text=f"{name} kategorisinde bu ay ilk kez harcama yaptın: {cur:.0f} TL.",
                )
            )
        else:
            direction = "arttı" if pct > 0 else "azaldı"
            highlights.append(
                Highlight(
                    kind="up" if pct > 0 else "down",
                    text=(
                        f"{name} harcaman geçen aya göre %{abs(pct):.0f} {direction} "
                        f"({cur:.0f} TL / {prev:.0f} TL)."
                    ),
                )
            )

    return highlights[:MAX_HIGHLIGHTS]
