"""
Backend API Server for E-Commerce Price Spider
Smart Search with automatic table/column detection
"""

import os
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# =============================================================================
# ROBUST ENV LOADING
# =============================================================================

def load_env_robust() -> None:
    """
    Load .env file from current directory OR parent directories.
    Searches up to 5 levels up to find the .env file.
    """
    current_dir = Path(__file__).resolve().parent
    
    # Search current and up to 5 parent directories
    for _ in range(6):
        env_path = current_dir / ".env"
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"✅ Loaded .env from: {env_path}")
            return
        current_dir = current_dir.parent
    
    # Fallback: try loading from CWD
    load_dotenv()
    logger.warning("⚠️ No .env file found in parent directories, using environment variables")


# Load environment variables
load_env_robust()

# Get Supabase credentials (support SUPABASE_SERVICE_ROLE_KEY alias)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables!")
    raise ValueError("Missing required Supabase environment variables")

logger.info(f"✅ Supabase URL: {SUPABASE_URL[:30]}...")
logger.info(f"✅ Supabase Key loaded (length: {len(SUPABASE_KEY)})")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger.info("✅ Supabase client initialized successfully")

# =============================================================================
# FASTAPI APP SETUP
# =============================================================================

app = FastAPI(
    title="E-Commerce Price Spider API",
    description="Smart Search API with automatic table detection",
    version="1.0.0"
)

# CORS - Allow ALL origins to fix connection issues with Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# PLATFORM DETECTION FROM URL
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
    """
    Detect platform name from product URL.
    Returns None if no match found.
    """
    if not url:
        return None
    
    url_lower = url.lower()
    for platform, patterns in PLATFORM_URL_PATTERNS.items():
        for pattern in patterns:
            if pattern in url_lower:
                return platform
    return None


