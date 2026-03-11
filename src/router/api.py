
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import time
import psycopg2
import json
import logging
import pickle
from pathlib import Path
from pyvi import ViTokenizer

# Logging setup
LOG_FILE = Path(__file__).resolve().parent.parent.parent / "logs" / "api.log"
LOG_FILE.parent.mkdir(exist_ok=True)
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api")

# Placeholder imports - these will be injected or initialized in app.py or here
# For now, we'll assume they are available or passed during app startup.
# Ideally, we should use dependency injection, but simple global or attached state works too.

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

from psycopg2 import pool
from contextlib import contextmanager

# ... (logging setup remains)

# Placeholder imports - these will be injected or initialized in app.py or here
router = APIRouter()

# These will be set by app.py
bm25_ranker = None
index_reader = None
vector_ranker = None
db_pool = None # Use a pool instead of a single connection

@contextmanager
def get_db_cursor():
    """Context manager for getting a database cursor from the pool."""
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database pool not initialized")
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit() # Commit any changes if needed
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        db_pool.putconn(conn)

# =============================================================================
# PLATFORM DETECTION & NORMALIZATION
# =============================================================================

PLATFORM_URL_PATTERNS = {
    "shopee": ["shopee.vn", "shopee.com"],
    "tiki": ["tiki.vn"],
    "lazada": ["lazada.vn", "lazada.com"],
    "sendo": ["sendo.vn"],
    "dienmayxanh": ["dienmayxanh.com"],
    "thegioididong": ["thegioididong.com"],
    "cellphones": ["cellphones.com.vn", "cellphoneS.com.vn"],
    "fptshop": ["fptshop.com.vn"],
    "nguyenkim": ["nguyenkim.com"],
    "phongvu": ["phongvu.vn"],
    "gearvn": ["gearvn.com"],
    "hasaki": ["hasaki.vn"],
    "yes24": ["yes24.vn"],
    "fahasa": ["fahasa.com"],
}

def detect_platform_from_url(url: str) -> Optional[str]:
    if not url: return None
    url_lower = url.lower()
    for platform, patterns in PLATFORM_URL_PATTERNS.items():
        for pattern in patterns:
            if pattern in url_lower:
                return platform
    return None

def normalize_product_data(item: Dict[str, Any]) -> Dict[str, Any]:
    platform = item.get("platform") or item.get("source") or item.get("shop_name")
    if not platform or platform.lower() in ["unknown", "null", "none", ""]:
        url = item.get("url") or item.get("external_url") or item.get("product_url") or item.get("link")
        detected = detect_platform_from_url(url)
        if detected: platform = detected
    
    if platform:
        platform = str(platform).strip().lower()
        platform_map = {
            "dien may xanh": "dienmayxanh",
            "điện máy xanh": "dienmayxanh",
            "the gioi di dong": "thegioididong",
            "thế giới di động": "thegioididong",
            "cell phones": "cellphones",
        }
        platform = platform_map.get(platform, platform)
    else:
        platform = "unknown"
    
    item["platform"] = platform
    return item

# =============================================================================
# LOCAL JSONL DATABASE (Fallback/Sample)
# =============================================================================

local_product_db = {}

def load_local_db():
    global local_product_db
    project_root = Path(__file__).resolve().parent.parent.parent
    db_path = project_root / "data_sample" / "sample.jsonl"
    
    if db_path.exists():
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        item = json.loads(line)
                        item = normalize_product_data(item)
                        local_product_db[str(item['id'])] = item
            print(f"[api] Loaded {len(local_product_db)} products from local Sample DB.")
        except Exception as e:
            print(f"[api] Failed to load local DB: {e}")

load_local_db()

