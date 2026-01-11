/**
 * Shopee Crawler - 2026 Network Interception Method
 * Captures product data from Shopee's internal API responses
 * Uses page.on('response') to intercept JSON data
 */

import { Page, Browser, HTTPResponse } from 'puppeteer';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct } from './base';
import { KeywordService } from './keywordService';
import { CategoryService, CategoryNode } from './categoryService';
import logger from '../utils/logger';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { intelligentCookieParse } from '../utils/cookieHelper';

interface ShopeeApiItem {
    itemid?: number;
    shopid?: number;
    name?: string;
    price?: number;
    price_before_discount?: number;
    discount?: string;
    historical_sold?: number;
    item_rating?: { rating_star?: number; rating_count?: number[] };
    stock?: number;
    image?: string;
    images?: string[];
    brand?: string;
    shop_location?: string;
    item_basic?: {
        name?: string;
        price?: number;
        price_before_discount?: number;
        historical_sold?: number;
        item_rating?: { rating_star?: number; rating_count?: number[] };
        image?: string;
        images?: string[];
        stock?: number;
    };
}

// 50 Keywords for mass crawl
const SHOPEE_KEYWORDS = [
    'iphone 15 pro max', 'iphone 15', 'samsung galaxy s24', 'samsung a54',
    'xiaomi 14', 'oppo reno 11', 'vivo v30', 'realme 12',
    'macbook air m3', 'macbook pro m3', 'laptop gaming asus', 'laptop dell',
    'laptop lenovo thinkpad', 'laptop hp pavilion', 'laptop acer nitro',
    'ipad pro m4', 'ipad air', 'samsung galaxy tab', 'xiaomi pad',
    'airpods pro', 'tai nghe bluetooth sony', 'tai nghe samsung', 'loa jbl',
    'loa bluetooth', 'tai nghe gaming',
    'apple watch ultra', 'samsung galaxy watch', 'garmin', 'amazfit',
    'tivi samsung 55 inch', 'tivi lg oled', 'màn hình gaming', 'monitor 27 inch',
    'máy lọc không khí', 'robot hút bụi', 'máy lọc nước', 'nồi chiên không dầu',
    'máy xay sinh tố', 'bếp từ', 'lò vi sóng',
    'sạc nhanh', 'case iphone 15', 'miếng dán cường lực', 'chuột gaming',
    'bàn phím cơ', 'webcam', 'usb flash drive',
    'camera hành trình', 'flycam', 'máy ảnh sony', 'gopro',
];

export class ShopeeCrawler extends PuppeteerCrawlerBase {
    private sessionInitialized = false;
    private readonly baseUrl = 'https://shopee.vn';
    private capturedProducts: ShopeeApiItem[] = [];

    public cookies?: string;
    private proxyUrl = process.env.CRAWLER_PROXY;

    constructor(options?: { cookie?: string }) {
        super('shopee');
        this.cookies = options?.cookie;
    }



