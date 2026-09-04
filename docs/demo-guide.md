# ReconcileAI — Hackathon Demonstration & Presentation Guide
## Razorpay Hackathon 2026 — Track 04: AI Finance Controller

This document provides a step-by-step presentation script and demonstration guide for showcasing **ReconcileAI** to hackathon judges, auditors, and stakeholders.

---

## 1. Hackathon Track Alignment (Track 04)

ReconcileAI addresses the core challenges of **Track 04: AI Finance Controller**:

1. **Multi-Source Ingestion**: Ingests 5 financial streams simultaneously (Orders, Gateway Payments, Gateway Settlements, Direct Bank Statements, Refunds).
2. **Deterministic Reconciliation Engine**: Executes multi-signal graph matching and scores transactions with high throughput (>70 rec/s) and zero manual oversight for exact/fee/refund matches.
3. **AI Finance Controller Assistant**: Conversational agent executing 10 specialized finance tools to answer settlement queries, forecast cash flows, and escalate exceptions.
4. **Liquidity & Tax Intelligence**: Real-time cash position monitoring, 30-day forecasting, and tax discrepancy verification.
5. **Ground Truth Benchmark Evaluation**: Evaluates automated decisions against ground truth with 3x3 confusion matrices, macro/weighted F1 scores, and strict dataset scoping.

---

## 2. Pre-Demo Verification Checklist

Before presenting the live demonstration, confirm:
- [x] Python engine running on `http://localhost:8000/health`
- [x] Express backend running on `http://localhost:5000/health`
- [x] React SPA accessible at `http://localhost:5173`
- [x] Seed credentials available: `admin@reconcile.ai` / `Admin@12345`
- [x] Benchmark CSV files ready in `data/dataset_250/` or `data_500/`

---

## 3. Step-by-Step Live Demonstration Script

### Step 1: Clean Login & Role Authentication
1. Navigate to `http://localhost:5173`.
2. Highlight the clean ReconcileAI brand logo header.
3. Sign in as **System Admin** (`admin@reconcile.ai` / `Admin@12345`).
4. **Key Talking Point**: *"ReconcileAI enforces strict Role-Based Access Control (RBAC) across Admin, Analyst, and Viewer personas, ensuring security and audit compliance."*

### Step 2: Data Ingestion (`/upload`)
1. Click **Data Upload** on the sidebar.
2. Upload the 5 source CSV files from `data/dataset_250/`:
   - `orders.csv` (250 records)
   - `payments.csv` (250 records)
   - `settlements.csv` (209 records)
   - `bank_transactions.csv` (245 records)
   - `refunds.csv` (30 records)
3. Click **Upload Dataset Batch**.
4. **Key Talking Point**: *"ReconcileAI validates schemas, coerces monetary fields, and saves the batch atomically in PostgreSQL with batch ID generation."*

### Step 3: Automated Multi-Source Reconciliation Execution (`/reconciliation`)
1. Click **Reconciliation Agent**.
2. Select the uploaded batch and click **Run Reconciliation Engine**.
3. Point out the live throughput speed (e.g. **72.25 records/second**).
4. Highlight the instant metric cards:
   - **Matched Records** (e.g. 119 - Exact, Fee-Adjusted, Refund-Adjusted)
   - **Needs Review** (e.g. 60 - Duplicate Bank Tx, Partial Settlement, Date Mismatch)
   - **Exceptions** (e.g. 71 - Amount Mismatch, Missing Settlement, Unknown Tx)
5. **Key Talking Point**: *"Our Python decision engine builds relational transaction graph bundles and scores 5 weighted signals to reconcile complex fees, taxes, and refunds in milliseconds."*

### Step 4: AI Finance Controller Assistant (`/assistant`)
1. Click **Finance Controller AI** on the sidebar.
2. Ask natural language financial questions:
   - *Query 1*: `"What is the current cash position and 30-day forecast?"`
   - *Query 2*: `"Why was TXN1001 reconciled as MATCHED?"`
   - *Query 3*: `"How much was settled today?"`
   - *Query 4*: `"Verify tax-line matching on settlement records"`
   - *Query 5*: `"Route transaction TXN20288 for human review because of amount discrepancy"`
