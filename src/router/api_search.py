import time
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Tuple, Dict, Any
from pyvi import ViTokenizer

from src.router import deps

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    alpha: float = 0.5 
    platforms: Optional[List[str]] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

class SearchResultItem(BaseModel):
    id: str
    score: float
    name: Optional[str] = None
    price: Optional[float] = None

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    time_taken: float

def smart_search_fallback(query: str, limit: int = 50, platforms: List[str] = None, min_price: float = None, max_price: float = None):
    query_lower = query.lower()
    results = []
    for item in deps.local_product_db.values():
        if query_lower not in (item.get("name") or "").lower():
            continue
        if platforms and item.get("platform") not in platforms:
            continue
        try:
            raw_price = item.get("price")
            if raw_price is not None:
                if isinstance(raw_price, str):
                    clean_price = "".join(filter(str.isdigit, raw_price))
                    price = float(clean_price) if clean_price else 0.0
                else:
                    price = float(raw_price)
                if min_price is not None and price < float(min_price): continue
                if max_price is not None and price > float(max_price): continue
        except Exception as e:
            deps.logger.warning(f"Fallback price filter error for item {item.get('id')}: {e}")
            
        results.append(item)
        if len(results) >= limit: break
            
    return {
        "success": True,
        "data": results,
        "count": len(results),
        "query": query,
        "fallback": True
    }

@router.post("/search/bm25", response_model=SearchResponse)
async def search_bm25(request: SearchRequest):
    start_time = time.time()
    
    if not deps.bm25_ranker or not deps.index_reader:
        raise HTTPException(status_code=503, detail="Search engine not initialized")
        
    query_tokens = ViTokenizer.tokenize(request.query.lower()).split()
    
    candidate_postings = {}
    for token in query_tokens:
        postings = deps.index_reader.get_postings(token)
        if postings:
            candidate_postings[token] = postings
            
    results = deps.bm25_ranker.rank(query_tokens, candidate_postings, top_k=request.top_k)
    
    doc_ids = [doc_id for doc_id, _ in results]
    product_info = deps.get_products(
        doc_ids, 
        platforms=request.platforms, 
        min_price=request.min_price, 
        max_price=request.max_price
    )

    response_items = []
    for doc_id, score in results:
        info = product_info.get(str(doc_id))
        if info:
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
    
    if not deps.vector_ranker:
        raise HTTPException(status_code=503, detail="Vector search not initialized")
        
    results = deps.vector_ranker.search(request.query, top_k=request.top_k)
    
    doc_ids = [res['id'] for res in results]
    product_info = deps.get_products(
        doc_ids, 
        platforms=request.platforms, 
        min_price=request.min_price, 
        max_price=request.max_price
    )

    response_items = []
    for res in results:
        info = product_info.get(str(res['id']))
        if info:
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
    
    if not deps.vector_ranker or not deps.bm25_ranker:
        raise HTTPException(status_code=503, detail="Search engines not initialized")

    vec_results = deps.vector_ranker.search(request.query, top_k=request.top_k * 2) 
    vec_scores = {res['id']: res['score'] for res in vec_results}
    
    query_tokens = ViTokenizer.tokenize(request.query.lower()).split()
    candidate_postings = {}
    for token in query_tokens:
        postings = deps.index_reader.get_postings(token)
        if postings:
            candidate_postings[token] = postings
            
    bm25_raw = deps.bm25_ranker.rank(query_tokens, candidate_postings, top_k=request.top_k * 2)
    bm25_scores = {doc_id: score for doc_id, score in bm25_raw}
    
    all_ids = set(vec_scores.keys()) | set(bm25_scores.keys())
    
    def normalize(scores_dict):
        if not scores_dict: return {}
        min_s = min(scores_dict.values())
        max_s = max(scores_dict.values())
        if max_s == min_s: return {k: 1.0 for k in scores_dict}
        return {k: (v - min_s) / (max_s - min_s) for k, v in scores_dict.items()}

    vec_norm = normalize(vec_scores)
    bm25_norm = normalize(bm25_scores)
    
    final_scores: List[Tuple[str, float]] = []
    for doc_id in all_ids:
        v_s = vec_norm.get(doc_id, 0.0)
        b_s = bm25_norm.get(doc_id, 0.0)
        final_score = request.alpha * v_s + (1 - request.alpha) * b_s
        final_scores.append((doc_id, final_score))
        
    final_scores.sort(key=lambda x: x[1], reverse=True)
    top_results = list(final_scores)[:int(request.top_k)]
    
    doc_ids = [doc_id for doc_id, _ in top_results]
    product_info = deps.get_products(
        doc_ids, 
        platforms=request.platforms, 
        min_price=request.min_price, 
        max_price=request.max_price
    )

    response_items = []
    for doc_id, score in top_results:
        info = product_info.get(str(doc_id))
        if info:
            response_items.append(SearchResultItem(
                id=str(doc_id),
                score=score,
                name=info.get("name"),
                price=info.get("price")
            ))

    return SearchResponse(results=response_items, time_taken=time.time() - start_time)

@router.get("/search")
async def ui_search(
    query: str = Query(..., min_length=1),
    limit: int = 50,
    method: str = "hybrid",
    alpha: float = 0.5,
    platforms: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None
):
    start_time = time.time()
    try:
        platform_list = [p.strip() for p in platforms.split(",")] if platforms else None
        effective_limit = limit * 20 if (platforms or min_price or max_price) else limit
        if effective_limit > 1000: effective_limit = 1000 

        data = []
        deps.logger.info(f"ui_search: method={method}, query='{query}', vr={deps.vector_ranker is not None}, bm25={deps.bm25_ranker is not None}")
        
        req = SearchRequest(query=query, top_k=effective_limit, platforms=platform_list, min_price=min_price, max_price=max_price)
        if method == "bm25" and deps.bm25_ranker:
            res = await search_bm25(req)
            data = res.results
        elif method == "vector" and deps.vector_ranker:
            res = await search_vector(req)
            data = res.results
        elif method == "hybrid" and deps.vector_ranker and deps.bm25_ranker:
            req.alpha = alpha
            res = await search_hybrid(req)
            data = res.results
        else:
            deps.logger.warning(f"Falling back to smart_search_fallback. VR: {deps.vector_ranker is not None}, BM25: {deps.bm25_ranker is not None}")
            return smart_search_fallback(query, limit, platforms=platform_list, min_price=min_price, max_price=max_price)
            
        data = data[:limit]
        doc_ids = [item.id for item in data]
        db_product_info = deps.get_products(doc_ids)
        
        full_data = []
        for item in data:
            product: Dict[str, Any] = {}
            db_product = db_product_info.get(str(item.id))
            if db_product:
                product = dict(db_product)
            elif str(item.id) in deps.local_product_db:
                product = dict(deps.local_product_db[str(item.id)])
            
            product["id"] = item.id
            product["score"] = item.score
            if item.name: product["name"] = item.name
            if item.price: product["price"] = item.price
            full_data.append(product)

        return {
            "success": True,
            "data": full_data,
            "count": len(full_data),
            "query": query,
            "time_taken": time.time() - start_time
        }
    except Exception as e:
        deps.logger.error(f"ui_search error: {e}", exc_info=True)
        platform_list = [p.strip() for p in platforms.split(",")] if platforms else None
        return smart_search_fallback(query, limit, platforms=platform_list, min_price=min_price, max_price=max_price)