    /**
     * TOP 1: Direct API Crawler (HTTP Only)
     * Ultra fast, bypasses browser rendering.
     */
    private async crawlDirectApi(keyword: string, pageNum: number): Promise<ShopeeApiItem[]> {
        logger.info(`[Shopee] ⚡ Direct API Request: "${keyword}" page ${pageNum}`);

        try {
            const url = 'https://shopee.vn/api/v4/search/search_items';

            // Convert everything to string format for headers
            let cookieHeader = '';
            let csrfToken = '';

            if (this.cookies) {
                const cookieArray = intelligentCookieParse(this.cookies);

                if (cookieArray.length > 0) {
                    cookieHeader = cookieArray.map((c: any) => `${c.name}=${c.value}`).join('; ');
                    const csrfCookie = cookieArray.find((c: any) => c.name === 'csrftoken');
                    if (csrfCookie) csrfToken = csrfCookie.value;
                } else if (this.cookies.includes('=')) {
                    // Raw string fallback
                    cookieHeader = this.cookies;
                    const match = this.cookies.match(/csrftoken=([^;]+)/);
                    if (match) csrfToken = match[1];
                }
            }

            // If explicit cookies were empty, try loading from file
            if (!cookieHeader) {
                try {
                    const { SHOPEE_COOKIES } = await import('./shopee-cookies');
                    if (SHOPEE_COOKIES && Array.isArray(SHOPEE_COOKIES)) {
                        cookieHeader = SHOPEE_COOKIES.map((c: any) => `${c.name}=${c.value}`).join('; ');
                        const csrfCookie = SHOPEE_COOKIES.find((c: any) => c.name === 'csrftoken');
                        if (csrfCookie) csrfToken = csrfCookie.value;
                        logger.info(`[Shopee] 🍪 Using file cookies for Direct API`);
                    }
                } catch (e) {
                    // Ignore if file missing
                }
            }

            const axiosConfig: any = {
                params: {
                    by: 'relevancy',
                    keyword: keyword,
                    limit: 60,
                    newest: pageNum * 60,
                    order: 'desc',
                    page_type: 'search',
                    scenario: 'PAGE_GLOBAL_SEARCH',
                    version: '1'
                },
                headers: {
                    'Cookie': cookieHeader,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'vi-VN,vi;q=0.9',
                    'Referer': 'https://shopee.vn/',
                    'Origin': 'https://shopee.vn',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-API-SOURCE': 'pc',
                    'X-Csrftoken': csrfToken
                },
                timeout: 15000,
                validateStatus: (status: number) => status < 500 // Allow 403 to be handled
            };

            // Use proxy if available
            if (this.proxyUrl) {
                axiosConfig.httpsAgent = new HttpsProxyAgent(this.proxyUrl);
                // Also support http for cases where the URL is http
                axiosConfig.proxy = false; // Disable axios internal proxy logic when using agent
            }

            const response = await axios.get(url, axiosConfig);
            const status = response.status;

            if (status === 200 && response.data) {
                const data = response.data;

                if (data.record_type || data.items || data.item_cards || data.sections) {
                    // Use the same extraction logic
                    const oldCaptured = this.capturedProducts;
                    this.capturedProducts = [];
                    this.extractItemsFromResponse(data);
                    const items = [...this.capturedProducts];
                    this.capturedProducts = oldCaptured; // Restore

                    if (items.length > 0) {
                        logger.info(`[Shopee] ✅ Direct API success: ${items.length} items`);
                        return items;
                    }
                }

                if (data.error === 90309999) {
                    logger.warn(`[Shopee] ❗ API Blocked (90309999). Anti-bot detected.`);
                } else if (data.error) {
                    logger.warn(`[Shopee] ⚠️ API returned error code ${data.error}: ${data.message}`);
                } else {
                    logger.warn(`[Shopee] ⚠️ API returned 0 items. Keys: ${Object.keys(data).join(',')}`);
                    logger.debug(`[Shopee] API Response Payload: ${JSON.stringify(data).substring(0, 500)}`);
                }
            } else {
                logger.warn(`[Shopee] ❗ API Request failed with status ${status}`);
            }
            return [];
        } catch (error: any) {
            logger.error(`[Shopee] ❌ Direct API Error: ${error.message}`);
            return [];
        }
    }

    /**
     * Setup network interception to capture Shopee API responses
     */
    private async setupNetworkInterception(page: Page): Promise<void> {
        // Listen for all responses
        page.on('response', async (response: HTTPResponse) => {
            const url = response.url();
            const status = response.status();

            // Log important API calls
            if (url.includes('/api/v4/') || url.includes('search')) {
                logger.debug(`[Shopee] 📡 API Response: ${status} ${url.substring(0, 100)}`);
            }

            // Check for login redirect
            if (url.includes('/buyer/login') || url.includes('/login')) {
                logger.warn(`[Shopee] ⚠️ REDIRECT TO LOGIN DETECTED: ${url}`);
            }

            // Capture search API responses
            if (url.includes('/api/v4/search/search_items') ||
                url.includes('/api/v4/recommend/recommend') ||
                url.includes('/api/v4/pdp/get_pc') ||
                url.includes('search_items')) {
                try {
                    const contentType = response.headers()['content-type'] || '';

                    if (contentType.includes('application/json')) {
                        try {
                            // Check if the response actually has a body and is valid
                            const text = await response.text();
                            if (!text || text.trim() === '') return;

                            const json = JSON.parse(text);
                            logger.info(`[Shopee] 🎯 Captured API (${status}): ${url.substring(0, 80)}`);
                            this.extractItemsFromResponse(json);
                        } catch (e) {
                            logger.warn(`[Shopee] JSON parse failed for ${url.substring(0, 50)}: ${e}`);
                        }
                    }
                } catch (err) {
                    // response.json() can fail if response is already closed or not json
                }
            }
        });
    }

