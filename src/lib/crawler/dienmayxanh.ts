import * as cheerio from 'cheerio';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct } from './base';
import { KeywordService } from './keywordService';
import { CategoryService } from './categoryService';
import logger from '@/lib/utils/logger';

// DienmayXanh category URLs for mass crawling
const DMX_CATEGORIES = [
    { slug: 'dien-thoai', name: 'Điện thoại' },
    { slug: 'dien-thoai-apple-iphone', name: 'iPhone' },
    { slug: 'dien-thoai-samsung', name: 'Samsung' },
    { slug: 'dien-thoai-xiaomi', name: 'Xiaomi' },
    { slug: 'dien-thoai-oppo', name: 'Oppo' },
    { slug: 'laptop', name: 'Laptop' },
    { slug: 'laptop-asus', name: 'Laptop Asus' },
    { slug: 'laptop-dell', name: 'Laptop Dell' },
    { slug: 'laptop-hp', name: 'Laptop HP' },
    { slug: 'laptop-lenovo', name: 'Laptop Lenovo' },
    { slug: 'laptop-acer', name: 'Laptop Acer' },
    { slug: 'may-tinh-bang', name: 'Máy tính bảng' },
    { slug: 'may-tinh-bang-ipad', name: 'iPad' },
    { slug: 'tivi', name: 'Tivi' },
    { slug: 'tivi-samsung', name: 'Tivi Samsung' },
    { slug: 'tivi-sony', name: 'Tivi Sony' },
    { slug: 'tivi-lg', name: 'Tivi LG' },
    { slug: 'tivi-tcl', name: 'Tivi TCL' },
    { slug: 'may-lanh', name: 'Máy lạnh' },
    { slug: 'may-lanh-daikin', name: 'Máy lạnh Daikin' },
    { slug: 'may-lanh-lg', name: 'Máy lạnh LG' },
    { slug: 'tu-lanh', name: 'Tủ lạnh' },
    { slug: 'tu-lanh-samsung', name: 'Tủ lạnh Samsung' },
    { slug: 'tu-lanh-lg', name: 'Tủ lạnh LG' },
    { slug: 'may-giat', name: 'Máy giặt' },
    { slug: 'may-giat-lg', name: 'Máy giặt LG' },
    { slug: 'may-giat-electrolux', name: 'Máy giặt Electrolux' },
    { slug: 'may-loc-nuoc', name: 'Máy lọc nước' },
    { slug: 'noi-com-dien', name: 'Nồi cơm điện' },
    { slug: 'noi-chien-khong-dau', name: 'Nồi chiên không dầu' },
    { slug: 'may-hut-bui', name: 'Máy hút bụi' },
    { slug: 'tai-nghe', name: 'Tai nghe' },
    { slug: 'loa-laptop', name: 'Loa' },
    { slug: 'dong-ho-thong-minh', name: 'Đồng hồ thông minh' },
    { slug: 'bep-tu', name: 'Bếp từ' },
    { slug: 'lo-vi-song', name: 'Lò vi sóng' },
    { slug: 'binh-nuoc-nong', name: 'Bình nước nóng' },
];

// Popular search keywords are now fetched from database via KeywordService
// See crawl_keywords table for centralized keyword management

