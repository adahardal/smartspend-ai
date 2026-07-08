from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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


class ManualSubscriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    category_id: int | None = None
    next_billing_date: date | None = None


class ManualSubscriptionOut(BaseModel):
    id: int
    name: str
    amount: float
    category_name: str | None
    next_billing_date: date | None


def _to_manual_out(
    sub: models.ManualSubscription, category_names: dict[int, str]
) -> ManualSubscriptionOut:
    return ManualSubscriptionOut(
        id=sub.id,
        name=sub.name,
        amount=float(sub.amount),
        category_name=category_names.get(sub.category_id) if sub.category_id else None,
        next_billing_date=sub.next_billing_date,
    )


def _category_names(db: Session, user_id: str) -> dict[int, str]:
    return {
        c.id: c.name
        for c in db.scalars(
            select(models.Category).where(models.Category.user_id == user_id)
        )
    }


def _get_owned_category(db: Session, user_id: str, category_id: int) -> models.Category:
    category = db.get(models.Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return category


@router.get("/subscriptions/manual", response_model=list[ManualSubscriptionOut])
def list_manual_subscriptions(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    subs = list(
        db.scalars(
            select(models.ManualSubscription)
            .where(models.ManualSubscription.user_id == user_id)
            .order_by(models.ManualSubscription.id)
        ).all()
    )
    names = _category_names(db, user_id)
    return [_to_manual_out(s, names) for s in subs]


@router.post("/subscriptions/manual", response_model=ManualSubscriptionOut, status_code=201)
def create_manual_subscription(
    payload: ManualSubscriptionIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if payload.category_id is not None:
        _get_owned_category(db, user_id, payload.category_id)

    sub = models.ManualSubscription(
        user_id=user_id,
        name=payload.name,
        amount=payload.amount,
        category_id=payload.category_id,
        next_billing_date=payload.next_billing_date,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _to_manual_out(sub, _category_names(db, user_id))


@router.put("/subscriptions/manual/{sub_id}", response_model=ManualSubscriptionOut)
def update_manual_subscription(
    sub_id: int,
    payload: ManualSubscriptionIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    sub = db.get(models.ManualSubscription, sub_id)
    if sub is None or sub.user_id != user_id:
        raise HTTPException(status_code=404, detail="Abonelik bulunamadı")
    if payload.category_id is not None:
        _get_owned_category(db, user_id, payload.category_id)

    sub.name = payload.name
    sub.amount = payload.amount
    sub.category_id = payload.category_id
    sub.next_billing_date = payload.next_billing_date
    db.commit()
    db.refresh(sub)
    return _to_manual_out(sub, _category_names(db, user_id))


@router.delete("/subscriptions/manual/{sub_id}", status_code=204)
def delete_manual_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    sub = db.get(models.ManualSubscription, sub_id)
    if sub is None or sub.user_id != user_id:
        raise HTTPException(status_code=404, detail="Abonelik bulunamadı")
    db.delete(sub)
    db.commit()
