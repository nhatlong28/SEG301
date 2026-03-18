from fastapi import APIRouter
from src.router import deps

router = APIRouter()

@router.get("/stats")
async def get_ui_stats():
    """Get statistics for dashboard from the real database."""
    if deps.db_pool:
        try:
            with deps.get_db_cursor() as cur:
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
    for item in deps.local_product_db.values():
        plat = item.get("platform", "unknown")
        platforms[plat] = platforms.get(plat, 0) + 1
        
    platform_distribution = [{"name": k, "count": v} for k, v in platforms.items()]
    platform_distribution.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "total_products": len(deps.local_product_db),
        "total_platforms": len(platforms),
        "total_brands": 0,
        "platform_distribution": platform_distribution,
        "message": "Stats from Local Sample DB (Fallback)",
        "source_table": "sample.jsonl"
    }

@router.get("/tables")
async def list_ui_tables():
    return {
        "available_tables": [{"table": "local_jsonl", "has_data": len(deps.local_product_db) > 0}],
        "unavailable_tables": []
    }
