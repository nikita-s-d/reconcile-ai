from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import ReconcileRequestPayload, ReconcileResponsePayload, EvaluateRequestPayload, EvaluateResponsePayload
from app.reconciliation import run_reconciliation_pipeline
from app.evaluation import run_evaluation_pipeline

app = FastAPI(
    title="ReconcileAI — Finance Decision Engine",
    description="Deterministic multi-source financial reconciliation and evaluation service for Razorpay Hackathon 2026 Track 4.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "ReconcileAI Finance Decision Engine",
        "version": "1.0.0"
    }

@app.post("/reconcile", response_model=ReconcileResponsePayload)
def reconcile(payload: ReconcileRequestPayload):
    try:
        return run_reconciliation_pipeline(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation error: {str(e)}")

@app.post("/evaluate", response_model=EvaluateResponsePayload)
def evaluate(payload: EvaluateRequestPayload):
    try:
        return run_evaluation_pipeline(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")
