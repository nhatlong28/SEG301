import { Page } from 'puppeteer';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct } from './base';
import { KeywordService } from './keywordService';
import { CategoryService } from './categoryService';
import { intelligentCookieParse } from '../utils/cookieHelper';
import logger from '../utils/logger';

export class LazadaCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://www.lazada.vn';
    private cookies?: string;
    private lastHumanUrl?: string;

    constructor(options?: { cookie?: string }) {
        super('lazada');
        this.cookies = options?.cookie;
    }

    /**
     * HUMAN SIMULATION: Rung lắc chuột, scroll ngẫu nhiên để đánh lừa anti-bot
     */
    private async simulateHumanBehavior(page: Page) {
        try {
            const width = 1920, height = 1080;
            // Di chuyển chuột ngẫu nhiên
            for (let i = 0; i < 3; i++) {
                await page.mouse.move(Math.random() * width, Math.random() * height, { steps: 5 });
                await this.sleep(200 + Math.random() * 300);
            }
            // Scroll nhẹ
            await page.evaluate(() => {
                window.scrollBy(0, Math.random() * 300);
            });
            await this.sleep(500);
        } catch (e) { /* ignore */ }
    }

    /**
     * PHƯƠNG PHÁP CÀO BỀN VỮNG: HYBRID INTERNAL FETCH
     * Thực hiện fetch() ngay trong cửa sổ trình duyệt để kế thừa mọi token (x5sec, cookie, etc.)
     */
    private async fetchProductsApi(page: Page, url: string): Promise<CrawledProduct[]> {
        // Fix: Human URL should retain query params but exclude 'ajax' for proper context
        const humanUrlObj = new URL(url);
        humanUrlObj.searchParams.delete('ajax');
        const humanUrl = humanUrlObj.toString();

        const apiUrl = new URL(url);
        apiUrl.searchParams.set('ajax', 'true');
        const finalApiUrl = apiUrl.toString();

        try {
            if (this.lastHumanUrl !== humanUrl) {
                logger.debug(`[Lazada] 🧭 Navigating to context: ${humanUrl}`);
                // Use a more relaxed waitUntil for better reliability
                await page.goto(humanUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                this.lastHumanUrl = humanUrl;

                // Smart wait for security layer to initialize
                await this.sleep(3000);
                await this.simulateHumanBehavior(page);
            }

            logger.debug(`[Lazada] 🚀 Internal fetch starting: ${finalApiUrl}`);

            // Perform fetch with a timeout inside the browser context
            const result = await page.evaluate(async (fetchUrl) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                try {
                    const response = await fetch(fetchUrl, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json, text/plain, */*'
                        },
                        signal: controller.signal
                    });
                    const status = response.status;
                    const text = await response.text();
                    clearTimeout(timeoutId);
                    return { status, text };
                } catch (e: any) {
                    clearTimeout(timeoutId);
                    return { error: e.name === 'AbortError' ? 'Timeout' : e.message };
                }
            }, finalApiUrl);

            if (result.error) {
                logger.error(`[Lazada] API Error: ${result.error}`);
                if (result.error === 'Timeout') {
                    // Force refresh next time
                    this.lastHumanUrl = '';
                }
                return [];
            }

            const dataText = (result.text || '').trim();
            logger.debug(`[Lazada] Received response status: ${result.status}, length: ${dataText.length}`);

            // KIỂM TRA CHẶN (Slider, Captcha, Redirect to login)
            if (dataText.includes('sessionStorage.x5referer') ||
                dataText.includes('SEC_SLIDER') ||
                dataText.includes('punish') ||
                dataText.includes('login') ||
                result.status === 403) {

                logger.error(`[Lazada] 🛑 BỊ CHẶN: Lazada yêu cầu xác thực hoặc đăng nhập (Status: ${result.status}).`);
                this.lastHumanUrl = ''; // Force reload
                return [];
            }

            let data: any;
            try {
                data = JSON.parse(dataText);
            } catch (e) {
                logger.warn(`[Lazada] ⚠️ JSON Parse fail. Length: ${dataText.length}`);
                return [];
            }

            if (data.ret && data.ret[0] === 'FAIL_SYS_USER_VALIDATE') {
                logger.error(`[Lazada] 🛑 FAIL_SYS_USER_VALIDATE: Session expired or IP blacklisted.`);
                return [];
            }

            const items = data.mods?.listItems;
            if (!items || !Array.isArray(items)) {
                if (data.mainInfo?.totalResults === "0") return [];
                logger.warn(`[Lazada] ⚠️ No listItems in response.`);
                return [];
            }

            return items.map(item => this.mapApiItemToProduct(item));

        } catch (error: any) {
            logger.error(`[Lazada] Fetch API exception: ${error.message}`);
            this.lastHumanUrl = '';
            return [];
        }
    }

    /**
     * Map dữ liệu từ Lazada API sang chuẩn CrawledProduct
     */
    private mapApiItemToProduct(item: any): CrawledProduct {
        const itemId = item.itemId || item.nid || item.id || '';
        const price = parseFloat(String(item.price).replace(/[^0-9]/g, '')) || 0;
        const originalPrice = parseFloat(String(item.originalPrice).replace(/[^0-9]/g, '')) || 0;

        // Lazada often changes URL field names: itemUrl, productUrl, or construction from ID
        let rawUrl = item.itemUrl || item.productUrl || '';
        if (!rawUrl && itemId) {
            rawUrl = `https://www.lazada.vn/products/-i${itemId}.html`;
        }

        return {
            externalId: String(itemId),
            externalUrl: this.productUrlToFull(rawUrl),
            name: item.name || item.title || 'No Name',
            price: price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discountPercent: item.discount ? parseInt(item.discount.replace(/[^0-9]/g, '')) : undefined,
            rating: parseFloat(item.ratingScore || item.rating) || 0,
            reviewCount: parseInt(item.review || item.reviewCount) || 0,
            soldCount: this.parseSoldCount(item.itemSoldCntShow || item.sold),
            imageUrl: item.image || item.picUrl,
            brand: item.brandName || item.brand,
            category: item.categoryName,
            available: true,
            metadata: {
                location: item.location,
                sellerName: item.sellerName,
                sellerId: item.sellerId,
                isOfficial: item.officialStore === 'true' || !!item.isLazmall,
                freeShipping: !!item.freeShipping,
                installment: !!item.installment,
                skuId: item.skuId || item.sku
            }
        };
    }

    private productUrlToFull(pUrl: string): string {
        if (!pUrl) return '';
        if (pUrl.startsWith('//')) return 'https:' + pUrl;
        if (pUrl.startsWith('http')) return pUrl;
        return `https://www.lazada.vn${pUrl.startsWith('/') ? '' : '/'}${pUrl}`;
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

    private async injectCookies(page: Page): Promise<void> {
        let cookieObjects: any[] = [];
        if (this.cookies) {
            try {
                cookieObjects = intelligentCookieParse(this.cookies);
            } catch (e) { /* ignore */ }
        }

        if (cookieObjects.length === 0) {
            try {
                // Thử load từ file backup lazada-cookies.ts
                const cookieModule = require('./lazada-cookies');
                if (cookieModule.LAZADA_COOKIES) cookieObjects = cookieModule.LAZADA_COOKIES;
            } catch (e) { /* ignore */ }
        }

        if (cookieObjects.length > 0) {
            const validCookies = cookieObjects.map((c: any) => ({
                name: c.name,
                value: c.value,
                domain: c.domain || '.lazada.vn',
                path: c.path || '/',
                secure: true,
                sameSite: 'None' as const
            }));
            try {
                await page.setCookie(...validCookies);
                logger.info(`[Lazada] 🍪 Injected ${validCookies.length} session cookies.`);
            } catch (e) {
                logger.warn(`[Lazada] Cookie injection failed: ${e}`);
            }
        }
    }

    /**
     * CÀO THEO TỪ KHÓA (FULL-FEATURED)
     */
    async crawl(options: PuppeteerCrawlOptions = {}): Promise<CrawledProduct[]> {
        await this.initialize();
        const query = options.keyword || options.query || 'iphone';
        const maxPages = options.maxPages || 5;
        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();

        logger.info(`🔍 [Lazada] Full-featured mobile-emulated crawl: "${query}"`);

        try {
            const page = await this.getPage();

            // EMULATE MOBILE: More reliable for Lazada
            const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
            await page.setUserAgent(mobileUA);
            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

            // Điều hướng tới trang chủ để mồi session
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
            await this.injectCookies(page);
            await page.reload({ waitUntil: 'domcontentloaded' });

            let totalInserted = 0;
            let totalUpdated = 0;

            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                if (this.shouldStop) break;

                logger.info(`[Lazada] 📄 Page ${pageNum}/${maxPages} for "${query}"`);
                const apiSearchUrl = `${this.baseUrl}/catalog/?q=${encodeURIComponent(query)}&page=${pageNum}`;

                const pageProducts = await this.fetchProductsApi(page, apiSearchUrl);
                if (pageProducts.length === 0) {
                    logger.warn(`[Lazada] Page ${pageNum} returned no products. Stopping search...`);
                    break;
                }

                const result = await this.saveProducts(pageProducts);
                totalInserted += result.inserted;
                totalUpdated += result.updated;
                products.push(...pageProducts);

                await this.updateCrawlLog(logId, {
                    total: products.length,
                    newItems: totalInserted,
                    updated: totalUpdated,
                    errors: 0
                }, false);

                // Delay ngẫu nhiên để tránh detection
                const delay = 5000 + Math.random() * 7000;
                await this.sleep(delay);
            }
        } catch (error: any) {
            logger.error(`[Lazada] Crawl error: ${error.message}`);
        } finally {
            await this.updateCrawlLog(logId, {
                status: 'completed',
                total: products.length
            } as any);
            await this.releaseBrowser();
        }

        return products;
    }

    /**
     * CÀO TOÀN BỘ SÀN (MASS CRAWL) - PREMIUM FEATURE
     */
    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        logger.info(`[Lazada] 🚀 Starting Global Mass Crawl...`);
        const maxPages = options.pagesPerCategory || 20;
        const allProducts: CrawledProduct[] = [];

        await this.initialize();
        const { CrawlProgressService } = await import('./crawlProgressService');

        try {
            const page = await this.getPage();
            const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
            await page.setUserAgent(mobileUA);
            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
            await this.injectCookies(page);

            while (!this.shouldStop) {
                const dbCategories = await CategoryService.getCategories(this.sourceId);
                const dbKeywords = await KeywordService.getKeywords('lazada');

                const uncrawledCats = await CrawlProgressService.getUncrawledCategories(this.sourceId, dbCategories, 24);
                const targetsFromKeywords = dbKeywords.map(k => k.keyword);
                const uncrawledKeys = await CrawlProgressService.getUncrawledKeywords(this.sourceId, targetsFromKeywords, 24);

                if (uncrawledCats.length === 0 && uncrawledKeys.length === 0) {
                    logger.info(`[Lazada] ✅ Nothing to crawl. Idle for 30m...`);
                    for (let i = 0; i < 30 && !this.shouldStop; i++) await this.sleep(60000);
                    continue;
                }

                const logId = await this.createCrawlLog();
                let totalInserted = 0, totalUpdated = 0, sessionTotal = 0;

                // Ưu tiên Categories
                for (const cat of uncrawledCats) {
                    if (this.shouldStop) break;
                    let slug = CategoryService.getSourceSlug(cat, 'lazada');
                    if (!slug) continue;

                    slug = slug.startsWith('/') ? slug.substring(1) : slug;
                    if (!slug.endsWith('/')) slug += '/';

                    logger.info(`[Lazada] 📁 Category: ${cat.name} (${slug})`);

                    for (let p = 1; p <= maxPages; p++) {
                        if (this.shouldStop) break;
                        const url = `${this.baseUrl}/${slug}?page=${p}`;
                        const products = await this.fetchProductsApi(page, url);

                        if (!products || products.length === 0) break;

                        const result = await this.saveProducts(products);
                        totalInserted += result.inserted;
                        totalUpdated += result.updated;
                        sessionTotal += products.length;
                        allProducts.push(...products);

                        await this.updateCrawlLog(logId, {
                            total: sessionTotal,
                            newItems: totalInserted,
                            updated: totalUpdated,
                            errors: 0
                        }, false);

                        await this.sleep(4000 + Math.random() * 4000);
                    }
                }

                // Sau đó tới Keywords
                for (const kw of uncrawledKeys) {
                    if (this.shouldStop) break;
                    logger.info(`[Lazada] 🔑 Keyword: ${kw}`);
                    for (let p = 1; p <= 10; p++) {
                        if (this.shouldStop) break;
                        const url = `${this.baseUrl}/catalog/?q=${encodeURIComponent(kw)}&page=${p}`;
                        const products = await this.fetchProductsApi(page, url);
                        if (!products || products.length === 0) break;

                        const result = await this.saveProducts(products);
                        totalInserted += result.inserted;
                        totalUpdated += result.updated;
                        sessionTotal += products.length;

                        await this.updateCrawlLog(logId, {
                            total: sessionTotal,
                            newItems: totalInserted,
                            updated: totalUpdated,
                            errors: 0
                        }, false);

                        await this.sleep(4000 + Math.random() * 4000);
                    }
                }

                await this.updateCrawlLog(logId, { status: 'completed' } as any);
                await this.sleep(10000);
            }
        } finally {
            await this.releaseBrowser();
        }

        return allProducts;
    }

    /**
     * CÀO MỘT DANH MỤC CỤ THỂ
     */
    async crawlCategory(categorySlug: string, maxPages: number = 20): Promise<CrawledProduct[]> {
        await this.initialize();
        const page = await this.getPage();
        const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
        await page.setUserAgent(mobileUA);
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
        await this.injectCookies(page);

        const allProducts: CrawledProduct[] = [];
        logger.info(`[Lazada] 🎯 Target Category Slug: ${categorySlug}`);

        for (let p = 1; p <= maxPages; p++) {
            if (this.shouldStop) break;
            const url = `${this.baseUrl}/${categorySlug}/?page=${p}`;
            const products = await this.fetchProductsApi(page, url);
            if (products.length === 0) break;

            allProducts.push(...products);
            await this.saveProducts(products);
            logger.info(`[Lazada] Page ${p}: Scraped ${products.length} products`);
            await this.sleep(5000 + Math.random() * 3000);
        }

        await this.releaseBrowser();
        return allProducts;
    }
}

