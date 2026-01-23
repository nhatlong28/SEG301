export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type SourceType = 'shopee' | 'tiki' | 'lazada' | 'cellphones' | 'dienmayxanh' | 'thegioididong';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Database {
    public: {
        Tables: {
            sources: {
                Row: {
                    id: number;
                    name: string;
                    base_url: string;
                    type: SourceType;
                    description: string | null;
                    is_active: boolean;
                    api_key: string | null;
                    rate_limit_rps: number;
                    proxy_url: string | null;
                    last_crawled_at: string | null;
                    total_items_crawled: number;
                    config: Json;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['sources']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['sources']['Insert']>;
            };
            categories: {
                Row: {
                    id: number;
                    name: string;
                    slug: string;
                    parent_id: number | null;
                    level: number;
                    icon: string | null;
                    is_active: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['categories']['Insert']>;
            };
            brands: {
                Row: {
                    id: number;
                    name: string;
                    slug: string;
                    logo_url: string | null;
                    is_verified: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['brands']['Insert']>;
            };
            raw_products: {
                Row: {
                    id: number;
                    source_id: number;
                    external_id: string;
                    external_url: string | null;
                    name: string;
                    name_normalized: string | null;
                    description: string | null;
                    price: number | null;
                    original_price: number | null;
                    discount_percent: number | null;
                    brand_id: number | null;
                    brand_raw: string | null;
                    category_id: number | null;
                    category_raw: string | null;
                    image_url: string | null;
                    images: Json;
                    rating: number | null;
                    review_count: number;
                    sold_count: number;
                    available: boolean;
                    stock_quantity: number | null;
                    specs: Json;
                    metadata: Json;
                    hash_name: string | null;
                    dedup_status: string | null;
                    last_dedup_at: string | null;
                    crawled_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['raw_products']['Row'], 'id' | 'crawled_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['raw_products']['Insert']>;
            };
            canonical_products: {
                Row: {
                    id: number;
                    name: string;
                    name_normalized: string | null;
                    slug: string | null;
                    brand_id: number | null;
                    category_id: number | null;
                    description: string | null;
                    image_url: string | null;
                    images: Json;
                    canonical_specs: Json;
                    min_price: number | null;
                    max_price: number | null;
                    avg_rating: number | null;
                    total_reviews: number;
                    total_sold: number;
                    source_count: number;
                    quality_score: number | null;
                    is_verified: boolean;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['canonical_products']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['canonical_products']['Insert']>;
            };
            product_mappings: {
                Row: {
                    id: number;
                    canonical_id: number;
                    raw_product_id: number;
                    confidence_score: number | null;
                    matching_method: string | null;
                    is_verified: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['product_mappings']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['product_mappings']['Insert']>;
            };
            matching_pairs: {
                Row: {
                    id: number;
                    job_id: number | null;
                    raw_product_1: number;
                    raw_product_2: number;
                    source_1: number;
                    source_2: number;
                    match_score: number | null;
                    match_method: string | null;
                    canonical_id: number | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['matching_pairs']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['matching_pairs']['Insert']>;
            };
            deduplication_jobs: {
                Row: {
                    id: number;
                    status: string;
                    mode: string;
                    total_raw: number | null;
                    processed: number | null;
                    canonical_created: number | null;
                    mappings_created: number | null;
                    source_breakdown: Json | null;
                    current_phase: string | null;
                    error_message: string | null;
                    started_at: string | null;
                    completed_at: string | null;
                };
                Insert: {
                    id?: number;
                    status?: string;
                    mode?: string;
                    total_raw?: number | null;
                    processed?: number | null;
                    canonical_created?: number | null;
                    mappings_created?: number | null;
                    source_breakdown?: Json | null;
                    current_phase?: string | null;
                    error_message?: string | null;
                    started_at?: string | null;
                    completed_at?: string | null;
                };
                Update: {
                    id?: number;
                    status?: string;
                    mode?: string;
                    total_raw?: number | null;
                    processed?: number | null;
                    canonical_created?: number | null;
                    mappings_created?: number | null;
                    source_breakdown?: Json | null;
                    current_phase?: string | null;
                    error_message?: string | null;
                    started_at?: string | null;
                    completed_at?: string | null;
                };
            };
            price_history: {
                Row: {
                    id: number;
                    raw_product_id: number;
                    price: number;
                    original_price: number | null;
                    discount_percent: number | null;
                    available: boolean;
                    recorded_at: string;
                };
                Insert: Omit<Database['public']['Tables']['price_history']['Row'], 'id' | 'recorded_at'>;
                Update: Partial<Database['public']['Tables']['price_history']['Insert']>;
            };
            reviews: {
                Row: {
                    id: number;
                    raw_product_id: number;
                    source_id: number;
                    external_id: string | null;
                    author: string | null;
                    author_avatar: string | null;
                    rating: number | null;
                    content: string | null;
                    images: Json;
                    helpful_count: number;
                    verified_purchase: boolean;
                    sentiment: string | null;
                    sentiment_score: number | null;
                    review_date: string | null;
                    crawled_at: string;
                };
                Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'crawled_at'>;
                Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
            };
            crawl_logs: {
                Row: {
                    id: number;
                    source_id: number;
                    category_id: number | null;
                    started_at: string;
                    completed_at: string | null;
                    total_items: number;
                    new_items: number;
                    updated_items: number;
                    error_count: number;
                    error_message: string | null;
                    status: ProcessingStatus;
                    metadata: Json;
                };
                Insert: Omit<Database['public']['Tables']['crawl_logs']['Row'], 'id' | 'started_at'>;
                Update: Partial<Database['public']['Tables']['crawl_logs']['Insert']>;
            };
            search_history: {
                Row: {
                    id: number;
                    query: string;
                    query_normalized: string | null;
                    search_type: string;
                    filters: Json;
                    results_count: number;
                    execution_time_ms: number | null;
                    top_result_id: number | null;
                    user_session_id: string | null;
                    ip_address: string | null;
                    user_agent: string | null;
                    searched_at: string;
                };
                Insert: Omit<Database['public']['Tables']['search_history']['Row'], 'id' | 'searched_at'>;
                Update: Partial<Database['public']['Tables']['search_history']['Insert']>;
            };
            user_watchlist: {
                Row: {
                    id: number;
                    user_id: string;
                    canonical_id: number;
                    target_price: number | null;
                    notify_on_drop: boolean;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_watchlist']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['user_watchlist']['Insert']>;
            };
            price_alerts: {
                Row: {
                    id: number;
                    user_id: string;
                    canonical_id: number;
                    old_price: number | null;
                    new_price: number | null;
                    drop_percent: number | null;
                    source_id: number | null;
                    is_sent: boolean;
                    sent_at: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['price_alerts']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['price_alerts']['Insert']>;
            };
        };
        Enums: {
            source_type: SourceType;
            processing_status: ProcessingStatus;
        };
    };
}

// Helper types for easier usage
export type Source = Database['public']['Tables']['sources']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Brand = Database['public']['Tables']['brands']['Row'];
export type RawProduct = Database['public']['Tables']['raw_products']['Row'];
export type CanonicalProduct = Database['public']['Tables']['canonical_products']['Row'];
export type ProductMapping = Database['public']['Tables']['product_mappings']['Row'];
export type PriceHistory = Database['public']['Tables']['price_history']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type CrawlLog = Database['public']['Tables']['crawl_logs']['Row'];
export type SearchHistory = Database['public']['Tables']['search_history']['Row'];
