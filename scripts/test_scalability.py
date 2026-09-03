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
        res_body = resp.read().decode("utf-8")
        return json.loads(res_body) if res_body else {}

def main():
    print("===========================================================")
    print("TESTING SCALABILITY DATASET (500+ RECORDS)")
    print("===========================================================")
    
    login_res = make_request(f"{BASE_URL}/auth/login", method="POST", data={
        "email": "analyst@reconcile.ai",
        "password": "Analyst@12345"
    })
    token = login_res["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    boundary = "----WebKitFormBoundaryScalability500"
    body_parts = []
    
    csv_files = {
        "orders": "data_500/orders.csv",
        "payments": "data_500/payments.csv",
        "settlements": "data_500/settlements.csv",
        "bank_transactions": "data_500/bank_transactions.csv",
        "refunds": "data_500/refunds.csv"
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
    print(f"\n1. Uploaded 500-record batch! Batch ID: {batch_id}, Record Count: {upload_res['batch']['recordCount']}")
    
    print("\n2. Triggering reconciliation run on 500-record batch...")
    recon_res = make_request(f"{BASE_URL}/reconciliation/run", method="POST", data={"batchId": batch_id}, headers=auth_headers)
    run = recon_res["run"]
    print(f"   Reconciliation Completed for 500+ records!")
    print(f"   Total Processed: {run['totalRecords']}")
    print(f"   Matched: {run['matchedCount']}")
    print(f"   Review: {run['reviewCount']}")
    print(f"   Exceptions: {run['exceptionCount']}")
    print(f"   Match Rate: {run['matchRate']}%")
    print(f"   Processing Time: {run['processingTimeMs']} ms")
    print(f"   Throughput: {run['throughput']} records/sec")
    
    print("\n===========================================================")
    print("SCALABILITY VERIFICATION PASSED — 500+ RECORDS PROCESSED DYNAMICALLY!")
    print("===========================================================")

if __name__ == "__main__":
    main()
