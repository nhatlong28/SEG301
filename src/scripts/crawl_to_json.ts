/**
 * Mass Crawler - JSON Output
 * 
 * Mục tiêu: Cào 300,000 sản phẩm unique cho mỗi sàn
 * - Lấy keywords từ bảng crawl_keywords trong Supabase
 * - Lưu ra file JSONL theo schema raw_products
 * - Chống trùng: Load existing IDs khi khởi động
 * 
 * Usage: npx tsx src/scripts/crawl_to_json.ts [platform]
 * Platforms: tiki, lazada, cellphones, dmx, tgdd, all
 */

import fs from 'fs';
import path from 'path';
// ... imports
import puppeteer, { Browser, Page } from 'puppeteer';
import { KeywordService, CrawlKeyword } from '../crawler/keywordService';
import { CrawledProduct } from '../crawler/base';
import logger from '../utils/logger';

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
<<<<<<< HEAD
import * as cheerio from 'cheerio';
=======
>>>>>>> 65c4278 (feat: initialize web application structure and core layouts)

puppeteerExtra.use(StealthPlugin());

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
    TARGET_PRODUCTS: 300000,
    MAX_PAGES_PER_KEYWORD: 100,
    DELAY_BETWEEN_PAGES: 50,
    DELAY_BETWEEN_KEYWORDS: 100,
};

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// =============================================
// DEDUPLICATION
// =============================================
const uniqueIds: Record<string, Set<string>> = {};

function loadExistingIds(source: string): Set<string> {
    if (!uniqueIds[source]) {
        uniqueIds[source] = new Set();
        const filename = path.join(DATA_DIR, source, 'products.jsonl');
        if (fs.existsSync(filename)) {
            console.log(`📂 [${source}] Loading existing IDs...`);
            const content = fs.readFileSync(filename, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const p = JSON.parse(line);
                    if (p.external_id) uniqueIds[source].add(String(p.external_id));
                } catch { }
            }
            console.log(`✅ [${source}] Loaded ${uniqueIds[source].size} existing unique products`);
        }
    }
    return uniqueIds[source];
}