    /**
     * Extract items from various Shopee API response formats
     */
    private extractItemsFromResponse(json: unknown): void {
        if (!json) return;

        // If it's an array, it might be a list of items directly (rare for Shopee but possible)
        if (Array.isArray(json)) {
            this.capturedProducts.push(...(json as ShopeeApiItem[]));
            logger.debug(`[Shopee] Captured ${json.length} items from top-level array`);
            return;
        }

        if (typeof json !== 'object') return;
        const data = json as Record<string, unknown>;

        let foundCount = 0;

        // Format 1: { items: [...] } - Standard Search API
        if (Array.isArray(data.items)) {
            this.capturedProducts.push(...(data.items as ShopeeApiItem[]));
            foundCount += data.items.length;
        }

        // Format 2: { data: { items: [...] } } - Common for recommend/pdp
        if (data.data && typeof data.data === 'object') {
            const innerData = data.data as Record<string, unknown>;
            if (Array.isArray(innerData.items)) {
                this.capturedProducts.push(...(innerData.items as ShopeeApiItem[]));
                foundCount += innerData.items.length;
            }
            // Some newer APIs have 'item' (singular) inside data
            if (Array.isArray(innerData.item)) {
                this.capturedProducts.push(...(innerData.item as ShopeeApiItem[]));
                foundCount += innerData.item.length;
            }
        }

        // Format 3: { item_cards: [{ items: [...] }] } - Modern Home/Search
        if (Array.isArray(data.item_cards)) {
            for (const card of data.item_cards as Array<{ items?: ShopeeApiItem[] }>) {
                if (Array.isArray(card.items)) {
                    this.capturedProducts.push(...card.items);
                    foundCount += card.items.length;
                }
            }
        }

        // Format 4: { sections: [{ data: { item: [...] } }] }
        if (Array.isArray(data.sections)) {
            for (const section of data.sections as Array<{ data?: { item?: ShopeeApiItem[]; items?: ShopeeApiItem[] } }>) {
                const sectionItems = section.data?.item || section.data?.items;
                if (Array.isArray(sectionItems)) {
                    this.capturedProducts.push(...sectionItems);
                    foundCount += sectionItems.length;
                }
            }
        }

        if (foundCount > 0) {
            logger.debug(`[Shopee] Captured ${foundCount} items from current response`);
        } else {
            // Log keys to help identify new formats
            const keys = Object.keys(data);
            logger.warn(`[Shopee] No items found. Top-level keys: ${keys.slice(0, 10).join(', ')}`);
            if (data.record_type || data.search_type) {
                logger.debug(`[Shopee] Search metadata: ${JSON.stringify({ record_type: data.record_type, search_type: data.search_type })}`);
            }
            // If there's an error key, log it
            if (data.error) {
                logger.error(`[Shopee] API returned error: ${data.error} - ${data.message || 'No message'}`);
            }
        }
    }

