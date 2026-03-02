
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import time
import psycopg2

# Placeholder imports - these will be injected or initialized in app.py or here
# For now, we'll assume they are available or passed during app startup.
# Ideally, we should use dependency injection, but simple global or attached state works too.

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    alpha: float = 0.5 # For hybrid search: 1.0 = Vector only, 0.0 = BM25 only

class SearchResultItem(BaseModel):
    id: str
    score: float
    name: Optional[str] = None
    price: Optional[float] = None

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    time_taken: float

# These will be set by app.py
bm25_ranker = None
index_reader = None
vector_ranker = None
db_conn = None

def get_products(doc_ids: list) -> Dict[Any, Dict]:
    """Query DB to get product info (id, name, price) for a list of doc_ids."""
    if not db_conn or not doc_ids:
        return {}
    try:
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, price FROM raw_products WHERE id = ANY(%s)",
                (doc_ids,)
            )
            rows = cur.fetchall()
        return {str(row[0]): {"name": row[1], "price": row[2]} for row in rows}
    except Exception as e:
        print(f"[get_products] DB error: {e}")
        return {}

@router.post("/search/bm25", response_model=SearchResponse)
async def search_bm25(request: SearchRequest):
    start_time = time.time()
    
    if not bm25_ranker or not index_reader:
        raise HTTPException(status_code=503, detail="Search engine not initialized")
        
    # tokenize
    from pyvi import ViTokenizer
    query_tokens = ViTokenizer.tokenize(request.query.lower()).split()
    
    # get postings
    candidate_postings = {}
    for token in query_tokens:
        postings = index_reader.get_postings(token)
        if postings:
            candidate_postings[token] = postings
            
    # rank
    results = bm25_ranker.rank(query_tokens, candidate_postings, top_k=request.top_k)
    
    # format
    doc_ids = [doc_id for doc_id, _ in results]
    product_info = get_products(doc_ids)

    response_items = []
    for doc_id, score in results:
        info = product_info.get(str(doc_id), {})
        response_items.append(SearchResultItem(
            id=str(doc_id),
            score=score,
            name=info.get("name"),
            price=info.get("price")
        ))

    return SearchResponse(results=response_items, time_taken=time.time() - start_time)

@router.post("/search/vector", response_model=SearchResponse)
async def search_vector(request: SearchRequest):
    start_time = time.time()
    
    if not vector_ranker:
        raise HTTPException(status_code=503, detail="Vector search not initialized")
        
    results = vector_ranker.search(request.query, top_k=request.top_k)
    
    doc_ids = [res['id'] for res in results]
    product_info = get_products(doc_ids)

    response_items = []
    for res in results:
        info = product_info.get(str(res['id']), {})
        response_items.append(SearchResultItem(
            id=str(res['id']),
            score=res['score'],
            name=info.get("name"),
            price=info.get("price")
        ))

    return SearchResponse(results=response_items, time_taken=time.time() - start_time)

@router.post("/search/hybrid", response_model=SearchResponse)
async def search_hybrid(request: SearchRequest):
    start_time = time.time()
    
    if not vector_ranker or not bm25_ranker:
        raise HTTPException(status_code=503, detail="Search engines not initialized")

    # 1. Get Vector Results
    vec_results = vector_ranker.search(request.query, top_k=request.top_k * 2) # Get more candidates
    vec_scores = {res['id']: res['score'] for res in vec_results}
    
    # 2. Get BM25 Results
    from pyvi import ViTokenizer
    query_tokens = ViTokenizer.tokenize(request.query.lower()).split()
    candidate_postings = {}
    for token in query_tokens:
        postings = index_reader.get_postings(token)
        if postings:
            candidate_postings[token] = postings
            
    bm25_raw = bm25_ranker.rank(query_tokens, candidate_postings, top_k=request.top_k * 2)
    bm25_scores = {doc_id: score for doc_id, score in bm25_raw}
    
    # 3. Merge (Simple Weighted Sum or RRF)
    # Since BM25 and Vector scores are on different scales, RRF is often safer without normalization.
    # But user asked for alpha, implies weighted sum. We need normalization.
    # For now, let's implement simple Reciprocal Rank Fusion which is robust.
    # OR, we can normalize both to [0, 1] if we know min/max.
    # Let's stick to RRF for robustness if alpha is not strictly forced to be linear combination of raw scores.
    # BUT, to respect 'alpha', we usually mean: alpha * vec_score + (1-alpha) * bm25_score.
    # We need to normalize.
    
    all_ids = set(vec_scores.keys()) | set(bm25_scores.keys())
    
    # Normalize helper (min-max)
    def normalize(scores_dict):
        if not scores_dict: return {}
        min_s = min(scores_dict.values())
        max_s = max(scores_dict.values())
        if max_s == min_s: return {k: 1.0 for k in scores_dict}
        return {k: (v - min_s) / (max_s - min_s) for k, v in scores_dict.items()}

    vec_norm = normalize(vec_scores)
    bm25_norm = normalize(bm25_scores)
    
    final_scores = []
    for doc_id in all_ids:
        # Default to 0 if not in list
        v_s = vec_norm.get(doc_id, 0.0)
        b_s = bm25_norm.get(doc_id, 0.0)
        
        # Weighted sum
        final_score = request.alpha * v_s + (1 - request.alpha) * b_s
        final_scores.append((doc_id, final_score))
        
    # Sort
    final_scores.sort(key=lambda x: x[1], reverse=True)
    top_results = final_scores[:request.top_k]
    
    doc_ids = [doc_id for doc_id, _ in top_results]
    product_info = get_products(doc_ids)

    response_items = []
    for doc_id, score in top_results:
        info = product_info.get(str(doc_id), {})
        response_items.append(SearchResultItem(
            id=str(doc_id),
            score=score,
            name=info.get("name"),
            price=info.get("price")
        ))

    return SearchResponse(results=response_items, time_taken=time.time() - start_time)
