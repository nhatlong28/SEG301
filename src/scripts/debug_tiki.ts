/**
 * Debug Tiki Crawler (REST API)
 * 
 * Usage: npx tsx src/scripts/debug_tiki.ts
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'tiki');
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

const API_URL = 'https://tiki.vn/api/v2/products';

const KEYWORDS = [
    "iphone", "samsung", "xiaomi", "oppo", "macbook", "laptop",
    "airpods", "tai nghe", "loa bluetooth", "sạc dự phòng",
    "tivi", "tủ lạnh", "máy giặt", "điều hòa", "nồi cơm điện",
    "quần áo", "giày dép", "túi xách", "đồng hồ",
    "sách", "thực phẩm", "mỹ phẩm", "đồ chơi", "thể thao"
];

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        TIKI DEBUG CRAWLER (REST API)                  ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    let totalNew = 0;

    for (const keyword of KEYWORDS) {
        console.log(`\n📌 Keyword: "${keyword}"`);
        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 100; pageNum++) {
            try {
                const url = `${API_URL}?q=${encodeURIComponent(keyword)}&page=${pageNum}&limit=100`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.log(`   ⚠️ HTTP ${response.status}`);
                    emptyPages++;
                    if (emptyPages >= 3) break;
                    await sleep(2000);
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

                // Save new products
                let newCount = 0;
                const lines: string[] = [];
                for (const item of items) {
                    const id = String(item.id);
                    if (!id || existingIds.has(id)) continue;
                    existingIds.add(id);
                    newCount++;

                    const soldQty = item.quantity_sold?.value || 0;

                    lines.push(JSON.stringify({
                        source_id: 2,
                        external_id: id,
                        external_url: `https://tiki.vn/${item.url_path || item.url_key}`,
                        name: item.name,
                        name_normalized: item.name.toLowerCase(),
                        price: item.price || 0,
                        original_price: item.list_price > item.price ? item.list_price : null,
                        discount_percent: item.discount_rate || 0,
                        image_url: item.thumbnail_url,
                        brand_raw: item.brand_name || '',
                        category_raw: item.categories?.primary?.name || '',
                        rating: item.rating_average || 0,
                        review_count: item.review_count || 0,
                        sold_count: soldQty,
                        available: item.inventory_status === 'available',
                        crawled_at: new Date().toISOString()
                    }));
                }

                if (lines.length > 0) {
                    fs.appendFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
                }

                kwProducts += newCount;
                totalNew += newCount;

                const totalPages = json.paging?.last_page || Math.ceil((json.paging?.total || 0) / 100);
                console.log(`   Page ${pageNum}/${totalPages}: ${items.length} found, +${newCount} new | Total: ${existingIds.size}`);

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

    console.log(`\n🎉 COMPLETE: +${totalNew} new | Total: ${existingIds.size}`);
}

main().catch(console.error);
