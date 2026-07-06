from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def _get_owned_category(db: Session, category_id: int, user_id: str) -> models.Category:
    category = db.get(models.Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return category


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
