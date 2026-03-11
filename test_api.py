import requests
import json

try:
    print("Testing Hybrid Search API...")
    url = "http://127.0.0.1:8000/api/search"
    params = {
        "query": "chuột gaming",
        "method": "hybrid",
        "limit": 10
    }
    response = requests.get(url, params=params, timeout=30)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Count: {data.get('count')}")
    if data.get('data'):
        for i, item in enumerate(data['data'][:3]):
            print(f"[{i}] {item.get('id')} - {item.get('name')} (Score: {item.get('score')})")
    else:
        print("NO DATA RETURNED")
except Exception as e:
    print(f"ERROR: {e}")
