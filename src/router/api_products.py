from fastapi import APIRouter, HTTPException
from src.router import deps

router = APIRouter()

@router.get("/products")
async def get_ui_products(limit: int = 50):
    """Fetch all products for landing page."""
    if deps.db_pool:
        try:
            with deps.get_db_cursor() as cur:
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
    data = list(deps.local_product_db.values())[:limit]
    return {"success": True, "data": data, "count": len(data)}

@router.get("/products/{product_id}")
async def get_product_detail(product_id: str):
    """Fetch full product details by ID."""
    if deps.db_pool:
        try:
            with deps.get_db_cursor() as cur:
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
            deps.logger.error(f"get_product_detail DB error: {e}", exc_info=True)

    # Fallback to local sample
    if product_id in deps.local_product_db:
        return {"success": True, "data": deps.local_product_db[product_id]}
        
    raise HTTPException(status_code=404, detail="Product not found")
