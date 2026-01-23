/**
 * EXHAUSTIVE CRAWLER - Cào TOÀN BỘ sản phẩm theo Category & Keywords mới 2026
 */

import fs from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { KeywordService } from '../crawler/keywordService';
import { insertProducts } from '../db/cockroach';

puppeteerExtra.use(StealthPlugin());

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

interface ProductRecord {
    source_id: number;
    external_id: string;
    external_url: string;
    name: string;
    price: number;
    image_url: string | null;
    brand_raw: string | null;
    category_raw: string | null;
    crawled_at: string;
}

function saveProducts(source: string, products: ProductRecord[]): number {
    const ids = loadExistingIds(source);
    let newCount = 0;
    const lines: string[] = [];
    const filename = path.join(DATA_DIR, source, 'products.jsonl');
    if (!fs.existsSync(path.dirname(filename))) fs.mkdirSync(path.dirname(filename), { recursive: true });

    for (const product of products) {
        const id = String(product.external_id);
        if (!id || ids.has(id)) continue;
        if (!product.price || product.price <= 0) continue;

        ids.add(id);
        newCount++;
        lines.push(JSON.stringify(product));
    }
    if (lines.length > 0) {
        fs.appendFileSync(filename, lines.join('\n') + '\n');
        // Dual storage: Save to local JSONL and push to CockroachDB immediately
        insertProducts(products).catch(() => { });
    }
    return newCount;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

async function safeFetch(url: string, options: any = {}, retries = 5): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                    ...options.headers
                },
                redirect: 'follow'
            });

            if (res.status === 403 || res.status === 429) {
                await sleep((30 + i * 30) * 1000);
                continue;
            }

            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                if (retries > 1) { await sleep(2000); continue; }
                throw e;
            }
        } catch (e: any) {
            if (i === retries - 1) throw e;
            await sleep((5 + i * 5) * 1000);
        }
    }
}