def get_products(doc_ids: list, platforms: List[str] = None, min_price: float = None, max_price: float = None) -> Dict[Any, Dict]:
    """Query DB to get product info for a list of doc_ids, with optional filtering."""
    if not db_pool or not doc_ids:
        return {}
    try:
        # Ensure doc_ids are integers
        clean_ids = []
        for did in doc_ids:
            try: clean_ids.append(int(did))
            except: pass
            
        if not clean_ids: return {}

        query = """SELECT p.id, p.name, p.price, s.name as platform, 
                          p.image_url, p.external_url, p.images, 
                          p.rating, p.review_count, p.sold_count,
                          p.original_price, p.discount_percent,
                          p.description, p.available
                   FROM raw_products p 
                   LEFT JOIN sources s ON p.source_id = s.id 
                   WHERE p.id = ANY(%s)"""
        params = [clean_ids]
        
        if platforms:
            normalized_platforms = []
            for p in platforms:
                p_lower = p.lower()
                if p_lower == "dienmayxanh": normalized_platforms.append("điện máy xanh")
                elif p_lower == "thegioididong": normalized_platforms.append("thế giới di động")
                normalized_platforms.append(p_lower)
            
            query += " AND (LOWER(s.name) = ANY(%s) OR s.name = ANY(%s))"
            params.append(normalized_platforms)
            params.append(normalized_platforms)
        
        if min_price is not None:
            query += " AND p.price >= %s"
            params.append(float(min_price))
        if max_price is not None:
            query += " AND p.price <= %s"
            params.append(float(max_price))
            
        logger.info(f"Executing Query: {query} with params count {len(params)}")
        try:
            with get_db_cursor() as cur:
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
        except Exception as e:
            logger.error(f"Error in get_products DB Query: {e}", exc_info=True)
            return {}
        result = {}
        for row in rows:
            result[str(row[0])] = {
                "id": str(row[0]),
                "name": row[1], 
                "price": row[2], 
                "platform": row[3],
                "image_url": row[4],
                "external_url": row[5],
                "images": row[6] or [],
                "rating": row[7],
                "review_count": row[8] or 0,
                "sold_count": row[9] or 0,
                "original_price": row[10],
                "discount_percent": row[11],
                "description": row[12],
                "available": row[13] if row[13] is not None else True
            }
        return result
    except Exception as e:
        logger.error(f"get_products DB error: {e}", exc_info=True)
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
    product_info = get_products(
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
    
    if not vector_ranker:
        raise HTTPException(status_code=503, detail="Vector search not initialized")
        
    results = vector_ranker.search(request.query, top_k=request.top_k)
    
    doc_ids = [res['id'] for res in results]
    product_info = get_products(
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
    product_info = get_products(
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

# =============================================================================
# UI COMPATIBILITY ENDPOINTS (GET)
# =============================================================================

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
    """Unified search endpoint for UI."""
    start_time = time.time()
    
    try:
        # Parse platforms if provided as comma-separated string
        platform_list = [p.strip() for p in platforms.split(",")] if platforms else None
        
        # INCREASE top_k for search methods to allow for filtering downstream
        # If we have filters, we need a larger candidate pool
        effective_limit = limit * 20 if (platforms or min_price or max_price) else limit
        if effective_limit > 1000: effective_limit = 1000 # Cap to 1000 for performance

        # 1. Fetch search results from specific method
        data = []
        logger.info(f"ui_search: method={method}, query='{query}', vr={vector_ranker is not None}, bm25={bm25_ranker is not None}")
        
        if method == "bm25" and bm25_ranker:
            req = SearchRequest(query=query, top_k=effective_limit, platforms=platform_list, min_price=min_price, max_price=max_price)
            res = await search_bm25(req)
            data = res.results
        elif method == "vector" and vector_ranker:
            req = SearchRequest(query=query, top_k=effective_limit, platforms=platform_list, min_price=min_price, max_price=max_price)
            res = await search_vector(req)
            data = res.results
        elif method == "hybrid" and vector_ranker and bm25_ranker:
            req = SearchRequest(query=query, top_k=effective_limit, alpha=alpha, platforms=platform_list, min_price=min_price, max_price=max_price)
            res = await search_hybrid(req)
            data = res.results
        else:
            logger.warning(f"Falling back to smart_search_fallback. VR: {vector_ranker is not None}, BM25: {bm25_ranker is not None}")
            return smart_search_fallback(query, limit, platforms=platform_list, min_price=min_price, max_price=max_price)
            
        # Truncate to desired limit AFTER filtering
        data = data[:limit]
            
        # 2. Enrich results with full product details for UI
        # search_bm25 etc. return SearchResultItem which has id, score, name, price.
        # The UI might want image_url, external_url, etc.
        
        doc_ids = [item.id for item in data]
        
        # Fetch full product data from CockroachDB
        db_product_info = get_products(doc_ids)
        
        # Try to get more info from DB results first, then fallback to local DB
        full_data = []
        for item in data:
            product = {}
            
            # First try CockroachDB product info (has image_url, platform, etc.)
            db_product = db_product_info.get(str(item.id))
            if db_product:
                product = dict(db_product)
            # Fallback: If in local DB, use it
            elif str(item.id) in local_product_db:
                product = dict(local_product_db[str(item.id)])
            
            # Merge with search result (score, ensure id)
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
        logger.error(f"ui_search error: {e}", exc_info=True)
        platform_list = [p.strip() for p in platforms.split(",")] if platforms else None
        return smart_search_fallback(query, limit, platforms=platform_list, min_price=min_price, max_price=max_price)

def smart_search_fallback(query: str, limit: int = 50, platforms: List[str] = None, min_price: float = None, max_price: float = None):
    query_lower = query.lower()
    results = []
    for item in local_product_db.values():
        # Match query
        if query_lower not in (item.get("name") or "").lower():
            continue
            
        # Match platform
        if platforms and item.get("platform") not in platforms:
            continue
            
        # Match price
        try:
            raw_price = item.get("price")
            if raw_price is not None:
                # Handle string prices like "1.000.000" or "$1,000"
                if isinstance(raw_price, str):
                    clean_price = "".join(filter(str.isdigit, raw_price))
                    price = float(clean_price) if clean_price else 0.0
                else:
                    price = float(raw_price)
                    
                if min_price is not None and price < float(min_price): continue
                if max_price is not None and price > float(max_price): continue
        except Exception as e:
            logger.warning(f"Fallback price filter error for item {item.get('id')}: {e}")
            
        results.append(item)
        if len(results) >= limit: break
            
    return {
        "success": True,
        "data": results,
        "count": len(results),
        "query": query,
        "fallback": True
    }

@router.get("/products")
async def get_ui_products(limit: int = 50):
    """Fetch all products for landing page."""
    if db_pool:
        try:
            with get_db_cursor() as cur:
                # Query with join to get platform names
                cur.execute("""
                    SELECT p.id, p.name, p.price, p.external_url, p.image_url, s.name as platform 
                    FROM raw_products p
                    LEFT JOIN sources s ON p.source_id = s.id
                    ORDER BY p.id DESC
                    LIMIT %s
                """, (limit,))
                rows = cur.fetchall()
                data = []
                for r in rows:
                    data.append({
                        "id": str(r[0]), "name": r[1], "price": r[2], 
                        "external_url": r[3], "image_url": r[4], "platform": r[5]
                    })
                return {"success": True, "data": data, "count": len(data)}
        except Exception as e:
            print(f"[get_ui_products] DB error: {e}")

    # Fallback to local sample
    data = list(local_product_db.values())[:limit]
    return {"success": True, "data": data, "count": len(data)}

@router.get("/products/{product_id}")
async def get_product_detail(product_id: str):
    """Fetch full product details by ID."""
    if db_pool:
        try:
            with get_db_cursor() as cur:
                cur.execute("""
                    SELECT p.id, p.name, p.price, p.external_url, p.image_url, 
                           s.name as platform, p.description, p.specs, p.images,
                           p.rating, p.review_count, p.sold_count, p.available,
                           p.original_price, p.discount_percent
                    FROM raw_products p
                    LEFT JOIN sources s ON p.source_id = s.id
                    WHERE p.id = %s
                """, (product_id,))
                r = cur.fetchone()
                if r:
                    return {
                        "success": True,
                        "data": {
                            "id": str(r[0]), "name": r[1], "price": r[2], 
                            "external_url": r[3], "image_url": r[4], 
                            "platform": r[5], "description": r[6],
                            "specs": r[7], "images": r[8],
                            "rating": r[9], "review_count": r[10],
                            "sold_count": r[11], "available": r[12],
                            "original_price": r[13], "discount_percent": r[14]
                        }
                    }
        except Exception as e:
            logger.error(f"get_product_detail DB error: {e}", exc_info=True)

    # Fallback to local sample
    if product_id in local_product_db:
        return {"success": True, "data": local_product_db[product_id]}
        
    raise HTTPException(status_code=404, detail="Product not found")

@router.get("/stats")
async def get_ui_stats():
    """Get statistics for dashboard from the real database."""
    if db_pool:
        try:
            with get_db_cursor() as cur:
                # 1. Total products
                cur.execute("SELECT COUNT(*) FROM raw_products")
                total_products = cur.fetchone()[0]
                
                # 2. Platform distribution (joining with sources)
                cur.execute("""
                    SELECT s.name, COUNT(p.id) 
                    FROM sources s
                    LEFT JOIN raw_products p ON s.id = p.source_id
                    GROUP BY s.name
                    ORDER BY COUNT(p.id) DESC
                """)
                platform_rows = cur.fetchall()
                platform_distribution = [{"name": r[0], "count": r[1]} for r in platform_rows]
                
                # 3. Total brands
                cur.execute("SELECT COUNT(*) FROM brands")
                total_brands = cur.fetchone()[0]
                
                # 4. Total platforms (active)
                total_platforms = len([p for p in platform_distribution if p['count'] > 0])
                
                return {
                    "total_products": total_products,
                    "total_platforms": total_platforms or len(platform_distribution),
                    "total_brands": total_brands,
                    "platform_distribution": platform_distribution,
                    "source_table": "CockroachDB",
                    "success": True
                }
        except Exception as e:
            print(f"[get_ui_stats] DB error, falling back to local: {e}")

    # Fallback to local sample JSONL if DB fails
    platforms = {}
    for item in local_product_db.values():
        plat = item.get("platform", "unknown")
        platforms[plat] = platforms.get(plat, 0) + 1
        
    platform_distribution = [{"name": k, "count": v} for k, v in platforms.items()]
    platform_distribution.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "total_products": len(local_product_db),
        "total_platforms": len(platforms),
        "total_brands": 0,
        "platform_distribution": platform_distribution,
        "message": "Stats from Local Sample DB (Fallback)",
        "source_table": "sample.jsonl"
    }

@router.get("/tables")
async def list_ui_tables():
    return {
        "available_tables": [{"table": "local_jsonl", "has_data": len(local_product_db) > 0}],
        "unavailable_tables": []
    }
