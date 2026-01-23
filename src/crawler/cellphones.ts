import { Page } from 'puppeteer';
import { PuppeteerCrawlerBase, PuppeteerCrawlOptions } from './puppeteerBase';
import { CrawledProduct, CrawlRequest } from './base';
import { CategoryService, CategoryNode } from './categoryService';
import { KeywordService } from './keywordService';
import logger from '../utils/logger';

export class CellphonesCrawler extends PuppeteerCrawlerBase {
    private readonly baseUrl = 'https://cellphones.com.vn';
    private readonly graphqlUrl = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';

    constructor(options?: any) {
        super('cellphones', options);
    }

    /**
     * Inject GraphQL Query into Browser Context
     */
    private async fetchGraphQL(page: Page, queryStr: string, variables: any): Promise<CrawledProduct[]> {

        try {
            const result = await page.evaluate(async (url, q, v) => {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Origin': 'https://cellphones.com.vn',
                            'Referer': 'https://cellphones.com.vn/',
                            // Add other headers if necessary, but Browser usually handles User-Agent etc.
                        },
                        body: JSON.stringify({
                            query: q,
                            variables: v
                        })
                    });

                    if (!response.ok) return { error: `Status ${response.status}` };
                    const data = await response.json();
                    return { data };
                } catch (e) {
                    return { error: e instanceof Error ? e.message : String(e) };
                }
            }, this.graphqlUrl, queryStr, variables);

            if (result.error) {
                logger.warn(`[CellphoneS] GraphQL error: ${result.error}`);
                return [];
            }

            if (!result.data || !result.data.data || !result.data.data.advanced_search || !result.data.data.advanced_search.products) {
                logger.warn(`[CellphoneS] Invalid GraphQL response structure`);
                return [];
            }

            const items = result.data.data.advanced_search.products;
            const products: CrawledProduct[] = [];

            for (const item of items) {
                // CellphoneS API: special_price is sale price, price is original
                const finalPrice = item.special_price || item.price || 0;

                // Skip if price is 0
                if (finalPrice <= 0) continue;

                const originalPrice = item.price || 0;
                const discount = (originalPrice > finalPrice && originalPrice > 0)
                    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
                    : 0;

                products.push({
                    externalId: item.product_id,
                    externalUrl: item.url_path ? (item.url_path.endsWith('.html') ? `${this.baseUrl}/${item.url_path}` : `${this.baseUrl}/${item.url_path}.html`) : '',
                    name: item.name,
                    price: finalPrice,
                    originalPrice: originalPrice > finalPrice ? originalPrice : undefined,
                    discountPercent: discount,
                    imageUrl: item.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://cdn2.cellphones.com.vn/358x358,webp,q100/media/catalog/product${item.thumbnail}`) : '',
                    rating: 5,
                    reviewCount: 0,
                    available: item.stock_available_id !== 46, // 46 might mean OOS or typical verify needed. Assuming available if present.
                    brand: item.category_objects?.[0]?.name || '',
                    metadata: {
                        sku: item.sku,
                        attributes: item.attributes
                    }
                });
            }

            return products;

        } catch (error) {
            logger.error(`[CellphoneS] Puppeteer evaluate error:`, error);
            return [];
        }
    }

    /**
     * Get the optimized GraphQL Query for Search
     */
    private getSearchQuery(): string {
        return `
            query advanced_search($terms: String!, $page: Int!) {
                advanced_search(
                    user_query: { 
                        terms: $terms,
                        province: 30
                    }
                    page: $page
                ) {
                    products {
                        product_id
                        name
                        sku
                        url_path
                        price
                        special_price
                        thumbnail
                        stock_available_id
                        category_objects {
                            name
                        }
                    }
                    meta {
                        total
                        page
                    }
                }
            }
        `;
    }

    async crawl(options: CrawlRequest = {}): Promise<CrawledProduct[]> {
        await this.initialize();
        const page = await this.getPage();
        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' }); // Set origin context

        const query = options.query;
        const categorySlug = options.category;
        const maxPages = options.maxPages || 30;

        const products: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let totalSaved = 0;

        logger.info(`[CellphoneS] 🚀 Starting GraphQL Crawl: ${query ? 'Query=' + query : 'Cat=' + categorySlug}`);

        for (let i = 1; i <= maxPages; i++) {
            if (this.shouldStop) break;

            // Construct Filter Variables
            // Construct Variables MATCHING the new query
            const variables = {
                terms: query || categorySlug, // Fallback: use category slug as keyword if query missing
                page: i
            };

            // Removed complex old filter logic as we now use simple search 'terms'
            if (!query && categorySlug) {
                // For category crawl, we treat categorySlug as a search term or find a better way?
                // The new API seems to rely on 'terms'. 
                // If we strictly want Category, we need to see if 'category_id' filter is supported in a different query.
                // For now, let's assume 'terms' handles it or we fallback to DOM for pure category.
            }

            // Correction: Browser-based GraphQL is best for SEARCH and massive listing. 
            // If we are given a slug "mobile", we might not know the ID "3". 
            // Benchmarking showed 'advanced_search' is great for keywords.
            // For categories, standard HTML crawl via Puppeteer is safer if we don't know the ID.

            // HYBRID APPROACH: 
            // If (query) -> Use GraphQL
            // If (category) -> Navigate to Page & Parse DOM (But with Puppeteer to bypass block)

            if (query) {
                // GraphQL Search Approach (remains same)
                logger.info(`[CellphoneS] Fetching GraphQL Page ${i} for "${query}"`);
                const pageProducts = await this.fetchGraphQL(page, this.getSearchQuery(), variables);
                if (pageProducts.length === 0) break;
                products.push(...pageProducts);

                // Save batch
                if (products.length >= 100) {
                    const toSave = products.splice(0, products.length);
                    const { inserted, updated } = await this.saveProducts(toSave);
                    totalSaved += inserted + updated;
                    await this.updateCrawlLog(logId, { total: totalSaved, newItems: inserted, updated: updated, errors: 0 }, false);
                }
            } else {
                // DOM Crawl for Category (or ID extraction for GraphQL Switch)

                // Only navigate ONCE at the start (i=1)
                if (i === 1) {
                    const url = `${this.baseUrl}/${categorySlug}.html`;
                    logger.info(`[CellphoneS] Navigating to ${url}`);
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

                    // 1. Try to extract Category ID for GraphQL from HTML Source
                    try {
                        const html = await page.content();
                        // Patterns: "categoryId": 3, "category_id": "3", filter: { category_id: ... }
                        // CellphoneS uses "currentCategoryId":3 or "category_id":3 in JSON blobs
                        const patterns = [
                            /"currentCategoryId"\s*:\s*"?(\d+)"?/,
                            /"categoryId"\s*:\s*"?(\d+)"?/,
                            /category_id\\?"\s*:\s*\\?"?(\d+)\\?"?/,
                            /"id"\s*:\s*(\d+),\s*"name"[^}]+Mobile/ // fallback context
                        ];

                        let catId = null;
                        for (const p of patterns) {
                            const m = html.match(p);
                            if (m) {
                                catId = m[1];
                                break;
                            }
                        }

                        if (catId) {
                            logger.info(`[CellphoneS] 💡 Found Category ID: ${catId}. Switching to GraphQL Mode!`);

                            // EXECUTE GRAPHQL LOOP HERE
                            let totalGraphQL = 0;
                            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                                if (this.shouldStop) break;

                                // Construct variables for Category
                                const catVars = {
                                    params: {
                                        filter: {
                                            is_active: { eq: "1" },
                                            category_id: { eq: catId } // Use the found ID
                                        },
                                        page_size: 20,
                                        page: pageNum
                                    }
                                };

                                logger.info(`[CellphoneS] Fetching GraphQL Page ${pageNum} for CatID ${catId}`);
                                const pageProducts = await this.fetchGraphQL(page, this.getSearchQuery(), catVars);
                                if (pageProducts.length === 0) break;

                                products.push(...pageProducts);
                                totalGraphQL += pageProducts.length;

                                // Save batch
                                if (products.length >= 100) {
                                    const toSave = products.splice(0, products.length);
                                    const { inserted, updated } = await this.saveProducts(toSave);
                                    totalSaved += inserted + updated;
                                    await this.updateCrawlLog(logId, { total: totalGraphQL, newItems: inserted, updated: updated, errors: 0 }, false);
                                }
                                await this.sleep(500); // polite
                            }

                            logger.info(`[CellphoneS] GraphQL finished. Total found: ${totalGraphQL}`);
                            // Break the outer loop (which is based on 'i') effectively by returning products now (or letting function finish)
                            // We need to stop the outer loop processing.
                            break;
                        } else {
                            logger.warn(`[CellphoneS] Could not find Category ID in HTML. Falling back to DOM crawl.`);
                        }
                    } catch (e) {
                        logger.error(`[CellphoneS] Error extracting ID: ${e}`);
                    }
                }

                // Extract products from current view
                // Scan broadly
                const currentProducts = await this.extractProductsFromDOM(page);

                let newCount = 0;
                for (const p of currentProducts) {
                    const exists = products.find(existing => existing.externalId === p.externalId);
                    if (!exists) {
                        products.push(p);
                        newCount++;
                    }
                }
                logger.info(`[CellphoneS] Page ${i}: Found ${currentProducts.length} items (${newCount} new). Total: ${products.length}`);

                // Save immediately
                if (products.length >= 50) {
                    const toSave = products.splice(0, products.length);
                    const { inserted, updated } = await this.saveProducts(toSave);
                    totalSaved += inserted + updated;
                    await this.updateCrawlLog(logId, { total: totalSaved, newItems: inserted, updated: updated, errors: 0 }, false);
                }

                // CHECK FOR PAGINATION / SHOW MORE
                const nextStep = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('a.btn-show-more, .btn-view-more, .cps-block-content_btn-showmore'));
                    const btn = buttons.find(b => b.textContent?.toLowerCase().includes('xem thêm') || b.clientHeight > 0) as HTMLAnchorElement;

                    if (btn) {
                        const href = btn.getAttribute('href');
                        // If it has a real link (not javascript: or #), return it
                        if (href && href.length > 2 && !href.startsWith('java') && !href.startsWith('#')) {
                            return { type: 'navigate', url: href };
                        }
                        // Otherwise it's a button to click
                        return { type: 'click' };
                    }
                    return null;
                });

                if (nextStep) {
                    if (nextStep.type === 'navigate') {
                        const nextUrl = nextStep.url!.startsWith('http') ? nextStep.url! : this.baseUrl + (nextStep.url!.startsWith('/') ? '' : '/') + nextStep.url!;
                        logger.info(`[CellphoneS] Navigating to next page: ${nextUrl}`);
                        await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                    } else {
                        logger.info(`[CellphoneS] Clicking 'Xem thêm' (SPA mode)...`);
                        await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('a.btn-show-more, .btn-view-more, .cps-block-content_btn-showmore'));
                            const btn = buttons.find(b => b.textContent?.toLowerCase().includes('xem thêm') || b.clientHeight > 0) as HTMLElement;
                            if (btn) {
                                btn.scrollIntoView({ block: 'center' });
                                btn.click();
                            }
                        });
                        await this.sleep(3000);
                        // Force scroll if SPA
                        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await this.sleep(1000);
                    }
                } else {
                    logger.info(`[CellphoneS] No 'Show More' button found. End of list.`);
                    break;
                }
            }

            // For GraphQL loop, we sleep here. For DOM loop, the sleep is inside the "if loadMoreClicked" block mostly.
            if (query) await this.sleep(1000);

        }

        if (products.length > 0) {
            const { inserted, updated } = await this.saveProducts(products);
            totalSaved += inserted + updated;
        }

        await this.updateCrawlLog(logId, { total: totalSaved, newItems: 0, updated: 0, errors: 0 });
        await this.releaseBrowser();
        return products;
    }

    // DOM Extraction Helper for Category Pages - GENERIC LINK SCANNER STRATEGY
    private async extractProductsFromDOM(page: Page): Promise<CrawledProduct[]> {
        return page.evaluate(() => {
            const items: CrawledProduct[] = [];

            // Strategy: Find ALL anchors. Filter those that look like product links AND have a price.
            const allLinks = Array.from(document.querySelectorAll('a'));

            allLinks.forEach(a => {
                const href = a.getAttribute('href');
                if (!href || !href.includes('.html')) return; // CellphoneS products usually end in .html

                // Skip non-product links (usually short, or administrative)
                if (href.length < 15) return;

                // Look for price inside the link or its parent/children
                // Expand search to parent container (up to 3 levels)
                let container = a as HTMLElement;
                let priceFound = '';
                let nameFound = '';

                // 1. Check inside the <a> tag first
                if (a.textContent && /\d{1,3}[.,]\d{3}/.test(a.textContent)) {
                    priceFound = a.textContent;
                }

                // 2. Walk up to find a container that holds both Name and Price
                let parent = a.parentElement;
                for (let i = 0; i < 3; i++) {
                    if (!parent) break;
                    const text = parent.textContent || '';
                    if (/\d{1,3}[.,]\d{3}/.test(text) && text.length < 500) { // arbitrary max length to avoid selecting the whole body
                        container = parent;
                        priceFound = text; // Just a boolean indicator really
                        break;
                    }
                    parent = parent.parentElement;
                }

                if (priceFound) {
                    // We found a container with a link and a price!
                    // Extract Name: Usually h3, or closest non-price text
                    const nameEl = container.querySelector('h3') || container.querySelector('.product__name') || a;
                    nameFound = nameEl.textContent?.trim() || '';

                    // Extract Price: Look for specific price classes or regex
                    const priceEl = container.querySelector('.price, .product__price--show, .special-price');
                    const priceTxt = priceEl?.textContent || priceFound; // Fallback to the broad text

                    // Extract Image
                    const imgEl = container.querySelector('img');
                    let imageUrl = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '';

                    // Clean up data
                    const cleanPrice = parseInt(priceTxt.replace(/[^\d]/g, '')) || 0;
                    if (cleanPrice <= 0) return; // Skip zero price
                    if (cleanPrice < 100000 && !nameFound.toLowerCase().includes('ốp') && !nameFound.toLowerCase().includes('dán')) {
                        // Potential accessory, but let's keep it if name suggests it. 
                        // For data quality, we mainly care about price > 0.
                    }

                    const externalId = href;

                    // Basic dedupe in this loop
                    if (!items.find(i => i.externalId === externalId)) {
                        items.push({
                            externalId: externalId,
                            externalUrl: href.startsWith('http') ? href : `https://cellphones.com.vn${href}`,
                            name: nameFound || 'Unknown Product',
                            price: cleanPrice,
                            imageUrl: imageUrl,
                            rating: 5,
                            reviewCount: 0,
                            available: true,
                            brand: '',
                            category: '',
                            metadata: {}
                        } as any);
                    }
                }
            });

            // Debug: If 0 items, return some info about the page
            if (items.length === 0) {
                // Return a dummy item with error info to log back in Node
                // (Hack but effective)
                /* 
                items.push({
                    externalId: 'DEBUG',
                    name: 'DEBUG_INFO: ' + document.body.innerHTML.substring(0, 500),
                    ...
                });
                */
            }

            return items;
        });
    }

    async crawlCategory(categorySlug: string, maxPages?: number): Promise<CrawledProduct[]> {
        return this.crawl({ category: categorySlug, maxPages });
    }

    async massCrawl(options: { pagesPerCategory?: number } = {}): Promise<CrawledProduct[]> {
        logger.info(`[CellphoneS] 🚀 Starting SMART EXHAUSTIVE Crawl...`);
        const maxPages = options.pagesPerCategory || 100;
        const allProducts: CrawledProduct[] = [];

        await this.initialize();
        const { CrawlProgressService } = await import('./crawlProgressService');

        while (!this.shouldStop) {
            // 1. Lấy mục tiêu từ Database
            const dbCategories = await CategoryService.getCategories(this.sourceId);
            const dbKeywords = await KeywordService.getKeywords('cellphones');

            // 2. Lọc những mục cần cào (chưa cào trong 24h)
            const uncrawledCats = await CrawlProgressService.getUncrawledCategories(this.sourceId, dbCategories, 24);
            const targetsFromKeywords = dbKeywords.map(k => k.keyword);
            const uncrawledKeys = await CrawlProgressService.getUncrawledKeywords(this.sourceId, targetsFromKeywords, 24);

            if (uncrawledCats.length === 0 && uncrawledKeys.length === 0) {
                logger.info(`[CellphoneS] ✅ Đã cào sạch sàn. Nghỉ 1 tiếng...`);
                for (let i = 0; i < 60 && !this.shouldStop; i++) await this.sleep(60000);
                continue;
            }

            logger.info(`[CellphoneS] 🎯 Mục tiêu: ${uncrawledCats.length} danh mục, ${uncrawledKeys.length} từ khóa`);

            // 3. Cào Danh mục (DOM fallback)
            for (const cat of uncrawledCats) {
                if (this.shouldStop) break;
                logger.info(`[CellphoneS] 📂 Vét cạn danh mục: ${cat.name}`);
                const products = await this.crawl({ category: cat.slug, maxPages: 50 });
                allProducts.push(...products);
                await this.sleep(5000);
            }

            // 4. Cào Từ khóa (GraphQL)
            for (const kw of uncrawledKeys) {
                if (this.shouldStop) break;
                logger.info(`[CellphoneS] 🔍 Vét cạn từ khóa: ${kw}`);
                const products = await this.crawl({ query: kw, maxPages: maxPages });
                allProducts.push(...products);
                await this.sleep(5000);
            }

            logger.info(`[CellphoneS] 🔄 Kết thúc vòng. Tổng: ${allProducts.length}`);
            await this.sleep(10000);
        }

        return allProducts;
    }
}
