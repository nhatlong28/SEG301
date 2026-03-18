from fastapi import APIRouter

from .api_search import router as search_router
from .api_products import router as products_router
from .api_stats import router as stats_router

api_router = APIRouter()

api_router.include_router(search_router, tags=["search"])
api_router.include_router(products_router, tags=["products"])
api_router.include_router(stats_router, tags=["stats"])
