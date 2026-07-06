from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/summary", tags=["summary"])


@router.get("")
def get_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    query = select(models.Transaction.type, func.sum(models.Transaction.amount)).where(
        models.Transaction.user_id == user_id
    )
    if date_from is not None:
        query = query.where(models.Transaction.date >= date_from)
    if date_to is not None:
        query = query.where(models.Transaction.date <= date_to)
    query = query.group_by(models.Transaction.type)

    totals = {"income": 0.0, "expense": 0.0}
    for t_type, total in db.execute(query):
        totals[t_type] = float(total)

    return {
        "income": totals["income"],
        "expense": totals["expense"],
        "net": totals["income"] - totals["expense"],
    }


@router.get("/by-category")
def get_summary_by_category(
    type: schemas.TransactionType = "expense",
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    query = (
        select(
            models.Category.id,
            func.coalesce(models.Category.name, "Kategorisiz"),
            func.sum(models.Transaction.amount),
        )
        .select_from(models.Transaction)
        .join(models.Category, models.Transaction.category_id == models.Category.id, isouter=True)
        .where(models.Transaction.user_id == user_id, models.Transaction.type == type)
    )
    if date_from is not None:
        query = query.where(models.Transaction.date >= date_from)
    if date_to is not None:
        query = query.where(models.Transaction.date <= date_to)
    query = query.group_by(models.Category.id, models.Category.name).order_by(
        func.sum(models.Transaction.amount).desc()
    )

    return [
        {"category_id": category_id, "category_name": name, "total": float(total)}
        for category_id, name, total in db.execute(query)
    ]
