/**
 * API Client for E-Commerce Price Spider Frontend
 * Connects to Python backend at localhost:8000
 * Transforms backend responses to match frontend expected types
 */

import { SearchResponse, SearchFilters, ProductItem, ProductGroup } from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE = 'http://127.0.0.1:8000/api';

// =============================================================================
// HELPER TYPES FOR RAW API RESPONSE
// =============================================================================

interface RawProduct {
    id?: string | number;
    name?: string;
    title?: string;
    product_name?: string;
    price?: number;
    original_price?: number;
    image?: string;
    image_url?: string;
    url?: string;
    external_url?: string;
    platform?: string;
    source?: string;
    rating?: number;
    reviews?: number;
    review_count?: number;
    discount?: number;
    discount_percent?: number;
    brand?: string;
    category?: string;
    sold_count?: number;
    available?: boolean;
    created_at?: string;
    [key: string]: unknown;
}

interface RawSearchResponse {
    success: boolean;
    table?: string;
    column?: string;
    data: RawProduct[];
    count: number;
    query?: string;
    message?: string;
}

// =============================================================================
// PRICE FORMATTING
// =============================================================================

export const formatPrice = (price: number | undefined | null): string => {
    if (!price) return "Liên hệ";
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
};

// =============================================================================
// PLATFORM DETECTION FROM URL
// =============================================================================

const PLATFORM_URL_PATTERNS: Record<string, string[]> = {
    shopee: ['shopee.vn', 'shopee.com'],
    tiki: ['tiki.vn'],
    lazada: ['lazada.vn', 'lazada.com'],
    sendo: ['sendo.vn'],
    dienmayxanh: ['dienmayxanh.com'],
    thegioididong: ['thegioididong.com'],
    cellphones: ['cellphones.com.vn'],
    fptshop: ['fptshop.com.vn'],
    nguyenkim: ['nguyenkim.com'],
    phongvu: ['phongvu.vn'],
    gearvn: ['gearvn.com'],
    hasaki: ['hasaki.vn'],
    yes24: ['yes24.vn'],
    fahasa: ['fahasa.com'],
};