// =============================================
// TIKI - CÀO THEO KEYWORDS 2026
// =============================================
async function runTikiExhaustive() {
    const SOURCE = 'tiki';
    const API_URL = 'https://tiki.vn/api/v2/products';
    const ids = loadExistingIds(SOURCE);

    console.log(`🚀 [TIKI] KEYWORD MODE: ${ids.size} existing products`);

    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 1);

    for (const kw of keywords) {
        console.log(`🔍 [TIKI] "${kw.keyword}"...`);
        for (let page = 1; page <= 50; page++) {
            try {
                const url = `${API_URL}?q=${encodeURIComponent(kw.keyword)}&page=${page}&limit=100&sort=newest`;
                const json = await safeFetch(url);
                const items = json?.data || [];
                if (items.length === 0) break;

                const products: ProductRecord[] = items.map((i: any) => ({
                    source_id: 2,
                    external_id: String(i.id),
                    external_url: `https://tiki.vn/${i.url_path || i.url_key}`,
                    name: i.name,
                    price: i.price,
                    image_url: i.thumbnail_url,
                    brand_raw: i.brand?.name || null,
                    category_raw: kw.category,
                    crawled_at: new Date().toISOString()
                }));

                const saved = saveProducts(SOURCE, products);
                console.log(`   P${page}: +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && page > 2) break;
                await sleep(200);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

// =============================================
// CELLPHONES - CÀO THEO KEYWORDS 2026
// =============================================
async function runCellphonesExhaustive() {
    const SOURCE = 'cellphones';
    const API_URL = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';
    const ids = loadExistingIds(SOURCE);

    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 1);

    for (const kw of keywords) {
        console.log(`🔍 [CELLPHONES] "${kw.keyword}"...`);
        for (let page = 1; page <= 50; page++) {
            try {
                const query = `query search { advanced_search(user_query: { terms: "${kw.keyword}", province: 30 }, page: ${page}) { products { product_id name url_path price special_price thumbnail category_objects { name } } } }`;
                const json = await safeFetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const items = json?.data?.advanced_search?.products || [];
                if (items.length === 0) break;

                const products: ProductRecord[] = items.map((i: any) => ({
                    source_id: 4,
                    external_id: String(i.product_id),
                    external_url: `https://cellphones.com.vn/${i.url_path}`,
                    name: i.name,
                    price: i.special_price || i.price,
                    image_url: i.thumbnail,
                    brand_raw: i.category_objects?.[0]?.name || null,
                    category_raw: kw.category,
                    crawled_at: new Date().toISOString()
                }));

                const saved = saveProducts(SOURCE, products);
                console.log(`   P${page}: +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && page > 1) break;
                await sleep(200);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

// =============================================
// MWG (DMX/TGDD) - CÀO THEO KEYWORDS 2026
// =============================================
async function runMWGExhaustive(source: 'dienmayxanh' | 'thegioididong') {
    const sourceId = source === 'dienmayxanh' ? 5 : 6;
    const baseUrl = source === 'dienmayxanh' ? 'https://www.dienmayxanh.com' : 'https://www.thegioididong.com';
    const ids = loadExistingIds(source);

    const browser = await puppeteerExtra.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const keywords = await KeywordService.getKeywords(source, undefined, 1);

    for (const kw of keywords) {
        console.log(`🔍 [${source.toUpperCase()}] "${kw.keyword}"...`);
        try {
            await page.goto(`${baseUrl}/tim-kiem?key=${encodeURIComponent(kw.keyword)}`, { waitUntil: 'domcontentloaded' });
            await sleep(2000);

            for (let pNum = 1; pNum <= 10; pNum++) {
                const products = await page.evaluate((srcId, kwCat, base) => {
                    const sel = '.listproduct li.item, li.item.ajaxed, a.main-contain';
                    return Array.from(document.querySelectorAll(sel)).map((el: any) => {
                        const a = el.tagName === 'A' ? el : el.querySelector('a');
                        if (!a) return null;
                        const finalId = a.getAttribute('data-id') || a.href.split('-').pop()?.split('.')[0] || '';
                        const price = parseInt(a.getAttribute('data-price') || el.querySelector('.price')?.textContent?.replace(/[^\d]/g, '') || '0');
                        let img = el.querySelector('img')?.getAttribute('data-src') || el.querySelector('img')?.src || '';
                        if (img.startsWith('//')) img = 'https:' + img;

                        return {
                            source_id: srcId,
                            external_id: finalId,
                            external_url: a.href.startsWith('http') ? a.href : base + a.href,
                            name: el.querySelector('h3, .name')?.textContent?.trim() || '',
                            price,
                            image_url: img,
                            brand_raw: null,
                            category_raw: kwCat,
                            crawled_at: new Date().toISOString()
                        };
                    }).filter(i => i && i.name && i.price > 0 && i.external_id);
                }, sourceId, kw.category, baseUrl);

                const saved = saveProducts(source, products as any);
                console.log(`   P${pNum}: +${saved} | Total: ${ids.size.toLocaleString()}`);

                if (saved === 0 && pNum > 1) break;
                const nextBtn = await page.$('.view-more a, .viewmore a');
                if (nextBtn) { await nextBtn.click(); await sleep(3000); } else break;
            }
            await KeywordService.markCrawled(kw.id);
        } catch { }
    }
    await browser.close();
}

// =============================================
// CHOTOT - CÀO THEO KEYWORDS 2026
// =============================================
async function runChototExhaustive() {
    const SOURCE = 'chotot';
    const API_URL = 'https://gateway.chotot.com/v1/public/ad-listing';
    const ids = loadExistingIds(SOURCE);

    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 1);

    for (const kw of keywords) {
        console.log(`🔍 [CHOTOT] "${kw.keyword}"...`);
        for (let offset = 0; offset < 1000; offset += 50) {
            try {
                const url = `${API_URL}?q=${encodeURIComponent(kw.keyword)}&limit=50&o=${offset}&st=s,k`;
                const json = await safeFetch(url);
                const items = json?.ads || [];
                if (items.length === 0) break;

                const products: ProductRecord[] = items.map((i: any) => ({
                    source_id: 7,
                    external_id: String(i.ad_id),
                    external_url: `https://www.chotot.com/${i.ad_listing_url}`,
                    name: i.subject,
                    price: i.price,
                    image_url: i.image,
                    brand_raw: null,
                    category_raw: kw.category,
                    crawled_at: new Date().toISOString()
                })).filter((i: any) => i.price > 0);

                const saved = saveProducts(SOURCE, products);
                console.log(`   Offset ${offset}: +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && offset > 200) break;
                await sleep(500);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
}

// =============================================
// LAZADA - CÀO THEO KEYWORDS 2026
// =============================================
async function runLazadaExhaustive() {
    const SOURCE = 'lazada';
    const ids = loadExistingIds(SOURCE);

    const browser = await puppeteerExtra.launch({ headless: false });
    const page = await browser.newPage();

    const keywords = await KeywordService.getKeywords(SOURCE, undefined, 1);

    for (const kw of keywords) {
        console.log(`🔍 [LAZADA] "${kw.keyword}"...`);
        for (let pageNum = 1; pageNum <= 30; pageNum++) {
            try {
                const url = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(kw.keyword)}&page=${pageNum}&ajax=true`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // --- CAPTCHA DETECTION ---
                let isCaptcha = await page.evaluate(() => {
                    const t = document.body.innerText.toLowerCase();
                    return (t.includes('robot') || t.includes('captcha') || window.location.href.includes('punish')) && !t.startsWith('{"templates":');
                });

                if (isCaptcha) {
                    console.log(`🚨 [LAZADA] CAPTCHA DETECTED! Waiting for you to solve manually in the browser window...`);
                    while (isCaptcha) {
                        await sleep(5000);
                        isCaptcha = await page.evaluate(() => {
                            const t = document.body.innerText.toLowerCase();
                            return (t.includes('robot') || t.includes('captcha') || window.location.href.includes('punish')) && !t.startsWith('{"templates":');
                        });
                    }
                    console.log(`✅ [LAZADA] Captcha seems solved! Resuming...`);
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                }

                const json = await page.evaluate(() => { try { return JSON.parse(document.body.innerText); } catch { return null; } });

                if (!json?.mods?.listItems?.length) break;

                const products: ProductRecord[] = json.mods.listItems.map((i: any) => ({
                    source_id: 3,
                    external_id: String(i.itemId),
                    external_url: 'https:' + i.itemUrl,
                    name: i.name,
                    price: parseInt(i.price),
                    image_url: i.image,
                    brand_raw: i.brandName,
                    category_raw: kw.category,
                    crawled_at: new Date().toISOString()
                }));

                const saved = saveProducts(SOURCE, products);
                console.log(`   P${pageNum}: +${saved} | Total: ${ids.size.toLocaleString()}`);
                if (saved === 0 && pageNum > 2) break;
                await sleep(3000);
            } catch { break; }
        }
        await KeywordService.markCrawled(kw.id);
    }
    await browser.close();
}

async function main() {
    const args = process.argv.slice(2);
    const source = args[0]?.toLowerCase();

    console.log('🔥 2026 KEYWORD CRAWLER - ACTIVE keywords only\n');

    while (true) {
        console.log(`\nRound started at ${new Date().toLocaleString('vi-VN')}`);
        if (source === 'tiki') await runTikiExhaustive();
        else if (source === 'cellphones') await runCellphonesExhaustive();
        else if (source === 'dmx' || source === 'dienmayxanh') await runMWGExhaustive('dienmayxanh');
        else if (source === 'tgdd' || source === 'thegioididong') await runMWGExhaustive('thegioididong');
        else if (source === 'chotot') await runChototExhaustive();
        else if (source === 'lazada') await runLazadaExhaustive();

        console.log(`Waiting 30s...`);
        await sleep(30000);
    }
}

main().catch(console.error);
