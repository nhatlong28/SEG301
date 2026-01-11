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

            // Construct initial URL
            let url: string;
            if (isKeywordSearch) {
                url = `${this.baseUrl}/catalogsearch/result?q=${encodeURIComponent(keyword)}`;
            } else {
                url = `${this.baseUrl}/${category}.html`;
            }

            logger.info(`[CellphoneS-Puppeteer] 📄 Loading initial page: ${url}`);

            const success = await this.navigateWithRetry(page, url);
            if (!success) {
                throw new Error('Navigation failed');
            }

            let pageNum = 1;
            let hasMore = true;
            const seenIds = new Set<string>();

            while (pageNum <= maxPages && hasMore) {
                if (this.shouldStop) break;

                try {
                    logger.info(`[CellphoneS-Puppeteer] 🔍 Processing page ${pageNum}...`);

                    // Scroll to load lazy images and trigger potential infinite scroll
                    await this.scrollPage(page, 3);

                    // Get HTML content and parse
                    const html = await page.content();
                    const items = this.parseListingPage(html);

                    consecutiveErrors = 0;

                    if (!items.length) {
                        logger.info(`[CellphoneS-Puppeteer] No items found on page ${pageNum}`);
                        break;
                    }

                    // For the "Load more" pattern, the page keeps growing. 
                    // We track seenIds across all pages of the same search/category
                    const newItems = items.filter(item => !seenIds.has(item.externalId));

                    if (newItems.length > 0) {
                        newItems.forEach(item => seenIds.add(item.externalId));
                        products.push(...newItems);
                        logger.info(`[CellphoneS-Puppeteer] Page ${pageNum}: Added ${newItems.length} new items, total session: ${seenIds.size}`);
                    } else if (pageNum > 1) {
                        logger.info(`[CellphoneS-Puppeteer] No new items found after previous "Show more" click.`);
                    }

                    // Update Session count in UI
                    await this.updateCrawlLog(logId, {
                        total: totalSaved + products.length,
                        newItems: totalSaved,
                        updated: 0,
                        errors: errorCount,
                    }, false);

                    // Save batch every 100 products
                    if (products.length >= 100) {
                        const toSave = products.splice(0, 100);
                        const { inserted } = await this.saveProducts(toSave);
                        totalSaved += inserted;
                    }

                    // Check for "Show More" button to continue
                    if (pageNum < maxPages) {
                        const showMoreSelector = '.button__show-more-product, .cps-block-content_btn-showmore, .btn-show-more, .load-more-btn';
                        const showMoreBtnVisible = await page.evaluate((sel) => {
                            const btn = document.querySelector(sel);
                            if (!btn) return false;
                            const style = window.getComputedStyle(btn);
                            return style.display !== 'none' && style.visibility !== 'hidden' && btn.getBoundingClientRect().height > 0;
                        }, showMoreSelector);

                        if (showMoreBtnVisible) {
                            logger.info(`[CellphoneS-Puppeteer] 🖱️ Clicking "Show More" button...`);

                            try {
                                // Find the button by text and visibility
                                const buttonWasClicked = await page.evaluate((sel) => {
                                    const elements = Array.from(document.querySelectorAll(sel));
                                    const btn: any = elements.find(el => {
                                        const text = el.textContent?.toLowerCase() || '';
                                        const isVisible = el.getBoundingClientRect().height > 0;
                                        return isVisible && text.includes('xem thêm') && text.includes('sản phẩm');
                                    }) || elements.find(el => el.getBoundingClientRect().height > 0);

                                    if (btn) {
                                        btn.scrollIntoView({ behavior: 'auto', block: 'center' });
                                        btn.click(); // Standard JS click is often most reliable for these
                                        return btn.textContent?.trim() || true;
                                    }
                                    return false;
                                }, showMoreSelector);

                                if (buttonWasClicked) {
                                    logger.info(`[CellphoneS-Puppeteer] ✅ Clicked button: "${buttonWasClicked}"`);

                                    // CRITICAL: Scroll down to the bottom after clicking.
                                    // Many sites only trigger the AJAX load or render the items when you scroll down.
                                    await this.scrollPage(page, 2);

                                    // Wait for new content to load - check if item count increases
                                    const currentItemCount = items.length;
                                    let loaded = false;
                                    for (let attempt = 0; attempt < 10; attempt++) {
                                        await this.sleep(1500);
                                        // Scroll a bit more each time to trigger lazy rendering
                                        await page.evaluate(() => window.scrollBy(0, 500));

                                        const newHtml = await page.content();
                                        const newItemsFound = this.parseListingPage(newHtml);
                                        const newItemsCount = newItemsFound.length;

                                        if (newItemsCount > currentItemCount) {
                                            loaded = true;
                                            logger.info(`[CellphoneS-Puppeteer] 🆕 New items detected! Total: ${newItemsCount} (was ${currentItemCount})`);
                                            break;
                                        }

                                        if (attempt === 5) {
                                            // Halfway through, try clicking again just in case
                                            await page.evaluate((s) => {
                                                const b: any = document.querySelector(s);
                                                if (b) b.click();
                                            }, showMoreSelector);
                                        }
                                    }

                                    if (!loaded) {
                                        logger.warn(`[CellphoneS-Puppeteer] Clicked "Show More" but count stayed at ${currentItemCount} (15 seconds).`);
                                    }
                                } else {
                                    logger.warn(`[CellphoneS-Puppeteer] Show more button was supposed to be visible but could not click it.`);
                                    hasMore = false;
                                }
                            } catch (clickErr: any) {
                                logger.warn(`[CellphoneS-Puppeteer] Failed to click "Show More" button: ${clickErr.message || clickErr}`);
                                hasMore = false;
                            }
                        } else {
                            logger.info(`[CellphoneS-Puppeteer] No "Show More" button found or it's hidden. Reached end.`);
                            hasMore = false;
                        }
                    }

                    pageNum++;
                    await this.sleep(1000 + Math.random() * 1000);
                } catch (error: any) {
                    const errMsg = error instanceof Error
                        ? `${error.name}: ${error.message}`
                        : (typeof error === 'object' ? JSON.stringify(error) : String(error));

                    logger.error(`[CellphoneS-Puppeteer] Error during page ${pageNum} processing: ${errMsg}`);
                    if (error instanceof Error && error.stack) {
                        logger.debug(`[CellphoneS-Puppeteer] Stack trace: ${error.stack}`);
                    }
                    errorCount++;
                    consecutiveErrors++;

                    if (consecutiveErrors >= 3) {
                        logger.error('[CellphoneS-Puppeteer] Too many consecutive errors, stopping crawl');
                        break;
                    }

                    pageNum++;
                    await this.sleep(3000);
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
     * Mass crawl - ENHANCED with Smart Auto-Skip
     */
    async massCrawl(options: { pagesPerCategory?: number; pagesPerKeyword?: number } = {}): Promise<CrawledProduct[]> {
        await this.initialize();
        const maxPagesCategory = options.pagesPerCategory || 50;
        const maxPagesKeyword = options.pagesPerKeyword || 20;

        const allProducts: CrawledProduct[] = [];
        const logId = await this.createCrawlLog();
        let totalErrors = 0;

        // Import CrawlProgressService for smart tracking
        const { CrawlProgressService } = await import('./crawlProgressService');

        // 🌳 PHASE 1: Fetch category tree from CategoryService
        logger.info('[CellphoneS] 🌳 Fetching category tree...');
        const categoryTree = await CategoryService.fetchCellphonesCategoryTree();
        const leafCategories = CategoryService.getLeafCategories(categoryTree);
        const allCategoriesFromTree = CategoryService.flattenCategories(categoryTree);

        // Prioritize leaf categories (more specific)
        let categories = [...leafCategories, ...allCategoriesFromTree.filter(c => c.level === 0)]
            .map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: String(cat.slug || cat.id)
            }));

        // Remove duplicates
        const seenSlugs = new Set<string>();
        categories = categories.filter(c => {
            if (seenSlugs.has(c.slug)) return false;
            seenSlugs.add(c.slug);
            return true;
        });

        // 🚀 SMART AUTO-SKIP: Filter out recently crawled categories
        const uncrawledCategories = await CrawlProgressService.getUncrawledCategories(
            this.sourceId,
            categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
            24
        );

        if (uncrawledCategories.length > 0) {
            const skipped = categories.length - uncrawledCategories.length;
            categories = uncrawledCategories.map(c => ({ id: c.id, name: c.name, slug: c.slug! }));
            logger.info(`[CellphoneS] ⏭️ SMART SKIP: ${skipped} categories already crawled, ${categories.length} remaining`);
        }

        // Fetch keywords from database (ONLY older than 24h)
        let keywords = await KeywordService.getKeywordStrings('cellphones', undefined, 24);

        // 🚀 SMART AUTO-SKIP: Filter out recently crawled keywords
        const uncrawledKeywords = await CrawlProgressService.getUncrawledKeywords(this.sourceId, keywords, 24);
        if (uncrawledKeywords.length > 0) {
            keywords = uncrawledKeywords;
        }

        logger.info(`[CellphoneS-Puppeteer] Starting MASS CRAWL: ${categories.length} categories + ${keywords.length} keywords`);

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
            'div.product-info-container', // Most reliable
            'div.product-item',
            'div.item-product',
            'div.cps-product-item',
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

                        // Original price - updated selector
                        const originalPriceText = $el.find('.product__price--through, .product-price__old, .price-old, del, .product-info__price-old').text();
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
        if (!url) return null;
        // Extract ID from URL like /iphone-15-pro-max.html
        const match = url.match(/\/([^/]+)\.html/);
        if (match) {
            return match[1].replace(/-/g, '_');
        }
        // Fallback for relative URLs or different formats
        const slug = url.split('/').pop()?.replace('.html', '');
        if (slug) return slug.replace(/-/g, '_');

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
