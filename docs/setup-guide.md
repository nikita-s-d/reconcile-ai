# ReconcileAI — Setup & Installation Guide
## Razorpay Hackathon 2026 — Track 04: AI Finance Controller

This document provides step-by-step instructions for configuring, installing, database seeding, running, and testing the **ReconcileAI** application in local and staging development environments.

---

## 1. Prerequisites

Ensure the following tools and runtime environments are installed on your machine:

- **Node.js**: `v18.0.0` or higher (`node -v`)
- **npm**: `v9.0.0` or higher (`npm -v`)
- **Python**: `v3.10.0` or higher (`python --version`)
- **PostgreSQL**: `v14.0` or higher (`psql --version`)
- **Git**: (`git --version`)

---

## 2. Environment Variables & Configuration

### 2.1 Backend Environment Configuration (`backend/.env`)
Create or verify `backend/.env`:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/AIfinancecontroller?schema=public"
JWT_SECRET="reconcile-ai-super-secret-jwt-key-2026"
RECONCILIATION_ENGINE_URL="http://localhost:8000"
OPENAI_API_KEY="your-openai-api-key-here"
```

> **Note**: If `OPENAI_API_KEY` is omitted or offline, ReconcileAI automatically uses its deterministic fallback intent router for all AI Assistant queries.

### 2.2 Frontend Environment Configuration (`frontend/.env`)
Create or verify `frontend/.env`:

```env
VITE_API_URL="http://localhost:5000/api"
```

---

## 3. Database Setup & Prisma Seeding

### 3.1 Create PostgreSQL Database
Open PostgreSQL shell or admin tool and create the database:

```sql
CREATE DATABASE AIfinancecontroller;
```

### 3.2 Run Prisma Migrations & Seed Default Users
Navigate to `backend/` and execute Prisma database synchronization:

```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
```

This populates default settings and 3 pre-seeded user accounts:

| Role | User Name | Email | Default Password | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN` | System Admin | `admin@reconcile.ai` | `Admin@12345` | Full Administrative & Configuration Privileges |
| `ANALYST` | Finance Analyst | `analyst@reconcile.ai` | `Analyst@12345` | Data Upload, Reconciliation, Evaluation, Exception Handling |
| `VIEWER` | Finance Viewer | `viewer@reconcile.ai` | `Viewer@12345` | Read-Only Dashboard, Cash Position & Audit Trail |

---

## 4. Python Decision Engine Installation

Navigate to `reconciliation-engine/` and set up the Python environment:

```bash
cd reconciliation-engine

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Activate virtual environment (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### `reconciliation-engine/requirements.txt`
```text
fastapi>=0.100.0
uvicorn>=0.22.0
pandas>=2.0.0
numpy>=1.24.0
pydantic>=2.0.0
python-multipart>=0.0.6
requests>=2.31.0
```

---

## 5. Running the Application Services

To run ReconcileAI locally, start the 3 microservices in separate terminal windows:

### Service 1: Python Reconciliation Engine (Port 8000)
```bash
cd reconciliation-engine
.\venv\Scripts\activate
uvicorn app.main:app --port 8000 --reload
```
*Health Check*: Open `http://localhost:8000/health` (Returns `{"status": "healthy"}`).

### Service 2: Node.js Express Backend Gateway (Port 5000)
```bash
cd backend
npm start
```
*Health Check*: Open `http://localhost:5000/health` (Returns `{"status": "healthy"}`).

### Service 3: React Vite Frontend SPA (Port 5173 / Port 3000)
```bash
cd frontend
npm install
npm run dev
```
*Access Web UI*: Open browser at `http://localhost:5173`.

---

## 6. Running Test Suites & Dataset Generation

ReconcileAI includes 6 automated validation scripts in `scripts/`:

```bash
# 1. Test AI Agent & 10 Finance Tools
python scripts/test_agent_suite.py

# 2. Test Extended Finance Controller Capabilities & RBAC
python scripts/test_finance_controller.py

# 3. Test Strict Dataset Scoping & Zero Stale Metrics
python scripts/test_dataset_scoping.py

# 4. Test Full End-to-End Ingestion, Evaluation & Exports
python scripts/test_e2e.py

# 5. Test Evaluation Button Edge Cases & Role Permissions
python scripts/test_evaluation_button.py

# 6. Generate & Validate New 250-Record Dataset
python scripts/generate_dataset_250.py
```

All 6 test scripts must execute cleanly with **exit code 0**.

---

## 7. Production Frontend Build

To build the frontend production distribution:

```bash
cd frontend
npm run build
```

This compiles static assets into `frontend/dist/` with zero TypeScript or Vite errors.