export class DienmayxanhCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://www.dienmayxanh.com';

    constructor() {
        super('dienmayxanh');
    }

    /**
     * Main crawl method
     */
    async crawl(options: PuppeteerCrawlOptions = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const category = options.categorySlug || options.category || 'dien-thoai';
        const keyword = options.keyword || options.query;
        const maxPages = options.maxPages || 50; // Increased from 30 to 50
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let consecutiveErrors = 0;
        let totalSaved = 0;
        let consecutiveNoNewProducts = 0; // Auto-skip counter

        const isKeywordSearch = !!keyword;
        const searchTerm = isKeywordSearch ? keyword : category;

        logger.info(`[DienmayXanh] Starting crawl for ${isKeywordSearch ? 'keyword' : 'category'}: "${searchTerm}", max pages: ${maxPages}`);

        try {
            const page = await this.getPage();

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                if (this.shouldStop) break;

                try {
                    // Construct URL - support both category and search
                    let navUrl: string;
                    if (isKeywordSearch) {
                        navUrl = `${this.baseUrl}/tim-kiem?key=${encodeURIComponent(keyword)}${pageNum > 1 ? `&p=${pageNum}` : ''}`;
                    } else {
                        navUrl = `${this.baseUrl}/${category}${pageNum > 1 ? `?p=${pageNum}` : ''}`;
                    }

                    logger.info(`[DienmayXanh] 📄 Loading: ${navUrl}`);

                    const success = await this.navigateWithRetry(page, navUrl);
                    if (!success) {
                        throw new Error('Navigation failed');
                    }

                    // Scroll to load lazy images and products
                    await this.scrollPage(page, 5);

                    // Get HTML content
                    const html = await page.content();
                    const items = this.parseListingPage(html);

                    consecutiveErrors = 0;

                    if (!items.length) {
                        logger.info(`[DienmayXanh] No more results at page ${pageNum}`);
                        break;
                    }

                    // Deduplicate items from this page
                    const uniqueItems = items.filter((item, index, self) =>
                        index === self.findIndex((t) => t.externalId === item.externalId)
                    );

                    products.push(...uniqueItems);

                    logger.info(`[DienmayXanh] Page ${pageNum}: Found ${items.length} items (${uniqueItems.length} unique), total buffered: ${products.length}`);

                    // Update Session count in UI immediately after each page
                    await this.updateCrawlLog(logId, {
                        total: totalSaved + products.length,
                        newItems: totalSaved,
                        updated: 0,
                        errors: errorCount,
                    }, false);

                    // Save batch (every 100)
                    if (products.length >= 100) {
                        // Final deduplication before save to be 100% sure
                        const uniqueToSave = products.filter((item, index, self) =>
                            index === self.findIndex((t) => t.externalId === item.externalId)
                        );

                        const toSave = uniqueToSave.slice(0, 100);
                        // Clear the buffer and keep only items that weren't in this batch
                        products.splice(0, products.length, ...uniqueToSave.slice(100));

                        const { inserted, updated } = await this.saveProducts(toSave);
                        totalSaved += inserted + updated;

                        // === AUTO-SKIP LOGIC ===
                        if (inserted === 0 && updated > 0) {
                            consecutiveNoNewProducts++;
                            logger.info(`[DienmayXanh] ⚠️ Page ${pageNum}: No new products (${updated} updated). Consecutive: ${consecutiveNoNewProducts}/3`);

                            if (consecutiveNoNewProducts >= 3) {
                                logger.info(`[DienmayXanh] ⏭️ AUTO-SKIP: 3 consecutive pages with no new products. Moving to next category.`);
                                break;
                            }
                        } else if (inserted > 0) {
                            consecutiveNoNewProducts = 0; // Reset counter when new products found
                        }
                        // === END AUTO-SKIP ===
                    }

                    await this.sleep(2000);
                } catch (error) {
                    logger.error(`[DienmayXanh] Error at page ${pageNum}:`, error);
                    errorCount++;
                    consecutiveErrors++;

                    if (consecutiveErrors >= 3) {
                        logger.error('[DienmayXanh] Too many consecutive errors, stopping crawl');
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

            logger.info(`[DienmayXanh] Crawl completed. Total saved: ${totalSaved}. Errors: ${errorCount}`);
        } finally {
            await this.releaseBrowser();
        }
        return products; // Note: this array might be empty if we spliced everything.
    }

    /**
     * Mass crawl across all DienmayXanh categories
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
                slug: CategoryService.getSourceSlug(cat, 'dienmayxanh'),
                name: cat.name
            }))
            : DMX_CATEGORIES;

        // Fetch keywords from database (ONLY older than 24h)
        const keywords = await KeywordService.getKeywordStrings('dienmayxanh', undefined, 24);

        logger.info(`[DienmayXanh] Starting MASS CRAWL: ${categories.length} categories + ${keywords.length} keywords (Source: Database)`);

        for (const cat of categories) {
            if (this.shouldStop) {
                logger.info('[DienmayXanh] 🛑 Mass crawl stopped by user');
                break;
            }

            logger.info(`[DienmayXanh] Crawling category: ${cat.name}`);

            try {
                const products = await this.crawl({ categorySlug: cat.slug, maxPages: maxPagesCategory });
                allProducts.push(...products);
                await this.sleep(5000);
            } catch (error) {
                logger.error(`[DienmayXanh] Failed category ${cat.name}:`, error);
                totalErrors++;
            }
        }

        // Phase 2: Crawl by keywords (from database)
        for (const keyword of keywords) {
            if (this.shouldStop) {
                logger.info('[DienmayXanh] 🛑 Mass crawl stopped by user');
                break;
            }

            logger.info(`[DienmayXanh] Crawling keyword: ${keyword}`);

            try {
                const products = await this.crawl({ keyword, maxPages: maxPagesKeyword });
                allProducts.push(...products);
                await this.sleep(3000);
            } catch (error) {
                logger.error(`[DienmayXanh] Failed keyword "${keyword}":`, error);
                totalErrors++;
            }
        }

        await this.updateCrawlLog(logId, {
            total: allProducts.length,
            newItems: allProducts.length,
            updated: 0,
            errors: totalErrors,
        });

        logger.info(`[DienmayXanh] Mass crawl completed: ${allProducts.length} total products`);
        return allProducts;
    }

    private parseListingPage(html: string): CrawledProduct[] {
        const products: CrawledProduct[] = [];
        const $ = cheerio.load(html);
        const title = $('title').text();

        // Check for empty or anti-bot content
        if (!title.includes("Điện máy XANH") && !title.includes("Thegioididong")) {
            // Just warn, don't fail immediately, maybe selectors still work
            logger.warn(`[DienmayXanh] Title mismatch: "${title}"`);
        }

        // DienmayXanh product listing structure - try multiple selectors
        const selectors = [
            '.listproduct > li',
            '.listproduct li.item',
            'li.item',
            '.productItem',
            '.product-item',
            'div.item',
            '[data-id]',
            'ul.listproduct li',
        ];

        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                logger.info(`[DienmayXanh] Found ${elements.length} items using selector: ${selector}`);

                elements.each((_, element) => {
                    try {
                        const $el = $(element);

                        // Extract product link and ID
                        const productLink = $el.find('a[href]').first().attr('href') || '';
                        let externalId = $el.attr('data-id') || $el.attr('data-product-id');

                        if (!externalId && productLink) {
                            externalId = this.extractProductId(productLink) || undefined;
                        }

                        if (!externalId) return;

                        // Product name
                        const name = $el.find('h3, .name, .item-name, .product-name').first().text().trim();
                        if (!name) return;

                        // Price
                        const priceText = $el.find('.price strong, .item-price, .box-price strong, .price-new, .price, .item-price strong').first().text();
                        const price = this.parsePrice(priceText);

                        if (!price) {
                            // Sometimes price is not shown or is "Liên hệ"
                            return;
                        }

                        // Original price
                        const originalPriceText = $el.find('.price-old, del, .item-oldprice').text();
                        const originalPrice = this.parsePrice(originalPriceText);

                        // Discount
                        const discountText = $el.find('.percent, .discount, .item-sale, .price-percent').text();
                        const discountPercent = parseInt(discountText.replace(/[^\d]/g, '')) || undefined;

                        // Image
                        let imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');
                        if (imageUrl && !imageUrl.startsWith('http')) {
                            // Handle lazy loaded placeholders or weird src
                        }

                        // Rating
                        const ratingAttr = $el.find('.item-rating, .rating, [data-rating]').attr('data-rating') || '';
                        const rating = parseFloat(ratingAttr) || undefined;

                        // Review/Rating count
                        const reviewText = $el.find('.result-rating, .item-review, .rating-count').text();
                        const reviewCount = parseInt(reviewText.replace(/[^\d]/g, '')) || 0;

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
                            available: true,
                            metadata: { source: 'dienmayxanh' },
                        });
                    } catch (error) {
                        logger.debug('[DienmayXanh] Failed to parse product element:', error);
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

    private extractProductId(url: string): string | undefined {
        // Extract ID from URL
        const match = url.match(/\/([^/]+)$/);
        if (match) {
            const slug = match[1];
            // ID is often at the end like slug-12345
            const idMatch = slug.match(/-(\d+)$/);
            if (idMatch) return idMatch[1];
            return slug.replace(/\.[a-z]+$/, '');
        }
        return undefined;
    }

    private parsePrice(priceStr: string): number {
        if (!priceStr) return 0;
        const cleaned = priceStr.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    }

    async crawlCategory(categorySlug: string, maxPages = 50): Promise<CrawledProduct[]> {
        return this.crawl({ categorySlug, maxPages });
    }
}
