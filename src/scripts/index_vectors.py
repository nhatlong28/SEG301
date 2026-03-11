import os
import sys
import psycopg2
from dotenv import load_dotenv
# Ensure we can import from src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from src.ranking.vector import VectorRanker

load_dotenv()

def index_all_products(limit: int = None):
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set.")
        return

    ranker = VectorRanker()
    existing_ids = ranker.get_existing_ids()
    
    conn = None
    try:
        try:
            conn = psycopg2.connect(db_url)
        except Exception as ssl_err:
            print(f"Initial connection failed: {ssl_err}. Trying with sslmode=require...")
            # Fallback: normalize for CockroachDB / SSL compatibility if strict verification fails
            normalized_url = db_url.replace("sslmode=verify-full", "sslmode=require").replace("&sslrootcert=system", "")
            conn = psycopg2.connect(normalized_url)

        with conn.cursor(name='vector_indexer_cursor') as cursor:
            print("Querying database...")
            cursor.execute("SELECT id, name_normalized FROM raw_products WHERE name_normalized IS NOT NULL AND name_normalized != ''")
            
            batch_size = 1000
            batch = []
            count = 0
            skipped = 0
            
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break
                    
                for row in rows:
                    doc_id = row[0]
                    name = row[1]
                    
                    # Skip if already exists
                    if doc_id in existing_ids:
                        skipped += 1
                        continue
        
                    # Store metadata for returning in search results
                    batch.append({
                        "id": doc_id,
                        "name": name
                    })
                    count += 1
                    
                    if limit and count >= limit:
                        break
                
                # Index the batch
                if batch:
                    ranker.index_documents(batch, batch_size=batch_size)
                    batch = [] # Clear
                
                if skipped > 0 and skipped % 10000 == 0:
                    print(f"Skipped {skipped} already indexed documents...")

                if limit and count >= limit:
                    print(f"Reached limit of {limit} new documents.")
                    break
                    
            print(f"Vector Indexing Complete. New: {count}, Skipped: {skipped}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import sys
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    
    ranker = VectorRanker()
    # ranker.delete_collection() # Cẩn thận: Dòng này sẽ xóa hết vector cũ nếu uncomment
    index_all_products(limit=limit)
