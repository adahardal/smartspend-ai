import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/coach", tags=["coach"])

MODEL = "claude-haiku-4-5"

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise HTTPException(
                status_code=503,
                detail="Koç yapılandırılmamış (ANTHROPIC_API_KEY eksik)",
            )
        _client = anthropic.Anthropic()
    return _client


class AskPayload(BaseModel):
    question: str = Field(min_length=1, max_length=500)


def _month_bounds(today: date) -> tuple[date, date, date]:
    """Return (this_month_start, last_month_start, last_month_end)."""
    this_start = date(today.year, today.month, 1)
    if today.month == 1:
        last_start = date(today.year - 1, 12, 1)
    else:
        last_start = date(today.year, today.month - 1, 1)
    return this_start, last_start, this_start


def _totals(db: Session, user_id: str, start: date, end: date) -> dict[str, float]:
    rows = db.execute(
        select(models.Transaction.type, func.sum(models.Transaction.amount))
        .where(
            models.Transaction.user_id == user_id,
            models.Transaction.date >= start,
            models.Transaction.date < end,
        )
        .group_by(models.Transaction.type)
    )
    totals = {"income": 0.0, "expense": 0.0}
    for t_type, total in rows:
        totals[t_type] = float(total)
    return totals


def _by_category(
    db: Session, user_id: str, start: date, end: date
) -> list[tuple[str, float]]:
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
        .order_by(func.sum(models.Transaction.amount).desc())
    )
    return [(name, float(total)) for name, total in rows]


def _budget_lines(db: Session, user_id: str, month_start: date) -> list[str]:
    budgets = list(
        db.scalars(
            select(models.Budget).where(models.Budget.user_id == user_id)
        ).all()
    )
    if not budgets:
        return []

    spent_rows = db.execute(
        select(
            models.Transaction.category_id,
            func.sum(models.Transaction.amount),
        )
        .where(
            models.Transaction.user_id == user_id,
            models.Transaction.type == "expense",
            models.Transaction.date >= month_start,
        )
        .group_by(models.Transaction.category_id)
    )
    spent = {cid: float(total) for cid, total in spent_rows}
    names = {
        c.id: c.name
        for c in db.scalars(
            select(models.Category).where(models.Category.user_id == user_id)
        )
    }

    lines = []
    for b in budgets:
        amount = float(b.amount)
        used = spent.get(b.category_id, 0.0)
        name = names.get(b.category_id, "—")
        status = "AŞILDI" if used > amount else "içinde"
        lines.append(
            f"- {name}: {used:.0f} / {amount:.0f} TL limit ({status})"
        )
    return lines


def _build_context(db: Session, user_id: str) -> str:
    today = date.today()
    this_start, last_start, last_end = _month_bounds(today)
    next_start = date(
        today.year + 1 if today.month == 12 else today.year,
        1 if today.month == 12 else today.month + 1,
        1,
    )

    this_totals = _totals(db, user_id, this_start, next_start)
    last_totals = _totals(db, user_id, last_start, last_end)
    this_cats = _by_category(db, user_id, this_start, next_start)
    last_cats = _by_category(db, user_id, last_start, last_end)
    budget_lines = _budget_lines(db, user_id, this_start)

    def fmt_cats(cats: list[tuple[str, float]]) -> str:
        if not cats:
            return "  (harcama yok)"
        return "\n".join(f"  - {name}: {total:.0f} TL" for name, total in cats)

    parts = [
        f"Bugünün tarihi: {today.isoformat()}",
        "",
        f"BU AY ({this_start.strftime('%Y-%m')}):",
        f"  Gelir: {this_totals['income']:.0f} TL",
        f"  Gider: {this_totals['expense']:.0f} TL",
        f"  Net: {this_totals['income'] - this_totals['expense']:.0f} TL",
        "  Kategori bazında gider:",
        fmt_cats(this_cats),
        "",
        f"GEÇEN AY ({last_start.strftime('%Y-%m')}):",
        f"  Gelir: {last_totals['income']:.0f} TL",
        f"  Gider: {last_totals['expense']:.0f} TL",
        f"  Net: {last_totals['income'] - last_totals['expense']:.0f} TL",
        "  Kategori bazında gider:",
        fmt_cats(last_cats),
    ]
    if budget_lines:
        parts += ["", "BÜTÇELER (bu ay):", *budget_lines]
    return "\n".join(parts)


SYSTEM_PROMPT = (
    "Sen SmartSpend adlı kişisel finans uygulamasının içindeki bir finans koçusun. "
    "Kullanıcının kendi harcama verilerine bakarak sorularını Türkçe, samimi ve net "
    "biçimde yanıtla. Sadece sana verilen verilere dayan; veri yoksa uydurma, "
    "dürüstçe 'bu konuda yeterli veri yok' de. Rakamları TL olarak, yuvarlayarak "
    "söyle. Cevapların kısa ve uygulanabilir olsun (2-4 kısa paragraf veya birkaç "
    "madde). Somut karşılaştırmalar yap (ör. 'geçen aya göre %X arttı'). Gereksiz "
    "uyarı ve genel geçer finansal tavsiyeden kaçın."
)


@router.post("/ask")
def ask_coach(
    payload: AskPayload,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    context = _build_context(db, user_id)
    client = _get_client()  # raises 503 before streaming if key missing

    prompt = (
        f"Kullanıcının finansal verileri:\n\n{context}\n\n"
        f"Kullanıcının sorusu:\n{payload.question}"
    )

    def generate():
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as exc:  # noqa: BLE001
            yield f"\n\n[Koç yanıtı kesildi: {exc}]"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
