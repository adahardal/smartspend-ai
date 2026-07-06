import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import models  # noqa: E402, F401 (registers models with Base.metadata)
from database import Base, engine  # noqa: E402
from routers import categories, transactions  # noqa: E402
from security import get_current_user_id  # noqa: E402

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SmartSpend AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(transactions.router)


@app.get("/healthz")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    return {"user_id": user_id}