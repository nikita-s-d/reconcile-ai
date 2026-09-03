import urllib.request
import urllib.parse
import json
import os

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
    try:
        with urllib.request.urlopen(req) as resp:
            res_body = resp.read().decode("utf-8")
            return resp.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(res_body)
        except:
            parsed = {"raw": res_body}
        return e.code, parsed

def login(email, password):
    status, body = make_request(f"{BASE_URL}/auth/login", method="POST", data={"email": email, "password": password})
    assert status == 200, f"Login failed for {email}"
    return body["token"]

def main():
    print("===========================================================")
    print("TESTING RUN EVALUATION BUTTON EDGE CASES & RBAC")
    print("===========================================================")

    admin_token = login("admin@reconcile.ai", "Admin@12345")
    analyst_token = login("analyst@reconcile.ai", "Analyst@12345")
    viewer_token = login("viewer@reconcile.ai", "Viewer@12345")

    print("\n1. Test VIEWER Role RBAC (POST /api/evaluation/run as Viewer)...")
    status, body = make_request(f"{BASE_URL}/evaluation/run", method="POST", data={}, headers={"Authorization": f"Bearer {viewer_token}"})
    print(f"   Response Status: {status}, Body: {body}")
    assert status == 403, "Expected 403 Forbidden for Viewer role"

    print("\n2. Test ANALYST Role Permission (POST /api/evaluation/run as Analyst)...")
    status, body = make_request(f"{BASE_URL}/evaluation/run", method="POST", data={}, headers={"Authorization": f"Bearer {analyst_token}"})
    print(f"   Response Status: {status}, Accuracy: {body['evaluation']['accuracy']}%")
    assert status == 200, "Expected 200 OK for Analyst role"

    print("\n3. Test Page Refresh State Restoration (GET /api/evaluation/results)...")
    status, body = make_request(f"{BASE_URL}/evaluation/results", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
    print(f"   Response Status: {status}, Has Evaluated: {body['hasEvaluated']}, Accuracy: {body['accuracy']}%")
    assert status == 200
    assert body["hasEvaluated"] is True
    assert body["accuracy"] > 0

    print("\n===========================================================")
    print("ALL EVALUATION BUTTON SPECIFICATIONS & RBAC TESTS PASSED!")
    print("===========================================================")

if __name__ == "__main__":
    main()
