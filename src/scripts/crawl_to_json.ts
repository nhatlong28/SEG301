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
    // Launch Browser and handle Login if needed
    let browser = await puppeteerExtra.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ],
        protocolTimeout: 0,
        defaultViewport: null
    });

    let page = await browser.newPage();

    // Helper to load cookies (JSON & Netscape support)
    const loadCookies = async (p: Page) => {
        const cookiePath = path.join(process.cwd(), 'lazada_cookie.txt');
        if (fs.existsSync(cookiePath)) {
            try {
                const cookieStr = fs.readFileSync(cookiePath, 'utf8');
                if (!cookieStr.trim()) return;

                if (cookieStr.trim().startsWith('[')) {
                    // JSON format
                    const cookies = JSON.parse(cookieStr);
                    await p.setCookie(...cookies);
                    console.log(`   🍪 Loaded ${cookies.length} cookies (JSON)`);
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
                    }
                }
            } catch (e) { console.error('   ⚠️ Cookie load error:', e); }
        }
    };

    // Helper to handle Captcha/Login
    const handleCaptcha = async () => {
        console.log('   ⛔ Captcha/Punish detected! Switching to MANUAL LOGIN mode...');
        try { await browser.close(); } catch { }

        // Relaunch Headful
        console.log('   🚀 Opening browser window... Please Login or Solve Captcha!');
        browser = await puppeteerExtra.launch({
            headless: false,
            defaultViewport: null,
            args: ['--window-size=1280,800', '--no-sandbox']
        });
        page = await browser.newPage();

        try {
            await page.goto('https://member.lazada.vn/user/login', { waitUntil: 'domcontentloaded' });
        } catch { }

        // Wait for user to fix it
        console.log('   ⏳ Waiting for valid session... (Login or Solve Captcha in the popup window)');
        await new Promise<void>((resolve) => {
            const checkInterval = setInterval(async () => {
                try {
                    if (!browser.isConnected()) { clearInterval(checkInterval); resolve(); return; }

                    const cookies = await page.cookies();
                    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                    const url = page.url();

                    if (cookies.length > 5 && !url.includes('login') && !url.includes('Security') && !url.includes('punish') && !url.includes('tmd')) {
                        fs.writeFileSync(path.join(process.cwd(), 'lazada_cookie.txt'), cookieString);
                        console.log(`   ✅ Login detected! Saved cookies.`);
                        clearInterval(checkInterval);
                        resolve();
                    }
                } catch (e) { clearInterval(checkInterval); resolve(); }
            }, 2000);
        });

        console.log('   🔄 Restarting Crawler in Headless mode...');
        try { await browser.close(); } catch { }
        await sleep(2000);

        // Relaunch Headless
        browser = await puppeteerExtra.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ],
            protocolTimeout: 0,
            defaultViewport: null
        });
        page = await browser.newPage();
        await loadCookies(page);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
    };

    await loadCookies(page);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

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

            const url = `https://www.lazada.vn${category}/?page=${pageNum}`;

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await sleep(1000); // Wait for JS

                // Check blocked
                const title = await page.title();
                const currentUrl = page.url();
                if (title.includes('Security') || title.includes('Captcha') || currentUrl.includes('punish') || currentUrl.includes('tmd')) {
                    await handleCaptcha();
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                    continue;
                }

                // Wait for products
                let selector = 'div[data-qa-locator="product-item"]';
                try {
                    await page.waitForSelector(selector, { timeout: 8000 });
                } catch {
                    selector = '.Bm3ON';
                    try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                    } catch {
                        console.log(`   ⚠️ No products found on page ${pageNum}`);

                        // DEBUG LOGGING
                        const debugInfo = await page.evaluate(() => ({
                            url: window.location.href,
                            title: document.title,
                            hasQA: document.querySelectorAll('div[data-qa-locator="product-item"]').length,
                            hasBm3ON: document.querySelectorAll('.Bm3ON').length,
                            bodyLen: document.body.innerHTML.length,
                            snippet: document.body.innerText.substring(0, 200).replace(/\n/g, ' ')
                        }));
                        console.log('   🔴 DEBUG:', JSON.stringify(debugInfo));

                        emptyPages++;
                        if (emptyPages >= 2) break;
                        continue;
                    }
                }

                // Scroll (Optimized)
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        const distance = 1000;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 20);
                    });
                });
                await sleep(1000);

                // Extract
                const products = await page.evaluate(() => {
                    const items: any[] = [];
                    const elements = document.querySelectorAll('div[data-qa-locator="product-item"], .Bm3ON');
                    elements.forEach((el: any) => {
                        try {
                            const nameLink = el.querySelector('.RfADt a') || el.querySelector('a[title]');
                            if (!nameLink) return;

                            const name = nameLink.getAttribute('title') || nameLink.textContent?.trim() || '';
                            const href = nameLink.getAttribute('href') || '';

                            const imgEl = el.querySelector('img');
                            const imageUrl = imgEl?.src || imgEl?.getAttribute('src') || '';

                            const priceEl = el.querySelector('.ooOxS') || el.querySelector('.aBrP_');
                            const price = parseInt((priceEl?.textContent || '0').replace(/[^\d]/g, '')) || 0;

                            const soldEl = el.querySelector('._1cEkb');
                            const soldCount = parseInt((soldEl?.textContent || '0').replace(/[^\d]/g, '')) || 0;

                            const idMatch = href.match(/-i(\d+)-s/) || href.match(/i(\d+)/);
                            const externalId = idMatch ? idMatch[1] : href;

                            if (name && price > 0) {
                                items.push({
                                    externalId,
                                    externalUrl: href.startsWith('//') ? 'https:' + href : (href.startsWith('http') ? href : 'https://www.lazada.vn' + href),
                                    name,
                                    price,
                                    imageUrl: imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl,
                                    soldCount,
                                    rating: 0,
                                    reviewCount: 0
                                });
                            }
                        } catch (e) { }
                    });
                    return items;
                });

                if (products.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }
                emptyPages = 0;

                const crawledProducts: CrawledProduct[] = products.map((p: any) => ({
                    ...p, available: true, brand: '', category: category
                }));

                const newCount = saveProducts(SOURCE, SOURCE_ID, crawledProducts);
                catProducts += newCount;
                totalNew += newCount;

                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}: Found ${products.length} items, +${newCount} new | Total: ${ids.size.toLocaleString()} (${progress}%)`);

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

            const searchUrl = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(kw.keyword)}&page=${pageNum}`;

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait shorter for JS to render
                await sleep(1000);

                // Check if blocked
                const title = await page.title();
                const currentUrl = page.url();
                if (title.includes('Security') || title.includes('Captcha') || currentUrl.includes('punish') || currentUrl.includes('tmd')) {
                    await handleCaptcha();
                    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    continue;
                }

                // Wait for products - try multiple selectors
                let selector = 'div[data-qa-locator="product-item"]';
                try {
                    await page.waitForSelector(selector, { timeout: 8000 });
                } catch {
                    selector = '.Bm3ON';
                    try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                    } catch {
                        console.log(`   ⚠️ No products found on page ${pageNum}`);

                        // DEBUG LOGGING
                        const debugInfo = await page.evaluate(() => ({
                            url: window.location.href,
                            title: document.title,
                            hasQA: document.querySelectorAll('div[data-qa-locator="product-item"]').length,
                            hasBm3ON: document.querySelectorAll('.Bm3ON').length,
                            bodyLen: document.body.innerHTML.length,
                            snippet: document.body.innerText.substring(0, 200).replace(/\n/g, ' ')
                        }));
                        console.log('   🔴 DEBUG:', JSON.stringify(debugInfo));

                        emptyPages++;
                        if (emptyPages >= 2) break;
                        continue;
                    }
                }

                // Scroll (Optimized)
                await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                        let totalHeight = 0;
                        const distance = 1000;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 20);
                    });
                });
                await sleep(1000);

                // Extract Data with updated selectors
                const products = await page.evaluate(() => {
                    const items: any[] = [];
                    // Try both selectors
                    const elements = document.querySelectorAll('div[data-qa-locator="product-item"], .Bm3ON');
                    elements.forEach((el: any) => {
                        try {
                            const nameLink = el.querySelector('.RfADt a') || el.querySelector('a[title]');
                            if (!nameLink) return;

                            const name = nameLink.getAttribute('title') || nameLink.textContent?.trim() || '';
                            const href = nameLink.getAttribute('href') || '';

                            const imgEl = el.querySelector('img');
                            const imageUrl = imgEl?.src || imgEl?.getAttribute('src') || '';

                            // Updated price selector
                            const priceEl = el.querySelector('.ooOxS') || el.querySelector('.aBrP_');
                            const price = parseInt((priceEl?.textContent || '0').replace(/[^\d]/g, '')) || 0;

                            // Updated sold selector
                            const soldEl = el.querySelector('._1cEkb');
                            const soldCount = parseInt((soldEl?.textContent || '0').replace(/[^\d]/g, '')) || 0;

                            const idMatch = href.match(/-i(\d+)-s/) || href.match(/i(\d+)/);
                            const externalId = idMatch ? idMatch[1] : href;

                            if (name && price > 0) {
                                items.push({
                                    externalId,
                                    externalUrl: href.startsWith('//') ? 'https:' + href : (href.startsWith('http') ? href : 'https://www.lazada.vn' + href),
                                    name,
                                    price,
                                    imageUrl: imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl,
                                    soldCount,
                                    rating: 0,
                                    reviewCount: 0
                                });
                            }
                        } catch (e) { }
                    });
                    return items;
                });

                if (products.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }

                emptyPages = 0;
                const crawledProducts: CrawledProduct[] = products.map((p: any) => ({
                    ...p,
                    available: true,
                    brand: '',
                    category: ''
                }));

                const newCount = saveProducts(SOURCE, SOURCE_ID, crawledProducts);
                kwProducts += newCount;
                totalNew += newCount;

                const progress = ((ids.size / CONFIG.TARGET_PRODUCTS) * 100).toFixed(1);
                console.log(`   Page ${pageNum}: Found ${products.length} items, +${newCount} new | Total: ${ids.size.toLocaleString()} (${progress}%)`);



                // Human delay
                await sleep(1000);

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
// DIENMAYXANH CRAWLER (AJAX POST)
// =============================================
// =============================================
// DIENMAYXANH CRAWLER (API MODE)
// =============================================
async function runDMX() {
    const SOURCE = 'dienmayxanh';
    const SOURCE_ID = 5;
    const BASE_URL = 'https://www.dienmayxanh.com';
    const SEARCH_API_URL = 'https://www.dienmayxanh.com/Category/FilterProductBox';

    console.log('\n🚀 DIENMAYXANH CRAWLER (API Mode)');
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

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;

        try {
            // Step 1: Get Initial Page to find Category ID (c) and Manufacturer ID (m) or other params
            const searchUrl = `${BASE_URL}/tim-kiem?key=${encodeURIComponent(kw.keyword.replace(/ /g, '+'))}`;
            const initRes = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!initRes.ok) {
                console.log(`   ⚠️ Failed to load search page: ${initRes.status}`);
                continue;
            }

            const html = await initRes.text();

            // Extract Category ID and other params
            // Usually found in some hidden inputs or data attributes or script
            // Simplest way for search results: Look for "LoadMoreProduct" or similar logic in the HTML
            // TGDĐ/DMX Search often redirects to a Category page if the keyword matches a category (e.g. "máy giặt")
            // Or it stays on /tim-kiem. 

            // Check if redirected to a category
            const finalUrl = initRes.url;
            const isCategoryPage = !finalUrl.includes('/tim-kiem');

            let cateId = '';
            // Regex to find cateId in common places
            const cateMatch = html.match(/data-cate-id="(\d+)"/) || html.match(/id="hdCate" value="(\d+)"/);
            if (cateMatch) cateId = cateMatch[1];

            // If no cateId found, maybe generic search (difficult to page via API if generic)
            // But let's try scraping the initial list first

            // Initial products extract (RegEx/Cheerio-like extraction)
            const productRegex = /<li data-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/g;
            let match;
            const initialProducts: CrawledProduct[] = [];

            // Simple HTML parsing (manual because we don't have cheerio)
            // We just look for standard TGDĐ/DMX product blocks

            // Let's use a simpler strategy: 
            // If we found a CateID, we can loop API. 
            // If not, we just parse what we can and move on (search page might only have 1 page if no cateId)

            if (!cateId && isCategoryPage) {
                // Try harder to find cateId on category page
                const cateMatch2 = html.match(/class="catID" value="(\d+)"/); // Common in old structure
                if (cateMatch2) cateId = cateMatch2[1];
            }

            // Extract initial products from HTML (Regex for speed)
            const buildProductsFromHtml = (htmlContent: string): CrawledProduct[] => {
                const items: CrawledProduct[] = [];
                // Look for <a href="..." class="main-contain" ...> ... <h3>Name</h3> ... <strong class="price">...</strong>
                const itemRegex = /<a href="([^"]+)" class="main-contain"[^>]*>[\s\S]*?<h3>(.*?)<\/h3>[\s\S]*?<strong class="price">(\d{1,3}(?:\.\d{3})*)₫?<\/strong>/g;
                let m;
                // Clean HTML slightly
                const cleanHtml = htmlContent.replace(/\n/g, ' ');
                while ((m = itemRegex.exec(cleanHtml)) !== null) {
                    const href = m[1];
                    const name = m[2].replace(/<[^>]+>/g, '').trim(); // Remove tags
                    const priceStr = m[3].replace(/\./g, '');
                    const price = parseInt(priceStr);

                    if (name && price > 0) {
                        items.push({
                            externalId: href, // temporary ID
                            externalUrl: BASE_URL + href,
                            name: name,
                            price: price,
                            originalPrice: price, // logic to find real original price is harder via regex
                            discountPercent: 0,
                            rating: 0,
                            reviewCount: 0,
                            available: true,
                            imageUrl: '', // Hard to regex image properly sometimes, skip for speed or add simplified regex
                            brand: '',
                            category: ''
                        });
                    }
                }
                return items;
            };

            let products = buildProductsFromHtml(html);
            kwProducts = saveProducts(SOURCE, SOURCE_ID, products);
            totalNew += kwProducts;
            console.log(`   Page 1 (HTML): Found ${products.length} items, +${kwProducts} new`);

            // If we have a CateID, we can loop the API for more
            if (cateId) {
                // Determine API params. 
                // We established it uses POST /Category/FilterProductBox
                // Body: IsParentCate=False&IsShowCompare=True&prevent=true&c={cateId}&pi={pageIndex}

                let emptyPages = 0;
                for (let pi = 1; pi <= 20; pi++) { // Loop up to 20 pages
                    if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

                    const bodyParams = new URLSearchParams();
                    bodyParams.append('IsParentCate', 'False');
                    bodyParams.append('IsShowCompare', 'True');
                    bodyParams.append('prevent', 'true');
                    bodyParams.append('c', cateId);
                    bodyParams.append('pi', pi.toString());

                    // Add other params found in typical requests
                    // o=13 (Featured), or whatever default

                    const res = await fetch(SEARCH_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Origin': BASE_URL,
                            'Referer': finalUrl
                        },
                        body: bodyParams
                    });

                    if (!res.ok) {
                        break;
                    }

                    const json = await res.json();
                    // Response is usually { listproducts: "<html>..." } or simple HTML string
                    const listHtml = json.listproducts || json;

                    if (!listHtml || listHtml.trim().length < 100) {
                        emptyPages++;
                        if (emptyPages >= 1) break;
                        continue;
                    }

                    const apiProducts = buildProductsFromHtml(listHtml);
                    if (apiProducts.length === 0) {
                        break;
                    }

                    const saved = saveProducts(SOURCE, SOURCE_ID, apiProducts);
                    kwProducts += saved;
                    totalNew += saved;
                    console.log(`   Page ${pi + 1} (API): Found ${apiProducts.length} items, +${saved} new | Total: ${ids.size.toLocaleString()}`);

                    await sleep(CONFIG.DELAY_BETWEEN_PAGES); // 50ms now
                }
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

    console.log(`\n🎉 DIENMAYXANH COMPLETE: ${totalNew} new products, ${ids.size} total\n`);
}