    /**
     * Parse Shopee API item to CrawledProduct
     */
    private parseApiItem(item: ShopeeApiItem): CrawledProduct | null {
        try {
            const basic = item.item_basic || item;
            const itemId = item.itemid || (basic as { itemid?: number }).itemid;
            const shopId = item.shopid || (basic as { shopid?: number }).shopid;
            const name = basic.name || item.name;

            if (!itemId || !name) return null;

            // Price in VND (Shopee sometimes returns price * 100000)
            let price = basic.price || item.price || 0;
            if (price > 100000000) price = Math.floor(price / 100000);

            let originalPrice = basic.price_before_discount || item.price_before_discount;
            if (originalPrice && originalPrice > 100000000) {
                originalPrice = Math.floor(originalPrice / 100000);
            }

            // Discount
            let discountPercent: number | undefined;
            if (item.discount) {
                discountPercent = parseInt(String(item.discount).replace('%', '')) || undefined;
            } else if (originalPrice && originalPrice > price) {
                discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
            }

            // Rating
            const ratingData = basic.item_rating || item.item_rating;
            const rating = ratingData?.rating_star;
            const ratingCount = Array.isArray(ratingData?.rating_count)
                ? ratingData.rating_count.reduce((a, b) => a + b, 0)
                : undefined;

            // Image
            const imageId = basic.image || item.image;
            const imageUrl = imageId ? `https://cf.shopee.vn/file/${imageId}` : undefined;

            return {
                externalId: `${itemId}_${shopId}`,
                externalUrl: `https://shopee.vn/product/${shopId}/${itemId}`,
                name: String(name).trim(),
                price,
                originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
                discountPercent,
                imageUrl,
                rating,
                reviewCount: ratingCount || 0,
                soldCount: basic.historical_sold || item.historical_sold || 0,
                available: (basic.stock || item.stock || 0) > 0,
                metadata: {
                    location: item.shop_location,
                },
            };
        } catch (error) {
            logger.debug('[Shopee] Parse error:', error);
            return null;
        }
    }

