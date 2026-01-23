/**
 * Mass Crawler - JSON Output
 * Stability + Productivity Focused Version
 */

import fs from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';
import { KeywordService } from '../crawler/keywordService';
import { CrawledProduct } from '../crawler/base';

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

const CONFIG = {
    TARGET_PRODUCTS: 500000,  // Mục tiêu 500k sản phẩm mỗi sàn
    MAX_PAGES_PER_KEYWORD: 100,
};

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const uniqueIds: Record<string, Set<string>> = {};

function loadExistingIds(source: string): Set<string> {
    if (!uniqueIds[source]) {
        uniqueIds[source] = new Set();
        const filename = path.join(DATA_DIR, source, 'products.jsonl');
        if (fs.existsSync(filename)) {
            const content = fs.readFileSync(filename, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const p = JSON.parse(line);
                    if (p.external_id) uniqueIds[source].add(String(p.external_id));
                } catch { }
            }
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
        if (!product.price || product.price <= 0) continue;

        ids.add(id);
        newCount++;

        const record = {
            source_id: sourceId,
            external_id: id,
            external_url: product.externalUrl,
            name: product.name,
            price: product.price,
            image_url: product.imageUrl || null,
            brand_raw: product.brand || null,
            category_raw: product.category || null,
            crawled_at: new Date().toISOString(),
        };
        lines.push(JSON.stringify(record));
    }
    if (lines.length > 0) fs.appendFileSync(filename, lines.join('\n') + '\n');
    return newCount;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const autoScroll = async (page: Page) => {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            let distance = 400;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || totalHeight > 10000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
};

// =============================================
// PLATFORMS
// =============================================

async function runCellphones() {
    const SOURCE = 'cellphones';
    const G_URL = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';
    const ids = loadExistingIds(SOURCE);
    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 24);
    const allKeywords = await KeywordService.getKeywords('all', undefined, 24);
    const combinedKeywords = [...keywords, ...allKeywords.filter(k => !keywords.find(kw => kw.keyword === k.keyword))];

    console.log(`🚀 [Cellphones] Processing ${combinedKeywords.length} keywords...`);
    for (const kw of combinedKeywords) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        for (let pNum = 1; pNum <= 50; pNum++) {
            try {
                const query = `query search { advanced_search(user_query: { terms: "${kw.keyword.replace(/"/g, '\\"')}", province: 30 }, page: ${pNum}) { products { product_id name url_path price special_price thumbnail category_objects { name } } } }`;
                const r = await fetch(G_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ query }) });
                const json: any = await r.json();
                const items = json?.data?.advanced_search?.products || [];
                if (items.length === 0) break;
                const saved = saveProducts(SOURCE, 4, items.map((i: any) => ({ externalId: i.product_id, externalUrl: `https://cellphones.com.vn/${i.url_path}`, name: i.name, price: i.special_price || i.price, imageUrl: i.thumbnail, brand: i.category_objects?.[0]?.name })));
                console.log(`[CELLPHONES] P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && pNum > 1) break;
                await sleep(100);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

async function runTiki() {
    const SOURCE = 'tiki';
    const API_URL = 'https://tiki.vn/api/v2/products';
    const ids = loadExistingIds(SOURCE);
    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 24);
    const allKeywords = await KeywordService.getKeywords('all', undefined, 24);
    const combinedKeywords = [...keywords, ...allKeywords.filter(k => !keywords.find(kw => kw.keyword === k.keyword))];

    console.log(`🚀 [Tiki] Processing Categories... (Total: ${ids.size})`);
    // EXPANDED: All main categories from Tiki
    const cats = [
        // Điện thoại & Máy tính bảng
        1789, 1795, 28856,
        // Laptop - Máy Vi Tính - Linh kiện
        1846, 1847, 8060, 8061, 8062, 8089,
        // Điện Gia Dụng
        1883, 4834, 4833, 4832, 4831, 4830, 4829, 4835, 4836, 4837,
        // Tivi - Thiết bị nghe nhìn
        1815, 4880, 4882, 4884,
        // Thiết bị số - Phụ kiện số  
        1801, 8055, 8056, 8057, 8058, 8059,
        // Máy ảnh - Quay phim
        1882, 4870, 4871, 4872, 4873,
        // Điện tử - Điện lạnh
        4221, 8139, 8140, 8141, 8142,
        // Đồng hồ và Trang sức
        8594, 8600, 8601, 8602,
        // Nhà cửa - Đời sống
        1686, 17166, 17167, 17168,
        // Sách, VPP
        8322, 316, 393, 320, 846,
        // Đồ chơi
        27498, 27499, 27500,
        // Mẹ và bé  
        2549, 2550, 2551, 2552,
        // Làm đẹp - Sức khỏe
        1520, 1521, 1522, 1523, 1524,
        // Thể thao
        1975, 1976, 1977, 1978,
        // Xe cộ
        8594
    ];
    /*
    for (const cid of cats) {
        for (let pNum = 1; pNum <= 50; pNum++) {
            try {
                const r = await fetch(`${API_URL}?category=${cid}&page=${pNum}&limit=100`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const json: any = await r.json();
                const items = json.data || [];
                if (items.length === 0) break;
                const saved = saveProducts(SOURCE, 2, items.map((i: any) => ({ externalId: i.id, externalUrl: `https://tiki.vn/${i.url_path}`, name: i.name, price: i.price, imageUrl: i.thumbnail_url })));
                console.log(`[TIKI-CAT] ${cid} P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && pNum > 1) break;
                await sleep(100);
            } catch { break; }
        }
    }
    */
    for (const kw of combinedKeywords) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        for (let pNum = 1; pNum <= 30; pNum++) {
            try {
                const r = await fetch(`${API_URL}?q=${encodeURIComponent(kw.keyword)}&page=${pNum}&limit=100`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const json: any = await r.json();
                const items = json.data || [];
                if (items.length === 0) break;
                const saved = saveProducts(SOURCE, 2, items.map((i: any) => ({ externalId: i.id, externalUrl: `https://tiki.vn/${i.url_path}`, name: i.name, price: i.price, imageUrl: i.thumbnail_url })));
                console.log(`[TIKI-KW] "${kw.keyword}" P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && pNum > 1) break;
                await sleep(100);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

async function runLazada() {
    const SOURCE = 'lazada';
    const ids = loadExistingIds(SOURCE);
    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 24);
    const allKeywords = await KeywordService.getKeywords('all', undefined, 24);
    const combinedKeywords = [...keywords, ...allKeywords.filter(k => !keywords.find(kw => kw.keyword === k.keyword))];
    const browser = await puppeteerExtra.launch({ headless: true, args: ['--window-size=1280,800'] });
    const page = await browser.newPage();

    console.log(`🚀 [Lazada] Processing ${combinedKeywords.length} keywords...`);
    for (const kw of combinedKeywords) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        for (let pNum = 1; pNum <= 30; pNum++) {
            try {
                const url = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(kw.keyword)}&page=${pNum}&ajax=true`;
                await page.goto(url, { waitUntil: 'domcontentloaded' });

                let isCaptcha = await page.evaluate(() => {
                    const t = document.body.innerText.toLowerCase();
                    return (t.includes('robot') || t.includes('captcha') || window.location.href.includes('punish')) && !t.startsWith('{"templates":');
                });

                if (isCaptcha) {
                    console.log(`🚨 [LAZADA] CAPTCHA DETECTED! Waiting for you...`);
                    while (isCaptcha) {
                        await sleep(5000);
                        isCaptcha = await page.evaluate(() => {
                            const t = document.body.innerText.toLowerCase();
                            return (t.includes('robot') || t.includes('captcha') || window.location.href.includes('punish')) && !t.startsWith('{"templates":');
                        });
                    }
                    console.log(`✅ [LAZADA] Captcha solved! Resuming...`);
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                }

                const data = await page.evaluate(() => { try { return JSON.parse(document.body.innerText); } catch { return null; } });
                if (data?.mods?.listItems) {
                    const saved = saveProducts(SOURCE, 3, data.mods.listItems.map((i: any) => ({ externalId: i.itemId, externalUrl: 'https:' + i.itemUrl, name: i.name, price: parseInt(i.price), imageUrl: i.image })));
                    console.log(`[LAZADA] P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);
                    if (saved === 0 && pNum > 1) break;
                    await sleep(3000 + Math.random() * 2000);
                }
            } catch { await sleep(5000); }
        }
        await KeywordService.markCrawled(kw.id);
    }
    await browser.close();
}

async function runMWG(source: string, sourceId: number, baseUrl: string) {
    const ids = loadExistingIds(source);
    const keywords = await KeywordService.getKeywords(source, undefined, 24);
    // Also get 'all' keywords
    const allKeywords = await KeywordService.getKeywords('all', undefined, 24);
    const combinedKeywords = [...keywords, ...allKeywords.filter(k => !keywords.find(kw => kw.keyword === k.keyword))];

    const browser = await puppeteerExtra.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`🚀 [${source.toUpperCase()}] Processing ${combinedKeywords.length} keywords...`);

    // Selectors optimized for both Search and Category pages
    const pS = '.listproduct li.item, li.item.ajaxed, a.main-contain, .list-product li.item, .product-list li.item, .category-products li.item';
    const bS = '.view-more a, .viewmore a, a.view-more, .view-more, .btn-viewmore';

    // 1. Crawl Categories first for high volume - EXPANDED LIST
    const categories = source === 'dienmayxanh'
        ? [
            // TV & Display
            'tivi', 'tivi-samsung', 'tivi-lg', 'tivi-sony', 'tivi-xiaomi', 'tivi-casper', 'tivi-tcl', 'tivi-hisense',
            // Tủ lạnh
            'tu-lanh', 'tu-lanh-samsung', 'tu-lanh-lg', 'tu-lanh-panasonic', 'tu-lanh-hitachi', 'tu-lanh-toshiba', 'tu-lanh-sharp', 'tu-lanh-aqua', 'tu-dong', 'tu-mat',
            // Máy giặt
            'may-giat', 'may-giat-samsung', 'may-giat-lg', 'may-giat-electrolux', 'may-giat-panasonic', 'may-giat-toshiba', 'may-giat-aqua', 'may-say-quan-ao',
            // Điều hòa
            'may-lanh-dieu-hoa', 'may-lanh-daikin', 'may-lanh-panasonic', 'may-lanh-lg', 'may-lanh-samsung', 'may-lanh-toshiba', 'may-lanh-casper', 'may-lanh-mitsubishi',
            // Gia dụng nhà bếp
            'noi-chien-khong-dau', 'noi-com-dien', 'bep-tu', 'bep-ga', 'bep-hong-ngoai', 'lo-vi-song', 'may-xay-sinh-to', 'may-ep-trai-cay', 'am-dun-sieu-toc', 'binh-thuy-dien',
            // Thiết bị làm sạch
            'may-hut-bui', 'robot-hut-bui', 'may-loc-khong-khi', 'may-loc-nuoc', 'may-rua-chen',
            // Thiết bị điện
            'quat', 'quat-dieu-hoa', 'may-nuoc-nong', 'binh-nong-lanh',
            // Âm thanh
            'loa', 'loa-bluetooth', 'loa-karaoke', 'dan-am-thanh', 'micro',
            // Camera
            'camera-giam-sat', 'camera-ip', 'camera-wifi',
            // Sức khỏe
            'ghe-massage', 'may-say-toc', 'may-cao-rau', 'ban-ui', 'may-tam-nuoc'
        ]
        : [
            // Điện thoại
            'dtdd', 'dtdd-iphone', 'dtdd-samsung', 'dtdd-xiaomi', 'dtdd-oppo', 'dtdd-vivo', 'dtdd-realme', 'dtdd-nokia', 'dtdd-tecno', 'dtdd-infinix', 'dtdd-honor', 'dtdd-asus',
            // Laptop
            'laptop', 'laptop-asus', 'laptop-dell', 'laptop-hp', 'laptop-lenovo', 'laptop-acer', 'laptop-msi', 'laptop-apple-macbook', 'laptop-lg', 'laptop-gigabyte',
            // Tablet
            'tablet', 'ipad', 'tablet-samsung', 'tablet-xiaomi', 'tablet-lenovo', 'tablet-huawei',
            // Apple
            'apple', 'iphone', 'ipad', 'apple-watch', 'airpods', 'macbook',
            // Phụ kiện
            'phu-kien', 'sac-du-phong', 'sac-cap', 'op-lung', 'mieng-dan-cuong-luc', 'tai-nghe', 'tai-nghe-bluetooth', 'loa-bluetooth',
            // Đồng hồ
            'dong-ho-thong-minh', 'apple-watch', 'samsung-galaxy-watch', 'garmin', 'xiaomi-watch', 'huawei-watch',
            // PC
            'pc-may-tinh-ban', 'man-hinh-may-tinh', 'may-in', 'chuot-ban-phim', 'webcam', 'linh-kien-may-tinh'
        ];

    /*
    console.log(`🚀 [${source.toUpperCase()}] Swiping Categories first...`);
    for (const catPath of categories) {
        try {
            await page.goto(`${baseUrl}/${catPath}`, { waitUntil: 'domcontentloaded' });
            await sleep(2000);
            for (let pNum = 1; pNum <= 30; pNum++) {
                const products = await page.evaluate((sel) => {
                    return Array.from(document.querySelectorAll(sel)).map((el: any) => {
                        const a = el.tagName === 'A' ? el : el.querySelector('a');
                        if (!a) return null;

                        // Robust ID extraction: data-id or URL parts
                        const dataId = a.getAttribute('data-id') || el.getAttribute('data-id');
                        const urlId = a.href.split('-').pop()?.split('.')[0]?.split('?')[0];
                        const finalId = dataId && /^\d+$/.test(dataId) ? dataId : urlId || a.href;

                        const name = el.querySelector('h3, .name')?.textContent?.trim() || a.getAttribute('data-name') || '';

                        // Price extraction: data-price or strong or span
                        const priceStr = a.getAttribute('data-price') || el.querySelector('.price, strong, .item-txt-online')?.textContent?.replace(/[^\d]/g, '') || '0';
                        const price = parseInt(priceStr);

                        // Fix URL: ensure proper format with base domain
                        let fullUrl = a.href;
                        if (!fullUrl.startsWith('http')) {
                            fullUrl = 'https://www.thegioididong.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
                        }

                        return { externalId: finalId, externalUrl: fullUrl, name, price, imageUrl: el.querySelector('img')?.src };
                    }).filter(i => i && i.name && i.price > 0);
                }, pS);

                const saved = saveProducts(source, sourceId, products as any);
                console.log(`[${source.toUpperCase()}-CAT] ${catPath} P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);

                await autoScroll(page);
                await sleep(1500);
                const btn = await page.$(bS);
                if (!btn) break;

                const before = await page.$$eval(pS, els => els.length);
                try { await btn.click(); } catch { await page.evaluate((el: any) => el.click(), btn); }
                let ok = false;
                for (let i = 0; i < 5; i++) {
                    await sleep(2500);
                    if (await page.$$eval(pS, els => els.length) > before) { ok = true; break; }
                }
                if (!ok) break;
            }
        } catch { }
    }
    */

    // 2. Crawl Keywords (combined source-specific + global)
    for (const kw of combinedKeywords) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        try {
            await page.goto(`${baseUrl}/tim-kiem?key=${encodeURIComponent(kw.keyword)}`, { waitUntil: 'domcontentloaded' });
            await sleep(2000);
            for (let pNum = 1; pNum <= 20; pNum++) {
                const products = await page.evaluate((sel) => {
                    return Array.from(document.querySelectorAll(sel)).map((el: any) => {
                        const a = el.tagName === 'A' ? el : el.querySelector('a');
                        if (!a) return null;
                        const dataId = a.getAttribute('data-id') || el.getAttribute('data-id');
                        const urlId = a.href.split('-').pop()?.split('.')[0];
                        const finalId = dataId || urlId || a.href;
                        const name = el.querySelector('h3, .name')?.textContent?.trim() || a.getAttribute('data-name') || '';
                        const price = parseInt(a.getAttribute('data-price') || el.querySelector('.price, strong')?.textContent?.replace(/[^\d]/g, '') || '0');
                        return { externalId: finalId, externalUrl: a.href, name, price, imageUrl: el.querySelector('img')?.src };
                    }).filter(i => i && i.name && i.price > 0);
                }, pS);

                const saved = saveProducts(source, sourceId, products as any);
                console.log(`[${source.toUpperCase()}-KW] "${kw.keyword}" P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);

                await autoScroll(page);
                await sleep(1500);
                const btn = await page.$(bS);
                if (!btn || !await page.evaluate(el => el.getBoundingClientRect().height > 0, btn)) break;

                const before = await page.$$eval(pS, els => els.length);
                await btn.click().catch(() => page.evaluate((el: any) => el.click(), btn));
                let ok = false;
                for (let i = 0; i < 5; i++) {
                    await sleep(2500);
                    if (await page.$$eval(pS, els => els.length) > before) { ok = true; break; }
                }
                if (!ok) break;
            }
        } catch { }
        await KeywordService.markCrawled(kw.id);
    }
    await browser.close();
}

async function runChotot() {
    const SOURCE = 'chotot';
    const API_URL = 'https://gateway.chotot.com/v1/public/ad-listing';
    const ids = loadExistingIds(SOURCE);
    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 24);
    const allKeywords = await KeywordService.getKeywords('all', undefined, 24);
    const combinedKeywords = [...keywords, ...allKeywords.filter(k => !keywords.find(kw => kw.keyword === k.keyword))];

    const extractBrand = (title: string): string | null => {
        const t = title.toLowerCase();
        if (t.includes('iphone') || t.includes('ipad') || t.includes('macbook') || t.includes('apple')) return 'Apple';
        if (t.includes('samsung') || t.includes('galaxy')) return 'Samsung';
        if (t.includes('xiaomi') || t.includes('redmi') || t.includes('poco')) return 'Xiaomi';
        if (t.includes('oppo')) return 'Oppo';
        if (t.includes('vivo')) return 'Vivo';
        if (t.includes('sony')) return 'Sony';
        if (t.includes('nokia')) return 'Nokia';
        if (t.includes('lg')) return 'LG';
        if (t.includes('asus') || t.includes('rog')) return 'Asus';
        if (t.includes('realme')) return 'Realme';
        if (t.includes('vsmart')) return 'Vsmart';
        if (t.includes('pixel') || t.includes('google')) return 'Google';
        return null;
    };

    console.log(`🚀 [Chotot] Processing ${combinedKeywords.length} keywords...`);
    for (const kw of combinedKeywords) {
        if (ids.size >= CONFIG.TARGET_PRODUCTS) break;
        // Chotot offset is index-based (0, 20, 40...), not page number. Limit is usually 20.
        // We simulate "pages" for the loop
        const limit = 20;

        for (let pNum = 1; pNum <= 30; pNum++) {
            try {
                const offset = (pNum - 1) * limit;
                const url = `${API_URL}?q=${encodeURIComponent(kw.keyword)}&limit=${limit}&o=${offset}&st=s,k`;

                const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const json: any = await r.json();
                const items = json.ads || [];

                if (items.length === 0) break;

                const saved = saveProducts(SOURCE, 7, items.map((i: any) => ({
                    externalId: i.ad_id,
                    externalUrl: `https://www.chotot.com/${i.ad_listing_url || (i.ad_id + '.htm')}`,
                    name: i.subject,
                    price: i.price,
                    imageUrl: i.image,
                    brand: extractBrand(i.subject),
                    category: i.category_name
                })));

                console.log(`[CHOTOT] "${kw.keyword}" P${pNum} | +${saved} | Total: ${ids.size.toLocaleString()}`);

                if (saved === 0 && pNum > 1) break;
                await sleep(500 + Math.random() * 500);
            } catch (e) {
                // console.error(e);
                break;
            }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

async function main() {
    console.log('🔥 STARTING MULTI-PLATFORM PRODUCTION CRAWLER...');
    // Parallelize all platforms
    await Promise.all([
        runTiki(),
        runCellphones(),
        runMWG('dienmayxanh', 5, 'https://www.dienmayxanh.com'),
        runMWG('thegioididong', 6, 'https://www.thegioididong.com'),
        runLazada(),
        runChotot()
    ]);
}
main().catch(console.error);
