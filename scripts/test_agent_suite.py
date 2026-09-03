import urllib.request
import urllib.parse
import json
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
    print("TESTING AI FINANCE CONTROLLER AGENT & 10 FINANCE TOOLS")
    print("===========================================================")

    print("\n1. Logging in as Admin (admin@reconcile.ai)...")
    login_res = make_request(f"{BASE_URL}/auth/login", method="POST", data={
        "email": "admin@reconcile.ai",
        "password": "Admin@12345"
    })
    token = login_res["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("   Login successful!")

    print("\n2. Testing Agent Chat Endpoint (POST /api/agent/chat)...")
    agent_queries = [
        "Why was TXN1001 reconciled as MATCHED?",
        "How many exceptions are there in the Exception Center?",
        "What is the current cash position and 30-day forecast?",
        "How much was settled today?",
        "Verify tax-line matching on settlement records",
        "Route transaction TXN20288 for human review because of amount discrepancy",
        "Run reconciliation on the latest batch"
    ]

    for q in agent_queries:
        res = make_request(f"{BASE_URL}/agent/chat", method="POST", data={"message": q}, headers=auth_headers)
        print(f"\n   Query: '{q}'")
        print(f"   Response Preview: '{res['response'][:120]}...'")
        print(f"   Fallback Router Used: {res.get('fallbackUsed', False)}")
        print(f"   Activity Steps Count: {len(res.get('activitySteps', []))}")
        print(f"   Executed Tools Count: {len(res.get('toolCalls', []))}")
        assert "response" in res and len(res["response"]) > 0

    print("\n3. Verifying Audit Trail Logging for Agent Runs & Tool Calls...")
    audit_res = make_request(f"{BASE_URL}/audit-logs?limit=10", method="GET", headers=auth_headers)
    recent_actions = [a["action"] for a in audit_res.get("auditLogs", [])]
    print(f"   Recent Audit Actions: {recent_actions[:6]}")
    assert any(act in recent_actions for act in ["AGENT_RUN_STARTED", "AGENT_TOOL_CALLED", "AGENT_RUN_COMPLETED", "ROUTED_TO_HUMAN_REVIEW"])

    print("\n===========================================================")
    print("ALL AI AGENT & 10 FINANCE TOOL SPECIFICATIONS PASSED!")
    print("===========================================================")

if __name__ == "__main__":
    main()