function detectPlatformFromUrl(url: string | undefined): string | null {
    if (!url) return null;

    const urlLower = url.toLowerCase();
    for (const [platform, patterns] of Object.entries(PLATFORM_URL_PATTERNS)) {
        for (const pattern of patterns) {
            if (urlLower.includes(pattern)) {
                return platform;
            }
        }
    }
    return null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform raw product to ProductItem format
 */
function transformToProductItem(raw: RawProduct, index: number): ProductItem {
    // Detect platform from various sources
    let platform = raw.platform || raw.source;

    // If platform is missing or unknown, try to detect from URL
    if (!platform || platform.toLowerCase() === 'unknown') {
        const url = raw.url || raw.external_url;
        const detected = detectPlatformFromUrl(url);
        if (detected) {
            platform = detected;
        } else {
            platform = 'unknown';
        }
    }

    // Normalize platform name
    platform = platform.toLowerCase().trim();

    return {
        id: typeof raw.id === 'number' ? raw.id : index,
        external_id: String(raw.id || index),
        name: raw.name || raw.title || raw.product_name || 'Unknown Product',
        name_normalized: (raw.name || raw.title || raw.product_name || '').toLowerCase(),
        price: raw.price,
        original_price: raw.original_price,
        discount_percent: raw.discount_percent || raw.discount,
        platform: platform,
        external_url: raw.external_url || raw.url,
        image_url: raw.image_url || raw.image,
        images: raw.image_url ? [raw.image_url] : raw.image ? [raw.image] : [],
        brand: raw.brand,
        category: raw.category,
        rating: raw.rating,
        review_count: raw.review_count || raw.reviews || 0,
        sold_count: raw.sold_count || 0,
        available: raw.available !== false,
        specs: {},
    };
}

/**
 * Group products by similar names for price comparison
 */
function groupProducts(products: ProductItem[]): ProductGroup[] {
    // Simple grouping by normalized name (first 50 chars)
    const groups: Map<string, ProductItem[]> = new Map();

    for (const product of products) {
        const key = (product.name_normalized || product.name || '').slice(0, 50).trim();
        if (!key) continue;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(product);
    }

    // Convert to ProductGroup format
    const result: ProductGroup[] = [];

    for (const [, items] of groups) {
        if (items.length === 0) continue;

        // Find best price
        const validPrices = items.filter(p => p.price && p.price > 0);
        const bestItem = validPrices.length > 0
            ? validPrices.reduce((a, b) => (a.price! < b.price! ? a : b))
            : items[0];

        result.push({
            canonical_name: items[0].name,
            image_url: items[0].image_url,
            best_price: bestItem.price || 0,
            best_platform: bestItem.platform,
            offers: items.map(item => ({
                platform: item.platform,
                price: item.price || 0,
                original_price: item.original_price,
                discount_percent: item.discount_percent,
                url: item.external_url || '',
                available: item.available,
            })),
            avg_rating: items.reduce((sum, p) => sum + (p.rating || 0), 0) / items.length || undefined,
            total_reviews: items.reduce((sum, p) => sum + (p.review_count || 0), 0),
            product_ids: items.map(p => p.id),
        });
    }

    return result;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Search for products using the smart search endpoint
 * Transforms response to match frontend SearchResponse type
 */
export async function searchProducts(filters: SearchFilters): Promise<SearchResponse> {
    const startTime = performance.now();

    const params = new URLSearchParams();

    // Required parameter
    params.set('query', filters.query);

    // Optional parameters
    if (filters.limit) {
        params.set('limit', filters.limit.toString());
    }
    if (filters.page) {
        params.set('page', filters.page.toString());
    }
    if (filters.platforms && filters.platforms.length > 0) {
        params.set('platforms', filters.platforms.join(','));
    }
    if (filters.min_price !== undefined) {
        params.set('min_price', filters.min_price.toString());
    }
    if (filters.max_price !== undefined) {
        params.set('max_price', filters.max_price.toString());
    }

    const url = `${API_BASE}/search?${params}`;
    console.log(`📡 Calling API: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`❌ API returned status ${response.status}`);
            throw new Error(`Search failed with status ${response.status}`);
        }

        const rawData: RawSearchResponse = await response.json();
        const executionTime = performance.now() - startTime;

        console.log(`✅ Received ${rawData.count || rawData.data?.length || 0} results from table: ${rawData.table}`);

        // Transform raw products to ProductItem format
        const products: ProductItem[] = (rawData.data || []).map((raw, idx) =>
            transformToProductItem(raw, idx)
        );

        // Create grouped results for comparison view
        const groupedResults = groupProducts(products);

        const limit = filters.limit || 20;
        const totalResults = rawData.count || products.length;

        // Return transformed response matching frontend SearchResponse type
        return {
            query: filters.query,
            method: filters.method,
            total_results: totalResults,
            page: filters.page || 1,
            limit: limit,
            total_pages: Math.ceil(totalResults / limit),
            results: products,
            grouped_results: groupedResults,
            execution_time_ms: executionTime,
        };
    } catch (error) {
        console.error("❌ API Call Failed:", error);
        throw error;
    }
}

// =============================================================================
// STATS TYPES (matching new backend response)
// =============================================================================

export interface PlatformDistribution {
    name: string;
    count: number;
}

export interface DashboardStats {
    total_products: number;
    total_platforms: number;
    total_brands: number;
    last_updated: string | null;
    platform_distribution: PlatformDistribution[];
    source_table?: string;
}

// Default stats for fallback
const DEFAULT_STATS: DashboardStats = {
    total_products: 0,
    total_platforms: 0,
    total_brands: 0,
    last_updated: null,
    platform_distribution: [],
};

/**
 * Get dashboard statistics
 * Returns properly structured stats with fallback on error
 */
export async function getStats(): Promise<DashboardStats> {
    const url = `${API_BASE}/stats`;
    console.log(`📡 Fetching stats: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`⚠️ Stats endpoint returned ${response.status}, using defaults`);
            return DEFAULT_STATS;
        }

        const data = await response.json();
        console.log('✅ Stats received:', data);

        // Transform and validate the response with defensive checks
        const stats: DashboardStats = {
            total_products: typeof data.total_products === 'number' ? data.total_products : 0,
            total_platforms: typeof data.total_platforms === 'number' ? data.total_platforms : 0,
            total_brands: typeof data.total_brands === 'number' ? data.total_brands : 0,
            last_updated: data.last_updated || null,
            platform_distribution: Array.isArray(data.platform_distribution)
                ? data.platform_distribution.map((item: { name?: string; count?: number }) => ({
                    name: item.name || 'unknown',
                    count: typeof item.count === 'number' ? item.count : 0,
                }))
                : [],
            source_table: data.source_table,
        };

        return stats;
    } catch (error) {
        console.error("❌ Failed to fetch stats:", error);
        return DEFAULT_STATS;
    }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; version?: string }> {
    const url = `${API_BASE}/health`;
    console.log(`📡 Health check: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('API not available');
        }

        return await response.json();
    } catch (error) {
        console.error("❌ Health check failed:", error);
        throw error;
    }
}
