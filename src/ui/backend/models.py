"""
Pydantic models for the Search Engine API.
Based on the database schema from src/types/database.ts
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class SearchMethod(str, Enum):
    """Search method options"""
    BM25 = "bm25"
    VECTOR = "vector"
    HYBRID = "hybrid"


class Platform(str, Enum):
    """E-commerce platform sources"""
    SHOPEE = "shopee"
    TIKI = "tiki"
    LAZADA = "lazada"
    CELLPHONES = "cellphones"
    DIENMAYXANH = "dienmayxanh"
    THEGIOIDIDONG = "thegioididong"


# ============ Request Models ============

class SearchRequest(BaseModel):
    """Search request parameters"""
    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    method: SearchMethod = Field(default=SearchMethod.HYBRID, description="Search method")
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Results per page")
    platforms: Optional[List[Platform]] = Field(default=None, description="Filter by platforms")
    min_price: Optional[float] = Field(default=None, ge=0, description="Minimum price filter")
    max_price: Optional[float] = Field(default=None, ge=0, description="Maximum price filter")
    brand: Optional[str] = Field(default=None, description="Filter by brand")


# ============ Response Models ============

class ProductItem(BaseModel):
    """Single product from a platform"""
    id: int
    external_id: str
    name: str
    name_normalized: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    platform: str  # source type (shopee, tiki, etc.)
    external_url: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    brand: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    sold_count: int = 0
    available: bool = True
    specs: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class PriceOffer(BaseModel):
    """A price offer from a specific platform"""
    platform: str
    price: float
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    url: str
    available: bool = True


class ProductGroup(BaseModel):
    """
    Grouped products for Entity Resolution.
    Same product across multiple platforms.
    """
    canonical_name: str
    image_url: Optional[str] = None
    best_price: float
    best_platform: str
    offers: List[PriceOffer] = Field(default_factory=list)
    avg_rating: Optional[float] = None
    total_reviews: int = 0
    product_ids: List[int] = Field(default_factory=list)


class SearchResponse(BaseModel):
    """Search API response"""
    query: str
    method: SearchMethod
    total_results: int
    page: int
    limit: int
    total_pages: int
    results: List[ProductItem] = Field(default_factory=list)
    grouped_results: List[ProductGroup] = Field(default_factory=list)
    execution_time_ms: float


class StatsResponse(BaseModel):
    """Dashboard statistics response"""
    total_products: int
    products_by_platform: Dict[str, int]
    avg_price_by_platform: Dict[str, float]
    total_brands: int
    total_categories: int
    last_crawled_at: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = "ok"
    version: str = "1.0.0"
    database_connected: bool = True
    index_loaded: bool = False
