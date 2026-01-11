import { BaseCrawler, CrawledProduct, CrawlOptions, CrawlRequest } from './base';
import { CategoryService, CategoryNode } from './categoryService';
import { KeywordService } from './keywordService';
import logger from '../utils/logger';

interface TikiSearchResponse {
    data?: Array<{
        id: number;
        sku: string;
        name: string;
        url_key: string;
        url_path: string;
        short_description: string;
        price: number;
        list_price: number;
        original_price: number;
        discount: number;
        discount_rate: number;
        rating_average: number;
        review_count: number;
        order_count: number;
        favourite_count: number;
        thumbnail_url: string;
        inventory_status: string;
        stock_item?: {
            qty: number;
            max_sale_qty: number;
        };
        brand?: {
            id: number;
            name: string;
            slug: string;
        };
        seller?: {
            id: number;
            name: string;
        };
        specifications?: Array<{
            name: string;
            attributes: Array<{
                code: string;
                name: string;
                value: string;
            }>;
        }>;
        productset_group_name?: string;
        badges_new?: Array<{
            code: string;
            text: string;
        }>;
    }>;
    paging?: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
    };
}

// Tiki category IDs for mass crawling
const TIKI_CATEGORIES = [
    { id: 1789, name: 'Điện Thoại - Máy Tính Bảng' },
    { id: 1846, name: 'Laptop - Máy Vi Tính' },
    { id: 1882, name: 'Máy Ảnh - Quay Phim' },
    { id: 1815, name: 'Tivi - Thiết Bị Nghe Nhìn' },
    { id: 1883, name: 'Điện Gia Dụng' },
    { id: 4221, name: 'Điện Tử - Điện Lạnh' },
    { id: 1801, name: 'Phụ Kiện Số - Phụ Kiện Di Động' },
    { id: 8594, name: 'Đồng Hồ và Trang Sức' },
];

// Popular search keywords
const TIKI_KEYWORDS = [
    'iphone', 'samsung', 'xiaomi', 'macbook', 'laptop gaming',
    'airpods', 'tai nghe bluetooth', 'apple watch', 'tivi samsung',
    'máy lọc không khí', 'robot hút bụi', 'nồi chiên không dầu',
];

export class TikiCrawler extends BaseCrawler {
    private readonly baseApiUrl = 'https://tiki.vn/api/v2/products';
    private readonly productBaseUrl = 'https://tiki.vn';

    constructor(options?: CrawlOptions) {
        super('tiki', {
            rateLimit: 3, // Tiki is more lenient
            timeout: 30000,
            ...options,
        });
    }

    /**
     * Get Tiki-specific headers
     */
    private getTikiHeaders(): Record<string, string> {
        return {
            'Referer': 'https://tiki.vn/',
            'Origin': 'https://tiki.vn',
            'X-Requested-With': 'XMLHttpRequest',
        };
    }

    async crawl(options: CrawlRequest = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const query = options?.query || 'điện thoại';
        const maxPages = options?.maxPages || 100; // Increased from 50 to 100
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let consecutiveErrors = 0;
        let totalSaved = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        let consecutiveNoNewProducts = 0; // Auto-skip counter

        logger.info(`[Tiki] Starting crawl for query: "${query}", max pages: ${maxPages}`);

        for (let page = 1; page <= maxPages; page++) {
            if (this.shouldStop) break;

            try {
                const url = `${this.baseApiUrl}?q=${encodeURIComponent(query)}&page=${page}&limit=100&sort=top_seller&aggregations=2`;

                const response = await this.queueFetch<TikiSearchResponse>(url, {
                    headers: this.getTikiHeaders(),
                });

                consecutiveErrors = 0;

                if (!response.data?.length) {
                    logger.info(`[Tiki] No more results at page ${page}`);
                    break;
                }

                for (const item of response.data) {
                    const product = this.parseProduct(item);
                    if (product) {
                        products.push(product);
                    }
                }

                logger.info(`[Tiki] Page ${page}: Found ${response.data.length} items, total buffered: ${products.length}`);

                // Update Session count in UI immediately after each page
                await this.updateCrawlLog(logId, {
                    total: totalSaved + products.length,
                    newItems: totalSaved,
                    updated: 0,
                    errors: errorCount,
                }, false);

                // Save products more frequently (every 100 instead of 500)
                if (products.length >= 100) {
                    const toSave = products.splice(0, 100);
                    const { inserted, updated } = await this.saveProducts(toSave);
                    totalSaved += inserted + updated;
                    totalInserted += inserted;
                    totalUpdated += updated;

                    // === AUTO-SKIP LOGIC DISABLED (User requested continuous crawl) ===
                    // if (inserted === 0 && updated > 0) {
                    //     consecutiveNoNewProducts++;
                    //     logger.info(`[Tiki] ⚠️ Page ${page}: No new products (${updated} updated). Consecutive: ${consecutiveNoNewProducts}/3`);

                    //     if (consecutiveNoNewProducts >= 10) {
                    //         logger.info(`[Tiki] ⏭️ AUTO-SKIP: 10 consecutive pages with no new products. Moving to next.`);
                    //         break;
                    //     }
                    // } else if (inserted > 0) {
                    //     consecutiveNoNewProducts = 0; // Reset counter when new products found
                    // }
                    // === END AUTO-SKIP ===

                    logger.info(`[Tiki] Saved batch of 100 products (total: ${totalSaved})`);

                    // Update log periodically
                    await this.updateCrawlLog(logId, {
                        total: totalSaved,
                        newItems: totalInserted,
                        updated: totalUpdated,
                        errors: errorCount,
                    }, false);
                }

                if (response.paging && page >= response.paging.last_page) {
                    break;
                }

                await this.sleep(500 + Math.random() * 500);
            } catch (error) {
                logger.error(`[Tiki] Error at page ${page}:`, error);
                errorCount++;
                consecutiveErrors++;

                if (consecutiveErrors >= 3) {
                    logger.error('[Tiki] Too many consecutive errors, stopping crawl');
                    break;
                }

                await this.sleep(3000);
            }
        }

        const { inserted, updated } = await this.saveProducts(products);
        totalSaved += inserted + updated;
        totalInserted += inserted;
        totalUpdated += updated;

        await this.updateCrawlLog(logId, {
            total: totalSaved,
            newItems: totalInserted,
            updated: totalUpdated,
            errors: errorCount,
        });

        logger.info(`[Tiki] Crawl completed: ${totalSaved} products saved, ${errorCount} errors`);

        return products;
    }

