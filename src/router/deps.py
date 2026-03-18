import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from contextlib import contextmanager

# Logging setup
LOG_FILE = Path(__file__).resolve().parent.parent.parent / "logs" / "api.log"
LOG_FILE.parent.mkdir(exist_ok=True)
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api")

# Globals injected by app.py
bm25_ranker = None
index_reader = None
vector_ranker = None
db_pool = None

@contextmanager
def get_db_cursor():
    """Context manager for getting a database cursor from the pool."""
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database pool not initialized")
    
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        db_pool.putconn(conn)

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

def get_products(doc_ids: list, platforms: List[str] = None, min_price: float = None, max_price: float = None) -> Dict[Any, Dict]:
    if not db_pool or not doc_ids:
        return {}
    try:
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
