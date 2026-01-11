/**
 * Debug Thegioididong Crawler
 * 
 * Crawl theo categories
 * Usage: npx tsx src/scripts/debug_tgdd.ts
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const DATA_DIR = path.join(process.cwd(), 'data', 'thegioididong');
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

// TGDD Categories
const CATEGORIES = [
    '/dtdd', '/may-tinh-bang', '/laptop', '/dong-ho-thong-minh',
    '/phu-kien-dien-thoai', '/phu-kien-laptop', '/sac-dtdd', '/tai-nghe',
    '/loa', '/chuot-may-tinh', '/ban-phim', '/camera-webcam',
    '/sim-so-dep', '/thiet-bi-mang', '/may-in', '/man-hinh-may-tinh'
];

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        THEGIOIDIDONG DEBUG CRAWLER                    ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        protocolTimeout: 0
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    let totalNew = 0;

    for (const category of CATEGORIES) {
        const url = `https://www.thegioididong.com${category}`;
        console.log(`\n📌 Category: ${category}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2000);

            let catNew = 0;
            let pageNum = 0;

            while (pageNum < 50) {
                pageNum++;

                // Extract products
                const products = await page.evaluate(() => {
                    const items: any[] = [];
                    document.querySelectorAll('.listproduct li').forEach((li: any) => {
                        const link = li.querySelector('a.main-contain') || li.querySelector('a');
                        if (!link) return;

                        const href = link.getAttribute('href') || '';
                        const name = li.querySelector('h3')?.textContent?.trim() || '';
                        const priceEl = li.querySelector('.price strong') || li.querySelector('strong');
                        const priceText = priceEl?.textContent?.replace(/[^\d]/g, '') || '0';
                        const price = parseInt(priceText) * 1000 || 0;
                        const img = li.querySelector('img');
                        const imageUrl = img?.getAttribute('data-src') || img?.src || '';

                        if (name && href) {
                            items.push({
                                externalId: href,
                                externalUrl: `https://www.thegioididong.com${href}`,
                                name, price, imageUrl
                            });
                        }
                    });
                    return items;
                });

                // Save new products
                let newCount = 0;
                const lines: string[] = [];
                for (const p of products) {
                    const id = String(p.externalId);
                    if (!id || existingIds.has(id)) continue;
                    existingIds.add(id);
                    newCount++;

                    lines.push(JSON.stringify({
                        source_id: 6,
                        external_id: id,
                        external_url: p.externalUrl,
                        name: p.name,
                        name_normalized: p.name.toLowerCase(),
                        price: p.price,
                        image_url: p.imageUrl,
                        available: true,
                        crawled_at: new Date().toISOString()
                    }));
                }

                if (lines.length > 0) {
                    fs.appendFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
                }

                catNew += newCount;
                totalNew += newCount;
                console.log(`   Page ${pageNum}: ${products.length} found, +${newCount} new | Total: ${existingIds.size}`);

                // Click "Xem thêm"
                const hasMore = await page.evaluate(async () => {
                    const btn = document.querySelector('.view-more a') as HTMLElement;
                    if (btn && btn.offsetParent !== null) {
                        btn.scrollIntoView();
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (!hasMore) {
                    console.log('   ⚠️ No more "Xem thêm" button');
                    break;
                }

                await sleep(2000);
            }

            console.log(`   📊 Category done: +${catNew}`);

        } catch (e: any) {
            console.log(`   ❌ Error: ${e.message}`);
        }
    }

    await browser.close();
    console.log(`\n🎉 COMPLETE: +${totalNew} new | Total: ${existingIds.size}`);
}

main().catch(console.error);