function saveProducts(source: string, sourceId: number, products: CrawledProduct[]): number {
    const ids = loadExistingIds(source);
    let newCount = 0;
    const lines: string[] = [];
    const filename = path.join(DATA_DIR, source, 'products.jsonl');
    if (!fs.existsSync(path.dirname(filename))) fs.mkdirSync(path.dirname(filename), { recursive: true });

    for (const product of products) {
        const id = String(product.externalId);
        if (!id || ids.has(id)) continue;

        // Final Quality Check: Price MUST be > 0
        if (!product.price || product.price <= 0) continue;

        ids.add(id);
        newCount++;

        const record = {
            source_id: sourceId,
            external_id: id,
            external_url: product.externalUrl,
            name: product.name,
            name_normalized: product.name.toLowerCase(),
            description: product.description || null,
            price: product.price,
            original_price: product.originalPrice || null,
            discount_percent: product.discountPercent || 0,
            brand_id: null,
            brand_raw: product.brand || null,
            category_id: null,
            category_raw: product.category || null,
            image_url: product.imageUrl || null,
            images: product.images || null,
            rating: product.rating || null,
            review_count: product.reviewCount || 0,
            sold_count: product.soldCount || null,
            available: product.available ?? true,
            stock_quantity: product.stockQuantity || null,
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
        fs.appendFileSync(filename, lines.join('\n') + '\n');
    }

    return newCount;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// =============================================
// CELLPHONES CRAWLER (GraphQL)
// =============================================
async function runCellphones() {
    const SOURCE = 'cellphones';
    const SOURCE_ID = 4;
    const GRAPHQL_URL = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';
    const BASE_URL = 'https://cellphones.com.vn';

    console.log('\n🚀 CELLPHONES CRAWLER');
    console.log('═══════════════════════════════════════════════════\n');

    const ids = loadExistingIds(SOURCE);
    if (ids.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${ids.size} products. Target reached!`);
        return;
    }

    const keywords = await KeywordService.getKeywords('cellphones');
    console.log(`📊 Found ${keywords.length} keywords to crawl\n`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        protocolTimeout: 0 // Disable timeout to prevent ProtocolError
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let totalNew = 0;

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES_PER_KEYWORD; pageNum++) {
            if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

            const query = buildCellphonesQuery(kw.keyword, pageNum);
            const { products, totalPages } = await fetchCellphonesGraphQL(page, GRAPHQL_URL, query, BASE_URL);

            if (products.length === 0) {
                emptyPages++;
                if (emptyPages >= 3) break;
                continue;
            }

            emptyPages = 0;
            const newCount = saveProducts(SOURCE, SOURCE_ID, products);
            kwProducts += newCount;
            totalNew += newCount;

            const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
            console.log(`   Page ${pageNum}/${totalPages || '?'}: +${newCount} | Total: ${ids.size.toLocaleString()} (${progress}%)`);



            if (totalPages > 0 && pageNum >= totalPages) break;
            if (newCount === 0) {
                emptyPages++;
                if (emptyPages >= 2) break;
            }

            await sleep(CONFIG.DELAY_BETWEEN_PAGES);
        }

        console.log(`   ✅ Keyword done: +${kwProducts} products\n`);
        try { await KeywordService.markCrawled(kw.id); } catch { }
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    await browser.close();
    console.log(`\n🎉 CELLPHONES COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

function buildCellphonesQuery(keyword: string, pageNum: number): string {
    const escaped = keyword.replace(/"/g, '\\"');
    return `
        query advanced_search {
            advanced_search(
                user_query: { terms: "${escaped}", province: 30 }
                page: ${pageNum}
            ) {
                products {
                    product_id name sku url_path price special_price
                    thumbnail stock_available_id
                    category_objects { name }
                }
                meta { total page }
            }
        }
    `;
}

async function fetchCellphonesGraphQL(page: Page, url: string, query: string, baseUrl: string): Promise<{ products: CrawledProduct[], totalPages: number }> {
    try {
        const result = await page.evaluate(async (u, q) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

                try {
                    const r = await fetch(u, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: q, variables: {} }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (!r.ok) return { error: `HTTP ${r.status}` };
                    return { data: await r.json() };
                } catch (err: any) {
                    clearTimeout(timeoutId);
                    if (err.name === 'AbortError') return { error: 'Fetch timed out' };
                    throw err;
                }
            } catch (e: any) { return { error: e.message }; }
        }, url, query);

        if (result.error) return { products: [], totalPages: 0 };

        const data = result.data?.data?.advanced_search;
        if (!data?.products) return { products: [], totalPages: 0 };

        const products: CrawledProduct[] = data.products.map((item: any) => ({
            externalId: String(item.product_id),
            externalUrl: item.url_path ? `${baseUrl}/${item.url_path}${item.url_path.endsWith('.html') ? '' : '.html'}` : '',
            name: item.name,
            price: item.special_price || item.price || 0,
            originalPrice: item.price > (item.special_price || item.price) ? item.price : undefined,
            discountPercent: item.price > (item.special_price || 0) ? Math.round(((item.price - item.special_price) / item.price) * 100) : 0,
            imageUrl: item.thumbnail?.startsWith('http') ? item.thumbnail : `https://cdn2.cellphones.com.vn/358x358,webp,q100/media/catalog/product${item.thumbnail}`,
            rating: 5,
            reviewCount: 0,
            available: item.stock_available_id !== 46,
            brand: item.category_objects?.[0]?.name || '',
            category: item.category_objects?.map((c: any) => c.name).join(' > ') || '',
            metadata: { sku: item.sku }
        }));

        const totalPages = Math.ceil((data.meta?.total || 0) / 20);
        return { products, totalPages };
    } catch { return { products: [], totalPages: 0 }; }
}

// =============================================
// TIKI CRAWLER (REST API)
// =============================================
async function runTiki() {
    const SOURCE = 'tiki';
    const SOURCE_ID = 2;
    const API_URL = 'https://tiki.vn/api/v2/products';

    console.log('\n🚀 TIKI CRAWLER');
    console.log('═══════════════════════════════════════════════════\n');

    const ids = loadExistingIds(SOURCE);
    if (ids.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${ids.size} products. Target reached!`);
        return;
    }

    const keywords = await KeywordService.getKeywords('tiki');
    console.log(`📊 Found ${keywords.length} keywords to crawl\n`);

    let totalNew = 0;

    // Phase 1: Category-based crawling
    const TIKI_CATEGORIES = [
        { id: 1789, name: 'Điện thoại - MTB' },
        { id: 1846, name: 'Laptop - PC' },
        { id: 4221, name: 'Điện tử - Điện lạnh' },
        { id: 1815, name: 'Phụ kiện số' },
        { id: 1801, name: 'Máy ảnh' },
        { id: 1883, name: 'Điện gia dụng' }
    ];

    console.log(`\n📚 Phase 1: Category-based crawling...`);
    phase1Loop: for (const cat of TIKI_CATEGORIES) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        console.log(`📌 Category: ${cat.name} (ID: ${cat.id})`);

        let catProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 100; pageNum++) {
            if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

            try {
                const url = `${API_URL}?category=${cat.id}&page=${pageNum}&limit=100`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }

                const json = await response.json();
                const items = json.data || [];

                if (items.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }
                emptyPages = 0;

                const products: CrawledProduct[] = items.map((item: any) => ({
                    externalId: String(item.id),
                    externalUrl: `https://tiki.vn/${item.url_path || item.url_key}`,
                    name: item.name,
                    price: item.price || 0,
                    originalPrice: item.list_price > item.price ? item.list_price : undefined,
                    discountPercent: item.discount_rate || 0,
                    imageUrl: item.thumbnail_url,
                    rating: item.rating_average || 0,
                    reviewCount: item.review_count || 0,
                    soldCount: item.quantity_sold?.value || 0,
                    available: item.inventory_status === 'available',
                    brand: item.brand_name || '',
                    category: item.categories?.primary?.name || cat.name,
                    metadata: { sku: item.sku, seller_id: item.seller?.id }
                }));

                const newCount = saveProducts(SOURCE, SOURCE_ID, products);
                catProducts += newCount;
                totalNew += newCount;

                const totalPages = json.paging?.last_page || 100;
                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}/${totalPages}: +${newCount} | Total: ${ids.size.toLocaleString()} (${progress}%)`);

                // SMART SKIP: If first 2 pages have no new products, assume category is done
                if (newCount === 0 && pageNum <= 2) {
                    console.log(`   ⏩ Smart Skip: No new products in early pages, skipping category.`);
                    if (cat.id === 1789) { // First category
                        console.log(`   🚀 First category empty. Skipping ALL categories phase.`);
                        break phase1Loop;
                    }
                    break;
                }

                if (pageNum >= totalPages) break;
                if (newCount === 0) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                }
                await sleep(CONFIG.DELAY_BETWEEN_PAGES);

            } catch (e) {
                console.error(`   ⚠️ Error:`, e);
                await sleep(2000);
            }
        }
        console.log(`   ✅ Category done: +${catProducts} products\n`);
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    console.log(`\n📚 Phase 2: Keyword-based crawling...`);
    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES_PER_KEYWORD; pageNum++) {
            if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

            try {
                const url = `${API_URL}?q=${encodeURIComponent(kw.keyword)}&page=${pageNum}&limit=40`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }

                const json = await response.json();
                const items = json.data || [];

                if (items.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }

                emptyPages = 0;
                const products: CrawledProduct[] = items.map((item: any) => ({
                    externalId: String(item.id),
                    externalUrl: `https://tiki.vn/${item.url_path || item.url_key}`,
                    name: item.name,
                    price: item.price || 0,
                    originalPrice: item.list_price > item.price ? item.list_price : undefined,
                    discountPercent: item.discount_rate || 0,
                    imageUrl: item.thumbnail_url,
                    rating: item.rating_average || 0,
                    reviewCount: item.review_count || 0,
                    soldCount: item.quantity_sold?.value || 0,
                    available: item.inventory_status === 'available',
                    brand: item.brand_name || '',
                    category: item.categories?.primary?.name || '',
                    metadata: { sku: item.sku, seller_id: item.seller?.id }
                }));

                const newCount = saveProducts(SOURCE, SOURCE_ID, products);
                kwProducts += newCount;
                totalNew += newCount;

                const totalPages = json.paging?.last_page || Math.ceil((json.paging?.total || 0) / 40);
                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}/${totalPages}: +${newCount} | Total: ${ids.size.toLocaleString()} (${progress}%)`);



                if (pageNum >= totalPages) break;
                if (newCount === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                }

                await sleep(CONFIG.DELAY_BETWEEN_PAGES);

            } catch (e) {
                console.error(`   ⚠️ Error:`, e);
                await sleep(2000);
            }
        }

        console.log(`   ✅ Keyword done: +${kwProducts} products\n`);
        try { await KeywordService.markCrawled(kw.id); } catch { }
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    console.log(`\n🎉 TIKI COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

