from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/savings-goals", tags=["savings-goals"])


class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)
    target_date: date | None = None


class ContributionIn(BaseModel):
    amount: float


class GoalOut(BaseModel):
    id: int
    name: str
    target_amount: float
    current_amount: float
    target_date: date | None
    remaining: float
    percent: float
    completed: bool


def _to_out(goal: models.SavingsGoal) -> GoalOut:
    target = float(goal.target_amount)
    current = float(goal.current_amount)
    percent = min(current / target * 100, 100) if target > 0 else 0.0
    return GoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=target,
        current_amount=current,
        target_date=goal.target_date,
        remaining=max(target - current, 0),
        percent=percent,
        completed=current >= target,
    )


def _get_owned(db: Session, user_id: str, goal_id: int) -> models.SavingsGoal:
    goal = db.get(models.SavingsGoal, goal_id)
    if goal is None or goal.user_id != user_id:
        raise HTTPException(status_code=404, detail="Hedef bulunamadı")
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    goals = list(
        db.scalars(
            select(models.SavingsGoal)
            .where(models.SavingsGoal.user_id == user_id)
            .order_by(models.SavingsGoal.id)
        ).all()
    )
    return [_to_out(g) for g in goals]


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(
    payload: GoalIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    goal = models.SavingsGoal(
        user_id=user_id,
        name=payload.name,
        target_amount=payload.target_amount,
        target_date=payload.target_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    goal = _get_owned(db, user_id, goal_id)
    goal.name = payload.name
    goal.target_amount = payload.target_amount
    goal.target_date = payload.target_date
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.post("/{goal_id}/contribute", response_model=GoalOut)
def contribute_to_goal(
    goal_id: int,
    payload: ContributionIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    goal = _get_owned(db, user_id, goal_id)
    new_amount = float(goal.current_amount) + payload.amount
    goal.current_amount = max(new_amount, 0)
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    goal = _get_owned(db, user_id, goal_id)
    db.delete(goal)
    db.commit()
