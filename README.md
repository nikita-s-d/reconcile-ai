# ReconcileAI — AI Finance Controller

> **Tagline:** Reconcile. Verify. Explain.  
> **Hackathon:** Razorpay Hackathon 2026  
> **Track:** Track 04 — AI Finance Controller  
> **Core Requirement:** "Run the books and the cash position." Close ONE finance-operations loop across a 50+ record synthetic dataset, reporting match rate, accuracy, throughput, and unresolved exceptions.

---

## 1. Project Overview

**ReconcileAI** is an automated, explainable financial decision engine designed to close a multi-source financial reconciliation loop:

$$\text{Financial Data} \longrightarrow \text{Automated Reconciliation} \longrightarrow \text{Financial Verification} \longrightarrow \text{Decision} \longrightarrow \text{Metrics} \longrightarrow \text{Exception Handling} \longrightarrow \text{Human Review} \longrightarrow \text{Audit Trail} \longrightarrow \text{Evaluation}$$

### Core Direction: MULTI-SOURCE FINANCIAL RECONCILIATION
The system processes financial records across 5 primary sources:
1. `orders.csv`
2. `payments.csv`
3. `settlements.csv`
4. `bank_transactions.csv`
5. `refunds.csv`

Plus an isolated evaluation dataset:
- `ground_truth.csv` (strictly evaluation-only, never accessed by the prediction engine).

---

## 2. Key Features & AI Decision Engine

- **Deterministic Financial Formula Verification**:
  $$\text{Expected Bank Amount} = \text{Gross Amount} - \text{Fee} - \text{Tax} - \text{Refund Amount}$$
- **Hierarchical Signal Matching**:
  - Exact Transaction ID (+40)
  - Related Identifiers (+20)
  - Amount Reconciliation (+20)
  - Date Window Validation (+10)
  - Bank Reference Match (+10)
- **Classification Thresholds**:
  - `95 – 100`: **MATCHED** (Automated approval)
  - `80 – 94`: **REVIEW** (Human escalation required)
  - `0 – 79`: **EXCEPTION** (Unresolved discrepancy)
- **9 Reconciliation Scenarios Handled**:
  1. Exact Match (`MATCHED`)
  2. Fee-Adjusted Match (`MATCHED`)
  3. Refund-Adjusted Match (`MATCHED`)
  4. Amount Mismatch (`EXCEPTION`)
  5. Missing Settlement (`EXCEPTION`)
  6. Duplicate Transaction (`REVIEW`)
  7. Partial Settlement (`REVIEW`)
  8. Unknown Transaction (`EXCEPTION`)
  9. Date Mismatch (`REVIEW`)
- **Honest Exception List**: Never suppresses or artificially hides unresolved cases.
- **Human Review Escalation**: Human-in-the-loop actions (Approve Match, Mark Exception, Resolve with notes).
- **Ground Truth Evaluation**: Evaluates predictions against `ground_truth.csv` by joining on `transaction_id`, computing Accuracy, Precision, Recall, Macro/Weighted F1 Score, and a $3 \times 3$ Confusion Matrix.
- **Zero Hardcoded Limits**: Supports 50+, 100, 500+, 1000+ records dynamically.

---

## 3. Technology Stack

- **Frontend**: React (v18), Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts. Light Mode default with persistent Dark Mode toggle.
- **Primary Backend**: Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL database, JWT authentication, bcryptjs, Multer CSV parser.
- **Finance Decision Engine**: Python (3.12), FastAPI, Pandas, NumPy, Pytest. (No external LLM/AI APIs, No SciPy).

---

## 4. Architecture

```
                       ┌─────────────────────────┐
                       │     React Frontend      │
                       │ (Vite + TS + Tailwind)  │
                       └────────────┬────────────┘
                                    │ HTTP / REST APIs (JWT Auth)
                                    ▼
                       ┌─────────────────────────┐
                       │     Node.js Backend     │
                       │ (Express + Prisma ORM)  │
                       └─────┬──────────────┬────┘
           Prisma Read/Write │              │ Axios HTTP Requests
                             ▼              ▼
                    ┌──────────────┐  ┌─────────────────────────┐
                    │  PostgreSQL  │  │ Python FastAPI Engine   │
                    │ Database DB  │  │ (Pandas, NumPy, Pytest) │
                    └──────────────┘  └─────────────────────────┘
```

---

## 5. Development Credentials

Standard password authentication (JWT + RBAC):
- **Admin**: `admin@reconcile.ai` / `Admin@12345`
- **Analyst**: `analyst@reconcile.ai` / `Analyst@12345`
- **Viewer**: `viewer@reconcile.ai` / `Viewer@12345`

---

## 6. How to Run the Project

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL service running on `localhost:5432` with database `reconcile_ai`

### 1. Python Finance Decision Engine
```bash
cd reconciliation-engine
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```

### 2. Node.js Express Backend
```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

### 3. React Frontend
```bash
cd frontend
npm install
npm run dev
```

Open browser at `http://localhost:5173`.

---

## 7. Running Unit Tests & Scalability Tests

- **Run Python Unit Tests**:
  ```bash
  $env:PYTHONPATH="reconciliation-engine"; python -m pytest reconciliation-engine/tests -v
  ```
- **Generate 500+ Record Scalability Dataset**:
  ```bash
  python scripts/generate_synthetic_data.py
  ```
- **Run Standalone Evaluation Script**:
  ```bash
  python scripts/evaluation.py data/predictions.json data/ground_truth.csv
  ```
