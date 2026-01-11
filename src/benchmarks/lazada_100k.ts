import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath, Page, Browser } from 'puppeteer';

puppeteer.use(StealthPlugin());

let globalBrowser: Browser | null = null;
let browserLoadingPromise: Promise<Browser> | null = null;

async function getBrowser() {
    if (globalBrowser) return globalBrowser;
    if (browserLoadingPromise) return browserLoadingPromise;

    browserLoadingPromise = (async () => {
        try {
            console.log("🚀 Launching Persistent Browser...");
            const browser = await puppeteer.launch({
                headless: true,
                executablePath: executablePath(),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=375,812',
                    '--user-data-dir=./tmp/lazada_bench_profile_v2'
                ]
            });

            // Open one page to warm up
            const page = await browser.newPage();
            console.log("   --> Checking connectivity (example.com)...");
            try {
                await page.goto('http://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
                console.log("   --> Connectivity Check: Success. Title:", await page.title());
            } catch (e) {
                console.error("   --> Connectivity Check: FAILED.", e);
            }

            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version=16.6 Mobile/15E148 Safari/604.1');
            console.log("   --> Warming up session (lazada.vn)...");
            await page.goto('https://www.lazada.vn/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log("   (Warmup navigation timed out or failed, proceeding anyway)"));
            await new Promise(r => setTimeout(r, 2000)); // Keep this delay
            await page.close(); // Close warm up page

            console.log("✅ Browser Ready!");
            globalBrowser = browser;
            return globalBrowser;
        } catch (err) {
            console.error("Browser Init Failed:", err);
            browserLoadingPromise = null;
            throw err;
        }
    })();

    return browserLoadingPromise;
}

async function fetchLazadaBatch(keyword: string, pageNumber: number) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set headers/viewport for this new page
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version=16.6 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    // Use normal catalog URL, not ajax
    const url = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(keyword)}&page=${pageNumber}`;

    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const title = await page.title();
        console.log(`[${keyword}] Title: ${title}`);

        if (title.includes('Sliding Validation') || title.includes('Punish') || title.includes('Security')) {
            console.warn(`[${keyword}] Hit Captcha/Punish/Security. Cooling down...`);
            return null;
        }

        // Random interactions to appear human - REMOVED as per instruction to refactor
        // await page.evaluate(() => { window.scrollBy(0, 300 + Math.random() * 200); });
        // await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

        // Extract data
        const items = await page.evaluate(() => {
            // @ts-ignore
            return window.pageData?.mods?.listItems || [];
        });

        return items;

    } catch (e: any) {
        console.error(`Page Nav fail ${url}: ${e.message}`);
        // If timeout, maybe we still loaded enough?
        return [];
    } finally {
        await page.close();
    }
}
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../lib/db/supabase';

// Config
const TARGET_ITEMS = 100000;
const OUTPUT_FILE = path.join(process.cwd(), 'lazada_100k_data.json');

// Extensive list of keywords to reach 100k items (approx 200 keywords * 500-1000 items each)
const KEYWORDS = [
    // Electronics
    'dien thoai', 'iphone', 'samsung', 'oppo', 'xiaomi', 'vivo', 'realme', 'nokia', 'vsmart', 'bphone', 'asus', 'rog phone', 'black shark',
    'laptop', 'macbook', 'dell', 'hp', 'lenovo', 'thinkpad', 'acer', 'msi', 'lg gram', 'surface',
    'may tinh bang', 'ipad', 'samsung tab', 'xiaomi pad', 'kindle',
    'tai nghe', 'airpods', 'galaxy buds', 'sony wh', 'jbl', 'marshall', 'anker', 'soundpeats', 'baseus',
    'loa bluetooth', 'loa harman kardon', 'loa jbl', 'loa sony', 'loa lg',
    'chuot may tinh', 'ban phim co', 'man hinh may tinh', 'ram laptop', 'ssd', 'usb', 'the nho', 'webcam', 'microphone',

    // Fashion - Men
    'ao thun nam', 'ao so mi nam', 'quan jean nam', 'quan tay nam', 'quan short nam', 'ao khoac nam', 'vest nam',
    'giay nam', 'giay the thao nam', 'giay tay nam', 'giay sneaker nam', 'dep nam', 'sandal nam',
    'dong ho nam', 'vi da nam', 'that lung nam', 'kinh mat nam', 'balo nam',

    // Fashion - Women
    'vay dam', 'ao kieu nu', 'chan vay', 'quan jean nu', 'ao thun nu', 'ao so mi nu', 'ao khoac nu', 'set do nu',
    'giay nu', 'giay cao got', 'giay the thao nu', 'giay bup be', 'sandal nu', 'boot nu',
    'tui xach nu', 'vi nu', 'balo nu', 'kinh mat nu', 'trang suc', 'bong tai', 'day chuyen', 'nhan nu',

    // Beauty & Health
    'son moi', 'son duong', 'phan phu', 'kem nen', 'che khuyet diem', 'mascara', 'ke mat',
    'sua rua mat', 'nuoc tay trang', 'toner', 'serum', 'kem duong am', 'kem chong nang', 'mat na',
    'dau goi', 'dau xa', 'sua tam', 'duong the', 'nuoc hoa', 'khu mui',
    'thuc pham chuc nang', 'vitamin', 'collagen', 'whey protein',

    // Home & Lifestyle
    'chan ga goi dem', 'tham trai san', 'rem cua', 'den trang tri', 'tranh treo tuong', 'dong ho treo tuong',
    'noi com dien', 'noi chien khong dau', 'may xay sinh to', 'am sieu toc', 'lo vi song', 'bep tu', 'may hut bui', 'robot hut bui',
    'bat dia', 'ly coc', 'binh giu nhiet', 'hop dung com', 'dung cu nha bep',
    'tu quan ao', 'ban ghe', 'ke sach', 'sofa', 'giuong ngu',

    // Mom & Baby
    'bim ta', 'sua bot', 'binh sua', 'may hut sua', 'xe day em be', 'ghe an dam', 'nui gia',
    'quan ao tre em', 'giay dep tre em', 'do choi tre em', 'lego', 'xe mo hinh', 'bup be',

    // Sports & Outdoors
    'giay chay bo', 'quan ao the thao', 'vot cau long', 'vot tennis', 'bong da', 'the thao du lich',
    'leu cam trai', 'den pin', 'tui ngu', 'vali du lich',

    // Moto & Car
    'mu bao hiem', 'gang tay xe may', 'do choi xe may', 'phu kien o to', 'camera hanh trinh', 'nuoc hoa o to',

    // Books & Stationery
    'sach kinh te', 'sach van hoc', 'truyen tranh', 'sach thieu nhi', 'sach giao khoa',
    'but bi', 'so tay', 'balo hoc sinh', 'hop but', 'mau ve',

    // Food & Beverage
    'banh keo', 'snack', 'ca phe', 'tra', 'ngu coc', 'mi goi', 'dau an', 'gia vi'
];

// Helpers for Supabase
function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

function generateHash(name: string): string {
    let hash = 0, i, chr;
    if (name.length === 0) return hash.toString();
    for (i = 0; i < name.length; i++) {
        chr = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString();
}

async function saveToSupabase(products: any[]) {
    if (products.length === 0) return;

    const dbProducts = products.map(p => {
        const itemId = p.itemId || p.nid || p.id || '';
        const rawUrl = p.itemUrl || p.productUrl || (itemId ? `https://www.lazada.vn/products/-i${itemId}.html` : '');
        const fullUrl = rawUrl && rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;

        const price = parseFloat(String(p.price).replace(/[^0-9]/g, '')) || 0;
        const originalPrice = parseFloat(String(p.originalPrice).replace(/[^0-9]/g, '')) || 0;

        return {
            source_id: 3, // Lazada Source ID
            external_id: String(itemId),
            name: p.name || p.title || 'No Name',
            name_normalized: normalizeName(p.name || ''),
            hash_name: generateHash(p.name || ''),
            price: price,
            original_price: originalPrice > price ? originalPrice : null,
            discount_percent: p.discount ? parseInt(p.discount.replace(/[^0-9]/g, '')) : 0, // Changed from discount_rate
            rating: parseFloat(p.ratingScore || p.rating) || 0,
            review_count: parseInt(p.review || p.reviewCount) || 0,
            sold_count: p.itemSoldCntShow ? parseInt(p.itemSoldCntShow.replace(/[^0-9.]/g, '').replace('k', '000').replace('.', '')) : 0,
            image_url: p.image || p.picUrl || (p.thumbs && p.thumbs[0]?.image) || '',
            external_url: fullUrl, // Changed from url to external_url
            brand_raw: p.brandName || p.brand || '', // Changed to brand_raw to match base.ts schema
            category_raw: p.categoryName || '', // Changed to category_raw
            updated_at: new Date().toISOString(),
            metadata: {
                location: p.location,
                sellerName: p.sellerName,
                is_official: p.officialStore === 'true' || !!p.isLazmall,
                skuId: p.skuId || p.sku
            }
        };
    });

    // Batch insert 50 at a time
    for (let i = 0; i < dbProducts.length; i += 50) {
        const batch = dbProducts.slice(i, i + 50);
        const { error } = await supabaseAdmin.from('raw_products').upsert(batch, { // Use raw_products and supabaseAdmin
            onConflict: 'source_id, external_id',
            ignoreDuplicates: false
        });

        if (error) {
            console.error('Supabase Save Error:', error.message);
        }
    }
}

