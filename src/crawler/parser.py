import os
import psycopg2
from pyvi import ViTokenizer
from dotenv import load_dotenv

load_dotenv()

def get_product_generator():
    """
    Yields product data line-by-line from the Postgres/CockroachDB database.
    Queries 'external_id' and 'name_normalized' from 'raw_products'.
    Normalize 'name_normalized' using Pyvi.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment variables.")
        return

    conn = None
    try:
        conn = psycopg2.connect(db_url)
        
        # Use server-side cursor (named cursor) to stream results
        # 'product_cursor' is the name of the cursor on the server
        with conn.cursor(name='product_cursor') as cursor:
            cursor.execute("SELECT external_id, name_normalized FROM raw_products")
            
            while True:
                # Fetch small batches to keep RAM usage low
                rows = cursor.fetchmany(size=1000)
                if not rows:
                    break
                    
                for row in rows:
                    doc_id = str(row[0])
                    name_normalized = row[1]
                    
                    if name_normalized:
                        # ViTokenizer.tokenize sẽ nối từ ghép bằng gạch dưới
                        text_processed = ViTokenizer.tokenize(name_normalized)
                        tokens = text_processed.split()
                        
                        yield doc_id, tokens
                        
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()
