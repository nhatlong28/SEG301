import logging
import traceback
import os
import sys

# Ensure we can import from src
sys.path.append(os.path.abspath(os.getcwd()))

logging.basicConfig(level=logging.INFO)
from src.ranking.vector import VectorRanker

try:
    print("Attempting to initialize VectorRanker...")
    r = VectorRanker()
    print("SUCCESS: VectorRanker initialized.")
    res = r.search("chuột gaming", top_k=5)
    print(f"SEARCH SUCCESS: Found {len(res)} results.")
    for i, item in enumerate(res):
        print(f"[{i}] {item['id']} - {item['name']} (Score: {item['score']})")
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