// Concurrency helper
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: Promise<R>[] = []; // Changed to Promise<R>[] to correctly reflect what's pushed
    const executing: Promise<void>[] = [];
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p); // Push the promise directly
        const e: Promise<void> = p.then(() => { executing.splice(executing.indexOf(e), 1); }).catch(() => { executing.splice(executing.indexOf(e), 1); }); // Ensure removal even on error
        executing.push(e);
        if (executing.length >= limit) await Promise.race(executing);
    }
    return Promise.all(results);
}

// Buffer System
const productBuffer: any[] = [];
let isCrawling = true;

async function processBuffer() {
    console.log("💾 Write Worker started...");
    while (isCrawling || productBuffer.length > 0) {
        if (productBuffer.length === 0) {
            await new Promise(r => setTimeout(r, 500));
            continue;
        }

        // Take a batch of up to 100 items
        const batch = productBuffer.splice(0, 100);

        try {
            await saveToSupabase(batch);
            // console.log(`💾 Saved batch of ${batch.length} items. Remaining buffer: ${productBuffer.length}`);
        } catch (err: any) {
            console.error(`❌ Save failed, returning ${batch.length} items to buffer:`, err.message);
            // Return to buffer to retry
            productBuffer.unshift(...batch);
            // Wait a bit before retrying
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    console.log("💾 Write Worker finished.");
}

async function run() {
    console.log(`🚀 Starting Lazada OPTIMIZED Benchmark 100k. Target: ${TARGET_ITEMS}`);

    // Check DB connection
    const { count, error } = await supabaseAdmin.from('raw_products').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Failed to connect to Supabase:', error);
        return;
    }
    console.log(`Connected to Supabase. Current total products: ${count}`);

    const items = new Map<string, any>();
    const start = Date.now();

    // OPTIMIZED CONCURRENCY SETTINGS - ADAPTIVE FOR NO PROXY
    // We must slow down because we are getting blocked (HTML response instead of JSON)
    const KEYWORD_CONCURRENCY = 1;
    const PAGE_CONCURRENCY = 1;
    const MAX_PAGES = 50;

    // Start the writer worker
    const writeWorker = processBuffer();

    await mapConcurrent(KEYWORDS, KEYWORD_CONCURRENCY, async (kw) => {
        if (items.size >= TARGET_ITEMS) return;

        let emptyPages = 0;
        let pagesToFetch = Array.from({ length: MAX_PAGES }, (_, i) => i + 1);

        // Fetch pages sequentially for each keyword to avoid flooding
        for (let i = 0; i < pagesToFetch.length; i += PAGE_CONCURRENCY) {
            if (items.size >= TARGET_ITEMS || emptyPages > 2) break;

            const batchPages = pagesToFetch.slice(i, i + PAGE_CONCURRENCY);

            // Sequential processing within the batch
            const results = [];
            for (const page of batchPages) {
                // Add random delay to prevent pattern detection
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

                const products = await fetchLazadaBatch(kw, page);
                console.log(`[${kw}] Fetched Page ${page}. Found: ${products?.length}`); // DEBUG

                results.push({ page, products });

                // If blocked (null returned), wait longer
                if (products === null) {
                    console.warn(`[${kw}] Detected block, cooling down 30s...`);
                    await new Promise(r => setTimeout(r, 30000));
                }
            }

            for (const { page, products } of results) {
                if (!products || products.length === 0) {
                    emptyPages++;
                } else {
                    emptyPages = 0;
                    let newCount = 0;

                    products.forEach((p: any) => {
                        const id = p.itemId || p.nid;
                        if (id && !items.has(id)) {
                            items.set(id, p);
                            // PUSH TO BUFFER INSTEAD OF SAVING DIRECTLY
                            productBuffer.push(p);
                            newCount++;
                        }
                    });

                    if (newCount > 0) {
                        console.log(`[${kw}] Page ${page}: +${newCount} items (Total Collected: ${items.size} | Buffer: ${productBuffer.length})`);
                    }
                }
            }
        }
    });

    isCrawling = false; // Signal worker to stop when buffer empty
    await writeWorker;  // Wait for writer to finish

    const end = Date.now();
    const durationMins = (end - start) / 1000 / 60;

    console.log("DONE");
    console.log(`Total Collected: ${items.size}`);
    console.log(`Duration: ${durationMins.toFixed(2)} mins`);

    // Backup
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(items.values()), null, 2));
    console.log(`Backup saved to ${OUTPUT_FILE}`);
}

run();
