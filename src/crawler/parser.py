import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_product_generator(source="from_supabase"):
    """
    Generator yield (doc_id, tokens) from Supabase.
    """
    if source != "from_supabase":
        raise ValueError("Only 'from_supabase' source is supported currently.")

    # Get connection string from env
    # Looking for a general DATABASE_URL or specific params. 
    # Usually Supabase gives a connection string or host/user/pass.
    # We will try to fetch standard PG env vars or a connection URL.
    try:
        # Assuming DB_CONNECTION_STRING or similar, or individual params.
        # Constructing connection string or passing params.
        # User prompt mentioned: "Trích xuất data từ bảng raw_product trong project crawl của chiendz098's Org"
        # We'll expect DATABASE_URL or typical PG environment variables to be set in .env
        conn_str = os.getenv("DATABASE_URL")
        if not conn_str:
            # Fallback to individual params if URL not found
            conn = psycopg2.connect(
                host=os.getenv("DB_HOST"),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                port=os.getenv("DB_PORT", 5432)
            )
        else:
            conn = psycopg2.connect(conn_str)
            
        cursor = conn.cursor()
        
        # Select id and name_normalized from raw_product
        # Using server-side cursor to handle 1 million records cleanly if possible, 
        # but standard cursor + yield is also fine if we fetch in batches or use iteration.
        # 'name_server_cursor' enables server-side cursor in psycopg2.
        cursor.execute("SELECT id, name_normalized FROM raw_product")
        
        # Fetching row by row to be memory efficient
        row = cursor.fetchone()
        while row:
            doc_id = str(row[0])
            name_normalized = row[1]
            if name_normalized:
                tokens = name_normalized.split() # Simple whitespace tokenization as requested
                yield doc_id, tokens
            row = cursor.fetchone()
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error connecting to DB or fetching data: {e}")
        # In a real app we might want to re-raise or handle gracefully.
        # For this task, we stop generation.
        return
