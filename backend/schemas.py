from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, Field

TransactionType = Literal["income", "expense"]


class CategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    type: TransactionType
    category_id: int | None = None
    description: str | None = None
    date: date_type


class TransactionUpdate(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    category_id: int | None = None
    description: str | None = None
    date: date_type | None = None


class TransactionOut(BaseModel):
    id: int
    amount: float
    type: str
    category_id: int | None
    description: str | None
    date: date_type

    class Config:
        from_attributes = True
