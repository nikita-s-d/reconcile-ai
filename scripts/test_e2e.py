import urllib.request
import urllib.parse
import json
import os

BASE_URL = "http://localhost:5000/api"

def make_request(url, method="GET", data=None, headers=None, is_blob=False):
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
        if is_blob:
            return res_body, resp.headers
        return json.loads(res_body.decode("utf-8")) if res_body else {}

def main():
    print("1. Logging in as Admin (admin@reconcile.ai)...")
    login_res = make_request(f"{BASE_URL}/auth/login", method="POST", data={
        "email": "admin@reconcile.ai",
        "password": "Admin@12345"
    })
    token = login_res["token"]
    print("   Login successful! JWT Token acquired.")
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    print("\n2. Uploading 5 reconciliation CSV files (100 records)...")
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body_parts = []
    
    csv_files = {
        "orders": "data/orders.csv",
        "payments": "data/payments.csv",
        "settlements": "data/settlements.csv",
        "bank_transactions": "data/bank_transactions.csv",
        "refunds": "data/refunds.csv"
    }
    
    for fieldname, filepath in csv_files.items():
        filename = os.path.basename(filepath)
        with open(filepath, "rb") as f:
            content = f.read()
        body_parts.append(f"--{boundary}".encode("utf-8"))
        body_parts.append(f'Content-Disposition: form-data; name="{fieldname}"; filename="{filename}"'.encode("utf-8"))
        body_parts.append(b"Content-Type: text/csv\r\n")
        body_parts.append(content)
        
    body_parts.append(f"--{boundary}--".encode("utf-8"))
    multipart_body = b"\r\n".join(body_parts)
    
    upload_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    }
    
    upload_res = make_request(f"{BASE_URL}/datasets/upload", method="POST", data=multipart_body, headers=upload_headers)
    batch_id = upload_res["batch"]["id"]
    print(f"   Dataset uploaded successfully! Batch ID: {batch_id}, Total Records: {upload_res['batch']['recordCount']}")
    
    print("\n3. Triggering automated reconciliation run...")
    recon_res = make_request(f"{BASE_URL}/reconciliation/run", method="POST", data={"batchId": batch_id}, headers=auth_headers)
    run = recon_res["run"]
    print(f"   Reconciliation Completed! Total: {run['totalRecords']}, Matched: {run['matchedCount']}, Review: {run['reviewCount']}, Exceptions: {run['exceptionCount']}")
    
    print("\n4. Testing Ground Truth Upload Button Endpoint (POST /api/evaluation/upload-ground-truth with multer field 'file')...")
    gt_boundary = "----WebKitFormBoundaryGroundTruth123"
    gt_parts = []
    with open("data/ground_truth.csv", "rb") as f:
        gt_content = f.read()
    gt_parts.append(f"--{gt_boundary}".encode("utf-8"))
    gt_parts.append(b'Content-Disposition: form-data; name="file"; filename="ground_truth.csv"')
    gt_parts.append(b"Content-Type: text/csv\r\n")
    gt_parts.append(gt_content)
    gt_parts.append(f"--{gt_boundary}--".encode("utf-8"))
    gt_body = b"\r\n".join(gt_parts)
    
    gt_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={gt_boundary}"
    }
    gt_res = make_request(f"{BASE_URL}/evaluation/upload-ground-truth", method="POST", data=gt_body, headers=gt_headers)
    gt_dataset_id = gt_res["datasetId"]
    print(f"   Ground Truth Uploaded to PostgreSQL! Dataset ID: {gt_dataset_id}, Record Count: {gt_res['recordCount']}")
    
    print("\n5. Testing Ground Truth Evaluation Button Endpoint (POST /api/evaluation/run)...")
    eval_res = make_request(f"{BASE_URL}/evaluation/run", method="POST", data={"runId": run['id'], "groundTruthDatasetId": gt_dataset_id}, headers=auth_headers)
    metrics = eval_res["evaluation"]
    print(f"   Evaluation Completed & Persisted to PostgreSQL!")
    print(f"   Accuracy: {metrics['accuracy']}%, F1 Macro: {metrics['f1Macro']}%, F1 Weighted: {metrics['f1Weighted']}%")
    print(f"   Associated Run ID: {metrics['runId']}, GT Dataset ID: {metrics['groundTruthDatasetId']}")
    
    print("\n6. Testing Export Evaluation Report CSV Button Endpoint (GET /api/export/evaluation)...")
    eval_csv_bytes, eval_headers = make_request(f"{BASE_URL}/export/evaluation", method="GET", headers=auth_headers, is_blob=True)
    print(f"   Export Evaluation Report Successful!")
    print(f"   Header Content-Type: {eval_headers.get('Content-Type')}")
    print(f"   Header Content-Disposition: {eval_headers.get('Content-Disposition')}")
    print(f"   Downloaded evaluation_report.csv size: {len(eval_csv_bytes)} bytes")
    
    print("\n7. Testing Export Audit Log CSV Button Endpoint (GET /api/export/audit)...")
    audit_csv_bytes, audit_headers = make_request(f"{BASE_URL}/export/audit", method="GET", headers=auth_headers, is_blob=True)
    print(f"   Export Audit Log Successful!")
    print(f"   Header Content-Type: {audit_headers.get('Content-Type')}")
    print(f"   Header Content-Disposition: {audit_headers.get('Content-Disposition')}")
    print(f"   Downloaded audit_log.csv size: {len(audit_csv_bytes)} bytes")
    
    print("\n8. Verifying Audit Trail Log Entries in PostgreSQL...")
    audit_res = make_request(f"{BASE_URL}/audit-logs", method="GET", headers=auth_headers)
    actions = [a['action'] for a in audit_res['auditLogs']]
    print(f"   Recent Audit Actions: {actions[:7]}")
    
    assert "GROUND_TRUTH_UPLOADED" in actions
    assert "EVALUATION_STARTED" in actions
    assert "EVALUATION_COMPLETED" in actions
    assert "EVALUATION_REPORT_EXPORTED" in actions
    assert "AUDIT_LOG_EXPORTED" in actions
    
    print("\n===========================================================")
    print("ALL THREE CSV BUTTON WORKFLOWS VERIFIED SUCCESSFULLY!")
    print("===========================================================")

if __name__ == "__main__":
    main()
