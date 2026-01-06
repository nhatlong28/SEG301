import * as cheerio from 'cheerio';
import { BaseCrawler, CrawledProduct, CrawlOptions } from './base';
import logger from '@/lib/utils/logger';

// CellphoneS category URLs for mass crawling
const CELLPHONES_CATEGORIES = [
    { slug: 'mobile', name: 'Điện thoại' },
    { slug: 'mobile/apple', name: 'iPhone' },
    { slug: 'mobile/samsung', name: 'Samsung' },
    { slug: 'mobile/xiaomi', name: 'Xiaomi' },
    { slug: 'mobile/oppo', name: 'Oppo' },
    { slug: 'laptop', name: 'Laptop' },
    { slug: 'laptop/mac', name: 'MacBook' },
    { slug: 'laptop/asus', name: 'Laptop Asus' },
    { slug: 'laptop/lenovo', name: 'Laptop Lenovo' },
    { slug: 'laptop/dell', name: 'Laptop Dell' },
    { slug: 'tablet', name: 'Máy tính bảng' },
    { slug: 'do-choi-cong-nghe/dong-ho-thong-minh/apple-watch', name: 'Apple Watch' },
    { slug: 'do-choi-cong-nghe/dong-ho-thong-minh', name: 'Đồng hồ thông minh' },
    { slug: 'thiet-bi-am-thanh/tai-nghe', name: 'Tai nghe' },
    { slug: 'thiet-bi-am-thanh/loa', name: 'Loa' },
];

export class CellphonesCrawler extends BaseCrawler {
    private readonly baseUrl = 'https://cellphones.com.vn';

    constructor(options?: CrawlOptions) {
        super('cellphones', {
            rateLimit: 2,
            timeout: 30000,
            ...options,
        });
    }

    /**
     * Get CellphoneS-specific headers
     */
    private getCellphonesHeaders(): Record<string, string> {
        return {
            'Referer': 'https://cellphones.com.vn/',
            'Origin': 'https://cellphones.com.vn',
        };
    }

    async crawl(options?: {
        query?: string;
        category?: string;
        maxPages?: number;
    }): Promise<CrawledProduct[]> {
        await this.initialize();

        const category = options?.category || 'mobile';
        const maxPages = options?.maxPages || 30;
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let consecutiveErrors = 0;
        let totalSaved = 0;
        let consecutiveNoNewProducts = 0; // Auto-skip counter

        logger.info(`[CellphoneS] Starting crawl for category: "${category}", max pages: ${maxPages}`);

        for (let page = 1; page <= maxPages; page++) {
            if (this.shouldStop) break;

            try {
                const url = `${this.baseUrl}/${category}.html?p=${page}`;
                const html = await this.queueFetch<string>(url, {
                    headers: this.getCellphonesHeaders(),
                });
                const items = this.parseListingPage(html);

                consecutiveErrors = 0;

                if (!items.length) {
                    logger.info(`[CellphoneS] No more results at page ${page}`);
                    break;
                }

                products.push(...items);

                logger.info(`[CellphoneS] Page ${page}: Found ${items.length} items, total buffered: ${products.length}`);

                // Update Session count in UI immediately after each page
                await this.updateCrawlLog(logId, {
                    total: totalSaved + products.length,
                    newItems: totalSaved,
                    updated: 0,
                    errors: errorCount,
                }, false);

                // Save products more frequently (every 100 instead of 200)
                if (products.length >= 100) {
                    const toSave = products.splice(0, 100);
                    const { inserted, updated } = await this.saveProducts(toSave);
                    totalSaved += inserted + updated;

                    // === AUTO-SKIP LOGIC ===
                    if (inserted === 0 && updated > 0) {
                        consecutiveNoNewProducts++;
                        logger.info(`[CellphoneS] ⚠️ Page ${page}: No new products (${updated} updated). Consecutive: ${consecutiveNoNewProducts}/3`);

                        if (consecutiveNoNewProducts >= 3) {
                            logger.info(`[CellphoneS] ⏭️ AUTO-SKIP: 3 consecutive pages with no new products. Moving to next category.`);
                            break;
                        }
                    } else if (inserted > 0) {
                        consecutiveNoNewProducts = 0; // Reset counter when new products found
                    }
                    // === END AUTO-SKIP ===
                }

                await this.sleep(1500 + Math.random() * 500);
            } catch (error: any) {
                // If 404, it means no more pages
                if (error?.response?.status === 404) {
                    logger.info(`[CellphoneS] No more pages for category "${category}" (Received 404 at page ${page})`);
                    break;
                }

                logger.error(`[CellphoneS] Error at page ${page}:`, error.message || error);
                errorCount++;
                consecutiveErrors++;

                if (consecutiveErrors >= 3) {
                    logger.error('[CellphoneS] Too many consecutive errors, stopping crawl');
                    break;
                }

                await this.sleep(3000);
            }
        }

        const { inserted } = await this.saveProducts(products);

        await this.updateCrawlLog(logId, {
            total: inserted + products.length,
            newItems: inserted,
            updated: 0,
            errors: errorCount,
        });

        logger.info(`[CellphoneS] Crawl completed: ${inserted} products saved, ${errorCount} errors`);

        return products;
    }

