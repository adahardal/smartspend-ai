import json
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/transactions/categorize", tags=["ai"])

MODEL = "claude-haiku-4-5"
MAX_TRANSACTIONS = 100

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise HTTPException(
                status_code=503,
                detail="AI kategorilendirme yapılandırılmamış (ANTHROPIC_API_KEY eksik)",
            )
        _client = anthropic.Anthropic()
    return _client


class Suggestion(BaseModel):
    transaction_id: int
    description: str | None
    amount: float
    type: str
    category_id: int | None
    category_name: str | None


class ApplyItem(BaseModel):
    transaction_id: int
    category_id: int


class ApplyPayload(BaseModel):
    assignments: list[ApplyItem]


SUGGESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "assignments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "integer"},
                    "category_id": {
                        "type": ["integer", "null"],
                        "description": "Verilen kategori listesinden en uygun kategorinin id'si, uygun yoksa null",
                    },
                },
                "required": ["transaction_id", "category_id"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["assignments"],
    "additionalProperties": False,
}


@router.post("/suggest", response_model=list[Suggestion])
def suggest_categories(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    categories = list(
        db.scalars(
            select(models.Category).where(models.Category.user_id == user_id)
        ).all()
    )
    if not categories:
        raise HTTPException(status_code=400, detail="Önce kategori oluştur")

    transactions = list(
        db.scalars(
            select(models.Transaction)
            .where(
                models.Transaction.user_id == user_id,
                models.Transaction.category_id.is_(None),
            )
            .order_by(models.Transaction.date.desc())
            .limit(MAX_TRANSACTIONS)
        ).all()
    )
    if not transactions:
        return []

    valid_ids = {c.id for c in categories}
    category_lines = "\n".join(f"- {c.id}: {c.name}" for c in categories)
    tx_lines = "\n".join(
        f"- id={t.id} | {t.type} | {float(t.amount)} | {t.description or '(açıklama yok)'}"
        for t in transactions
    )

    prompt = (
        "Sen bir kişisel finans asistanısın. Aşağıdaki harcama/gelir işlemlerini, "
        "verilen kategori listesindeki EN uygun kategoriye eşle. Sadece listedeki "
        "kategori id'lerini kullan. Hiçbiri uygun değilse category_id olarak null döndür.\n\n"
        f"Kategoriler:\n{category_lines}\n\n"
        f"İşlemler:\n{tx_lines}\n\n"
        "Her işlem için bir eşleme döndür."
    )

    client = _get_client()
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            output_config={
                "format": {"type": "json_schema", "schema": SUGGESTION_SCHEMA}
            },
            messages=[{"role": "user", "content": prompt}],
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {exc}")

    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        data = json.loads(text)
        assignments = {
            a["transaction_id"]: a["category_id"] for a in data["assignments"]
        }
    except (json.JSONDecodeError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="AI yanıtı çözümlenemedi")

    names = {c.id: c.name for c in categories}
    suggestions: list[Suggestion] = []
    for t in transactions:
        cid = assignments.get(t.id)
        if cid not in valid_ids:
            cid = None
        suggestions.append(
            Suggestion(
                transaction_id=t.id,
                description=t.description,
                amount=float(t.amount),
                type=t.type,
                category_id=cid,
                category_name=names.get(cid) if cid else None,
            )
        )
    return suggestions


@router.post("/apply")
def apply_categories(
    payload: ApplyPayload,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not payload.assignments:
        raise HTTPException(status_code=400, detail="Uygulanacak eşleme yok")

    owned_categories = {
        c.id
        for c in db.scalars(
            select(models.Category.id).where(models.Category.user_id == user_id)
        )
    }
    tx_ids = [a.transaction_id for a in payload.assignments]
    transactions = {
        t.id: t
        for t in db.scalars(
            select(models.Transaction).where(
                models.Transaction.user_id == user_id,
                models.Transaction.id.in_(tx_ids),
            )
        )
    }

    updated = 0
    for a in payload.assignments:
        if a.category_id not in owned_categories:
            raise HTTPException(status_code=404, detail="Geçersiz kategori")
        tx = transactions.get(a.transaction_id)
        if tx is None:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı")
        tx.category_id = a.category_id
        updated += 1

    db.commit()
    return {"updated": updated}