// =============================================
// THEGIOIDIDONG CRAWLER
// =============================================
// =============================================
// THEGIOIDIDONG CRAWLER (API MODE)
// =============================================
async function runTGDD() {
    const SOURCE = 'thegioididong';
    const SOURCE_ID = 6;
    const BASE_URL = 'https://www.thegioididong.com';
    const SEARCH_API_URL = 'https://www.thegioididong.com/Category/FilterProductBox';

    console.log('\n🚀 THEGIOIDIDONG CRAWLER (API Mode)');
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

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

        console.log(`📌 [${i + 1}/${keywords.length}] Keyword: "${kw.keyword}"`);

        let kwProducts = 0;

        try {
            // Step 1: Get Initial Page for params
            const searchUrl = `${BASE_URL}/tim-kiem?key=${encodeURIComponent(kw.keyword.replace(/ /g, '+'))}`;
            const initRes = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!initRes.ok) {
                console.error(`   ⚠️ Failed to load search page: ${initRes.status}`);
                continue;
            }

            const html = await initRes.text();

            // Check for redirect to category
            const finalUrl = initRes.url;
            const isCategoryPage = !finalUrl.includes('/tim-kiem');

            let cateId = '';
            const cateMatch = html.match(/data-cate-id="(\d+)"/) || html.match(/id="hdCate" value="(\d+)"/);
            if (cateMatch) cateId = cateMatch[1];

            if (!cateId && isCategoryPage) {
                const cateMatch2 = html.match(/class="catID" value="(\d+)"/);
                if (cateMatch2) cateId = cateMatch2[1];
            }

            // Extract initial products from HTML
            const buildProductsFromHtml = (htmlContent: string): CrawledProduct[] => {
                const items: CrawledProduct[] = [];
                // TGDD slightly different HTML sometimes, but main-contain is consistent
                const itemRegex = /<a href="([^"]+)" class="main-contain"[^>]*>[\s\S]*?<h3>(.*?)<\/h3>[\s\S]*?<strong class="price">(\d{1,3}(?:\.\d{3})*)₫?<\/strong>/g;
                let m;
                const cleanHtml = htmlContent.replace(/\n/g, ' ');
                while ((m = itemRegex.exec(cleanHtml)) !== null) {
                    const href = m[1];
                    const name = m[2].replace(/<[^>]+>/g, '').trim();
                    const priceStr = m[3].replace(/\./g, '');
                    const price = parseInt(priceStr);

                    if (name && price > 0) {
                        items.push({
                            externalId: href,
                            externalUrl: BASE_URL + href,
                            name: name,
                            price: price,
                            originalPrice: price,
                            discountPercent: 0,
                            rating: 0,
                            reviewCount: 0,
                            available: true,
                            imageUrl: '',
                            brand: '',
                            category: ''
                        });
                    }
                }
                return items;
            };

            let products = buildProductsFromHtml(html);
            kwProducts = saveProducts(SOURCE, SOURCE_ID, products);
            totalNew += kwProducts;
            console.log(`   Page 1 (HTML): Found ${products.length} items, +${kwProducts} new`);

            // Loop API if CateID found
            if (cateId) {
                let emptyPages = 0;
                for (let pi = 1; pi <= 20; pi++) {
                    if (ids.size >= CONFIG.TARGET_PRODUCTS) break;

                    const bodyParams = new URLSearchParams();
                    bodyParams.append('IsParentCate', 'False');
                    bodyParams.append('IsShowCompare', 'True');
                    bodyParams.append('prevent', 'true');
                    bodyParams.append('c', cateId);
                    bodyParams.append('pi', pi.toString());

                    const res = await fetch(SEARCH_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Origin': BASE_URL,
                            'Referer': finalUrl
                        },
                        body: bodyParams
                    });

                    if (!res.ok) break;

                    const json = await res.json();
                    const listHtml = json.listproducts || json; // sometimes returns just HTML string? CHECK LOGS if fails.
                    // Actually DMX/TGDD returns { listproducts: "html" } usually

                    if (!listHtml || (typeof listHtml === 'string' && listHtml.trim().length < 100)) {
                        emptyPages++;
                        if (emptyPages >= 1) break;
                        continue;
                    }

                    const apiProducts = buildProductsFromHtml(typeof listHtml === 'string' ? listHtml : '');
                    if (apiProducts.length === 0) break;

                    const saved = saveProducts(SOURCE, SOURCE_ID, apiProducts);
                    kwProducts += saved;
                    totalNew += saved;
                    console.log(`   Page ${pi + 1} (API): Found ${apiProducts.length} items, +${saved} new | Total: ${ids.size.toLocaleString()}`);

                    await sleep(CONFIG.DELAY_BETWEEN_PAGES);
                }
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
