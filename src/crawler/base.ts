import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import PQueue from 'p-queue';
import logger from '../utils/logger';
import { supabaseAdmin } from '../db/supabase';
import type { SourceType } from '../types/database';

export interface CrawlOptions {
    rateLimit?: number;
    timeout?: number;
    maxRetries?: number;
    proxyUrl?: string;
    userAgent?: string;
    // For compatibility with per-crawl options in some implementations
    query?: string;
    category?: string;
    categorySlug?: string;
    maxPages?: number;
}

export interface CrawlRequest {
    query?: string;
    keyword?: string; // added for compatibility
    category?: string;
    categorySlug?: string;
    maxPages?: number;
}

export interface CrawledProduct {
    externalId: string;
    externalUrl?: string;
    name: string;
    description?: string;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    brand?: string;
    category?: string;
    imageUrl?: string;
    images?: string[];
    rating?: number;
    reviewCount?: number;
    soldCount?: number;
    available?: boolean;
    stockQuantity?: number;
    specs?: Record<string, string>;
    metadata?: Record<string, unknown>;
}

interface CrawlOptionsInternal {
    rateLimit: number;
    timeout: number;
    maxRetries: number;
    userAgent: string;
    proxyUrl?: string;
}

// Enhanced User-Agents pool - more realistic browser patterns
const USER_AGENTS = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

export abstract class BaseCrawler {
    protected axiosInstance: AxiosInstance;
    protected queue: PQueue;
    protected sourceId: number;
    protected sourceName: string;
    protected sourceType: SourceType;
    protected options: CrawlOptionsInternal;
    protected shouldStop: boolean = false;
    private requestCount: number = 0;
    public onProgress?: (stats: { products: number; errors: number; currentAction?: string }) => void;

    constructor(sourceType: SourceType, options: CrawlOptions = {}) {
        this.sourceType = sourceType;
        this.sourceName = sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
        this.sourceId = 0;
        this.options = {
            rateLimit: options.rateLimit || 3,
            timeout: options.timeout || 45000,
            maxRetries: options.maxRetries || 5,
            userAgent: options.userAgent || this.getRandomUserAgent(),
            proxyUrl: options.proxyUrl,
        };

        this.axiosInstance = axios.create({
            timeout: this.options.timeout,
            headers: this.getDefaultHeaders(),
            // Prevent axios from following redirects automatically
            maxRedirects: 5,
            // Accept compressed responses
            decompress: true,
        });

        // Add response interceptor for debugging
        this.axiosInstance.interceptors.response.use(
            (response: AxiosResponse) => {
                logger.debug(`[${this.sourceName}] Response ${response.status} from ${response.config.url}`);
                return response;
            },
            (error) => {
                const status = error.response?.status || 'Network Error';
                const url = error.config?.url || 'Unknown URL';
                logger.warn(`[${this.sourceName}] Error ${status} from ${url}`);
                return Promise.reject(error);
            }
        );

        // 🚀 TURBO MODE: High concurrency for massive data ingestion
        this.queue = new PQueue({
            concurrency: 10,  // Tăng từ 1 lên 10
            interval: 200,    // Giảm từ 2000ms xuống 200ms
            intervalCap: this.options.rateLimit || 10,
        });
    }

    /**
     * Stop the crawler gracefully
     */
    stop(): void {
        this.shouldStop = true;
        logger.info(`[${this.sourceName}] 🛑 Stop signal received`);
    }