3. Demonstrate the **Agent Activity Panel** and **Verified Tools Called** badges showing exact tool execution (`get_cash_position`, `get_settlement_summary`, `get_tax_match`, `create_human_review`).
4. **Key Talking Point**: *"The AI Controller features 10 specialized financial tools with OpenAI function calling and a zero-latency fallback intent router, giving finance teams instant conversational insights."*

### Step 5: Cash Position & Liquidity Forecasting (`/cash-position`)
1. Click **Cash Position**.
2. Review the Current Net Cash Balance (₹4,80,19,760.28).
3. Inspect the liquidity projections:
   - **7-Day Forecast**: ₹9,60,39,521
   - **14-Day Forecast**: ₹1,44,05,928
   - **30-Day Forecast**: ₹2,53,60,256
4. **Key Talking Point**: *"ReconcileAI bridges operational reconciliation with treasury management, projecting future net cash based on pending settlements and refunds."*

### Step 6: Tax-Line Matching & Discrepancy Verification (`/tax-verification`)
1. Click **Tax Verification**.
2. Show verified settlement tax amounts and flagged tax-line discrepancies.
3. **Key Talking Point**: *"The engine automatically computes expected GST against gateway deductions to ensure compliance and prevent tax leakage."*

### Step 7: Exception Center & Human-in-the-Loop Review (`/exceptions`)
1. Click **Exceptions**.
2. Filter exceptions by category (`AMOUNT_MISMATCH`, `MISSING_SETTLEMENT`, `UNKNOWN_TRANSACTION`).
3. Click an exception, review the evidence drawer, enter a resolution note (e.g., *"Verified manual bank deposit"*), and click **Approve Manual Match**.
4. Show that status updates to `RESOLVED` and records an immutable audit log entry.
5. **Key Talking Point**: *"High-risk exceptions are automatically flagged for human-in-the-loop review, creating a seamless workflow between AI and human controllers."*

### Step 8: Ground Truth Evaluation & Scoped Metrics (`/analytics`)
1. Click **Analytics / Evaluation**.
2. Upload `data/dataset_250/ground_truth.csv` (250 records).
3. Click **RUN EVALUATION**.
4. Inspect the evaluation dashboard:
   - **Accuracy**: 69.2%
   - **Macro F1**: 69.67%
   - **Weighted F1**: 70.15%
   - **3x3 Confusion Matrix** (Actual vs Predicted status)
   - **Per-Class Metrics** (Precision, Recall, F1 for MATCHED, REVIEW, EXCEPTION)
5. **Key Talking Point**: *"ReconcileAI incorporates strict dataset scoping. Uploading a new ground-truth dataset instantly archives old evaluation states, ensuring zero stale metrics."*

### Step 9: Executive Reports & CSV Exports (`/run-history`)
1. Click **Run History & Reports**.
2. Click **View Report** on the latest run to open the **AI Finance Controller Executive Report** modal with official branding.
3. Click **Export Evaluation Report CSV** and **Export Audit Log CSV** to demonstrate downloadable audit artifacts.

### Step 10: System Audit Trail (`/audit-trail`)
1. Click **Audit Trail**.
2. Show the complete timeline of user actions, reconciliation runs, manual approvals, and ground-truth uploads.
3. **Key Talking Point**: *"Every financial action is logged in an immutable PostgreSQL audit trail for SOC 2 and enterprise compliance."*

---

## 4. Persona & Role Switching Demonstration

To demonstrate RBAC to judges:

1. **Log out** as Admin and sign in as **Finance Viewer** (`viewer@reconcile.ai` / `Viewer@12345`).
2. Show that read-only access is enforced across Dashboard, Cash Position, and Audit Trail.
3. Attempt to trigger **Run Evaluation** or **Run Reconciliation** to show the `403 Forbidden` access denial notification.
4. Sign back in as **Admin** or **Analyst** to demonstrate operational controls.
