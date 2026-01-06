/**
 * Lazada Crawler - Puppeteer Version for Anti-Bot Bypass
 * Uses browser automation for lazy-loading pages
 */

import { Page } from 'puppeteer';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct } from './base';
import { KeywordService } from './keywordService';
import { CategoryService } from './categoryService';
import logger from '../utils/logger';

interface LazadaProduct {
    itemId: string;
    productUrl?: string;
    name?: string;
    title?: string;
    price: string;
    originalPrice?: string;
    discount?: string;
    ratingScore?: number;
    review?: number;
    sold?: number;
    image: string;
    brandName?: string;
    location?: string;
    sellerName?: string;
    itemSoldCntShow?: string;
}

// Lazada categories for mass crawl targeting 3k/day
const LAZADA_CATEGORIES = [
    { slug: 'dien-thoai-di-dong', name: 'Điện thoại' },
    { slug: 'may-tinh-bang', name: 'Máy tính bảng' },
    { slug: 'laptop', name: 'Laptop' },
    { slug: 'may-tinh-de-ban', name: 'Máy tính để bàn' },
    { slug: 'linh-kien-may-tinh', name: 'Linh kiện máy tính' },
    { slug: 'tivi', name: 'Tivi' },
    { slug: 'thiet-bi-am-thanh', name: 'Thiết bị âm thanh' },
    { slug: 'do-gia-dung-dien-tu', name: 'Đồ gia dụng điện tử' },
    { slug: 'phu-kien-dien-thoai', name: 'Phụ kiện điện thoại' },
    { slug: 'may-anh-may-quay-phim', name: 'Máy ảnh' },
    { slug: 'thiet-bi-deo-thong-minh', name: 'Đồng hồ thông minh' },
    { slug: 'tu-lanh', name: 'Tủ lạnh' },
    { slug: 'may-giat', name: 'Máy giặt' },
    { slug: 'dieu-hoa', name: 'Điều hòa' },
    { slug: 'may-loc-khong-khi', name: 'Máy lọc không khí' },
    { slug: 'may-loc-nuoc', name: 'Máy lọc nước' },
];

const LAZADA_KEYWORDS = [
    'iphone', 'samsung', 'macbook', 'laptop gaming',
    'airpods', 'apple watch', 'xiaomi', 'robot hút bụi',
    'nồi chiên không dầu', 'tivi samsung',
];

