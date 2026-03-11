import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
print(f"Testing connection with DATABASE_URL: {db_url}")

try:
    print("Attempting to connect with sslmode=require...")
    # 'require' usually allows connection even if cert is not verified against a CA
    conn_str = db_url.replace("sslmode=verify-full", "sslmode=require").replace("&sslrootcert=system", "")
    print(f"URL: {conn_str}")
    conn = psycopg2.connect(conn_str)
    print("Connection successful!")
    with conn.cursor() as cur:
        cur.execute("SELECT 1")
        print(f"Query result: {cur.fetchone()}")
    conn.close()
except Exception as e:
    print(f"\nConnection failed with error:\n{e}")
    print("\nDetailed error type:", type(e))
