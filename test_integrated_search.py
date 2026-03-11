import os
import sys
import psycopg2
from dotenv import load_dotenv

# Ensure we can import from src
sys.path.append(os.path.abspath(os.getcwd()))

load_dotenv()

from src.ranking.vector import VectorRanker

def get_products_test(doc_ids):
    db_url = os.getenv("DATABASE_URL")
    normalized_url = db_url.replace("sslmode=verify-full", "sslmode=require").replace("&sslrootcert=system", "")
    conn = psycopg2.connect(normalized_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM raw_products WHERE id = ANY(%s)", (doc_ids,))
            rows = cur.fetchall()
            return {row[0]: row[1] for row in rows}
    finally:
        conn.close()

try:
    print("1. Initializing Vector Engine...")
    vr = VectorRanker()
    
    print("2. Searching for 'chuột gaming'...")
    results = vr.search("chuột gaming", top_k=5)
    doc_ids = [res['id'] for res in results]
    print(f"   Found IDs: {doc_ids}")
    
    print("3. Fetching names from DB...")
    product_map = get_products_test(doc_ids)
    print(f"   DB Results Count: {len(product_map)}")
    
    for i, res in enumerate(results):
        name_db = product_map.get(res['id'], "NOT FOUND IN DB")
        print(f"[{i}] ID: {res['id']} | DB Name: {name_db}")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
