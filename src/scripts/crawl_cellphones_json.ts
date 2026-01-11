/**
 * CellphoneS Mass Crawler - JSON Output
 * 
 * Mục tiêu: Cào 300,000 sản phẩm unique từ CellphoneS
 * - Lấy keywords từ bảng crawl_keywords trong Supabase
 * - Lưu ra file JSONL theo schema raw_products
 * - Không lưu vào database, chỉ xuất file
 */

import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { KeywordService } from '../crawler/keywordService';
import { CrawledProduct } from '../crawler/base';
import logger from '../utils/logger';

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
    TARGET_PRODUCTS: 300000,
    GRAPHQL_URL: 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query',
    BASE_URL: 'https://cellphones.com.vn',
    SOURCE_ID: 4, // cellphones source_id in DB
    MAX_PAGES_PER_KEYWORD: 100, // Crawl up to 100 pages per keyword
    DELAY_BETWEEN_PAGES: 500, // ms
    DELAY_BETWEEN_KEYWORDS: 2000, // ms
    BATCH_SAVE_SIZE: 50, // Save every N products
};

// Data directory
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Track unique products
const uniqueIds = new Set<string>();
const OUTPUT_FILE = path.join(DATA_DIR, 'cellphones_products.jsonl');

// Load existing IDs from file
function loadExistingIds() {
    if (fs.existsSync(OUTPUT_FILE)) {
        console.log('📂 Loading existing IDs from file...');
        const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        for (const line of lines) {
            try {
                const p = JSON.parse(line);
                if (p.external_id) uniqueIds.add(String(p.external_id));
            } catch { }
        }
        console.log(`✅ Loaded ${uniqueIds.size} existing unique products`);
    }
}

// Build GraphQL Query with INLINE parameters (CellphoneS API style)
function buildSearchQuery(keyword: string, pageNum: number): string {
    // Escape quotes in keyword to prevent GraphQL injection
    const escapedKeyword = keyword.replace(/"/g, '\\"');
    return `
        query advanced_search {
            advanced_search(
                user_query: { 
                    terms: "${escapedKeyword}",
                    province: 30
                }
                page: ${pageNum}
            ) {
                products {
                    province_id
                    product_id
                    name
                    product_condition
                    sku
                    url_path
                    price
                    prices
                    special_price
                    stock_available_id
                    thumbnail
                    sticker
                    flash_sale_types
                    promotion_information
                    category_objects {
                        path
                        category_id
                        level
                        name
                        uri
                    }
                    score
                    view
                }
                meta {
                    total
                    page
                }
            }
        }
    `;
}

// Fetch products via GraphQL (browser-injected)
async function fetchGraphQL(page: Page, keyword: string, pageNum: number): Promise<{ products: CrawledProduct[], totalPages: number }> {
    const query = buildSearchQuery(keyword, pageNum);

    try {
        const result = await page.evaluate(async (url, queryStr) => {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: queryStr, variables: {} })
                });
                if (!response.ok) return { error: `HTTP ${response.status}` };
                return { data: await response.json() };
            } catch (e: any) {
                return { error: e.message || String(e) };
            }
        }, CONFIG.GRAPHQL_URL, query);

        if (result.error) {
            logger.warn(`[GraphQL] Error: ${result.error}`);
            return { products: [], totalPages: 0 };
        }

        const data = result.data?.data?.advanced_search;
        if (!data || !data.products) {
            return { products: [], totalPages: 0 };
        }

        const products: CrawledProduct[] = data.products.map((item: any) => {
            const finalPrice = item.special_price || item.price || 0;
            const originalPrice = item.price || 0;
            const discount = (originalPrice > finalPrice && originalPrice > 0)
                ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
                : 0;

            return {
                externalId: String(item.product_id),
                externalUrl: item.url_path
                    ? `${CONFIG.BASE_URL}/${item.url_path}${item.url_path.endsWith('.html') ? '' : '.html'}`
                    : '',
                name: item.name,
                price: finalPrice,
                originalPrice: originalPrice > finalPrice ? originalPrice : undefined,
                discountPercent: discount,
                imageUrl: item.thumbnail
                    ? (item.thumbnail.startsWith('http')
                        ? item.thumbnail
                        : `https://cdn2.cellphones.com.vn/358x358,webp,q100/media/catalog/product${item.thumbnail}`)
                    : '',
                rating: 5,
                reviewCount: 0,
                available: item.stock_available_id !== 46,
                brand: item.category_objects?.[0]?.name || '',
                category: item.category_objects?.map((c: any) => c.name).join(' > ') || '',
                specs: item.attributes || {},
                metadata: { sku: item.sku }
            };
        });

        // Calculate total pages from total items (assuming 20 items per page)
        const totalItems = data.meta?.total || 0;
        const totalPages = Math.ceil(totalItems / 20);

        return {
            products,
            totalPages
        };
    } catch (error) {
        logger.error(`[GraphQL] Exception:`, error);
        return { products: [], totalPages: 0 };
    }
}

