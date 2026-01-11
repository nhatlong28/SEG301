/**
 * Debug CellphoneS Crawler (GraphQL)
 * 
 * Usage: npx tsx src/scripts/debug_cellphones.ts
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const DATA_DIR = path.join(process.cwd(), 'data', 'cellphones');
const OUTPUT_FILE = path.join(DATA_DIR, 'products.jsonl');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const existingIds = new Set<string>();
if (fs.existsSync(OUTPUT_FILE)) {
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
        try {
            const p = JSON.parse(line);
            if (p.external_id) existingIds.add(String(p.external_id));
        } catch { }
    }
    console.log(`📂 Loaded ${existingIds.size} existing products`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const GRAPHQL_URL = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';
const BASE_URL = 'https://cellphones.com.vn';

const KEYWORDS = [
    "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "huawei",
    "macbook", "laptop asus", "laptop dell", "laptop hp", "laptop lenovo", "laptop acer",
    "ipad", "tablet", "máy tính bảng",
    "airpods", "tai nghe", "loa bluetooth", "sạc dự phòng",
    "apple watch", "đồng hồ thông minh", "smartwatch",
    "cáp sạc", "ốp lưng", "miếng dán", "phụ kiện"
];

function buildQuery(keyword: string, pageNum: number): string {
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

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        CELLPHONES DEBUG CRAWLER (GraphQL)             ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        protocolTimeout: 0
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let totalNew = 0;

    for (const keyword of KEYWORDS) {
        console.log(`\n📌 Keyword: "${keyword}"`);
        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 100; pageNum++) {
            const query = buildQuery(keyword, pageNum);

            try {
                const result: any = await page.evaluate(async (url, q) => {
                    try {
                        const r = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query: q, variables: {} })
                        });
                        if (!r.ok) return { error: `HTTP ${r.status}` };
                        return { data: await r.json() };
                    } catch (e: any) {
                        return { error: e.message };
                    }
                }, GRAPHQL_URL, query);

                if (result.error) {
                    console.log(`   ⚠️ API Error: ${result.error}`);
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }

                const data = result.data?.data?.advanced_search;
                if (!data?.products || data.products.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    continue;
                }
                emptyPages = 0;

                // Save new products
                let newCount = 0;
                const lines: string[] = [];
                for (const item of data.products) {
                    const id = String(item.product_id);
                    if (!id || existingIds.has(id)) continue;
                    existingIds.add(id);
                    newCount++;

                    const urlPath = item.url_path || '';
                    const price = item.special_price || item.price || 0;
                    const origPrice = item.price > price ? item.price : 0;
                    const discount = origPrice > 0 ? Math.round(((origPrice - price) / origPrice) * 100) : 0;

                    lines.push(JSON.stringify({
                        source_id: 4,
                        external_id: id,
                        external_url: `${BASE_URL}/${urlPath}${urlPath.endsWith('.html') ? '' : '.html'}`,
                        name: item.name,
                        name_normalized: item.name.toLowerCase(),
                        price,
                        original_price: origPrice || null,
                        discount_percent: discount,
                        image_url: item.thumbnail?.startsWith('http') ? item.thumbnail : `https://cdn2.cellphones.com.vn/358x358,webp,q100/media/catalog/product${item.thumbnail}`,
                        category_raw: item.category_objects?.map((c: any) => c.name).join(' > ') || '',
                        available: item.stock_available_id !== 46,
                        crawled_at: new Date().toISOString()
                    }));
                }

                if (lines.length > 0) {
                    fs.appendFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
                }

                kwProducts += newCount;
                totalNew += newCount;

                const totalPages = Math.ceil((data.meta?.total || 0) / 20);
                console.log(`   Page ${pageNum}/${totalPages}: ${data.products.length} found, +${newCount} new | Total: ${existingIds.size}`);

                if (pageNum >= totalPages) break;
                if (newCount === 0 && pageNum > 5) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                }

                await sleep(500);

            } catch (e: any) {
                console.log(`   ❌ Error: ${e.message}`);
                await sleep(2000);
            }
        }

        console.log(`   📊 Keyword done: +${kwProducts}`);
        await sleep(1000);
    }

    await browser.close();
    console.log(`\n🎉 COMPLETE: +${totalNew} new | Total: ${existingIds.size}`);
}

main().catch(console.error);
