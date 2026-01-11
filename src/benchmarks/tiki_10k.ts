import fs from 'fs';
import path from 'path';

// Config
const TARGET_ITEMS = 10000;
const BATCH_SIZE = 50; // API usually limits to 40-100
const MAX_CONCURRENT_REQUESTS = 5;
const OUTPUT_FILE = path.join(process.cwd(), 'tiki_10k_data.json');

// State
const seenIds = new Set<string>();
const products: any[] = [];
let totalFetched = 0;

// Keywords/Categories to iterate if one query isn't enough
const SEED_KEYWORDS = [
    'iphone', 'samsung', 'xiaomi', 'oppo', 'macbook', 'laptop', 'tai nghe',
    'chuột', 'bàn phím', 'thời trang', 'giày', 'áo', 'quần', 'sách',
    'đồ chơi', 'tã', 'bỉm', 'sữa', 'son', 'phấn', 'nồi chiên', 'tủ lạnh'
];

async function fetchBatch(keyword: string, page: number) {
    const url = `https://tiki.vn/api/v2/products?limit=${BATCH_SIZE}&include=advertisement&aggregations=2&version=home-persionalized&q=${encodeURIComponent(keyword)}&page=${page}`;

    try {
        const start = Date.now();
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://tiki.vn/',
            }
        });

        if (!res.ok) {
            console.warn(`[Fail] Page ${page} param ${keyword}: Status ${res.status}`);
            return [];
        }

        const data = await res.json();
        const items = data.data || [];
        const duration = Date.now() - start;

        console.log(`[Success] Keyword "${keyword}" Page ${page}: Found ${items.length} items in ${duration}ms`);
        return items;

    } catch (error) {
        console.error(`[Error] Page ${page}:`, error);
        return [];
    }
}

async function runBenchmark() {
    console.log(`Starting Tiki Benchmark: Target ${TARGET_ITEMS} items`);
    const startTime = Date.now();

    // We will cycle through keywords and pages
    // To be simpler/faster, we can run multiple keywords in "parallel" lanes

    for (const keyword of SEED_KEYWORDS) {
        if (products.length >= TARGET_ITEMS) break;

        console.log(`\n--- Switching to Keyword: ${keyword} ---\n`);
        let page = 1;
        let emptyBatches = 0;

        while (true) {
            if (products.length >= TARGET_ITEMS) break;
            if (emptyBatches > 3) break; // Stop this keyword if 3 consecutive checks are empty

            // Create a batch of promises for concurrency
            const promises = [];
            for (let i = 0; i < MAX_CONCURRENT_REQUESTS; i++) {
                promises.push(fetchBatch(keyword, page + i));
            }

            const results = await Promise.all(promises);

            let itemsFoundInBatch = 0;
            for (const batchItems of results) {
                for (const item of batchItems) {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        products.push({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            url: `https://tiki.vn/${item.url_path}`
                        });
                        itemsFoundInBatch++;
                    }
                }
            }

            totalFetched = products.length;
            console.log(`Total Unique Items: ${totalFetched} / ${TARGET_ITEMS}`);

            if (itemsFoundInBatch === 0) {
                // Check if it was truly empty or just duplicates
                // If total raw items from results was 0, then we are done with this keyword
                const rawCount = results.reduce((acc, val) => acc + val.length, 0);
                if (rawCount === 0) emptyBatches++;
            } else {
                emptyBatches = 0;
            }

            page += MAX_CONCURRENT_REQUESTS;

            // Nice delay to not kill the API
            await new Promise(r => setTimeout(r, 200));
        }
    }

    const endTime = Date.now();
    const durationSec = (endTime - startTime) / 1000;

    console.log(`\nDONE!`);
    console.log(`Items: ${products.length}`);
    console.log(`Time: ${durationSec.toFixed(2)}s`);
    console.log(`Rate: ${(products.length / durationSec).toFixed(2)} items/s`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

runBenchmark();
