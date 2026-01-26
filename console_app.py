import json
import argparse
import time
import pickle
import os
# sys.path.append(os.path.join(os.path.dirname(__file__), 'src')) (Not needed if running from root with proper structure but kept for safety)

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
    
    # Load aggregated raw data for detailed display
    data_path = os.path.join("data", "total_products.jsonl")
    product_details = {}
    if os.path.exists(data_path):
        with open(data_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    p = json.loads(line)
                    product_details[str(p.get('external_id'))] = p
                except json.JSONDecodeError:
                    continue
    
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
                product = product_details.get(doc_id, {})
                name = product.get("name", "Unknown")
                price = product.get("price", "N/A")
                
                print(f"{rank}. [{doc_id}] {name} - Price: {price} (Score: {score:.4f})")

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
