import * as cheerio from 'cheerio';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct } from './base';
import { KeywordService } from './keywordService';
import { CategoryService } from './categoryService';
import logger from '@/lib/utils/logger';

// CellphoneS category URLs for mass crawling
const CELLPHONES_CATEGORIES = [
    { slug: 'mobile', name: 'Điện thoại' },
    { slug: 'mobile/apple', name: 'iPhone' },
    { slug: 'mobile/samsung', name: 'Samsung' },
    { slug: 'mobile/xiaomi', name: 'Xiaomi' },
    { slug: 'mobile/oppo', name: 'Oppo' },
    { slug: 'mobile/vivo', name: 'Vivo' },
    { slug: 'mobile/realme', name: 'Realme' },
    { slug: 'laptop', name: 'Laptop' },
    { slug: 'laptop/mac', name: 'MacBook' },
    { slug: 'laptop/asus', name: 'Laptop Asus' },
    { slug: 'laptop/lenovo', name: 'Laptop Lenovo' },
    { slug: 'laptop/dell', name: 'Laptop Dell' },
    { slug: 'laptop/hp', name: 'Laptop HP' },
    { slug: 'laptop/acer', name: 'Laptop Acer' },
    { slug: 'laptop/msi', name: 'Laptop MSI' },
    { slug: 'tablet', name: 'Máy tính bảng' },
    { slug: 'tablet/ipad', name: 'iPad' },
    { slug: 'tablet/samsung', name: 'Samsung Tablet' },
    { slug: 'do-choi-cong-nghe/dong-ho-thong-minh/apple-watch', name: 'Apple Watch' },
    { slug: 'do-choi-cong-nghe/dong-ho-thong-minh', name: 'Đồng hồ thông minh' },
    { slug: 'do-choi-cong-nghe/dong-ho-thong-minh/samsung', name: 'Samsung Watch' },
    { slug: 'thiet-bi-am-thanh/tai-nghe', name: 'Tai nghe' },
    { slug: 'thiet-bi-am-thanh/tai-nghe/apple', name: 'AirPods' },
    { slug: 'thiet-bi-am-thanh/loa', name: 'Loa' },
    { slug: 'thiet-bi-am-thanh/loa/jbl', name: 'Loa JBL' },
    { slug: 'phu-kien', name: 'Phụ kiện' },
    { slug: 'phu-kien/sac-du-phong', name: 'Sạc dự phòng' },
];

// Popular search keywords are now fetched from database via KeywordService
// See crawl_keywords table for centralized keyword management