def normalize_product_data(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize product data by detecting platform from URL if missing.
    Also ensures consistent field names.
    """
    # Get platform from various possible fields
    platform = item.get("platform") or item.get("source") or item.get("shop_name")
    
    # If platform is still missing or 'unknown', try to detect from URL
    if not platform or platform.lower() in ["unknown", "null", "none", ""]:
        url = item.get("url") or item.get("external_url") or item.get("product_url") or item.get("link")
        detected = detect_platform_from_url(url)
        if detected:
            platform = detected
            logger.debug(f"   🔍 Detected platform '{platform}' from URL")
    
    # Normalize platform name (lowercase, strip spaces)
    if platform:
        platform = str(platform).strip().lower()
        # Fix common variations
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
    
    # Update the item with normalized platform
    item["platform"] = platform
    return item


# =============================================================================
# SMART SEARCH FUNCTION (Critical)
# =============================================================================

# Tables and columns to search through
SEARCH_TABLES = ["raw_products", "crawled_data", "products", "items"]
SEARCH_COLUMNS = ["name", "title", "product_name"]


def smart_search(query: str, limit: int = 50) -> Dict[str, Any]:
    """
    Smart search that automatically detects the correct table and column.
    
    - Loops through predefined table names
    - Loops through predefined column names
    - Returns data immediately when found
    - Logs every attempt for debugging
    
    Args:
        query: The search query string
        limit: Maximum number of results to return
        
    Returns:
        Dict containing: table, column, data, and count
    """
    logger.info(f"🔍 Starting smart search for query: '{query}'")
    
    for table_name in SEARCH_TABLES:
        for column_name in SEARCH_COLUMNS:
            try:
                logger.info(f"   → Trying table '{table_name}' with column '{column_name}'...")
                
                # Attempt to search with ilike (case-insensitive partial match)
                response = supabase.table(table_name).select("*").ilike(
                    column_name, f"%{query}%"
                ).limit(limit).execute()
                
                data = response.data
                
                if data and len(data) > 0:
                    # Normalize all products to fix platform names
                    normalized_data = [normalize_product_data(item) for item in data]
                    logger.info(f"   ✅ FOUND {len(normalized_data)} results in '{table_name}.{column_name}'!")
                    return {
                        "success": True,
                        "table": table_name,
                        "column": column_name,
                        "data": normalized_data,
                        "count": len(normalized_data),
                        "query": query
                    }
                else:
                    logger.info(f"   ❌ No results in '{table_name}.{column_name}'")
                    
            except Exception as e:
                error_msg = str(e)
                # Check if error is due to missing table/column (expected)
                if "does not exist" in error_msg.lower() or "column" in error_msg.lower():
                    logger.debug(f"   ⚠️ Table/column not found: {table_name}.{column_name}")
                else:
                    logger.warning(f"   ⚠️ Error querying {table_name}.{column_name}: {error_msg}")
                continue
    
    # No results found in any table/column combination
    logger.warning(f"❌ No results found for query '{query}' in any table")
    return {
        "success": False,
        "table": None,
        "column": None,
        "data": [],
        "count": 0,
        "query": query,
        "message": "No results found in any available table"
    }


def get_all_products(limit: int = 100) -> Dict[str, Any]:
    """
    Get all products from the first available table.
    Useful for initial load or browsing.
    """
    logger.info(f"📦 Fetching all products (limit: {limit})")
    
    for table_name in SEARCH_TABLES:
        try:
            logger.info(f"   → Trying table '{table_name}'...")
            
            response = supabase.table(table_name).select("*").limit(limit).execute()
            data = response.data
            
            if data and len(data) > 0:
                logger.info(f"   ✅ FOUND {len(data)} products in '{table_name}'!")
                return {
                    "success": True,
                    "table": table_name,
                    "data": data,
                    "count": len(data)
                }
                
        except Exception as e:
            logger.debug(f"   ⚠️ Table '{table_name}' not accessible: {e}")
            continue
    
    logger.warning("❌ No products found in any table")
    return {
        "success": False,
        "table": None,
        "data": [],
        "count": 0,
        "message": "No products found in any available table"
    }


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "E-Commerce Price Spider API is running",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "supabase_connected": True,
        "search_tables": SEARCH_TABLES,
        "search_columns": SEARCH_COLUMNS
    }


@app.get("/api/search")
async def search_products(
    query: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results")
):
    """
    Smart search endpoint that automatically finds the correct table.
    
    - Searches through multiple tables and columns
    - Returns results from the first matching table
    - Logs all attempts for debugging
    """
    try:
        result = smart_search(query, limit)
        return result
    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/products")
async def get_products(
    limit: int = Query(100, ge=1, le=500, description="Maximum results")
):
    """
    Get all products from the first available table.
    Useful for initial page load.
    """
    try:
        result = get_all_products(limit)
        return result
    except Exception as e:
        logger.error(f"❌ Error fetching products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tables")
async def list_available_tables():
    """
    Check which tables are available in the database.
    Useful for debugging.
    """
    available = []
    unavailable = []
    
    for table_name in SEARCH_TABLES:
        try:
            response = supabase.table(table_name).select("*").limit(1).execute()
            available.append({
                "table": table_name,
                "has_data": len(response.data) > 0
            })
        except Exception as e:
            unavailable.append({
                "table": table_name,
                "error": str(e)[:100]
            })
    
    return {
        "available_tables": available,
        "unavailable_tables": unavailable,
        "search_columns": SEARCH_COLUMNS
    }


@app.get("/api/stats")
async def get_stats():
    """
    Lấy thống kê dashboard bằng RPC (Xử lý phía Server).
    Tối ưu cho dữ liệu lớn (>200k sản phẩm).
    """
    logger.info("📊 Đang gọi RPC get_dashboard_stats...")
    try:
        # Gọi RPC: Database sẽ đếm và trả về kết quả cuối cùng trong tích tắc
        response = supabase.rpc("get_dashboard_stats").execute()
        
        if response.data:
            logger.info("✅ Lấy thống kê thành công!")
            return response.data
            
        raise Exception("RPC returned no data")
        
    except Exception as e:
        logger.error(f"❌ Lỗi khi lấy thống kê: {e}")
        # Fallback: Chỉ đếm tổng nếu RPC thất bại
        count_resp = supabase.table("raw_products").select("*", count="exact").limit(0).execute()
        return {
            "total_products": count_resp.count or 0,
            "total_platforms": 0,
            "total_brands": 0,
            "platform_distribution": [],
            "message": "Vui lòng kiểm tra lại hàm RPC trên Supabase"
        }


# =============================================================================
# RUN SERVER (for direct execution)
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.ui.backend.main:app", host="0.0.0.0", port=8000, reload=True)