/**
 * Debug Lazada Crawler
 * 
 * Chạy riêng Lazada để debug và kiểm tra selectors
 * Usage: npx tsx src/scripts/debug_lazada.ts
 */

import fs from 'fs';
import path from 'path';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

const DATA_DIR = path.join(process.cwd(), 'data', 'lazada');
const OUTPUT_FILE = path.join(DATA_DIR, 'products.jsonl');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load existing IDs
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

const KEYWORDS = [
    "iphone 16", "iphone 15", "samsung galaxy s24", "samsung galaxy s23",
    "macbook pro", "macbook air", "laptop asus", "laptop dell",
    "airpods pro", "tai nghe bluetooth", "sạc dự phòng", "cáp sạc",
    "tivi samsung", "tivi lg", "tủ lạnh", "máy giặt",
    "điều hòa", "nồi cơm điện", "máy xay sinh tố"
];

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║           LAZADA DEBUG CRAWLER                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    const browser = await puppeteerExtra.launch({
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

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('🌐 Navigating to Lazada...');
    try {
        await page.goto('https://www.lazada.vn', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);
    } catch (e) {
        console.log('⚠️ Initial navigation failed');
    }

    let totalNew = 0;

    for (const keyword of KEYWORDS) {
        console.log(`\n📌 Keyword: "${keyword}"`);
        let kwProducts = 0;
        let emptyPages = 0;

        for (let pageNum = 1; pageNum <= 50; pageNum++) {
            const searchUrl = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(keyword)}&page=${pageNum}`;

            try {
                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                // Wait longer for JS to render
                await sleep(3000);

                const title = await page.title();
                if (title.includes('Security') || title.includes('Captcha')) {
                    console.log('   ⛔ CAPTCHA! Waiting 30s...');
                    await sleep(30000);
                    continue;
                }

                // Try multiple selectors
                let selector = 'div[data-qa-locator="product-item"]';
                try {
                    await page.waitForSelector(selector, { timeout: 8000 });
                } catch {
                    // Fallback to alternative selector
                    selector = '.Bm3ON';
                    try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                    } catch {
                        console.log(`   ⚠️ No products on page ${pageNum}`);
                        emptyPages++;
                        if (emptyPages >= 2) break;
                        continue;
                    }
                }

                // Scroll to load all
                await page.evaluate(async () => {
                    for (let i = 0; i < 10; i++) {
                        window.scrollBy(0, 300);
                        await new Promise(r => setTimeout(r, 150));
                    }
                });
                await sleep(500);

                // Extract products
                const products = await page.evaluate(() => {
                    const items: any[] = [];
                    document.querySelectorAll('div[data-qa-locator="product-item"]').forEach((el: any) => {
                        try {
                            const nameLink = el.querySelector('.RfADt a') || el.querySelector('a[href*="/products/"]');
                            if (!nameLink) return;

                            const name = nameLink.getAttribute('title') || nameLink.textContent?.trim() || '';
                            const href = nameLink.getAttribute('href') || '';
                            const imgEl = el.querySelector('img[type="product"]');
                            const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

                            let price = 0;
                            const priceEl = el.querySelector('.aBrP0 span') || el.querySelector('span[class*="price"]');
                            if (priceEl) {
                                price = parseInt(priceEl.textContent?.replace(/[^\d]/g, '') || '0');
                            }

                            const soldEl = el.querySelector('._1cEkb');
                            const soldCount = parseInt((soldEl?.textContent || '0').replace(/[^\d]/g, '')) || 0;

                            const idMatch = href.match(/-i(\d+)-s/) || href.match(/i(\d+)/);
                            const externalId = idMatch ? idMatch[1] : href;

                            if (name && price > 0) {
                                items.push({
                                    externalId, name, price, soldCount,
                                    externalUrl: href.startsWith('//') ? 'https:' + href : (href.startsWith('http') ? href : 'https://www.lazada.vn' + href),
                                    imageUrl: imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl
                                });
                            }
                        } catch { }
                    });
                    return items;
                });

                if (products.length === 0) {
                    emptyPages++;
                    if (emptyPages >= 2) break;
                    continue;
                }
                emptyPages = 0;

                // Save new products
                let newCount = 0;
                const lines: string[] = [];
                for (const p of products) {
                    const id = String(p.externalId);
                    if (!id || existingIds.has(id)) continue;
                    existingIds.add(id);
                    newCount++;

                    lines.push(JSON.stringify({
                        source_id: 3,
                        external_id: id,
                        external_url: p.externalUrl,
                        name: p.name,
                        name_normalized: p.name.toLowerCase(),
                        price: p.price,
                        image_url: p.imageUrl,
                        sold_count: p.soldCount,
                        available: true,
                        crawled_at: new Date().toISOString()
                    }));
                }

                if (lines.length > 0) {
                    fs.appendFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
                }

                kwProducts += newCount;
                totalNew += newCount;
                console.log(`   Page ${pageNum}: ${products.length} found, +${newCount} new | Total: ${existingIds.size}`);

                if (newCount === 0 && pageNum > 3) break;
                await sleep(2000 + Math.random() * 1000);

            } catch (e: any) {
                console.log(`   ❌ Error: ${e.message}`);
                await sleep(3000);
            }
        }
        console.log(`   📊 Keyword done: +${kwProducts}`);
    }

    await browser.close();
    console.log(`\n🎉 COMPLETE: +${totalNew} new | Total: ${existingIds.size}`);
}

main().catch(console.error);
