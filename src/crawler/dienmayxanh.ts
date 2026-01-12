import { Page } from 'puppeteer';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct, CrawlRequest } from './base';
import { CategoryService, CategoryNode } from './categoryService';
import { KeywordService } from './keywordService';
import logger from '../utils/logger';
import * as cheerio from 'cheerio';

export class DienmayxanhCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://www.dienmayxanh.com';
    private readonly apiUrl = 'https://www.dienmayxanh.com/Category/FilterProductBox';

    constructor() {
        super('dienmayxanh', { rateLimit: 2 });
    }

    /**
     * Resolve Category ID from Slug using functionality injected into Browser
     */
    private async resolveCategoryId(page: Page, slug: string): Promise<string | null> {
        try {
            await page.goto(`${this.baseUrl}/${slug}`, { waitUntil: 'domcontentloaded' });

            return await page.evaluate(() => {
                // Method 1: cateID variable
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (window.cateID) return String(window.cateID);

                // Method 2: Hidden Input
                const hidden = document.querySelector('#hdCateId');
                if (hidden && hidden.getAttribute('value')) return hidden.getAttribute('value');

                // Method 3: Class name __cate_123
                const bodyHtml = document.body.innerHTML;
                const match = bodyHtml.match(/class="[^"]*__cate_(\d+)/);
                if (match) return match[1];

                return null;
            });
        } catch (e) {
            return null;
        }
    }

    /**
     * Inject AJAX POST to FilterProductBox
     */
    private async fetchAjaxApi(page: Page, categoryId: string, pageIndex: number): Promise<string> {
        return page.evaluate(async (url, cid, pi) => {
            try {
                // Must form-encode body
                const body = new URLSearchParams();
                body.append('IsParentCate', 'False');
                body.append('prevent', 'true');
                // The API needs 'c' (Category) and 'pi' (PageIndex) in the Query Params typically,
                // BUT implementation varies. Benchmarks show it works with Query Params + POST body.

                const response = await fetch(`${url}?c=${cid}&pi=${pi}&o=13`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: body.toString()
                });

                if (!response.ok) return '';
                const json = await response.json();
                return json.listproducts || ''; // Contains HTML
            } catch (e) {
                return '';
            }
        }, this.apiUrl, categoryId, pageIndex);
    }

    /**
     * Crawl a specific category by slug
     */
    async crawlCategory(categorySlug: string, maxPages: number = 20): Promise<CrawledProduct[]> {
        return this.crawl({ categorySlug, maxPages });
    }

    async crawl(options: CrawlRequest = {}): Promise<CrawledProduct[]> {
        await this.initialize();
        const page = await this.getPage();

        const categorySlug = options.categorySlug || options.category || 'dien-thoai';
        const maxPages = options.maxPages || 20;
        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();

        logger.info(`[DienmayXanh] 🚀 Starting Puppeteer Crawl: Cat=${categorySlug}`);

        // 1. Resolve Category ID
        const categoryId = await this.resolveCategoryId(page, categorySlug);
        if (!categoryId) {
            logger.error(`[DienmayXanh] Could not resolve ID for ${categorySlug}`);
            await this.releaseBrowser();
            return [];
        }
        logger.info(`[DienmayXanh] Resolved ID: ${categoryId}`);

        // 2. Iterate Pages
        let totalSaved = 0;

        for (let i = 0; i < maxPages; i++) {
            if (this.shouldStop) break;

            logger.info(`[DienmayXanh] API Page ${i} for Cat ${categoryId}`);
            const htmlFragment = await this.fetchAjaxApi(page, categoryId, i);

            if (!htmlFragment || htmlFragment.length < 50) {
                logger.info('[DienmayXanh] Empty response, stopping.');
                break;
            }

            // Parse with Cheerio (lightweight)
            const items = this.parseListingPage(htmlFragment);
            if (items.length === 0) break;

            products.push(...items);

            if (products.length >= 100) {
                const toSave = products.splice(0, products.length);
                const { inserted, updated } = await this.saveProducts(toSave);
                totalSaved += inserted + updated;
                await this.updateCrawlLog(logId, { total: totalSaved, newItems: inserted, updated: updated, errors: 0 }, false);
            }

            await this.sleep(1000);
        }

        // Final save
        if (products.length > 0) {
            const { inserted, updated } = await this.saveProducts(products);
            totalSaved += inserted + updated;
        }

        await this.updateCrawlLog(logId, { total: totalSaved, newItems: 0, updated: 0, errors: 0 });
        await this.releaseBrowser();
        return products;
    }

    // Reuse the parsing logic from before, but stripped down
    private parseListingPage(html: string): CrawledProduct[] {
        const products: CrawledProduct[] = [];
        const $ = cheerio.load(html);

        $('.item, .product-item, .listproduct li').each((_, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();

            // 1. Extract Name & Price
            // Try attributes first, then text fallback
            const attrName = $link.attr('data-name') || $el.attr('data-name');
            const attrPrice = parseInt($link.attr('data-price') || $el.attr('data-price') || '0');
            const attrBrand = $link.attr('data-brand') || $el.attr('data-brand');
            const attrCate = $link.attr('data-cate') || $el.attr('data-cate');

            const name = attrName || $el.find('h3, .name').text().trim();
            const price = attrPrice || parseInt($el.find('.price, strong').text().replace(/[^\d]/g, '')) || 0;

            // Skip if no name or price is 0
            if (!name || price <= 0) return;

            // 2. Extract External ID (Numeric Priority)
            // Strategy: Look for data-id on Container OR Link.
            // Also check 'id' attribute if it looks numeric.
            let id = $el.attr('data-id') || $link.attr('data-id');
            if (!id && $el.attr('id') && /^\d+$/.test($el.attr('id') || '')) {
                id = $el.attr('id');
            }

            // Fallback: Check for data-product-id (sometimes used)
            if (!id) id = $el.attr('data-product-id');

            // 3. Extract URL
            let externalUrl = $link.attr('href') || $el.attr('data-url') || '';
            if (externalUrl && !externalUrl.startsWith('http')) {
                externalUrl = this.baseUrl + externalUrl.replace(/^\//, ''); // Ensure single slash
            }

            // CRITICAL: If ID is still missing or not numeric, we have a problem.
            // But for now, if we found a valid product (name+price), we might have to accept a non-standard ID
            // or try to extract from URL if possible (though TGDD URLs are slugs).
            // However, User Request is specifically complaining about URL-based IDs.
            // Examples show TGDD/DMX usually have data-id.
            if (!id) {
                // Last ditch: check class name for pattern like __cate_12345 (cat id) or product-123 (prod id)
                // But usually missing data-id means it's a weird variant item.
                // If externalUrl exists, use it as fallback but log warning
                // logger.warn(`[DienmayXanh] Missing numeric ID for ${name}. HTML: ${$el.html()?.substring(0, 50)}`);
                // For now, keep the fallback to URL to avoid losing data, but prefer numeric.
                id = externalUrl;
            }

            const imageUrl = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

            products.push({
                externalId: id, // Prioritize numeric data-id
                name,
                price,
                available: true,
                externalUrl,
                imageUrl,
                brand: attrBrand || '',
                category: attrCate || '',
            } as any);
        });

        return products;
    }

    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        logger.info(`[DienmayXanh] 🚀 Starting SMART EXHAUSTIVE Crawl...`);
        const maxPages = options.pagesPerCategory || 100;
        const allProducts: CrawledProduct[] = [];

        await this.initialize();
        const { CrawlProgressService } = await import('./crawlProgressService');

        while (!this.shouldStop) {
            // 1. Lấy mục tiêu từ Database
            const dbCategories = await CategoryService.getCategories(this.sourceId);
            const dbKeywords = await KeywordService.getKeywordStrings('dienmayxanh', undefined, 24);

            // 2. Lọc danh mục chưa cào
            const uncrawledCats = await CrawlProgressService.getUncrawledCategories(this.sourceId, dbCategories, 24);
            const uncrawledKeys = await CrawlProgressService.getUncrawledKeywords(this.sourceId, dbKeywords, 24);

            if (uncrawledCats.length === 0 && uncrawledKeys.length === 0) {
                logger.info(`[DienmayXanh] ✅ Đã cào sạch sàn. Nghỉ 1 tiếng...`);
                for (let i = 0; i < 60 && !this.shouldStop; i++) await this.sleep(60000);
                continue;
            }

            logger.info(`[DienmayXanh] 🎯 Mục tiêu: ${uncrawledCats.length} danh mục, ${uncrawledKeys.length} từ khóa`);

            // 3. Cào Danh mục
            for (const cat of uncrawledCats) {
                if (this.shouldStop) break;
                logger.info(`[DienmayXanh] 📂 Vét cạn danh mục: ${cat.name}`);
                const products = await this.crawl({ category: cat.slug, maxPages: maxPages });
                allProducts.push(...products);
                await this.sleep(10000);
            }

            // 4. Cào Từ khóa
            for (const kw of uncrawledKeys) {
                if (this.shouldStop) break;
                logger.info(`[DienmayXanh] 🔍 Vét cạn từ khóa: ${kw}`);
                const products = await this.crawl({ query: kw, maxPages: 20 });
                allProducts.push(...products);
                await this.sleep(10000);
            }

            logger.info(`[DienmayXanh] 🔄 Kết thúc vòng. Tổng: ${allProducts.length}`);
            await this.sleep(30000);
        }

        return allProducts;
    }
}
