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
    
    try:
        conn = None
        normalized_url = db_url.replace("sslmode=verify-full", "sslmode=require").replace("&sslrootcert=system", "")
        conn = psycopg2.connect(normalized_url)
        with conn.cursor(name='vector_indexer_cursor') as cursor:
            print("Querying database...")
            cursor.execute("SELECT id, name_normalized FROM raw_products WHERE name_normalized IS NOT NULL AND name_normalized != ''")
            
            batch_size = 1000
            batch = []
            count = 0
            
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break
                    
                for row in rows:
                    doc_id = row[0]
                    name = row[1]
        
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
                
                if limit and count >= limit:
                    print(f"Reached limit of {limit} documents.")
                    break
                    
            print("Vector Indexing Complete.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    ranker = VectorRanker()
    ranker.delete_collection()
    index_all_products()
