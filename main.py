import os
import sys
import pickle
import argparse
import time
from dotenv import load_dotenv
import psycopg2

# Add src to path if needed, assuming running from root
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.crawler.parser import get_product_generator
from src.indexer.spimi import SPIMIIndexer
from src.indexer.merging import merge_blocks
from src.indexer.reader import IndexReader
from src.ranking.bm25 import BM25Ranker

load_dotenv()

def build_index():
    print("Starting Indexing Process...")
    start_time = time.time()
    
    # 1. Generator
    product_gen = get_product_generator("from_supabase")
    if not product_gen:
        print("Failed to initialize data generator.")
        return

    # 2. SPIMI Indexing
    # Outputting blocks to 'output_blocks'
    indexer = SPIMIIndexer(block_size_limit_mb=100, output_dir="output_blocks")
    indexer.run_indexing(product_gen)
    
    # 3. Merging
    print("Merging blocks...")
    merge_blocks(block_dir="output_blocks", output_file="final_index.bin", lexicon_file="lexicon.dat")
    
    print(f"Indexing completed in {time.time() - start_time:.2f} seconds.")

def search_loop():
    print("Loading Search Engine...")
    
    # Load Metadata
    meta_path = os.path.join("output_blocks", "metadata.pkl")
    if not os.path.exists(meta_path):
        print("Metadata not found. Please run indexing first.")
        return
        
    with open(meta_path, 'rb') as f:
        metadata = pickle.load(f)
        
    N = metadata['N']
    avgdl = metadata['avgdl']
    doc_lengths = metadata['doc_lengths']
    
    # Initialize Reader and Ranker
    reader = IndexReader(index_file="final_index.bin", lexicon_file="lexicon.dat")
    ranker = BM25Ranker(doc_lengths=doc_lengths, avgdl=avgdl, N=N)
    
    # Connect to DB for fetching details (Step 5)
    # Re-using connection logic or just new connection
    conn_str = os.getenv("DATABASE_URL")
    conn = None
    try:
        # Fallback handling
        if conn_str:
            conn = psycopg2.connect(conn_str)
        else:
             conn = psycopg2.connect(
                host=os.getenv("DB_HOST"),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                port=os.getenv("DB_PORT", 5432)
            )
    except Exception as e:
        print(f"Warning: Could not connect to DB for detailed display. {e}")
    
    print("Search Engine Ready!")
    
    while True:
        query = input("\nEnter query (or 'exit'): ").strip()
        if query.lower() == 'exit':
            break
        if not query:
            continue
            
        start_search = time.time()
        
        # 1. Preprocessing
        # Simple whitespace tokenize + lowercase to match parser logic
        query_tokens = query.lower().split()
        
        # 2. Get Postings
        candidate_postings = {}
        for token in query_tokens:
            postings = reader.get_postings(token)
            if postings:
                candidate_postings[token] = postings
        
        if not candidate_postings:
            print("No results found.")
            continue
            
        # 3. Ranking
        # returns list of (doc_id, score)
        top_results = ranker.rank(query_tokens, candidate_postings, top_k=10)
        
        search_time = time.time() - start_search
        print(f"Found {len(top_results)} results in {search_time:.4f}s")
        
        # 4. Fetch Details & Display
        if not top_results:
             print("No relevant results after ranking.")
        else:
            print("\nTop 10 Results:")
            for rank, (doc_id, score) in enumerate(top_results, 1):
                # Fetch detailed info from DB
                name = "Unknown"
                if conn:
                    try:
                        cur = conn.cursor()
                        cur.execute("SELECT name, price FROM raw_product WHERE id = %s", (doc_id,)) # Assuming id matches
                        res = cur.fetchone()
                        if res:
                            name = res[0]
                            # Price or other info if available
                    except Exception as e:
                        print(f"Error fetching details: {e}")
                
                print(f"{rank}. [{doc_id}] {name} (Score: {score:.4f})")
                
    if conn:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="Search Engine")
    parser.add_argument('--index', action='store_true', help='Run Indexing Pipeline')
    parser.add_argument('--search', action='store_true', help='Run Search Console')
    
    args = parser.parse_args()
    
    if args.index:
        build_index()
    elif args.search:
        search_loop()
    else:
        # Default behavior if no args? Maybe show help or run search if index exists?
        # User prompt asked for "Hàm main sẽ có pipeline như này..." showing indexing.
        # But also asked for search flow.
        # I'll default to search if index exists, else print help.
        if os.path.exists("final_index.bin"):
             search_loop()
        else:
             print("Index not found. Run with --index to build.")
             build_index() # Or just run it.

if __name__ == "__main__":
    main()