    /**
     * Crawl by Tiki category ID
     */
    async crawlByCategoryId(categoryId: number, maxPages = 50): Promise<CrawledProduct[]> {
        await this.initialize();

        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let totalInserted = 0;
        let totalUpdated = 0;

        logger.info(`[Tiki] Crawling category ID: ${categoryId}`);

        for (let page = 1; page <= maxPages; page++) {
            if (this.shouldStop) break;

            try {
                const url = `${this.baseApiUrl}?category=${categoryId}&page=${page}&limit=100&sort=top_seller`;

                const response = await this.queueFetch<TikiSearchResponse>(url, {
                    headers: this.getTikiHeaders(),
                });

                if (!response.data?.length) {
                    break;
                }

                for (const item of response.data) {
                    const product = this.parseProduct(item);
                    if (product) {
                        products.push(product);
                    }
                }

                logger.info(`[Tiki] Category ${categoryId} page ${page}: ${response.data.length} items`);

                if (response.paging && page >= response.paging.last_page) {
                    break;
                }

                await this.sleep(400 + Math.random() * 300);
            } catch (error) {
                logger.error(`[Tiki] Error at page ${page}:`, error);
                errorCount++;
                if (errorCount >= 3) break;
            }
        }

        const { inserted, updated } = await this.saveProducts(products);
        totalInserted += inserted;
        totalUpdated += updated;

        await this.updateCrawlLog(logId, {
            total: totalInserted + totalUpdated,
            newItems: totalInserted,
            updated: totalUpdated,
            errors: errorCount,
        });

        return products;
    }

    /**
     * Mass crawl across all categories and keywords
     * ENHANCED: Smart auto-skip - only crawls uncrawled items
     */
    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        logger.info(`[Tiki] 🚀 Starting SMART EXHAUSTIVE Crawl...`);
        const maxPages = options.pagesPerCategory || 100;
        const allProducts: CrawledProduct[] = [];

        await this.initialize();
        const { CrawlProgressService } = await import('./crawlProgressService');

