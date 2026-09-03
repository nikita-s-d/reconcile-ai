import urllib.request
import json

BASE_URL = "http://localhost:5000/api"

req = urllib.request.Request(f"{BASE_URL}/auth/login", method="POST", headers={"Content-Type": "application/json"}, data=json.dumps({"email": "admin@reconcile.ai", "password": "Admin@12345"}).encode())
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())["token"]

req = urllib.request.Request(f"{BASE_URL}/evaluation/results", method="GET", headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req) as resp:
    print(json.dumps(json.loads(resp.read().decode()), indent=2))
