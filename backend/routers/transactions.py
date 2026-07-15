from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from push import send_push_to_user
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

BUDGET_WARNING_PCT = 80.0


def _get_owned_category(db: Session, category_id: int, user_id: str) -> models.Category:
    category = db.get(models.Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return category


def _maybe_notify_budget_threshold(
    db: Session, user_id: str, category_id: int, new_amount: float, tx_date: date
) -> None:
    budget = db.scalar(
        select(models.Budget).where(
            models.Budget.user_id == user_id, models.Budget.category_id == category_id
        )
    )
    if budget is None or float(budget.amount) <= 0:
        return

    month_start = date(tx_date.year, tx_date.month, 1)
    if tx_date < month_start:
        return

    spent_before = float(
        db.scalar(
            select(func.coalesce(func.sum(models.Transaction.amount), 0)).where(
                models.Transaction.user_id == user_id,
                models.Transaction.category_id == category_id,
                models.Transaction.type == "expense",
                models.Transaction.date >= month_start,
            )
        )
        or 0
    ) - new_amount
    spent_after = spent_before + new_amount
    amount = float(budget.amount)

    pct_before = spent_before / amount * 100
    pct_after = spent_after / amount * 100
    if pct_before < BUDGET_WARNING_PCT <= pct_after:
        category = db.get(models.Category, category_id)
        name = category.name if category else "Bütçe"
        send_push_to_user(
            db,
            user_id,
            title="Bütçe uyarısı",
            body=f"{name} bütçende limitin %{pct_after:.0f}'ine ulaştın "
            f"({spent_after:.0f} TL / {amount:.0f} TL).",
        )


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    category_id: int | None = None,
    type: schemas.TransactionType | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    query = select(models.Transaction).where(models.Transaction.user_id == user_id)

    if category_id is not None:
        query = query.where(models.Transaction.category_id == category_id)
    if type is not None:
        query = query.where(models.Transaction.type == type)
    if date_from is not None:
        query = query.where(models.Transaction.date >= date_from)
    if date_to is not None:
        query = query.where(models.Transaction.date <= date_to)

    query = query.order_by(models.Transaction.date.desc(), models.Transaction.id.desc())

    return db.scalars(query).all()


@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if payload.category_id is not None:
        _get_owned_category(db, payload.category_id, user_id)

    transaction = models.Transaction(user_id=user_id, **payload.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    if transaction.type == "expense" and transaction.category_id is not None:
        _maybe_notify_budget_threshold(
            db,
            user_id,
            transaction.category_id,
            float(transaction.amount),
            transaction.date,
        )

    return transaction


@router.put("/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı")

    if payload.category_id is not None:
        _get_owned_category(db, payload.category_id, user_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı")

    db.delete(transaction)
    db.commit()
