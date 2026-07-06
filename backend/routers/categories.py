from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user_id

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])

DEFAULT_CATEGORIES = [
    "Yemek",
    "Ulaşım",
    "Fatura",
    "Market",
    "Eğlence",
    "Sağlık",
    "Maaş",
    "Diğer",
]


@router.get("", response_model=list[schemas.CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    categories = list(
        db.scalars(
            select(models.Category)
            .where(models.Category.user_id == user_id)
            .order_by(models.Category.id)
        ).all()
    )

    if not categories:
        categories = [
            models.Category(user_id=user_id, name=name) for name in DEFAULT_CATEGORIES
        ]
        db.add_all(categories)
        db.commit()
        for category in categories:
            db.refresh(category)

    return categories


@router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    category = models.Category(user_id=user_id, name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    category = db.get(models.Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")

    db.delete(category)
    db.commit()
