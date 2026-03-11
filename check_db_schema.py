import os
import psycopg2
from dotenv import load_dotenv

def check_schema():
    load_dotenv()
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("DATABASE_URL not found")
        return
        
    # Standardize URL
    db_url = db_url.replace('sslmode=verify-full', 'sslmode=require').replace('&sslrootcert=system', '')
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("--- Table: raw_products ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'raw_products'")
        cols = cur.fetchall()
        for col in cols:
            print(f"{col[0]}: {col[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