    /**
     * Get randomized default headers that look like a real browser
     */
    protected getDefaultHeaders(): Record<string, string> {
        const ua = this.options?.userAgent || this.getRandomUserAgent();
        const isChrome = ua.includes('Chrome');
        const isFirefox = ua.includes('Firefox');

        const headers: Record<string, string> = {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };

        // Add Chrome-specific headers
        if (isChrome) {
            headers['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
            headers['Sec-Ch-Ua-Mobile'] = '?0';
            headers['Sec-Ch-Ua-Platform'] = '"Windows"';
            headers['Sec-Fetch-Dest'] = 'document';
            headers['Sec-Fetch-Mode'] = 'navigate';
            headers['Sec-Fetch-Site'] = 'none';
            headers['Sec-Fetch-User'] = '?1';
        }

        // Firefox uses different security headers
        if (isFirefox) {
            headers['DNT'] = '1';
        }

        return headers;
    }

    protected getRandomUserAgent(): string {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    protected rotateUserAgent(): void {
        const ua = this.getRandomUserAgent();
        this.axiosInstance.defaults.headers.common['User-Agent'] = ua;

        // Update Sec-Ch-Ua if Chrome
        if (ua.includes('Chrome')) {
            const chromeVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '120';
            this.axiosInstance.defaults.headers.common['Sec-Ch-Ua'] =
                `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
        }
    }

    /**
     * Initialize crawler by fetching source ID from database
     */
    async initialize(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: source } = await (supabaseAdmin as any)
            .from('sources')
            .select('id')
            .eq('type', this.sourceType)
            .single() as { data: { id: number } | null };

        if (source) {
            this.sourceId = source.id;
            logger.info(`[${this.sourceName}] Crawler initialized with source ID: ${this.sourceId}`);
        } else {
            throw new Error(`Source not found for type: ${this.sourceType}`);
        }
    }

    /**
     * Fetch a URL with automatic retry and anti-bot measures
     */
    protected async fetchWithRetry<T>(
        url: string,
        config?: AxiosRequestConfig,
        retries = 0
    ): Promise<T> {
        try {
            this.requestCount++;

            // Rotate UA every 10 requests
            if (this.requestCount % 10 === 0) {
                this.rotateUserAgent();
            }

            // Add random delay between 500-1500ms to seem more human
            const randomDelay = 500 + Math.random() * 1000;
            await this.sleep(randomDelay);

            logger.debug(`[${this.sourceName}] Fetching [attempt ${retries + 1}]: ${url.substring(0, 100)}...`);

            const response = await this.axiosInstance.request<T>({
                url,
                method: config?.method || 'GET',
                ...config,
                headers: {
                    ...this.getDefaultHeaders(),
                    ...config?.headers,
                },
            });

            return response.data;
        } catch (error: unknown) {
            const maxRetries = this.options.maxRetries;
            const axiosError = error as { response?: { status?: number }; code?: string };

            // Check if error is retryable
            const isRetryable = this.isRetryableError(axiosError);

            if (isRetryable && retries < maxRetries) {
                // Exponential backoff with jitter
                const baseDelay = Math.pow(2, retries) * 2000;
                const jitter = Math.random() * 3000;
                const delay = baseDelay + jitter;

                logger.warn(`[${this.sourceName}] Retry ${retries + 1}/${maxRetries} in ${Math.round(delay)}ms - Error: ${axiosError.response?.status || axiosError.code}`);

                await this.sleep(delay);
                this.rotateUserAgent(); // Try with new UA

                return this.fetchWithRetry(url, config, retries + 1);
            }

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[${this.sourceName}] Failed to fetch after ${maxRetries} retries: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Check if error should trigger a retry
     */
    private isRetryableError(error: { response?: { status?: number }; code?: string }): boolean {
        const status = error.response?.status;
        const code = error.code;

        // Network errors
        if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
            return true;
        }

        // Server errors (5xx) should be retried
        if (status && status >= 500 && status < 600) {
            return true;
        }

        // Rate limiting (429) should be retried with longer delay
        if (status === 429) {
            return true;
        }

        // Some 4xx errors might be temporary
        if (status === 408 || status === 425 || status === 503) {
            return true;
        }

        return false;
    }

    /**
     * Queue a fetch operation
     */
    protected async queueFetch<T>(
        url: string,
        config?: AxiosRequestConfig
    ): Promise<T> {
        return this.queue.add(() => this.fetchWithRetry<T>(url, config)) as Promise<T>;
    }

    /**
     * Normalize product name for consistent matching
     */
    protected normalizeName(name: string): string {
        return name
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .trim();
    }

    /**
     * Generate hash from normalized name for dedup
     */
    protected generateHash(name: string): string {
        const normalized = this.normalizeName(name);
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    /**
     * Save crawled products to database using bulk upsert
     * OPTIMIZED: Removed redundant duplicate check - DB handles via ON CONFLICT
     */
    async saveProducts(products: CrawledProduct[]): Promise<{ inserted: number; updated: number }> {
        if (products.length === 0) return { inserted: 0, updated: 0 };

        try {
            const productDataList = products.map(product => {
                const externalId = product.externalId ? String(product.externalId).trim() : '';
                return {
                    source_id: this.sourceId,
                    external_id: externalId,
                    external_url: product.externalUrl,
                    name: product.name,
                    name_normalized: this.normalizeName(product.name),
                    brand_raw: product.brand,
                    category_raw: product.category,
                    image_url: product.imageUrl,
                    description: product.description ? product.description.substring(0, 200) : undefined,
                    images: (product.images || []).slice(0, 3),
                    rating: product.rating,
                    review_count: product.reviewCount || 0,
                    sold_count: product.soldCount || 0,
                    price: product.price,
                    original_price: product.originalPrice,
                    discount_percent: product.discountPercent,
                    available: product.available ?? true,
                    stock_quantity: product.stockQuantity,
                    specs: product.specs || {},
                    metadata: product.metadata || {},
                    hash_name: this.generateHash(product.name),
                    updated_at: new Date().toISOString(),
                };
            }).filter(p => !!p.external_id);

            if (productDataList.length === 0) return { inserted: 0, updated: 0 };

            // Deduplicate within batch based on external_id
            const uniqueProductDataMap = new Map<string, any>();
            for (const item of productDataList) {
                const key = String(item.external_id).trim();
                uniqueProductDataMap.set(key, item);
            }
            const uniqueProductData = Array.from(uniqueProductDataMap.values());

            // Batch insert in smaller chunks (20) to avoid Cloudflare 500 errors and DB timeouts
            const batchSize = 20;
            let totalInserted = 0;
            let totalUpdated = 0;

            for (let i = 0; i < uniqueProductData.length; i += batchSize) {
                const batch = uniqueProductData.slice(i, i + batchSize);

                try {
                    // FAST UPSERT: Let DB handle conflicts via ON CONFLICT
                    // Use RETURNING to get which were NEW vs UPDATED
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data, error } = await (supabaseAdmin as any)
                        .from('raw_products')
                        .upsert(batch, {
                            onConflict: 'source_id, external_id',
                            ignoreDuplicates: false
                        })
                        .select('id, crawled_at, updated_at');

                    if (error) {
                        logger.warn(`[${this.sourceName}] Batch ${Math.floor(i / batchSize) + 1} failed, retrying with smaller chunks... Error:`, error.message);

                        // Fallback: Try one by one if batch failed
                        for (const item of batch) {
                            try {
                                const { data: singleData } = await (supabaseAdmin as any)
                                    .from('raw_products')
                                    .upsert(item, {
                                        onConflict: 'source_id, external_id',
                                        ignoreDuplicates: false
                                    })
                                    .select('id, crawled_at, updated_at');

                                if (singleData) {
                                    const row = singleData[0];
                                    const created = new Date(row.crawled_at).getTime();
                                    const updated = new Date(row.updated_at).getTime();
                                    if (Math.abs(updated - created) < 2000) {
                                        totalInserted++;
                                    } else {
                                        totalUpdated++;
                                    }
                                }
                            } catch (innerErr) {
                                logger.error(`[${this.sourceName}] Failed to save single item ${item.external_id}:`, innerErr);
                            }
                        }

                        continue;
                    }

                    // Count new vs updated: if crawled_at ~= updated_at (within 1 second), it's new
                    if (data) {
                        for (const row of data) {
                            const created = new Date(row.crawled_at).getTime();
                            const updated = new Date(row.updated_at).getTime();
                            if (Math.abs(updated - created) < 2000) {
                                totalInserted++;
                            } else {
                                totalUpdated++;
                            }
                        }
                    }

                    logger.info(`[${this.sourceName}] Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueProductData.length / batchSize)}`);
                    await this.sleep(100);
                } catch (err) {
                    logger.error(`[${this.sourceName}] Batch ${Math.floor(i / batchSize) + 1} exception:`, err);
                }
            }

            logger.info(`[${this.sourceName}] 📊 Products: ${totalInserted} NEW, ${totalUpdated} UPDATED (total: ${totalInserted + totalUpdated})`);

            return { inserted: totalInserted, updated: totalUpdated };
        } catch (error) {
            logger.error(`[${this.sourceName}] Failed to bulk save products:`, error);
            return { inserted: 0, updated: 0 };
        }
    }

    /**
     * Create crawl log entry
     */
    async createCrawlLog(categoryId?: number): Promise<number> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('crawl_logs')
            .insert({
                source_id: this.sourceId,
                category_id: categoryId,
                status: 'processing',
                total_items: 0,
                new_items: 0,
                updated_items: 0,
                error_count: 0,
            } as Record<string, unknown>)
            .select('id')
            .single() as { data: { id: number } | null };

        return data?.id || 0;
    }

    /**
     * Update crawl log with results
     */
    async updateCrawlLog(
        logId: number,
        stats: {
            total: number;
            newItems: number;
            updated: number;
            errors: number;
            errorMessage?: string;
        },
        isFinished = true
    ): Promise<void> {
        // Report progress to orchestrator if callback is set
        this.onProgress?.({
            products: stats.total,
            errors: stats.errors,
            currentAction: isFinished ? (stats.total > 0 ? 'Completed' : 'Failed') : 'Crawling...'
        });

        const updateData: Record<string, unknown> = {
            total_items: stats.total,
            new_items: stats.newItems,
            updated_items: stats.updated,
            error_count: stats.errors,
            error_message: stats.errorMessage,
        };

        if (isFinished) {
            updateData.completed_at = new Date().toISOString();
            updateData.status = stats.total > 0
                ? (stats.errors > 0 ? 'partial' : 'completed')
                : 'failed';

            // Update source's last_crawled_at only when finished
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
                .from('sources')
                .update({ last_crawled_at: new Date().toISOString() } as Record<string, unknown>)
                .eq('id', this.sourceId);
        } else {
            updateData.status = 'processing';
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('crawl_logs')
            .update(updateData)
            .eq('id', logId);
    }

    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main crawl method - to be implemented by each platform
     */
    abstract crawl(options?: CrawlRequest): Promise<CrawledProduct[]>;

    /**
     * Crawl a specific category
     */
    abstract crawlCategory(categorySlug: string, maxPages?: number): Promise<CrawledProduct[]>;
}
