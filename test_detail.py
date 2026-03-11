import requests
r = requests.get("http://127.0.0.1:8000/api/products?limit=1")
data = r.json()
pid = data["data"][0]["id"]
print(f"Product ID: {pid}")
r2 = requests.get(f"http://127.0.0.1:8000/api/products/{pid}")
d2 = r2.json()
print(f"Status: {r2.status_code}")
print(f"Success: {d2.get('success')}")
if d2.get("data"):
    print(f"Name: {d2['data']['name'][:60]}")
    print(f"Price: {d2['data']['price']}")
    print(f"Platform: {d2['data']['platform']}")
else:
    print(f"ERROR: {d2}")
