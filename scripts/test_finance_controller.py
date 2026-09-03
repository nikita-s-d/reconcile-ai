import urllib.request
import urllib.parse
import json
import os
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5000/api"

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        if isinstance(data, dict):
            body = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")
        else:
            body = data
        req.data = body
    with urllib.request.urlopen(req) as resp:
        res_body = resp.read()
        return json.loads(res_body.decode("utf-8")) if res_body else {}

def main():
    print("===========================================================")
    print("TESTING AI FINANCE CONTROLLER EXTENDED CAPABILITIES & RBAC")
    print("===========================================================")

    print("\n1. Logging in as Admin (admin@reconcile.ai)...")
    login_res = make_request(f"{BASE_URL}/auth/login", method="POST", data={
        "email": "admin@reconcile.ai",
        "password": "Admin@12345"
    })
    token = login_res["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("   Login successful!")

    print("\n2. Fetching AI Finance Controller Dashboard Metrics (GET /api/finance/dashboard)...")
    dash = make_request(f"{BASE_URL}/finance/dashboard", method="GET", headers=auth_headers)
    print(f"   Processed Records: {dash['totalRecordsProcessed']}")
    print(f"   Transaction Value: INR {dash['totalTransactionValue']}")
    print(f"   Reconciled Value: INR {dash['reconciledValue']}")
    print(f"   Exception Value: INR {dash['exceptionValue']}")
    print(f"   Current Cash Position: INR {dash['currentCashPosition']}")
    print(f"   Projected 30d Cash Position: INR {dash['projectedCashPosition30d']}")

    print("\n3. Testing Settlement Q&A Intelligence (POST /api/finance/settlements/qa)...")
    qa_queries = [
        "How much was settled today?",
        "What is the total pending settlement?",
        "Why was TX1023 not settled?",
        "What was the largest settlement?"
    ]
    for q in qa_queries:
        res = make_request(f"{BASE_URL}/finance/settlements/qa", method="POST", data={"query": q}, headers=auth_headers)
        print(f"   Q: '{q}'")
        print(f"   A: '{res['answer']}'")
        assert "answer" in res and len(res["answer"]) > 0

    print("\n4. Testing Cash Position & Forecasting (GET /api/finance/cash-position)...")
    cash_res = make_request(f"{BASE_URL}/finance/cash-position", method="GET", headers=auth_headers)
    print(f"   Current Cash Position: INR {cash_res['currentCashPosition']}")
    print(f"   7-Day Forecast: INR {cash_res['forecasts']['days7']}")
    print(f"   14-Day Forecast: INR {cash_res['forecasts']['days14']}")
    print(f"   30-Day Forecast: INR {cash_res['forecasts']['days30']}")
    print(f"   Assumptions: {cash_res['assumptions'][0]}")

    print("\n5. Testing Tax-Line Verification (GET /api/finance/tax-verification)...")
    tax_res = make_request(f"{BASE_URL}/finance/tax-verification", method="GET", headers=auth_headers)
    print(f"   Tax Data Available: {tax_res['taxDataAvailable']}")
    print(f"   Total Tax Verified: INR {tax_res['totalTaxVerified']}")
    print(f"   Tax Exceptions Flagged: {tax_res['taxExceptionCount']}")

    print("\n6. Testing Run History (GET /api/finance/runs)...")
    runs_res = make_request(f"{BASE_URL}/finance/runs", method="GET", headers=auth_headers)
    print(f"   Total Recorded Runs: {len(runs_res['runs'])}")
    if len(runs_res['runs']) > 0:
        first_run = runs_res['runs'][0]
        print(f"   Latest Run ID: {first_run['runId']}, Throughput: {first_run['throughput']} rec/s")
        
        print(f"\n7. Testing Finance Controller Report Generation (GET /api/finance/reports/{first_run['runId']})...")
        report = make_request(f"{BASE_URL}/finance/reports/{first_run['runId']}", method="GET", headers=auth_headers)
        print(f"   Report Batch Name: {report['runInfo']['batchName']}")
        print(f"   Reconciled Value: INR {report['financialSummary']['reconciledValue']}")
        print(f"   Total Exceptions: {report['exceptionsBreakdown']['totalExceptions']}")

    print("\n8. Testing Human-in-the-Loop Review & Audit Logging...")
    exceptions = make_request(f"{BASE_URL}/exceptions?limit=5", method="GET", headers=auth_headers)
    exc_list = exceptions.get("exceptions", [])
    if len(exc_list) > 0:
        target_exc = exc_list[0]
        print(f"   Targeting Exception ID: {target_exc['id']} (Tx: {target_exc['transactionId']})")
        
        # Approve Match
        app_res = make_request(f"{BASE_URL}/exceptions/{target_exc['id']}/approve", method="POST", data={"reason": "Verified bank statement manual match"}, headers=auth_headers)
        print(f"   Approved! Status: {app_res['exception']['status']}, Resolution: '{app_res['exception']['resolutionNote']}'")
        
        # Verify Audit Log
        audit_res = make_request(f"{BASE_URL}/audit-logs?limit=5", method="GET", headers=auth_headers)
        recent_actions = [a["action"] for a in audit_res.get("auditLogs", [])]
        print(f"   Recent Audit Actions: {recent_actions[:5]}")
        assert any(act in recent_actions for act in ["MANUAL_MATCH_APPROVED", "MATCH_APPROVED", "EXCEPTION_RESOLVED"])

    print("\n===========================================================")
    print("ALL AI FINANCE CONTROLLER TEST SPECIFICATIONS PASSED!")
    print("===========================================================")

if __name__ == "__main__":
    main()