export class LazadaCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://www.lazada.vn';

    private cookies?: string;

    constructor(options?: { cookie?: string }) {
        super('lazada');
        this.cookies = options?.cookie;
    }

    /**
     * Extract products from page DOM
     */
    private async extractProductsFromPage(page: Page): Promise<LazadaProduct[]> {
        return page.evaluate(() => {
            const products: LazadaProduct[] = [];

            // Lazada uses various selectors for product cards
            const selectors = [
                '[data-qa-locator="product-item"]',
                '.Bm3ON',
                '.qmXQo',
                '[data-tracking="product-card"]',
                '.buTCk',
                // New selectors
                'div[data-item-id]',
                '.c2prKC', // Common container class
                '.c3KeDq', // Common item class
                'div[data-test-name="product-card"]',
                'div.box-content'
            ];

            for (const selector of selectors) {
                const items = document.querySelectorAll(selector);
                if (items.length > 0) {
                    items.forEach((el) => {
                        try {
                            // Extract link and ID
                            const link = el.querySelector('a[href*="/products/"]') as HTMLAnchorElement;
                            const href = link?.getAttribute('href') || '';
                            const itemIdMatch = href.match(/i(\d+)(?:-s|\.html|\?|$)/);
                            const itemId = itemIdMatch?.[1] || '';

                            if (!itemId) return;

                            // Name
                            const nameEl = el.querySelector('[class*="Title"], .RfADt, .title-wrapper, h2, h3');
                            const name = nameEl?.textContent?.trim() || '';

                            // Price
                            const priceEl = el.querySelector('[class*="Price"], .ooOxS, .price, span[class*="currency"]');
                            const price = priceEl?.textContent?.trim() || '0';

                            // Original price
                            const origPriceEl = el.querySelector('[class*="OriginalPrice"], .WNoq3, del, .origin-price');
                            const originalPrice = origPriceEl?.textContent?.trim();

                            // Discount
                            const discountEl = el.querySelector('[class*="Discount"], .IcOsH, .discount');
                            const discount = discountEl?.textContent?.trim();

                            // Rating
                            const ratingEl = el.querySelector('[class*="rating"], .XMY10');
                            const ratingScore = parseFloat(ratingEl?.textContent || '0');

                            // Image - Robust extraction checking multiple attributes
                            const imgEl = el.querySelector('img') as HTMLImageElement;
                            let image = '';

                            if (imgEl) {
                                // Priority list of attributes to find the real image URL
                                const attrs = ['data-src', 'data-original', 'data-ks-lazyload', 'data-image', 'src'];
                                for (const attr of attrs) {
                                    const val = imgEl.getAttribute(attr) || (imgEl.dataset && imgEl.dataset[attr.replace('data-', '')]);
                                    if (val && typeof val === 'string' && !val.startsWith('data:') && !val.includes('placeholder') && !val.includes('.gif')) {
                                        image = val;
                                        break;
                                    }
                                }
                            }

                            // Sold count
                            const soldEl = el.querySelector('[class*="sold"], .RjABF');
                            const itemSoldCntShow = soldEl?.textContent?.trim();

                            if (name && itemId) {
                                products.push({
                                    itemId,
                                    productUrl: href,
                                    name,
                                    price,
                                    originalPrice,
                                    discount,
                                    ratingScore,
                                    image,
                                    itemSoldCntShow,
                                });
                            }
                        } catch {
                            // Skip item
                        }
                    });
                    break; // Stop after finding products with one selector
                }
            }

            return products;
        });
    }

    /**
     * Parse product to CrawledProduct
     */
    private parseProduct(item: LazadaProduct): CrawledProduct | null {
        try {
            if (!item?.itemId || !item?.price) return null;

            const price = this.parsePrice(item.price);
            const originalPrice = item.originalPrice
                ? this.parsePrice(item.originalPrice)
                : undefined;
            const discountPercent = item.discount
                ? parseInt(item.discount.replace(/[^\d]/g, ''))
                : undefined;

            return {
                externalId: item.itemId,
                externalUrl: item.productUrl?.startsWith('http')
                    ? item.productUrl
                    : item.productUrl?.startsWith('//')
                        ? `https:${item.productUrl}`
                        : `${this.baseUrl}${item.productUrl}`,
                name: item.name || item.title || '',
                price: price,
                originalPrice: originalPrice,
                discountPercent: discountPercent,
                brand: item.brandName,
                imageUrl: item.image,
                rating: item.ratingScore,
                reviewCount: item.review || 0,
                soldCount: item.sold || this.parseSoldCount(item.itemSoldCntShow),
                available: true,
                metadata: {
                    location: item.location,
                    sellerName: item.sellerName,
                },
            };
        } catch {
            return null;
        }
    }

    private parsePrice(priceStr: string): number {
        const cleaned = priceStr.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    }

    private parseSoldCount(soldStr?: string): number {
        if (!soldStr) return 0;
        const match = soldStr.match(/([\d.,]+)\s*(k|K)?/);
        if (match) {
            let num = parseFloat(match[1].replace(',', '.'));
            if (match[2]) num *= 1000;
            return Math.round(num);
        }
        return 0;
    }

    /**
     * Crawl a category page with lazy loading
     */
    private async crawlCategoryPage(
        page: Page,
        url: string
    ): Promise<CrawledProduct[]> {
        const products: CrawledProduct[] = [];

        logger.info(`[Lazada] 📄 Navigating to: ${url}`);

        // Use a more robust navigation strategy
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // CRITICAL: Scroll down to trigger lazy loading of images
            await this.scrollPage(page, 5); // Scroll 5 times
        } catch (e) {
            logger.error(`[Lazada] ❌ Navigation timeout/error: ${url}`);
            return products;
        }

        // Check for captcha/challenge title immediately
        const title = await page.title();
        if (title.includes("Security Challenge") || title.includes("验证") || title.includes("Access Denied")) {
            logger.error(`[Lazada] ❌ BLOCKED: ${title}`);
            return products;
        }

        // Wait for product cards OR empty state OR captcha
        try {
            await page.waitForSelector('[data-qa-locator="product-item"], .Bm3ON, .qmXQo, body', { timeout: 10000 });
        } catch (e) {
            // Timeout waiting for selector
        }

        // Scroll to trigger lazy loading
        await this.scrollPage(page, 4);
        await this.waitForNetworkIdle(page, 2000);

        // Extract products
        const items = await this.extractProductsFromPage(page);

        // Extraction logic
        if (items.length > 0) {
            logger.info(`[Lazada] 🎯 Page captured: ${items.length} items from ${url}`);
        } else {
            logger.warn(`[Lazada] ⚠️ No items found on page: ${url} (Title: ${title})`);

            // Log body text for debugging to see what's actually there
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500).replace(/\n/g, ' '));
            logger.debug(`[Lazada] Body snippet: ${bodyText}`);
        }

        for (const item of items) {
            const product = this.parseProduct(item);
            if (product) {
                products.push(product);
            }
        }

        return products;
    }

    private async injectCookies(page: Page): Promise<void> {
        let cookieObjects: any[] = [];

        // 1. Try options (Support both semicolon string and Netscape format)
        if (this.cookies) {
            try {
                if (this.cookies.includes('\t') || this.cookies.includes('# Netscape')) {
                    // Handle Netscape format
                    const lines = this.cookies.split('\n');
                    for (const line of lines) {
                        if (!line.trim() || line.startsWith('#')) continue;
                        const parts = line.split('\t');
                        if (parts.length >= 7) {
                            cookieObjects.push({
                                name: parts[5].trim(),
                                value: parts[6].trim(),
                                domain: parts[0].trim(),
                                path: parts[2].trim(),
                                secure: parts[3] === 'TRUE',
                            });
                        }
                    }
                    logger.info(`[Lazada] 🍪 Parsed ${cookieObjects.length} cookies from Netscape format`);
                } else {
                    // Handle standard name=value; format
                    cookieObjects = this.cookies.split(';').map(pair => {
                        const parts = pair.split('=');
                        const name = parts.shift()?.trim();
                        const value = parts.join('=').trim();
                        return { name, value, domain: '.lazada.vn' };
                    }).filter(c => c.name && c.value);
                    logger.info(`[Lazada] 🍪 Parsed ${cookieObjects.length} cookies from standard string`);
                }
            } catch (e) {
                logger.error(`[Lazada] Failed to parse option cookies:`, e);
            }
        }

        // 2. Try loading from file
        if (cookieObjects.length === 0) {
            try {
                const { LAZADA_COOKIES } = await import('./lazada-cookies');
                if (LAZADA_COOKIES && Array.isArray(LAZADA_COOKIES)) {
                    cookieObjects = LAZADA_COOKIES;
                    logger.info(`[Lazada] 🍪 Loaded ${cookieObjects.length} cookies from file`);
                }
            } catch (e) {
                logger.debug(`[Lazada] No local cookie file found`);
            }
        }

        // 3. Inject
        if (cookieObjects.length > 0) {
            // Ensure domain/path validity for Puppeteer
            const validCookies = cookieObjects.map((c: any) => ({
                name: c.name,
                value: c.value,
                domain: c.domain || '.lazada.vn',
                path: c.path || '/',
                secure: c.secure !== false,
            }));

            try {
                await page.setCookie(...validCookies);
                logger.info(`[Lazada] 🍪 Injected ${validCookies.length} cookies`);
            } catch (e) {
                logger.warn(`[Lazada] Cookie injection warning: ${e}`);
            }
        }
    }

    /**
     * Main crawl method
     */
    async crawl(options: PuppeteerCrawlOptions = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const query = options.keyword || 'điện thoại';
        const maxPages = options.maxPages || 20; // Increased from 5 to 20
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let errorCount = 0;
        let totalSaved = 0;

        logger.info(`🕷️ [Lazada] Starting Puppeteer crawl: "${query}", ${maxPages} pages`);

        try {
            const page = await this.getPage();
            await this.injectCookies(page);
            // Simulate mouse movement
            await page.mouse.move(Math.random() * 500, Math.random() * 500);
            await this.sleep(2000 + Math.random() * 1000);

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                if (this.shouldStop) break;

                try {
                    const url = `${this.baseUrl}/catalog/?q=${encodeURIComponent(query)}&page=${pageNum}`;
                    const pageProducts = await this.crawlCategoryPage(page, url);

                    if (pageProducts.length === 0) {
                        logger.info(`[Lazada] No more results at page ${pageNum}`);
                        const title = await page.title();
                        logger.warn(`[Lazada] Page title: ${title}`);
                        if (title.includes("Security Challenge") || title.includes("验证")) {
                            logger.error("[Lazada] Blocked by security challenge");
                        }
                        break;
                    }

                    products.push(...pageProducts);
                    logger.info(`[Lazada] Page ${pageNum}: ${pageProducts.length} items, total buffered: ${products.length}`);

                    // Save every 300 products
                    if (products.length >= 300) {
                        const toSave = products.splice(0, 300);
                        const { inserted } = await this.saveProducts(toSave);
                        totalSaved += inserted;

                        // Update log periodically
                        await this.updateCrawlLog(logId, {
                            total: totalSaved,
                            newItems: totalSaved,
                            updated: 0,
                            errors: errorCount,
                        }, false);
                    }

                    await this.sleep(1500 + Math.random() * 1000);
                } catch (error) {
                    logger.error(`[Lazada] Page ${pageNum} error:`, error);
                    errorCount++;
                    if (errorCount >= 3) break;
                }
            }

            const { inserted } = await this.saveProducts(products);
            totalSaved += inserted;

            await this.updateCrawlLog(logId, {
                total: totalSaved,
                newItems: totalSaved,
                updated: 0,
                errors: errorCount,
            });

            logger.info(`✅ [Lazada] Crawl completed: ${totalSaved} products saved, ${errorCount} errors`);
        } finally {
            await this.releaseBrowser();
        }

        return products;
    }

    /**
     * Mass crawl - Uses categories + keywords from database
     */
    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const pagesPerCat = options.pagesPerCategory || 20;
        const allProducts: CrawledProduct[] = [];

        // We will create individual logs for categories, and one "keyword session" log for keywords
        let totalErrors = 0;
        let totalSaved = 0;
        const logId = await this.createCrawlLog();

        // Fetch categories from database with 24h freshness check
        const dbCategories = await CategoryService.getCategories(this.sourceId, 24);
        const categories = dbCategories.length > 0
            ? dbCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: CategoryService.getSourceSlug(cat, 'lazada')
            }))
            : LAZADA_CATEGORIES.map(cat => ({ ...cat, id: undefined }));

        // Fetch keywords from database (ONLY older than 24h)
        const dbKeywords = await KeywordService.getKeywordStrings('lazada', undefined, 24);
        const keywords = dbKeywords.length > 0 ? dbKeywords : LAZADA_KEYWORDS;

        logger.info(`🚀 [Lazada] MASS CRAWL: ${categories.length} categories + ${keywords.length} keywords (Source: Database)`);

        try {
            const page = await this.getPage();
            await this.injectCookies(page);
            await page.mouse.move(Math.random() * 500, Math.random() * 500);
            await this.sleep(2000 + Math.random() * 1000);

            // 1. Crawl Categories
            for (const cat of categories) {
                if (this.shouldStop) break;

                // Ensure slug exists
                if (!cat.slug) continue;

                logger.info(`[Lazada] 📂 Processing Category: ${cat.name} (${cat.slug})`);
                let consecutiveNoNewProducts = 0; // Auto-skip counter for this category

                try {
                    for (let pageNum = 1; pageNum <= pagesPerCat; pageNum++) {
                        if (this.shouldStop) break;

                        // CORRECT URL for categories: https://www.lazada.vn/category-slug/?page=N
                        const url = `${this.baseUrl}/${cat.slug}/?page=${pageNum}`;
                        logger.info(`[Lazada] 📄 Loading category page: ${url}`);

                        const pageProducts = await this.crawlCategoryPage(page, url);

                        if (pageProducts.length === 0) {
                            logger.info(`[Lazada] No more results at page ${pageNum}`);
                            break;
                        }

                        allProducts.push(...pageProducts);
                        logger.info(`[Lazada] Page ${pageNum}: ${pageProducts.length} items, total buffered: ${allProducts.length + totalSaved}`);

                        if (allProducts.length >= 200) {
                            const toSave = allProducts.splice(0, 200);
                            const { inserted, updated } = await this.saveProducts(toSave);
                            totalSaved += inserted + updated;

                            // === AUTO-SKIP LOGIC ===
                            if (inserted === 0 && updated > 0) {
                                consecutiveNoNewProducts++;
                                logger.info(`[Lazada] ⚠️ Page ${pageNum}: No new products (${updated} updated). Consecutive: ${consecutiveNoNewProducts}/3`);

                                if (consecutiveNoNewProducts >= 3) {
                                    logger.info(`[Lazada] ⏭️ AUTO-SKIP: 3 consecutive pages with no new products. Moving to next category.`);
                                    break;
                                }
                            } else if (inserted > 0) {
                                consecutiveNoNewProducts = 0;
                            }
                            // === END AUTO-SKIP ===

                            await this.updateCrawlLog(logId, {
                                total: totalSaved,
                                newItems: totalSaved,
                                updated: 0,
                                errors: totalErrors
                            }, false);
                        }

                        await this.sleep(1500 + Math.random() * 1000);
                    }
                } catch (error) {
                    logger.error(`[Lazada] Category ${cat.name} failed:`, error);
                    totalErrors++;
                }
            }

            // 2. Crawl Keywords
            for (let i = 0; i < keywords.length; i++) {
                if (this.shouldStop) break;

                const keyword = keywords[i];
                logger.info(`[Lazada] 🔍 [${i + 1}/${keywords.length}] Keyword: ${keyword}`);

                try {
                    for (let pageNum = 1; pageNum <= 3; pageNum++) {
                        if (this.shouldStop) break;

                        const url = `${this.baseUrl}/catalog/?q=${encodeURIComponent(keyword)}&page=${pageNum}`;
                        logger.info(`[Lazada] 📄 Loading search: "${keyword}" (Page ${pageNum})`);
                        const products = await this.crawlCategoryPage(page, url);

                        if (products.length === 0) break;

                        allProducts.push(...products);
                        logger.info(`[Lazada] Page ${pageNum}: Found ${products.length} items for "${keyword}", total buffered: ${allProducts.length + totalSaved}`);

                        if (allProducts.length >= 200) {
                            const toSave = allProducts.splice(0, 200);
                            const { inserted } = await this.saveProducts(toSave);
                            totalSaved += inserted;

                            await this.updateCrawlLog(logId, {
                                total: totalSaved,
                                newItems: totalSaved,
                                updated: 0,
                                errors: totalErrors,
                            }, false);
                        }
                        await this.sleep(1500 + Math.random() * 500);
                    }
                } catch (error) {
                    logger.error(`[Lazada] Keyword "${keyword}" failed:`, error);
                    totalErrors++;
                }
            }

            // Save remaining
            if (allProducts.length > 0) {
                const { inserted } = await this.saveProducts(allProducts);
                totalSaved += inserted;
            }

            await this.updateCrawlLog(logId, {
                total: totalSaved,
                newItems: totalSaved,
                updated: 0,
                errors: totalErrors,
            });

            logger.info(`🎉 [Lazada] MASS CRAWL COMPLETE: ${totalSaved} products saved`);
        } finally {
            await this.releaseBrowser();
        }

        return allProducts;
    }
    async crawlCategory(categorySlug: string, maxPages: number = 20): Promise<CrawledProduct[]> {
        await this.initialize();
        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog(); // Temporary log if called directly
        let errorCount = 0;
        let totalSaved = 0;

        logger.info(`🕷️ [Lazada] Starting Category Crawl: "${categorySlug}", ${maxPages} pages`);

        try {
            const page = await this.getPage();
            await this.injectCookies(page);
            await page.mouse.move(Math.random() * 500, Math.random() * 500);
            await this.sleep(2000 + Math.random() * 1000);

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                if (this.shouldStop) break;

                try {
                    // CORRECT URL for categories: https://www.lazada.vn/category-slug/?page=N
                    const url = `${this.baseUrl}/${categorySlug}/?page=${pageNum}`;
                    logger.info(`[Lazada] 📄 Loading category page: ${url}`);

                    const pageProducts = await this.crawlCategoryPage(page, url);

                    if (pageProducts.length === 0) {
                        logger.info(`[Lazada] No more results at page ${pageNum}`);
                        break;
                    }

                    products.push(...pageProducts);
                    logger.info(`[Lazada] Page ${pageNum}: ${pageProducts.length} items, total buffered: ${products.length}`);

                    if (products.length >= 200) {
                        const toSave = products.splice(0, 200);
                        const { inserted } = await this.saveProducts(toSave);
                        totalSaved += inserted;
                    }

                    await this.sleep(1500 + Math.random() * 1000);
                } catch (error) {
                    logger.error(`[Lazada] Page ${pageNum} error:`, error);
                    errorCount++;
                    if (errorCount >= 3) break;
                }
            }

            // Save remaining
            if (products.length > 0) {
                const { inserted } = await this.saveProducts(products);
                totalSaved += inserted;
            }

            logger.info(`✅ [Lazada] Category Crawl completed: ${totalSaved} saved`);
        } catch (e) {
            logger.error(`[Lazada] Category crawl failed:`, e);
        } finally {
            await this.releaseBrowser();
        }

        return products;
    }
}