export class CellphonesPuppeteerCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://cellphones.com.vn';

    constructor() {
        super('cellphones');
    }

    /**
     * Main crawl method - by category or keyword
     */
    async crawl(options: PuppeteerCrawlOptions = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const category = options.categorySlug || 'mobile';
        const keyword = options.keyword;
        const maxPages = options.maxPages || 50; // Increased from 30 to 50
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let consecutiveErrors = 0;
        let totalSaved = 0;

        const isKeywordSearch = !!keyword;
        const searchTerm = isKeywordSearch ? keyword : category;

        logger.info(`[CellphoneS-Puppeteer] Starting crawl for ${isKeywordSearch ? 'keyword' : 'category'}: "${searchTerm}", max pages: ${maxPages}`);

        try {
            const page = await this.getPage();

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                if (this.shouldStop) break;

                try {
                    // Construct URL
                    let url: string;
                    if (isKeywordSearch) {
                        url = `${this.baseUrl}/catalogsearch/result?q=${encodeURIComponent(keyword)}${pageNum > 1 ? `&p=${pageNum}` : ''}`;
                    } else {
                        url = `${this.baseUrl}/${category}.html${pageNum > 1 ? `?p=${pageNum}` : ''}`;
                    }

                    logger.info(`[CellphoneS-Puppeteer] 📄 Loading: ${url}`);

                    const success = await this.navigateWithRetry(page, url);
                    if (!success) {
                        throw new Error('Navigation failed');
                    }

                    // Scroll to load lazy images
                    await this.scrollPage(page, 5);

                    // Get HTML content
                    const html = await page.content();
                    const items = this.parseListingPage(html);

                    consecutiveErrors = 0;

                    if (!items.length) {
                        logger.info(`[CellphoneS-Puppeteer] No more results at page ${pageNum}`);
                        break;
                    }

                    // Deduplicate items from this page
                    const uniqueItems = items.filter((item, index, self) =>
                        index === self.findIndex((t) => t.externalId === item.externalId)
                    );

                    products.push(...uniqueItems);

                    logger.info(`[CellphoneS-Puppeteer] Page ${pageNum}: Found ${items.length} items (${uniqueItems.length} unique), total buffered: ${products.length}`);

                    // Update Session count in UI
                    await this.updateCrawlLog(logId, {
                        total: totalSaved + products.length,
                        newItems: totalSaved,
                        updated: 0,
                        errors: errorCount,
                    }, false);

                    // Save batch every 100 products
                    if (products.length >= 100) {
                        const uniqueToSave = products.filter((item, index, self) =>
                            index === self.findIndex((t) => t.externalId === item.externalId)
                        );

                        const toSave = uniqueToSave.slice(0, 100);
                        // Clear the buffer and keep only items that weren't in this batch
                        products.splice(0, products.length, ...uniqueToSave.slice(100));

                        const { inserted } = await this.saveProducts(toSave);
                        totalSaved += inserted;
                    }

                    await this.sleep(2000 + Math.random() * 1000);
                } catch (error) {
                    logger.error(`[CellphoneS-Puppeteer] Error at page ${pageNum}:`, error);
                    errorCount++;
                    consecutiveErrors++;

                    if (consecutiveErrors >= 3) {
                        logger.error('[CellphoneS-Puppeteer] Too many consecutive errors, stopping crawl');
                        break;
                    }
                }
            }

            // Save remaining
            const finalUnique = products.filter((item, index, self) =>
                index === self.findIndex((t) => t.externalId === item.externalId)
            );
            const { inserted } = await this.saveProducts(finalUnique);
            totalSaved += inserted;

            await this.updateCrawlLog(logId, {
                total: totalSaved,
                newItems: totalSaved,
                updated: 0,
                errors: errorCount,
            });

            logger.info(`[CellphoneS-Puppeteer] Crawl completed. Total saved: ${totalSaved}. Errors: ${errorCount}`);

        } finally {
            await this.releaseBrowser();
        }
        return products;
    }

    /**
     * Crawl a specific category - Implementation of abstract method from BaseCrawler
     */
    async crawlCategory(categorySlug: string, maxPages: number = 20): Promise<CrawledProduct[]> {
        return this.crawl({ categorySlug, maxPages });
    }

    /**
     * Mass crawl across all categories AND keywords
     */
    async massCrawl(options: { pagesPerCategory?: number; pagesPerKeyword?: number } = {}): Promise<CrawledProduct[]> {
        await this.initialize();
        const maxPagesCategory = options.pagesPerCategory || 50;
        const maxPagesKeyword = options.pagesPerKeyword || 20;

        const allProducts: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let totalErrors = 0;

        // Fetch categories from database instead of hardcoded array
        // Fetch categories from database with 24h freshness check
        const dbCategories = await CategoryService.getCategories(this.sourceId, 24);
        const categories = dbCategories.length > 0
            ? dbCategories.map(cat => ({
                slug: CategoryService.getSourceSlug(cat, 'cellphones'),
                name: cat.name
            }))
            : CELLPHONES_CATEGORIES;

        // Fetch keywords from database (ONLY older than 24h)
        const keywords = await KeywordService.getKeywordStrings('cellphones', undefined, 24);

        logger.info(`[CellphoneS-Puppeteer] Starting MASS CRAWL: ${categories.length} categories + ${keywords.length} keywords (Source: Database)`);

        // Phase 1: Crawl by categories
        for (const cat of categories) {
            if (this.shouldStop) {
                logger.info('[CellphoneS-Puppeteer] 🛑 Mass crawl stopped by user');
                break;
            }

            logger.info(`[CellphoneS-Puppeteer] Crawling category: ${cat.name}`);

            try {
                const products = await this.crawl({ categorySlug: cat.slug, maxPages: maxPagesCategory });
                allProducts.push(...products);
                await this.sleep(5000); // Longer delay between categories
            } catch (error) {
                logger.error(`[CellphoneS-Puppeteer] Failed category ${cat.name}:`, error);
                totalErrors++;
            }
        }

        // Phase 2: Crawl by keywords (from database)
        for (const keyword of keywords) {
            if (this.shouldStop) {
                logger.info('[CellphoneS-Puppeteer] 🛑 Mass crawl stopped by user');
                break;
            }

            logger.info(`[CellphoneS-Puppeteer] Crawling keyword: ${keyword}`);

            try {
                const products = await this.crawl({ keyword, maxPages: maxPagesKeyword });
                allProducts.push(...products);
                await this.sleep(3000);
            } catch (error) {
                logger.error(`[CellphoneS-Puppeteer] Failed keyword "${keyword}":`, error);
                totalErrors++;
            }
        }

        await this.updateCrawlLog(logId, {
            total: allProducts.length,
            newItems: allProducts.length,
            updated: 0,
            errors: totalErrors,
        });

        logger.info(`[CellphoneS-Puppeteer] Mass crawl completed: ${allProducts.length} total products`);
        return allProducts;
    }

    private parseListingPage(html: string): CrawledProduct[] {
        const products: CrawledProduct[] = [];
        const $ = cheerio.load(html);

        // CellphoneS product listing structure - try multiple selectors
        const selectors = [
            'div.product-item',
            'div.item-product',
            'div.cps-product-item',
            'div.product-info-container',
            'div[data-product-id]',
            'li.product-item',
            'div.product__item'
        ];

        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                logger.info(`[CellphoneS-Puppeteer] Found ${elements.length} items using selector: ${selector}`);

                elements.each((_, element) => {
                    try {
                        const $el = $(element);

                        // Extract product link and ID
                        const productLink = $el.find('a[href*=".html"]').first().attr('href') || '';
                        const externalId = this.extractProductId(productLink) || $el.attr('data-product-id');

                        if (!externalId) return;

                        // Product name
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
                        let imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');

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
                            price,
                            originalPrice: originalPrice > price ? originalPrice : undefined,
                            discountPercent,
                            imageUrl: this.normalizeImageUrl(imageUrl),
                            rating,
                            reviewCount,
                            available: !outOfStock,
                            metadata: { source: 'cellphones' },
                        });
                    } catch (error) {
                        logger.debug('[CellphoneS-Puppeteer] Failed to parse product element:', error);
                    }
                });

                if (products.length > 0) break;
            }
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