const FALLBACK_KEYWORDS = [
    "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme",
    "macbook", "laptop", "asus", "hp", "dell", "lenovo", "acer",
    "tai nghe", "loa bluetooth", "sạc dự phòng", "cáp sạc",
    "tivi", "tủ lạnh", "máy giặt", "điều hòa", "máy lọc nước",
    "nồi cơm điện", "nồi chiên không dầu", "máy xay sinh tố",
    "bếp từ", "quạt điều hòa", "máy hút bụi"
];


// =============================================
// LAZADA CRAWLER (DOM Scraping - More Reliable)
// =============================================
async function runLazada() {
    const SOURCE = 'lazada';
    const SOURCE_ID = 3;
    const BASE_URL = 'https://www.lazada.vn';

    console.log('\n🚀 LAZADA CRAWLER (DOM Mode)');
    console.log('═══════════════════════════════════════════════════\n');

    const ids = loadExistingIds(SOURCE);
    if (ids.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${ids.size} products. Target reached!`);
        return;
    }

    let keywords = await KeywordService.getKeywords('lazada');
    if (keywords.length === 0) {
        console.log('⚠️ No keywords found in DB for Lazada. Using fallback list.');
        keywords = FALLBACK_KEYWORDS.map((k, i) => ({
            id: -1,
            keyword: k,
            category: 'general',
            priority: 1,
            is_active: true,
            applies_to: ['lazada'],
            last_crawled_at: null
        }));
    }
    console.log(`📊 Found ${keywords.length} keywords to crawl\n`);

    // Use puppeteer-extra for stealth
    // Launch Browser in HEADFUL mode to avoid bot detection
    console.log('   💡 Running in HEADFUL mode (có cửa sổ browser) để bypass bot detection');
    console.log('   ⚠️ Không đóng cửa sổ Chrome! Nếu có captcha, giải nó rồi crawler sẽ tự chạy tiếp.\n');

    let browser = await puppeteerExtra.launch({
        headless: false, // HEADFUL MODE - visible browser window
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1366,768',
            '--window-position=50,50'
        ],
        protocolTimeout: 0,
        defaultViewport: null
    });

    let page = await browser.newPage();

    // Helper to load User-Agent
    const loadUserAgent = () => {
        const uaPath = path.join(process.cwd(), 'lazada_ua.txt');
        if (fs.existsSync(uaPath)) {
            const ua = fs.readFileSync(uaPath, 'utf8').trim();
            if (ua) return ua;
        }
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    };

    // Helper to load cookies (JSON & Netscape support)
    const loadCookies = async (p: Page) => {
        const cookiePath = path.join(process.cwd(), 'lazada_cookie.txt');
        if (fs.existsSync(cookiePath)) {
            try {
                const cookieStr = fs.readFileSync(cookiePath, 'utf8').trim();
                if (!cookieStr) return false;

                if (cookieStr.startsWith('[')) {
                    // JSON format
                    const cookies = JSON.parse(cookieStr);
                    await p.setCookie(...cookies);
                    console.log(`   🍪 Loaded ${cookies.length} cookies (JSON)`);
                    return true;
                } else {
                    // Cookie string format (name=value; name2=value2) or Netscape
                    if (cookieStr.includes('=') && !cookieStr.includes('\t')) {
                        // Simple cookie string format
                        const cookies = cookieStr.split(';').map(pair => {
                            const [name, ...valueParts] = pair.trim().split('=');
                            return {
                                name: name,
                                value: valueParts.join('='),
                                domain: '.lazada.vn',
                                path: '/'
                            };
                        }).filter(c => c.name && c.value);
                        await p.setCookie(...cookies);
                        console.log(`   🍪 Loaded ${cookies.length} cookies (String)`);
                        return true;
                    } else {
                        // Netscape format
                        const cookies: any[] = [];
                        const lines = cookieStr.split('\n');
                        for (const line of lines) {
                            const l = line.trim();
                            if (!l || l.startsWith('#')) continue;
                            const parts = l.split('\t');
                            if (parts.length >= 7) {
                                cookies.push({
                                    domain: parts[0],
                                    path: parts[2],
                                    secure: parts[3].toUpperCase() === 'TRUE',
                                    expires: parseInt(parts[4]),
                                    name: parts[5],
                                    value: parts[6]
                                });
                            }
                        }
                        if (cookies.length > 0) {
                            await p.setCookie(...cookies);
                            console.log(`   🍪 Loaded ${cookies.length} cookies (Netscape)`);
                            return true;
                        }
                    }
                }
            } catch (e) { console.error('   ⚠️ Cookie load error:', e); }
        }
        return false;
    };

    // Track cookie file modification for hot-reload
    const cookiePath = path.join(process.cwd(), 'lazada_cookie.txt');
    const uaPath = path.join(process.cwd(), 'lazada_ua.txt');
    let lastCookieMtime = fs.existsSync(cookiePath) ? fs.statSync(cookiePath).mtimeMs : 0;
    let lastUAMtime = fs.existsSync(uaPath) ? fs.statSync(uaPath).mtimeMs : 0;

    // Hot-reload cookies if file changed - call this before each page request
    const checkAndReloadCookies = async (): Promise<boolean> => {
        try {
            const currentCookieMtime = fs.existsSync(cookiePath) ? fs.statSync(cookiePath).mtimeMs : 0;
            const currentUAMtime = fs.existsSync(uaPath) ? fs.statSync(uaPath).mtimeMs : 0;

            if (currentCookieMtime > lastCookieMtime || currentUAMtime > lastUAMtime) {
                console.log('   🔄 Cookie/UA file changed! Hot-reloading...');

                // Clear existing cookies
                const existingCookies = await page.cookies();
                for (const c of existingCookies) {
                    await page.deleteCookie(c);
                }

                // Update User-Agent if changed
                if (currentUAMtime > lastUAMtime) {
                    await page.setUserAgent(loadUserAgent());
                    console.log('   ✨ User-Agent updated');
                }

                // Load new cookies
                await loadCookies(page);

                lastCookieMtime = currentCookieMtime;
                lastUAMtime = currentUAMtime;

                console.log('   ✅ Hot-reload complete! Resuming crawl...');
                return true; // Signal that cookies were reloaded
            }
        } catch (e) {
            console.error('   ⚠️ Hot-reload error:', e);
        }
        return false;
    };


    // Helper to handle Captcha/Login - WITH POPUP BROWSER
    let captchaRetryCount = 0;
    const MAX_CAPTCHA_RETRIES = 5;

    const handleCaptcha = async (): Promise<boolean> => {
        captchaRetryCount++;

        if (captchaRetryCount > MAX_CAPTCHA_RETRIES) {
            console.log('\n   ❌ Max retries reached. Lazada blocking is too aggressive.');
            console.log('   💡 TIP: Thử chạy lại sau 30 phút hoặc đổi IP (VPN/Mobile data)');
            return false;
        }

        console.log(`\n   ⛔ CAPTCHA/BOT DETECTION! (Retry ${captchaRetryCount}/${MAX_CAPTCHA_RETRIES})`);
        console.log('   ═══════════════════════════════════════════════════');
        console.log('   🚀 Mở trình duyệt tự động...');
        console.log('   👉 Vui lòng đăng nhập hoặc giải captcha trên cửa sổ popup');
        console.log('   ═══════════════════════════════════════════════════\n');

        // Close headless browser
        try { await browser.close(); } catch { }

        // Open headful browser for manual intervention
        browser = await puppeteerExtra.launch({
            headless: false,
            defaultViewport: null,
            args: ['--window-size=1280,800', '--no-sandbox']
        });
        page = await browser.newPage();
        await page.setUserAgent(loadUserAgent());

        try {
            await page.goto('https://www.lazada.vn', { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch { }

        // Track file changes for manual update option
        const initialCookieMtime = fs.existsSync(cookiePath) ? fs.statSync(cookiePath).mtimeMs : 0;
        const initialUAMtime = fs.existsSync(uaPath) ? fs.statSync(uaPath).mtimeMs : 0;

        console.log('   ⏳ Đợi đăng nhập hoặc file thay đổi... (timeout 10 phút)');

        const startTime = Date.now();
        const timeoutMs = 10 * 60 * 1000; // 10 minutes
        let startTimeSuccess = 0;


        while (Date.now() - startTime < timeoutMs) {
            await sleep(3000);

            // Check if browser was closed
            if (!browser.isConnected()) {
                console.log('   ⚠️ Browser closed by user.');
                break;
            }

            // Check for manual file update
            const currentCookieMtime = fs.existsSync(cookiePath) ? fs.statSync(cookiePath).mtimeMs : 0;
            const currentUAMtime = fs.existsSync(uaPath) ? fs.statSync(uaPath).mtimeMs : 0;
            if (currentCookieMtime > initialCookieMtime || currentUAMtime > initialUAMtime) {
                console.log('   ✨ File change detected! Using manual cookies.');
                break;
            }

            // Check if user logged in successfully
            try {
                const cookies = await page.cookies();
                const url = page.url();
                const invalidTerms = ['login', 'Security', 'punish', 'captcha', 'challenge'];
                const isInvalidUrl = invalidTerms.some(term => url.includes(term));

                // Strict check: Must be on homepage or valid catalog/product page
                // Relaxed: Just check if we are on lazada domain and NOT on a blocked page
                const isValidPage = url.includes('lazada.vn');

                if (cookies.length > 15 && !isInvalidUrl && isValidPage) {
                    if (!startTimeSuccess) startTimeSuccess = Date.now();

                    // Require 5 seconds of STABLE valid state
                    if (Date.now() - startTimeSuccess > 5000) {
                        console.log('   ✅ Valid session stable for 5s! Saving cookies...');

                        // Save cookies in NETSCAPE format
                        const netscapeCookies = ['# Netscape HTTP Cookie File', '# Auto-generated by crawler'];
                        for (const c of cookies) {
                            const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
                            const flag = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
                            const path = c.path || '/';
                            const secure = c.secure ? 'TRUE' : 'FALSE';
                            const expires = c.expires ? Math.floor(c.expires) : 0;
                            netscapeCookies.push(`${domain}\t${flag}\t${path}\t${secure}\t${expires}\t${c.name}\t${c.value}`);
                        }
                        fs.writeFileSync(cookiePath, netscapeCookies.join('\n'));
                        console.log(`   💾 Saved ${cookies.length} cookies to lazada_cookie.txt`);
                        captchaRetryCount = 0; // Reset on success
                        break;
                    } else {
                        // Ensure we don't spam logs
                        if (Math.random() < 0.1) console.log('   ⏳ Verifying session stability...');
                    }
                } else {
                    startTimeSuccess = 0; // Reset timer if state becomes invalid
                }
            } catch {
                startTimeSuccess = 0;
            }
        }

        // Update tracking timestamps
        lastCookieMtime = fs.existsSync(cookiePath) ? fs.statSync(cookiePath).mtimeMs : 0;
        lastUAMtime = fs.existsSync(uaPath) ? fs.statSync(uaPath).mtimeMs : 0;

        // Reload cookies and continue (still in headful mode)
        await loadCookies(page);

        console.log('   ⏳ Warming up session (3s)...');
        await sleep(3000);

        try {
            await page.goto('https://www.lazada.vn', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(2000);
        } catch { }

        console.log('   ✅ Ready! Resuming crawl...\n');
        return true;
    };


    await page.setUserAgent(loadUserAgent());
    await page.setViewport({ width: 1920, height: 1080 });
    await loadCookies(page);


    // Initial Navigation & Captcha Check
    console.log('   🔄 Connecting to Lazada...');
    try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);

        const title = await page.title();
        const url = page.url();
        if (title.includes('Security') || title.includes('Captcha') || url.includes('punish') || url.includes('tmd')) {
            await handleCaptcha();
            await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        }

    } catch (e) {
        console.log('   ⚠️ Initial navigation warning:', e);
    }

    let totalNew = 0;

    // Phase 1: Category-based crawling
    const LAZADA_CATEGORIES = [
        '/dien-thoai-di-dong', '/may-tinh-bang', '/laptop', '/am-thanh',
        '/phu-kien-dien-tu', '/tivi-dien-may', '/smartwatch', '/may-anh-may-quay-phim'
    ];

    console.log(`\n📚 Phase 1: Category-based crawling...`);
    phase1Lazada: for (let i = 0; i < LAZADA_CATEGORIES.length; i++) {
        const category = LAZADA_CATEGORIES[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${LAZADA_CATEGORIES.length}] Category: ${category}`);
        let catProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 100; pageNum++) {
            if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

            const url = `https://www.lazada.vn${category}/?page=${pageNum}&ajax=true`;

            try {
                // Hot-reload cookies if file changed
                await checkAndReloadCookies();

                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });


                // Check blocked
                const title = await page.title();
                const currentUrl = page.url();
                if (title.includes('Security') || title.includes('Captcha') || currentUrl.includes('punish') || currentUrl.includes('tmd')) {
                    await handleCaptcha();
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                    continue;
                }

                // Extract JSON Data
                const ajaxData = await page.evaluate(() => {
                    try {
                        return JSON.parse(document.body.innerText);
                    } catch (e) {
                        return null;
                    }
                });

                if (!ajaxData || !ajaxData.mods || !ajaxData.mods.listItems) {
                    console.log(`   ⚠️ No valid JSON data on page ${pageNum}`);
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }

                const listItems = ajaxData.mods.listItems;
                if (listItems.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }
                emptyPages = 0;

                // Extract Category Name from filters if available
                let categoryName = category.replace(/^\/|\/$/g, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const catFilter = ajaxData.mods.filter?.filterItems?.find((f: any) => f.name === 'category');
                if (catFilter && catFilter.options && catFilter.options.length > 0) {
                    categoryName = catFilter.options[0].title;
                }

                const crawledProducts: CrawledProduct[] = listItems.map((item: any) => {
                    const href = item.itemUrl || '';
                    const idMatch = href.match(/-i(\d+)-s/) || href.match(/i(\d+)/);
                    const externalId = item.itemId || (idMatch ? idMatch[1] : href);

                    return {
                        externalId: String(externalId),
                        externalUrl: href.startsWith('//') ? 'https:' + href : (href.startsWith('http') ? href : 'https://www.lazada.vn' + href),
                        name: item.name,
                        price: parseInt(item.price) || 0,
                        originalPrice: item.originalPrice ? parseInt(item.originalPrice) : undefined,
                        imageUrl: item.image?.startsWith('//') ? 'https:' + item.image : item.image,
                        soldCount: parseInt(String(item.itemSoldCntShow || '0').replace(/[^\d]/g, '')) || 0,
                        rating: parseFloat(item.ratingScore) || 0,
                        reviewCount: parseInt(item.review) || 0,
                        available: true,
                        brand: item.brandName || '',
                        category: categoryName
                    };
                }).filter((p: any) => p.name && p.price > 0);

                const newCount = saveProducts(SOURCE, SOURCE_ID, crawledProducts);
                catProducts += newCount;
                totalNew += newCount;

                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}: Found ${listItems.length} items, +${newCount} new | Total: ${ids.size.toLocaleString()} (${progress}%)`);

                // SMART SKIP: If first 2 pages have no new products, assume category is done
                if (newCount === 0 && pageNum <= 2) {
                    console.log(`   ⏩ Smart Skip: No new products in early pages, skipping category.`);
                    if (i === 0) {
                        console.log(`   🚀 First category empty. Skipping ALL categories phase.`);
                        break phase1Lazada;
                    }
                    break;
                }

                await sleep(100);

            } catch (e: any) {
                console.log(`   ⚠️ Error navigating/scraping page ${pageNum}:`, e.message);
                await sleep(2000);
            }
        }
        console.log(`   ✅ Category done: +${catProducts} products\n`);
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    console.log(`\n📚 Phase 2: Keyword-based crawling...`);
    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 50; pageNum++) { // Increased to 50 pages per keyword
            if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

            const searchUrl = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(kw.keyword)}&page=${pageNum}&ajax=true`;

            try {
                // Hot-reload cookies if file changed
                await checkAndReloadCookies();

                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });


                // Check if blocked
                const title = await page.title();
                const currentUrl = page.url();
                if (title.includes('Security') || title.includes('Captcha') || currentUrl.includes('punish') || currentUrl.includes('tmd')) {
                    await handleCaptcha();
                    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    continue;
                }

                // Extract JSON Data
                const ajaxData = await page.evaluate(() => {
                    try {
                        return JSON.parse(document.body.innerText);
                    } catch (e) {
                        return null;
                    }
                });

                if (!ajaxData || !ajaxData.mods || !ajaxData.mods.listItems) {
                    console.log(`   ⚠️ No valid JSON data on page ${pageNum}`);
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }

                const listItems = ajaxData.mods.listItems;
                if (listItems.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }
                emptyPages = 0;

                // Extract Category Name from filters if available
                let categoryName = '';
                const catFilter = ajaxData.mods.filter?.filterItems?.find((f: any) => f.name === 'category');
                if (catFilter && catFilter.options && catFilter.options.length > 0) {
                    categoryName = catFilter.options[0].title;
                }

                const crawledProducts: CrawledProduct[] = listItems.map((item: any) => {
                    const href = item.itemUrl || '';
                    const idMatch = href.match(/-i(\d+)-s/) || href.match(/i(\d+)/);
                    const externalId = item.itemId || (idMatch ? idMatch[1] : href);

                    return {
                        externalId: String(externalId),
                        externalUrl: href.startsWith('//') ? 'https:' + href : (href.startsWith('http') ? href : 'https://www.lazada.vn' + href),
                        name: item.name,
                        price: parseInt(item.price) || 0,
                        originalPrice: item.originalPrice ? parseInt(item.originalPrice) : undefined,
                        imageUrl: item.image?.startsWith('//') ? 'https:' + item.image : item.image,
                        soldCount: parseInt(String(item.itemSoldCntShow || '0').replace(/[^\d]/g, '')) || 0,
                        rating: parseFloat(item.ratingScore) || 0,
                        reviewCount: parseInt(item.review) || 0,
                        available: true,
                        brand: item.brandName || '',
                        category: categoryName
                    };
                }).filter((p: any) => p.name && p.price > 0);

                const newCount = saveProducts(SOURCE, SOURCE_ID, crawledProducts);
                kwProducts += newCount;
                totalNew += newCount;

                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}: Found ${listItems.length} items, +${newCount} new | Total: ${ids.size.toLocaleString()} (${progress}%)`);

                // Human delay
                await sleep(500);

            } catch (e: any) {
                console.log(`   ⚠️ Error navigating/scraping page ${pageNum}:`, e.message);
                await sleep(2000);
            }
        }

        console.log(`   ✅ Keyword done: +${kwProducts} products\n`);
        if (kw.id !== -1) {
            try { await KeywordService.markCrawled(kw.id); } catch { }
        }
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    await browser.close();
    console.log(`\n🎉 LAZADA COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

