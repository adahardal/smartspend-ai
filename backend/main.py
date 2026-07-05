from fastapi import FastAPI

app = FastAPI(title="SmartSpend AI API")


@app.get("/healthz")
def health_check():
    return {"status": "ok"}