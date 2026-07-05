import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from security import get_current_user_id  # noqa: E402

app = FastAPI(title="SmartSpend AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    return {"user_id": user_id}