    /**
     * Crawl a search page and capture network responses
     */
    private async crawlWithInterception(page: Page, keyword: string, pageNum: number): Promise<ShopeeApiItem[]> {
        this.capturedProducts = [];
        const url = `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}&page=${pageNum}`;
        logger.info(`[Shopee] 📄 Loading search via interaction: ${keyword}`);

        try {
            // 1. Go to homepage first
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // 2. Perform manual search
            try {
                // Wait for potential popups and try to close them (X button or click outside)
                await this.sleep(2000);
                const popupCloseSelector = '.shopee-popup__close-btn';
                if (await page.$(popupCloseSelector)) {
                    await page.click(popupCloseSelector);
                    logger.info(`[Shopee] ✖ Close marketing popup`);
                }

                await page.waitForSelector('input.shopee-searchbar-input__input', { timeout: 15000 });

                // Click search box first
                await page.click('input.shopee-searchbar-input__input');
                await this.sleep(500);

                // Type keyword like a human
                await page.type('input.shopee-searchbar-input__input', keyword, { delay: 150 });
                await this.sleep(500);

                // Try Enter first
                await page.keyboard.press('Enter');

                // Also try clicking the search button if Enter didn't trigger navigation
                await this.sleep(1000);
                const searchBtnSelector = '.shopee-searchbar__search-button';
                if (await page.$(searchBtnSelector)) {
                    await page.click(searchBtnSelector);
                }

                logger.info(`[Shopee] ⌨️ Performed manual search for "${keyword}"`);
            } catch (e) {
                logger.warn(`[Shopee] ⚠️ Search interaction failed, falling back to direct URL`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            const finalUrl = page.url();
            logger.info(`[Shopee] 📍 Final URL: ${finalUrl}`);

            if (finalUrl.includes('/login') || finalUrl.includes('/buyer/login')) {
                logger.error(`[Shopee] ❌ BLOCKED: Redirected to login page!`);
                return [];
            }

            if (finalUrl.includes('/verify/traffic') || finalUrl.includes('/verify/captcha')) {
                logger.error(`[Shopee] ❌ BOT DETECTION: Redirected to verification/captcha page!`);
                logger.info(`[Shopee] 💡 TIP: If you see the browser window, please solve the captcha manually.`);
                // Wait longer if captcha is detected to give user time to solve
                await this.sleep(15000);
            }

            // 3. Scroll and wait
            await this.sleep(3000);
            await this.scrollPage(page, 4);
            await this.sleep(2000);

            const captured = [...this.capturedProducts];
            if (captured.length === 0) {
                const pageTitle = await page.title();
                logger.warn(`[Shopee] ⚠️ 0 items captured. Page title: "${pageTitle}"`);
            } else {
                logger.info(`[Shopee] ✅ Captured ${captured.length} items`);
            }

            return captured;
        } catch (error) {
            logger.error(`[Shopee] ❌ Interaction error:`, error);
            return [];
        }
    }

    /**
     * Crawl 5 pages in parallel - each with its own browser
     */
    private async crawlPagesParallel(keyword: string, startPage: number, pageCount: number = 5): Promise<CrawledProduct[]> {
        const allProducts: CrawledProduct[] = [];

        logger.info(`[Shopee] 🚀 Parallel crawl: "${keyword}" pages ${startPage}-${startPage + pageCount - 1}`);

        const crawlPromises = [];

        for (let i = 0; i < pageCount; i++) {
            const pageNum = startPage + i;

            const crawlPage = async (): Promise<CrawledProduct[]> => {
                // 1. TRY DIRECT API FIRST (Much faster, no browser needed)
                if (this.cookies) {
                    const apiItems = await this.crawlDirectApi(keyword, pageNum);
                    if (apiItems.length > 0) {
                        const products: CrawledProduct[] = [];
                        for (const item of apiItems) {
                            const product = this.parseApiItem(item);
                            if (product) products.push(product);
                        }
                        return products;
                    }
                    logger.info(`[Shopee] 🔄 API method returned 0 items, falling back to Puppeteer...`);
                }

                // 2. FALLBACK TO PUPPETEER
                let browser: Browser | null = null;
                try {
                    browser = await this.pool.acquire();
                    const page = await this.pool.createPage(browser);

                    // Setup network interception for this page
                    await this.setupNetworkInterception(page);

                    // Stagger requests slightly
                    await this.sleep(i * 500);


                    // LOAD COOKIES FROM FILE OR OPTION
                    let cookieObjects: any[] = [];

                    // 1. Try cookies passed in options first
                    if (this.cookies) {
                        try {
                            cookieObjects = intelligentCookieParse(this.cookies);
                            if (cookieObjects.length > 0) {
                                logger.info(`[Shopee] 🍪 Loaded ${cookieObjects.length} cookies from UI input`);
                            }
                        } catch (e) {
                            logger.error(`[Shopee] Failed to parse UI cookies:`, e);
                        }
                    }

                    // 2. If no valid cookies yet, try loading from shopee-cookies.ts
                    if (cookieObjects.length === 0) {
                        try {
                            // Dynamic import to avoid build errors if file is missing
                            const { SHOPEE_COOKIES } = await import('./shopee-cookies');
                            if (SHOPEE_COOKIES && Array.isArray(SHOPEE_COOKIES)) {
                                cookieObjects = SHOPEE_COOKIES;
                                logger.info(`[Shopee] 🍪 Loaded ${cookieObjects.length} cookies from file`);
                            }
                        } catch (e) {
                            logger.debug(`[Shopee] No local cookie file found or invalid`);
                        }
                    }

                    // 3. Inject cookies
                    if (cookieObjects.length > 0) {
                        // Ensure domain is set correctly and format is puppeteer-friendly
                        const validCookies = cookieObjects.map((c: any) => ({
                            name: c.name,
                            value: c.value,
                            domain: c.domain || '.shopee.vn',
                            path: c.path || '/',
                            secure: c.secure !== false,
                            httpOnly: c.httpOnly === true,
                        }));

                        await page.setCookie(...validCookies);
                        logger.info(`[Shopee] 🍪 Injected ${validCookies.length} cookies for worker`);
                    }


                    // Visit homepage first to get cookies and warm up
                    await page.goto(this.baseUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    // SIMULATE HUMAN BEHAVIOR
                    // 1. Move mouse randomly
                    await page.mouse.move(100, 100);
                    await page.mouse.move(200, 200, { steps: 10 });
                    await this.sleep(500 + Math.random() * 500);

                    // 2. Scroll down a bit
                    await page.evaluate(() => {
                        window.scrollBy(0, 300);
                    });
                    await this.sleep(1000 + Math.random() * 1000);

                    // 3. Scroll back up
                    await page.evaluate(() => {
                        window.scrollTo(0, 0);
                    });
                    await this.sleep(500);


                    // Now crawl search page
                    const items = await this.crawlWithInterception(page, keyword, pageNum);

                    await page.close().catch(() => { });

                    // Parse items
                    const products: CrawledProduct[] = [];
                    for (const item of items) {
                        const product = this.parseApiItem(item);
                        if (product) products.push(product);
                    }

                    return products;
                } catch (error: any) {
                    logger.error(`[Shopee] Worker page ${pageNum} error: ${error?.message || error}`, error?.stack);
                    return [];
                } finally {
                    if (browser) this.pool.release(browser);
                }
            };

            crawlPromises.push(crawlPage());
        }

        const results = await Promise.all(crawlPromises);

        for (const products of results) {
            allProducts.push(...products);
        }

        logger.info(`[Shopee] ✅ Parallel complete: ${allProducts.length} products from ${pageCount} pages`);

        return allProducts;
    }

    /**
     * Main crawl method - single keyword
     */
    async crawl(options: PuppeteerCrawlOptions = {}): Promise<CrawledProduct[]> {
        await this.initialize();

        const keyword = options.keyword || 'điện thoại';
        const maxPages = options.maxPages || 20; // Increased from 5 to 20
        const products: CrawledProduct[] = [];

        const logId = await this.createCrawlLog();
        let totalSaved = 0;

        logger.info(`🕷️ [Shopee] Starting crawl: "${keyword}", ${maxPages} pages (parallel)`);

        try {
            // Crawl in batches of 5 pages
            for (let batch = 0; batch < Math.ceil(maxPages / 5); batch++) {
                if (this.shouldStop) break;

                const startPage = batch * 5;
                const pagesInBatch = Math.min(5, maxPages - startPage);

                const batchProducts = await this.crawlPagesParallel(keyword, startPage, pagesInBatch);
                products.push(...batchProducts);

                // Save every 300 products
                if (products.length >= 100) {
                    const toSave = products.splice(0, 100);
                    const { inserted } = await this.saveProducts(toSave);
                    totalSaved += inserted;

                    logger.info(`[Shopee] 💾 Saved batch products (total saved: ${totalSaved})`);
                }

                // Update Session count in UI immediately after each page batch
                await this.updateCrawlLog(logId, {
                    total: totalSaved + products.length,
                    newItems: totalSaved,
                    updated: 0,
                    errors: 0,
                }, false);

                await this.sleep(2000);
            }

            const { inserted } = await this.saveProducts(products);
            totalSaved += inserted;

            await this.updateCrawlLog(logId, {
                total: totalSaved,
                newItems: totalSaved,
                updated: 0,
                errors: 0,
            });

            logger.info(`✅ [Shopee] Crawl complete: ${totalSaved} products`);
        } finally {
            await this.releaseBrowser();
        }

        return products;
    }

    /**
     * Mass crawl - ENHANCED with Smart Auto-Skip
     */
    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        logger.info(`[Shopee] 🚀 Starting Infinite Mass Crawl...`);

        while (!this.shouldStop) {
            await this.initialize();

            const pagesPerKeyword = options.pagesPerCategory || 20;
            const allProducts: CrawledProduct[] = [];
            const logId = await this.createCrawlLog();
            let totalErrors = 0;
            let totalSaved = 0;

            // Import CrawlProgressService for smart tracking
            const { CrawlProgressService } = await import('./crawlProgressService');

            // PHASE 1: Fetch categories from Database first
            logger.info('[Shopee] 🌳 Fetching categories from Database...');

            // Try getting categories from database for source 1 (Shopee)
            const dbCategories = await CategoryService.getCategories(1);

            let categoryKeywords: string[] = [];

            if (dbCategories.length > 0) {
                categoryKeywords = dbCategories.map(c => c.name);
                logger.info(`[Shopee] Found ${categoryKeywords.length} categories in Database.`);
            } else {
                logger.info('[Shopee] No categories in DB, falling back to API tree...');
                const categoryTree = await CategoryService.fetchShopeeCategoryTree();
                const leafCategories = CategoryService.getLeafCategories(categoryTree);
                categoryKeywords = leafCategories.slice(0, 100).map((c: CategoryNode) => c.name);
            }

            // Fetch additional keywords from database
            const dbKeywords = await KeywordService.getKeywordStrings('shopee', undefined, 24);
            const keywords = dbKeywords.length > 0 ? dbKeywords : SHOPEE_KEYWORDS;

            // Combine categories and keywords
            let allTargets = [...new Set([...categoryKeywords, ...keywords])];

            // 🚀 SMART AUTO-SKIP ENABLED
            const uncrawledKeywords = await CrawlProgressService.getUncrawledKeywords(
                this.sourceId,
                allTargets,
                24 // Skip if crawled within 24h
            );

            if (uncrawledKeywords.length > 0) {
                const skipped = allTargets.length - uncrawledKeywords.length;
                allTargets = uncrawledKeywords;
                logger.info(`[Shopee] ⏭️ SMART SKIP: ${skipped} keywords already crawled, ${allTargets.length} remaining`);
            } else {
                logger.info(`[Shopee] 🔄 All keywords crawled within 24h. Skipping all.`);
                allTargets = [];
            }
            // logger.info(`[Shopee] ⏭️ SMART SKIP DISABLED: Crawling all ${allTargets.length} targets.`);

            logger.info(`🚀 [Shopee] MASS CRAWL: ${allTargets.length} unique targets`);

            try {
                for (let i = 0; i < allTargets.length; i++) {
                    if (this.shouldStop) {
                        logger.info('[Shopee] 🛑 Mass crawl stopped by user');
                        break;
                    }

                    const keyword = allTargets[i];
                    logger.info(`[Shopee] 🔍 [${i + 1}/${allTargets.length}] "${keyword}"`);
                    let consecutiveNoNewProducts = 0; // Auto-skip counter for this keyword

                    try {
                        let keywordProducts = 0;

                        // Crawl in batches of 5 parallel pages
                        for (let batch = 0; batch < Math.ceil(pagesPerKeyword / 5); batch++) {
                            if (this.shouldStop) break;

                            const startPage = batch * 5;
                            const pagesInBatch = Math.min(5, pagesPerKeyword - startPage);

                            const batchProducts = await this.crawlPagesParallel(keyword, startPage, pagesInBatch);

                            if (batchProducts.length === 0 && batch === 0) {
                                logger.warn(`[Shopee] No results for "${keyword}"`);
                                break;
                            }

                            allProducts.push(...batchProducts);
                            keywordProducts += batchProducts.length;

                            // Save every 500 products
                            if (allProducts.length >= 500) {
                                const toSave = allProducts.splice(0, 500);
                                const { inserted, updated } = await this.saveProducts(toSave);
                                totalSaved += inserted + updated;

                                // === AUTO-SKIP LOGIC ===
                                if (inserted === 0 && updated > 0) {
                                    consecutiveNoNewProducts++;
                                    logger.info(`[Shopee] ⚠️ Batch ${batch}: No new products (${updated} updated). Consecutive: ${consecutiveNoNewProducts}/2`);

                                    if (consecutiveNoNewProducts >= 2) {
                                        logger.info(`[Shopee] ⏭️ AUTO-SKIP: 2 consecutive batches with no new products. Moving to next keyword.`);
                                        break;
                                    }
                                } else if (inserted > 0) {
                                    consecutiveNoNewProducts = 0;
                                }
                                // === END AUTO-SKIP ===

                                logger.info(`[Shopee] 💾 Saved 500 (total: ${totalSaved})`);
                            }

                            await this.sleep(2000 + Math.random() * 1000);
                        }

                        logger.info(`[Shopee] ✅ "${keyword}": ${keywordProducts} products`);

                        // Delay between keywords
                        await this.sleep(3000 + Math.random() * 2000);
                    } catch (error) {
                        logger.error(`[Shopee] ❌ "${keyword}" failed:`, error);
                        totalErrors++;
                    }
                }

                // Save remaining
                const { inserted } = await this.saveProducts(allProducts);
                totalSaved += inserted;

                await this.updateCrawlLog(logId, {
                    total: totalSaved,
                    newItems: totalSaved,
                    updated: 0,
                    errors: totalErrors,
                });

                logger.info(`🎉 [Shopee] Cycle complete: ${totalSaved} products, ${totalErrors} errors`);
            } finally {
                await this.releaseBrowser();
            }

            if (this.shouldStop) break;
            logger.info(`[Shopee] ⏳ Cycle complete. Waiting 60s before next run...`);
            await this.sleep(60000);
        }
        return [];
    }
    async crawlCategory(categorySlug: string, maxPages?: number): Promise<CrawledProduct[]> {
        return this.crawl({ keyword: categorySlug, maxPages });
    }
}