// Convert CrawledProduct to raw_products schema and append to file
function saveProducts(products: CrawledProduct[]): number {
    let newCount = 0;
    const lines: string[] = [];

    for (const product of products) {
        const id = String(product.externalId);
        if (!id || uniqueIds.has(id)) continue;

        uniqueIds.add(id);
        newCount++;

        const record = {
            source_id: CONFIG.SOURCE_ID,
            external_id: id,
            external_url: product.externalUrl,
            name: product.name,
            name_normalized: product.name.toLowerCase(),
            description: null,
            price: product.price,
            original_price: product.originalPrice || null,
            discount_percent: product.discountPercent || 0,
            brand_id: null,
            brand_raw: product.brand || null,
            category_id: null,
            category_raw: product.category || null,
            image_url: product.imageUrl || null,
            images: null,
            rating: product.rating || null,
            review_count: product.reviewCount || 0,
            sold_count: null,
            available: product.available ?? true,
            stock_quantity: null,
            specs: product.specs || null,
            metadata: product.metadata || null,
            hash_name: null,
            crawled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_dedup_at: null,
            dedup_status: null
        };

        lines.push(JSON.stringify(record));
    }

    if (lines.length > 0) {
        fs.appendFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
    }

    return newCount;
}

// Sleep helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Main crawler function
async function main() {
    console.log('🚀 CellphoneS Mass Crawler - JSON Output');
    console.log(`🎯 Target: ${CONFIG.TARGET_PRODUCTS.toLocaleString()} unique products`);
    console.log(`📁 Output: ${OUTPUT_FILE}\n`);

    // Load existing
    loadExistingIds();

    if (uniqueIds.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${uniqueIds.size} products. Target reached!`);
        return;
    }

    // Get keywords from database
    console.log('📊 Fetching keywords from database...');
    const keywords = await KeywordService.getKeywords('cellphones');
    console.log(`✅ Found ${keywords.length} keywords to crawl\n`);

    if (keywords.length === 0) {
        console.log('❌ No keywords found! Please add keywords to crawl_keywords table.');
        return;
    }

    // Launch browser
    console.log('🌐 Launching browser...');
    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set origin context
    await page.goto(CONFIG.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✅ Browser ready\n');

    const startTime = Date.now();
    let totalNewProducts = 0;
    let keywordIndex = 0;

    // Crawl each keyword
    for (const kw of keywords) {
        keywordIndex++;
        if (uniqueIds.size >= CONFIG.TARGET_PRODUCTS) {
            console.log(`\n🎉 TARGET REACHED: ${uniqueIds.size.toLocaleString()} products!`);
            break;
        }

        const keyword = kw.keyword;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📌 [${keywordIndex}/${keywords.length}] Keyword: "${keyword}"`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        let keywordProducts = 0;
        let consecutiveEmpty = 0;

        for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES_PER_KEYWORD; pageNum++) {
            if (uniqueIds.size >= CONFIG.TARGET_PRODUCTS) break;

            try {
                const { products, totalPages } = await fetchGraphQL(page, keyword, pageNum);

                if (products.length === 0) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= 3) {
                        console.log(`   ⏹️ No more products after page ${pageNum}`);
                        break;
                    }
                    continue;
                }

                consecutiveEmpty = 0;
                const newCount = saveProducts(products);
                keywordProducts += newCount;
                totalNewProducts += newCount;

                // Progress display
                const progress = ((uniqueIds.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}/${totalPages || '?'}: +${newCount} new | Total: ${uniqueIds.size.toLocaleString()} (${progress}%)`);

                // Stop if we've seen all pages (only if we know totalPages)
                if (totalPages > 0 && pageNum >= totalPages) {
                    console.log(`   ✅ All ${totalPages} pages crawled`);
                    break;
                }

                // If no new products found (all duplicates), might be end of list
                if (newCount === 0) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= 2) {
                        console.log(`   ⏹️ No new products found, likely reached end`);
                        break;
                    }
                }

                await sleep(CONFIG.DELAY_BETWEEN_PAGES);

            } catch (error) {
                console.error(`   ⚠️ Error on page ${pageNum}:`, error);
                await sleep(2000);
            }
        }

        console.log(`   📊 Keyword "${keyword}": +${keywordProducts} new products`);

        // Mark keyword as crawled in DB (optional)
        try {
            await KeywordService.markCrawled(kw.id);
        } catch { }

        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    // Cleanup
    await browser.close();

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n════════════════════════════════════════════════════');
    console.log('📊 CRAWL SUMMARY');
    console.log('════════════════════════════════════════════════════');
    console.log(`✅ Total unique products: ${uniqueIds.size.toLocaleString()}`);
    console.log(`➕ New products this run: ${totalNewProducts.toLocaleString()}`);
    console.log(`⏱️ Time elapsed: ${elapsed} minutes`);
    console.log(`📁 Output file: ${OUTPUT_FILE}`);
    console.log('════════════════════════════════════════════════════\n');
}

// Run
main().catch(console.error);
