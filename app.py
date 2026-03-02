
import os
import uvicorn
import pickle
import psycopg2
from fastapi import FastAPI
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Import internal modules
from src.indexer.reader import IndexReader
from src.ranking.bm25 import BM25Ranker
from src.ranking.vector import VectorRanker
from src.router import api

load_dotenv()

# Global state
index_reader = None
bm25_ranker = None
vector_ranker = None
db_conn = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global index_reader, bm25_ranker, vector_ranker, db_conn
    
    print("Startup: Initializing Search Engines...")
    
    # 1. Initialize BM25
    try:
        index_file = "src/indexer/final_index.bin"
        lexicon_file = "src/indexer/lexicon.dat"
        metadata_file = "src/indexer/output_blocks/metadata.pkl"
        
        if os.path.exists(index_file) and os.path.exists(lexicon_file) and os.path.exists(metadata_file):
            print("Loading BM25 Indices...")
            # Load metadata
            with open(metadata_file, 'rb') as f:
                metadata = pickle.load(f)
            
            # Init components
            index_reader = IndexReader(index_file, lexicon_file)
            bm25_ranker = BM25Ranker(
                doc_lengths=metadata['doc_lengths'], 
                avgdl=metadata['avgdl'], 
                N=metadata['N']
            )
            
            # Inject into router
            api.index_reader = index_reader
            api.bm25_ranker = bm25_ranker
            print("BM25 Engine Ready.")
        else:
            print("Warning: BM25 index files not found. BM25 search will fail.")
    except Exception as e:
        print(f"Failed to load BM25: {e}")

    # 2. Initialize Vector Search
    try:
        print("Loading Vector Engine...")
        # Initialize Vector Ranker (will load model and ChromaDB)
        # Check if we should use GPU or anything speicific? Defaults are fine.
        vector_ranker = VectorRanker()
        
        # Inject into router
        api.vector_ranker = vector_ranker
        print("Vector Engine Ready.")
    except Exception as e:
        print(f"Failed to load Vector Engine: {e}")

    # 3. Initialize DB Connection
    try:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            db_conn = psycopg2.connect(database_url)
        api.db_conn = db_conn
        print("DB Connection Ready.")
    except Exception as e:
        print(f"Failed to connect to DB: {e}")

    yield

    print("Shutdown: Cleaning up...")
    if db_conn:
        db_conn.close()

app = FastAPI(title="Search Engine API", lifespan=lifespan)

# Include Router
app.include_router(api.router)

@app.get("/")
def health_check():
    return {"status": "ok", "services": {
        "bm25": bm25_ranker is not None,
        "vector": vector_ranker is not None
    }}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