        while (!this.shouldStop) {
            // 1. Lấy mục tiêu từ Database
            const dbCategories = await CategoryService.getCategories(this.sourceId);
            const dbKeywords = await KeywordService.getKeywords('tiki');

            // 2. Lọc danh mục/từ khóa chưa cào (24h)
            const uncrawledCats = await CrawlProgressService.getUncrawledCategories(this.sourceId, dbCategories, 24);
            const targetsFromKeywords = dbKeywords.map(k => k.keyword);
            const uncrawledKeys = await CrawlProgressService.getUncrawledKeywords(this.sourceId, targetsFromKeywords, 24);

            if (uncrawledCats.length === 0 && uncrawledKeys.length === 0) {
                logger.info(`[Tiki] ✅ Đã cào sạch Tiki. Nghỉ 1 tiếng...`);
                for (let i = 0; i < 60 && !this.shouldStop; i++) await this.sleep(60000);
                continue;
            }

            logger.info(`[Tiki] 🎯 Mục tiêu: ${uncrawledCats.length} danh mục, ${uncrawledKeys.length} từ khóa`);

            // 3. Cào Danh mục (Tiki API cào theo ID cực chuẩn)
            for (const cat of uncrawledCats) {
                if (this.shouldStop) break;

                // Use external_id if available, otherwise look up slug mapping
                let catIdStr = cat.external_id;
                if (!catIdStr) {
                    catIdStr = CategoryService.getSourceSlug(cat, 'tiki');
                }

                const catId = parseInt(catIdStr);

                if (isNaN(catId)) {
                    logger.warn(`[Tiki] Skipped category ${cat.name} - Invalid ID: ${catIdStr}`);
                    continue;
                }

                logger.info(`[Tiki] 📂 Vét cạn danh mục: ${cat.name} (Tiki ID: ${catId})`);
                const products = await this.crawlByCategoryId(catId, maxPages);
                allProducts.push(...products);
                await this.sleep(2000);
            }

            // 4. Cào Từ khóa
            for (const kw of uncrawledKeys) {
                if (this.shouldStop) break;
                logger.info(`[Tiki] 🔍 Vét cạn từ khóa: ${kw}`);
                const products = await this.crawl({ query: kw, maxPages: 50 });
                allProducts.push(...products);
                await this.sleep(2000);
            }

            logger.info(`[Tiki] 🔄 Kết thúc vòng. Tổng: ${allProducts.length}`);
            await this.sleep(30000);
        }

        return allProducts;
    }

    /**
     * Crawl products from a specific seller/shop
     * Each top seller can have thousands of products
     */
    async crawlSeller(sellerId: number, maxPages: number = 50): Promise<CrawledProduct[]> {
        await this.initialize();

        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let totalInserted = 0;
        let totalUpdated = 0;

        logger.info(`[Tiki] 🏪 Crawling seller ID: ${sellerId}`);

        for (let page = 1; page <= maxPages; page++) {
            if (this.shouldStop) break;

            try {
                const url = `${this.baseApiUrl}?seller=${sellerId}&page=${page}&limit=100&sort=top_seller`;

                const response = await this.queueFetch<TikiSearchResponse>(url, {
                    headers: this.getTikiHeaders(),
                });

                if (!response.data?.length) {
                    logger.info(`[Tiki] Seller ${sellerId}: No more products at page ${page}`);
                    break;
                }

                for (const item of response.data) {
                    const product = this.parseProduct(item);
                    if (product) {
                        products.push(product);
                    }
                }

                logger.info(`[Tiki] Seller ${sellerId} page ${page}: ${response.data.length} items`);

                if (response.paging && page >= response.paging.last_page) {
                    break;
                }

                await this.sleep(400 + Math.random() * 300);
            } catch (error) {
                logger.error(`[Tiki] Seller crawl error at page ${page}:`, error);
                errorCount++;
                if (errorCount >= 3) break;
            }
        }

        const { inserted, updated } = await this.saveProducts(products);
        totalInserted += inserted;
        totalUpdated += updated;

        await this.updateCrawlLog(logId, {
            total: totalInserted + totalUpdated,
            newItems: totalInserted,
            updated: totalUpdated,
            errors: errorCount,
        });

        return products;
    }

    async crawlCategory(categorySlug: string, maxPages = 50): Promise<CrawledProduct[]> {
        return this.crawl({ query: categorySlug, maxPages });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private parseProduct(item: any): CrawledProduct | null {
        try {
            if (!item?.name || !item?.price) return null;

            const productUrl = `${this.productBaseUrl}/${item.url_path || item.url_key}`;

            // Parse specifications
            const specs: Record<string, string> = {};
            if (item.specifications) {
                for (const spec of item.specifications) {
                    for (const attr of spec.attributes || []) {
                        specs[attr.name] = attr.value;
                    }
                }
            }

            return {
                externalId: item.id.toString(),
                externalUrl: productUrl,
                name: item.name,
                description: item.short_description,
                price: item.price,
                originalPrice: item.list_price || item.original_price,
                discountPercent: item.discount_rate || item.discount,
                brand: item.brand?.name,
                category: item.productset_group_name,
                imageUrl: item.thumbnail_url,
                rating: item.rating_average,
                reviewCount: item.review_count || 0,
                soldCount: item.order_count || 0,
                available: item.inventory_status === 'available',
                stockQuantity: item.stock_item?.qty,
                specs: specs,
                metadata: {
                    sku: item.sku,
                    sellerId: item.seller?.id,
                    sellerName: item.seller?.name,
                    badges: item.badges_new?.map((b: { text: string }) => b.text),
                },
            };
        } catch (error) {
            logger.error(`[Tiki] Failed to parse product ${item?.id}:`, error);
            return null;
        }
    }
}
