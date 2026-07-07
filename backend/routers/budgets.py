from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])


class BudgetUpsert(BaseModel):
    category_id: int
    amount: float = Field(gt=0)


class BudgetOut(BaseModel):
    id: int
    category_id: int
    category_name: str
    amount: float
    spent: float
    remaining: float


def _first_of_month() -> date:
    today = date.today()
    return date(today.year, today.month, 1)


@router.get("", response_model=list[BudgetOut])
def list_budgets(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    budgets = list(
        db.scalars(
            select(models.Budget)
            .where(models.Budget.user_id == user_id)
            .order_by(models.Budget.id)
        ).all()
    )
    if not budgets:
        return []

    month_start = _first_of_month()
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
    spent_by_category = {cid: float(total) for cid, total in spent_rows}

    names = {
        c.id: c.name
        for c in db.scalars(
            select(models.Category).where(models.Category.user_id == user_id)
        )
    }

    result: list[BudgetOut] = []
    for b in budgets:
        amount = float(b.amount)
        spent = spent_by_category.get(b.category_id, 0.0)
        result.append(
            BudgetOut(
                id=b.id,
                category_id=b.category_id,
                category_name=names.get(b.category_id, "—"),
                amount=amount,
                spent=spent,
                remaining=amount - spent,
            )
        )
    return result


@router.put("", response_model=BudgetOut)
def upsert_budget(
    payload: BudgetUpsert,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    category = db.get(models.Category, payload.category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")

    budget = db.scalar(
        select(models.Budget).where(
            models.Budget.user_id == user_id,
            models.Budget.category_id == payload.category_id,
        )
    )
    if budget is None:
        budget = models.Budget(
            user_id=user_id,
            category_id=payload.category_id,
            amount=payload.amount,
        )
        db.add(budget)
    else:
        budget.amount = payload.amount

    db.commit()
    db.refresh(budget)

    month_start = _first_of_month()
    spent = db.scalar(
        select(func.coalesce(func.sum(models.Transaction.amount), 0)).where(
            models.Transaction.user_id == user_id,
            models.Transaction.type == "expense",
            models.Transaction.category_id == payload.category_id,
            models.Transaction.date >= month_start,
        )
    )
    spent = float(spent)
    amount = float(budget.amount)
    return BudgetOut(
        id=budget.id,
        category_id=budget.category_id,
        category_name=category.name,
        amount=amount,
        spent=spent,
        remaining=amount - spent,
    )


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    budget = db.get(models.Budget, budget_id)
    if budget is None or budget.user_id != user_id:
        raise HTTPException(status_code=404, detail="Bütçe bulunamadı")
    db.delete(budget)
    db.commit()
