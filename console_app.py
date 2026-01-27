import argparse
import time
import pickle
import os
import psycopg2
from pyvi import ViTokenizer
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from src.crawler.parser import get_product_generator
from src.indexer.spimi import SPIMIIndexer
from src.indexer.merging import merge_blocks
from src.indexer.reader import IndexReader
from src.ranking.bm25 import BM25Ranker

def build_index():
    print("Starting Indexing Process...")
    start_time = time.time()
    
    # 1. Generator
    # Reading from Database via parser (DATABASE_URL in .env)
    product_gen = get_product_generator()
    if not product_gen:
        print("Failed to initialize data generator.")
        return

    # 2. SPIMI Indexing
    # Outputting blocks to 'src/indexer/output_blocks'
    indexer = SPIMIIndexer(block_size_limit_mb=100, output_dir="src/indexer/output_blocks")
    indexer.run_indexing(product_gen)
    
    # 3. Merging
    print("Merging blocks...")
    merge_blocks(block_dir="src/indexer/output_blocks", output_file="src/indexer/final_index.bin", lexicon_file="src/indexer/lexicon.dat")
    
    print(f"Indexing completed in {time.time() - start_time:.2f} seconds.")

def search_loop():
    print("Loading Search Engine...")
    
    # Load Metadata
    meta_path = os.path.join("src/indexer/output_blocks", "metadata.pkl")
    if not os.path.exists(meta_path):
        print("Metadata not found. Please run indexing first.")
        return
        
    with open(meta_path, 'rb') as f:
        metadata = pickle.load(f)
        
    N = metadata['N']
    avgdl = metadata['avgdl']
    doc_lengths = metadata['doc_lengths']

    # Initialize Reader and Ranker
    reader = IndexReader(index_file="src/indexer/final_index.bin", lexicon_file="src/indexer/lexicon.dat")
    ranker = BM25Ranker(doc_lengths=doc_lengths, avgdl=avgdl, N=N)
    
    # DB connection for details
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found. Result details might be limited.")

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
        #query_tokens = query.lower().split()
        query_tokens = ViTokenizer.tokenize(query.lower()).split()
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
        
        # search_time = time.time() - start_search
        # print(f"Found {len(top_results)} results in {search_time:.4f}s")
        
        # 4. Fetch Details from DB & Display
        if not top_results:
             print("No relevant results after ranking.")
        else:
            print("\nTop 10 Results:")
            
            # Fetch details in one go for efficiency
            doc_ids = [res[0] for res in top_results]
            details_map = {}
            
            if db_url:
                try:
                    conn = psycopg2.connect(db_url)
                    with conn.cursor() as cur:
                        # Use ANY(%s) to fetch all docs at once
                        cur.execute("SELECT id, name, price FROM raw_products WHERE id = ANY(%s)", (doc_ids,))
                        for row in cur.fetchall():
                            details_map[str(row[0])] = {"name": row[1], "price": row[2]}
                    conn.close()
                except Exception as e:
                    print(f"Error fetching details: {e}")

            for rank, (doc_id, score) in enumerate(top_results, 1):
                product = details_map.get(str(doc_id), {})
                name = product.get("name", "Unknown (DB lookup failed)")
                price = product.get("price", "N/A")
                
                print(f"{rank}. [ID: {doc_id}] {name} - Price: {price} (Score: {score:.4f})")
        search_time = time.time() - start_search
        print(f"Found {len(top_results)} results in {search_time:.4f}s")

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
        if os.path.exists("src/indexer/final_index.bin"):
             search_loop()
        else:
             print("Index not found. Run with --index to build.")
             build_index() # Or just run it.

if __name__ == "__main__":
    main()