// =============================================
// DIENMAYXANH CRAWLER (PUPPETEER + CLICK PAGINATION)
// =============================================
async function runDMX() {
    const SOURCE = 'dienmayxanh';
    const SOURCE_ID = 5;
    const BASE_URL = 'https://www.dienmayxanh.com';

    console.log('\n🚀 DIENMAYXANH CRAWLER (Puppeteer + Click Mode)');
    console.log('═══════════════════════════════════════════════════\n');

    const ids = loadExistingIds(SOURCE);
    if (ids.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${ids.size} products. Target reached!`);
        return;
    }

    // Load Keywords
    let keywords = await KeywordService.getKeywords('dienmayxanh');
    if (keywords.length === 0) keywords = FALLBACK_KEYWORDS.map((k, i) => ({ id: -1, keyword: k, priority: 1 } as any));
    console.log(`📊 Found ${keywords.length} keywords to crawl\n`);

    let totalNew = 0;

    const browser = await puppeteerExtra.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    // Helper: Extract products from current page via Puppeteer
    const extractProducts = async (): Promise<CrawledProduct[]> => {
        return await page.evaluate((baseUrl) => {
            const items: any[] = [];
            document.querySelectorAll('.listproduct li.item, li.item.ajaxed').forEach((el) => {
                const link = el.querySelector('a');
                if (!link) return;

                const name = link.getAttribute('data-name') || el.querySelector('h3, .name')?.textContent?.trim() || '';
                const price = parseInt(link.getAttribute('data-price') || '0') || 0;
                const id = el.getAttribute('data-id') || link.getAttribute('data-id') || '';
                const brand = link.getAttribute('data-brand') || '';
                const category = link.getAttribute('data-cate') || '';
                let href = link.getAttribute('href') || '';
                if (href && !href.startsWith('http')) {
                    href = baseUrl + (href.startsWith('/') ? '' : '/') + href;
                }
                const img = el.querySelector('img');
                const imageUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || '';

                if (name && price > 0 && id) {
                    items.push({
                        externalId: id,
                        externalUrl: href,
                        name,
                        price,
                        imageUrl,
                        brand,
                        category,
                        available: true
                    });
                }
            });
            return items;
        }, BASE_URL) as CrawledProduct[];
    };

    // Helper: Click "Xem thêm" button and wait for new content
    const clickLoadMore = async (): Promise<boolean> => {
        try {
            const btn = await page.$('.view-more a, .viewmore a');
            if (!btn) return false;

            const isVisible = await page.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return rect.height > 0 && rect.width > 0;
            }, btn);
            if (!isVisible) return false;

            const countBefore = await page.$$eval('.listproduct li.item, li.item.ajaxed', els => els.length);
            await btn.click();
            await sleep(1500);
            const countAfter = await page.$$eval('.listproduct li.item, li.item.ajaxed', els => els.length);
            return countAfter > countBefore;
        } catch (e) {
            return false;
        }
    };

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;

        try {
            const searchUrl = `${BASE_URL}/tim-kiem?key=${encodeURIComponent(kw.keyword)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(1000);

            const finalUrl = page.url();
            const isSearchPage = finalUrl.includes('/tim-kiem');
            console.log(`   URL: ${finalUrl} (${isSearchPage ? 'Search' : 'Category'})`);

            let products = await extractProducts();
            if (products.length === 0) {
                console.log(`   ⚠️ No products found on page.`);
            } else {
                let saved = saveProducts(SOURCE, SOURCE_ID, products);
                kwProducts += saved;
                totalNew += saved;
                console.log(`   Page 1: Found ${products.length} items, +${saved} new`);
            }

            // Click "Xem thêm" repeatedly (max 50 clicks)
            let loadMoreClicks = 0;
            const maxClicks = 50;

            while (loadMoreClicks < maxClicks) {
                if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

                const hasMore = await clickLoadMore();
                if (!hasMore) break;

                loadMoreClicks++;
                const allProducts = await extractProducts();
                const newProducts = allProducts.filter(p => !ids.has(String(p.externalId)));

                if (newProducts.length > 0) {
                    const saved = saveProducts(SOURCE, SOURCE_ID, newProducts);
                    kwProducts += saved;
                    totalNew += saved;
                    console.log(`   Page ${loadMoreClicks + 1}: Total ${allProducts.length} items, +${saved} new | Total: ${ids.size.toLocaleString()}`);
                }

                await sleep(CONFIG.DELAY_BETWEEN_PAGES);
            }

            if (loadMoreClicks >= maxClicks) {
                console.log(`   ⚠️ Reached max clicks (${maxClicks})`);
            }

        } catch (e: any) {
            console.error(`   ⚠️ Error:`, e.message);
        }

        console.log(`   ✅ Keyword done: +${kwProducts} products\n`);
        if (kw.id !== -1) {
            try { await KeywordService.markCrawled(kw.id); } catch { }
        }
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    await browser.close();
    console.log(`\n🎉 DIENMAYXANH COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

// =============================================
// THEGIOIDIDONG CRAWLER
// =============================================
// =============================================
// THEGIOIDIDONG CRAWLER (PUPPETEER + CLICK PAGINATION)
// =============================================
async function runTGDD() {
    const SOURCE = 'thegioididong';
    const SOURCE_ID = 6;
    const BASE_URL = 'https://www.thegioididong.com';

    console.log('\n🚀 THEGIOIDIDONG CRAWLER (Puppeteer + Click Mode)');
    console.log('═══════════════════════════════════════════════════\n');

    const ids = loadExistingIds(SOURCE);
    if (ids.size >= CONFIG.TARGET_PRODUCTS) {
        console.log(`✅ Already have ${ids.size} products. Target reached!`);
        return;
    }

    let keywords = await KeywordService.getKeywords('thegioididong');
    if (keywords.length === 0) keywords = FALLBACK_KEYWORDS.map((k, i) => ({ id: -1, keyword: k, priority: 1 } as any));
    console.log(`📊 Found ${keywords.length} keywords to crawl\n`);

    let totalNew = 0;

    const browser = await puppeteerExtra.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    // Helper: Extract products from current page via Puppeteer
    const extractProducts = async (): Promise<CrawledProduct[]> => {
        return await page.evaluate((baseUrl) => {
            const items: any[] = [];
            document.querySelectorAll('.listproduct li.item, li.item.ajaxed').forEach((el) => {
                const link = el.querySelector('a');
                if (!link) return;

                const name = link.getAttribute('data-name') || el.querySelector('h3, .name')?.textContent?.trim() || '';
                const price = parseInt(link.getAttribute('data-price') || '0') || 0;
                const id = el.getAttribute('data-id') || link.getAttribute('data-id') || '';
                const brand = link.getAttribute('data-brand') || '';
                const category = link.getAttribute('data-cate') || '';
                let href = link.getAttribute('href') || '';
                if (href && !href.startsWith('http')) {
                    href = baseUrl + (href.startsWith('/') ? '' : '/') + href;
                }
                const img = el.querySelector('img');
                const imageUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || '';

                if (name && price > 0 && id) {
                    items.push({
                        externalId: id,
                        externalUrl: href,
                        name,
                        price,
                        imageUrl,
                        brand,
                        category,
                        available: true
                    });
                }
            });
            return items;
        }, BASE_URL) as CrawledProduct[];
    };

    // Helper: Click "Xem thêm" button and wait for new content
    const clickLoadMore = async (): Promise<boolean> => {
        try {
            const btn = await page.$('.view-more a, .viewmore a');
            if (!btn) return false;

            // Check if button is visible
            const isVisible = await page.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return rect.height > 0 && rect.width > 0;
            }, btn);
            if (!isVisible) return false;

            // Get current product count
            const countBefore = await page.$$eval('.listproduct li.item, li.item.ajaxed', els => els.length);

            // Click the button
            await btn.click();
            await sleep(1500); // Wait for AJAX to load

            // Check if products actually increased
            const countAfter = await page.$$eval('.listproduct li.item, li.item.ajaxed', els => els.length);
            return countAfter > countBefore;

        } catch (e) {
            return false;
        }
    };

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;

        try {
            // Navigate to search URL
            const searchUrl = `${BASE_URL}/tim-kiem?key=${encodeURIComponent(kw.keyword)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(1000);

            // Check final URL (might redirect to category page)
            const finalUrl = page.url();
            const isSearchPage = finalUrl.includes('/tim-kiem');
            console.log(`   URL: ${finalUrl} (${isSearchPage ? 'Search' : 'Category'})`);

            // Get initial products
            let products = await extractProducts();
            if (products.length === 0) {
                console.log(`   ⚠️ No products found on page.`);
            } else {
                let saved = saveProducts(SOURCE, SOURCE_ID, products);
                kwProducts += saved;
                totalNew += saved;
                console.log(`   Page 1: Found ${products.length} items, +${saved} new`);
            }

            // Click "Xem thêm" repeatedly to load all products (max 50 clicks)
            let loadMoreClicks = 0;
            const maxClicks = 50;

            while (loadMoreClicks < maxClicks) {
                if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

                const hasMore = await clickLoadMore();
                if (!hasMore) break;

                loadMoreClicks++;

                // Extract all products again (they accumulate on page)
                const allProducts = await extractProducts();

                // Filter out products we already have
                const newProducts = allProducts.filter(p => !ids.has(String(p.externalId)));

                if (newProducts.length > 0) {
                    const saved = saveProducts(SOURCE, SOURCE_ID, newProducts);
                    kwProducts += saved;
                    totalNew += saved;
                    console.log(`   Page ${loadMoreClicks + 1}: Total ${allProducts.length} items, +${saved} new | Total: ${ids.size.toLocaleString()}`);
                }

                await sleep(CONFIG.DELAY_BETWEEN_PAGES);
            }

            if (loadMoreClicks >= maxClicks) {
                console.log(`   ⚠️ Reached max clicks (${maxClicks})`);
            }

        } catch (e: any) {
            console.error(`   ⚠️ Error:`, e.message);
        }

        console.log(`   ✅ Keyword done: +${kwProducts} products\n`);
        if (kw.id !== -1) {
            try { await KeywordService.markCrawled(kw.id); } catch { }
        }
        await sleep(CONFIG.DELAY_BETWEEN_KEYWORDS);
    }

    await browser.close();
    console.log(`\n🎉 THEGIOIDIDONG COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

// =============================================
// MAIN
// =============================================
async function main() {
    const target = process.argv[2]?.toLowerCase();

    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     E-COMMERCE MASS CRAWLER - JSON OUTPUT             ║');
    console.log('║     Target: 300,000 products per platform             ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log(`\n🎯 Mode: ${target?.toUpperCase() || 'ALL PLATFORMS'}`);

    const startTime = Date.now();

    switch (target) {
        case 'cellphones':
            await runCellphones();
            break;
        case 'tiki':
            await runTiki();
            break;
        case 'lazada':
            await runLazada();
            break;
        case 'dmx':
        case 'dienmayxanh':
            await runDMX();
            break;
        case 'tgdd':
        case 'thegioididong':
            await runTGDD();
            break;
        default:
            console.log('\n🔥 Running ALL 5 platforms in PARALLEL...\n');
            await Promise.all([
                runCellphones(),
                runTiki(),
                runLazada(),
                runDMX(),
                runTGDD()
            ]);
            break;
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                    CRAWL COMPLETE                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log(`⏱️  Total time: ${elapsed} minutes`);
    console.log(`📁 Output directory: ${DATA_DIR}`);
}

main().catch(console.error);
