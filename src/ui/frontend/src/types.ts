// API Types matching backend models.py

export type SearchMethod = 'bm25' | 'vector' | 'hybrid';

export type Platform = 'shopee' | 'tiki' | 'lazada' | 'cellphones' | 'dienmayxanh' | 'thegioididong';

export interface ProductItem {
    id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    price?: number;
    original_price?: number;
    discount_percent?: number;
    platform: string;
    external_url?: string;
    image_url?: string;
    images: string[];
    brand?: string;
    category?: string;
    rating?: number;
    review_count: number;
    sold_count: number;
    available: boolean;
    specs: Record<string, unknown>;
}

export interface PriceOffer {
    platform: string;
    price: number;
    original_price?: number;
    discount_percent?: number;
    url: string;
    available: boolean;
}

export interface ProductGroup {
    canonical_name: string;
    image_url?: string;
    best_price: number;
    best_platform: string;
    offers: PriceOffer[];
    avg_rating?: number;
    total_reviews: number;
    product_ids: number[];
}

export interface SearchResponse {
    query: string;
    method: SearchMethod;
    total_results: number;
    page: number;
    limit: number;
    total_pages: number;
    results: ProductItem[];
    grouped_results: ProductGroup[];
    execution_time_ms: number;
}

export interface StatsResponse {
    total_products: number;
    products_by_platform: Record<string, number>;
    avg_price_by_platform: Record<string, number>;
    total_brands: number;
    total_categories: number;
    last_crawled_at?: string;
}

export interface SearchFilters {
    query: string;
    method: SearchMethod;
    page: number;
    limit: number;
    platforms?: Platform[];
    min_price?: number;
    max_price?: number;
}