    /**
     * Mass crawl across all CellphoneS categories
     */
    async massCrawl(maxPagesPerCategory: number = 10): Promise<CrawledProduct[]> {
        await this.initialize();

        const allProducts: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let totalErrors = 0;

        logger.info(`[CellphoneS] Starting MASS CRAWL across ${CELLPHONES_CATEGORIES.length} categories`);

        for (const cat of CELLPHONES_CATEGORIES) {
            if (this.shouldStop) {
                logger.info('[CellphoneS] 🛑 Mass crawl stopped by user');
                break;
            }

            logger.info(`[CellphoneS] Crawling category: ${cat.name}`);

            try {
                const products = await this.crawl({ category: cat.slug, maxPages: maxPagesPerCategory });
                allProducts.push(...products);
                await this.sleep(2000 + Math.random() * 1000);
            } catch (error) {
                logger.error(`[CellphoneS] Failed category ${cat.name}:`, error);
                totalErrors++;
            }
        }

        await this.updateCrawlLog(logId, {
            total: allProducts.length,
            newItems: allProducts.length,
            updated: 0,
            errors: totalErrors,
        });

        logger.info(`[CellphoneS] Mass crawl completed: ${allProducts.length} total products`);
        return allProducts;
    }

    async crawlCategory(categorySlug: string, maxPages = 30): Promise<CrawledProduct[]> {
        return this.crawl({ category: categorySlug, maxPages });
    }

    private parseListingPage(html: string): CrawledProduct[] {
        const products: CrawledProduct[] = [];
        const $ = cheerio.load(html);

        // CellphoneS product listing structure - try multiple selectors
        const selectors = [
            '.product-item',
            '.product-info',
            '.cps-product-item',
            '.product__item',
            '[data-product-id]',
        ];

        for (const selector of selectors) {
            $(selector).each((_, element) => {
                try {
                    const $el = $(element);

                    // Extract product ID from data attribute or link
                    const productLink = $el.find('a[href*=".html"]').first().attr('href') || '';
                    const externalId = this.extractProductId(productLink) || $el.attr('data-product-id');

                    if (!externalId) return;

                    // Product name - try multiple selectors
                    const name = $el.find('.product-name, .product__name, h3 a, .product-info__name').text().trim();
                    if (!name) return;

                    // Price
                    const priceText = $el.find('.product-price, .product__price--show, .price-new, .product-info__price').text();
                    const price = this.parsePrice(priceText);
                    if (!price) return;

                    // Original price
                    const originalPriceText = $el.find('.product-price__old, .price-old, del, .product-info__price-old').text();
                    const originalPrice = this.parsePrice(originalPriceText);

                    // Discount
                    const discountText = $el.find('.product-discount, .percent, .tag-sale, .product-info__percent').text();
                    const discountPercent = parseInt(discountText.replace(/[^\d]/g, '')) || undefined;

                    // Image
                    const imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');

                    // Rating
                    const ratingText = $el.find('.rating-star, .star-rating, .product-info__rating').attr('style')
                        || $el.find('[data-rating]').attr('data-rating') || '';
                    const rating = this.parseRating(ratingText);

                    // Review count
                    const reviewText = $el.find('.product-review, .count-rating').text();
                    const reviewCount = parseInt(reviewText.replace(/[^\d]/g, '')) || 0;

                    // Stock status
                    const outOfStock = $el.find('.out-stock, .het-hang, .btn-soldout').length > 0;

                    products.push({
                        externalId,
                        externalUrl: productLink.startsWith('http') ? productLink : `${this.baseUrl}${productLink}`,
                        name,
                        price: price,
                        originalPrice: originalPrice > price ? originalPrice : undefined,
                        discountPercent,
                        imageUrl: this.normalizeImageUrl(imageUrl),
                        rating,
                        reviewCount,
                        available: !outOfStock,
                        metadata: {
                            source: 'cellphones',
                        },
                    });
                } catch (error) {
                    logger.debug('[CellphoneS] Failed to parse product element:', error);
                }
            });

            // If we found products with this selector, stop trying others
            if (products.length > 0) break;
        }

        return products;
    }

    private normalizeImageUrl(url?: string): string | undefined {
        if (!url) return undefined;
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('/')) return `${this.baseUrl}${url}`;
        return url;
    }

    private extractProductId(url: string): string | null {
        // Extract ID from URL like /iphone-15-pro-max.html
        const match = url.match(/\/([^/]+)\.html/);
        if (match) {
            return match[1].replace(/-/g, '_');
        }
        return null;
    }

    private parsePrice(priceStr: string): number {
        if (!priceStr) return 0;
        // "15.990.000₫" -> 15990000
        const cleaned = priceStr.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    }

    private parseRating(ratingStr: string): number | undefined {
        // "width: 80%" -> 4.0 (out of 5)
        const widthMatch = ratingStr.match(/width:\s*(\d+)%/);
        if (widthMatch) {
            return (parseInt(widthMatch[1]) / 100) * 5;
        }
        // Direct number
        const num = parseFloat(ratingStr);
        if (!isNaN(num) && num <= 5) {
            return num;
        }
        return undefined;
    }
}
