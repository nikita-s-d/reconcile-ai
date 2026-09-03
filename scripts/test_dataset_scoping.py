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
    with urllib.request.urlopen(req) as resp:
        res_body = resp.read()
        return json.loads(res_body.decode("utf-8")) if res_body else {}

def main():
    print("===========================================================")
    print("TESTING STRICT GROUND TRUTH DATASET SCOPING & DATA INTEGRITY")
    print("===========================================================")

    print("\n1. Logging in as Admin...")
    login_res = make_request(f"{BASE_URL}/auth/login", method="POST", data={
        "email": "admin@reconcile.ai",
        "password": "Admin@12345"
    })
    token = login_res["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print("   Login successful!")

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
    print(f"   Dataset uploaded! Batch ID: {batch_id}")

    print("\n3. Triggering automated reconciliation run...")
    recon_res = make_request(f"{BASE_URL}/reconciliation/run", method="POST", data={"batchId": batch_id}, headers=auth_headers)
    run_id = recon_res["run"]["id"]
    print(f"   Reconciliation run completed! Run ID: {run_id}")

    print("\n4. Uploading Dataset A (ground_truth.csv - 100 records)...")
    gt_boundary = "----WebKitFormBoundaryGroundTruth123"
    gt_parts = []
    with open("data/ground_truth.csv", "rb") as f:
        gt_content = f.read()
    gt_parts.append(f"--{gt_boundary}".encode("utf-8"))
    gt_parts.append(b'Content-Disposition: form-data; name="file"; filename="ground_truth_100.csv"')
    gt_parts.append(b"Content-Type: text/csv\r\n")
    gt_parts.append(gt_content)
    gt_parts.append(f"--{gt_boundary}--".encode("utf-8"))
    gt_body = b"\r\n".join(gt_parts)

    gt_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={gt_boundary}"
    }
    gt1_res = make_request(f"{BASE_URL}/evaluation/upload-ground-truth", method="POST", data=gt_body, headers=gt_headers)
    dataset1_id = gt1_res["datasetId"]
    print(f"   Dataset A Uploaded! ID: {dataset1_id}, Records: {gt1_res['recordCount']}")

    print("\n5. Running Evaluation for Dataset A...")
    eval1_res = make_request(f"{BASE_URL}/evaluation/run", method="POST", data={"runId": run_id, "groundTruthDatasetId": dataset1_id}, headers=auth_headers)
    print(f"   Dataset A Evaluated! Accuracy: {eval1_res['evaluation']['accuracy']}%, Total GT Records: {eval1_res['evaluation']['totalGtRecords']}")

    print("\n6. Uploading Dataset B (new ground truth dataset)...")
    gt2_res = make_request(f"{BASE_URL}/evaluation/upload-ground-truth", method="POST", data=gt_body, headers=gt_headers)
    dataset2_id = gt2_res["datasetId"]
    print(f"   Dataset B Uploaded! ID: {dataset2_id}, Records: {gt2_res['recordCount']}")

    print("\n7. Fetching /api/evaluation/results BEFORE evaluating Dataset B...")
    res_before_eval = make_request(f"{BASE_URL}/evaluation/results", method="GET", headers=auth_headers)
    
    print(f"   Active Dataset ID: {res_before_eval['groundTruthDataset']['id']}")
    print(f"   Has Evaluated for Active Dataset: {res_before_eval['hasEvaluated']}")
    print(f"   Evaluation Object: {res_before_eval.get('evaluation')}")

    # VERIFY CRITICAL BEHAVIOR: Dataset A's old evaluation MUST NOT be returned for Dataset B!
    assert res_before_eval["groundTruthDataset"]["id"] == dataset2_id
    assert res_before_eval["hasEvaluated"] == False
    assert res_before_eval.get("evaluation") is None
    print("   SUCCESS! Dataset A's old evaluation is correctly HIDDEN for Dataset B!")

    print("\n8. Running Evaluation for Dataset B...")
    eval2_res = make_request(f"{BASE_URL}/evaluation/run", method="POST", data={"runId": run_id, "groundTruthDatasetId": dataset2_id}, headers=auth_headers)
    print(f"   Dataset B Evaluated! Accuracy: {eval2_res['evaluation']['accuracy']}%, Total GT Records: {eval2_res['evaluation']['totalGtRecords']}")

    print("\n9. Fetching /api/evaluation/results AFTER evaluating Dataset B...")
    res_after_eval = make_request(f"{BASE_URL}/evaluation/results", method="GET", headers=auth_headers)
    assert res_after_eval["hasEvaluated"] == True
    assert res_after_eval["groundTruthDatasetId"] == dataset2_id
    assert res_after_eval["evaluation"]["total_gt_records"] == 100
    print("   SUCCESS! Dataset B evaluation correctly associated and returned!")

    print("\n===========================================================")
    print("STRICT DATASET SCOPING & ZERO STALE METRICS TEST PASSED!")
    print("===========================================================")

if __name__ == "__main__":
    main()
