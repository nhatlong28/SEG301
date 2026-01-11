import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Note: In a real project we'd use 'cheerio' to parse the HTML fragments fast.
// Since I can't easily install new npm packages without asking, I will use a simple regex-based parser 
// for this benchmark to keep it dependency-lite. It's faster anyway.

const TARGET_ITEMS = 10000;
const OUTPUT_FILE = path.join(process.cwd(), 'dmx_10k_data.json');

// Category IDs for DMX / TGDD
// 42 = Smartphone, 44 = Laptop, 522 = Tablet, 57 = Dong ho, etc.
const CATEGORIES = [42, 44, 522, 57, 1363, 166, 2002, 1942, 11];

async function fetchDmxBatch(cateId: number, pi: number) {
    const url = `https://www.thegioididong.com/Category/FilterProductBox?c=${cateId}&o=13&pi=${pi}`;

    try {
        const res = await axios.post(url, 'IsParentCate=False&IsShowCompare=True&prevent=true', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.thegioididong.com/dtdd',
                'Origin': 'https://www.thegioididong.com'
            },
            timeout: 15000
        });

        return res.data || "";
    } catch (e: any) {
        console.error("Error fetching " + url, e.message);
        return "";
    }
}

function parseItems(html: string) {
    const items: any[] = [];

    // Very naive regex parsing to avoid Cheerio dependency issues
    // Pattern: <li ... data-id="12345" ...> ... <h3>Product Name</h3> ... <strong class="price">10.000d</strong>

    // We can just look for data-id and nearby text.
    // It's robust enough for a benchmark.

    const itemRegex = /<li[^>]*data-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/li>/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const id = match[1];
        const content = match[2];

        // Extract Name
        const nameMatch = /<h3>(.*?)<\/h3>/.exec(content);
        const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : "Unknown";

        // Extract Price
        const priceMatch = /class="price">([^<]+)</.exec(content);
        const price = priceMatch ? priceMatch[1].replace(/\./g, '').replace('₫', '').trim() : "0";

        items.push({ id, name, price });
    }

    return items;
}

// In case the API returns just the list content without LI wrapper in some contexts, 
// or if the previous regex fails, we can add more robust parsing if needed. 
// But FilterProductBox usually returns a list of <li>.

async function run() {
    console.log("Starting Dienmayxanh Benchmark...");
    const products = new Map<string, any>();
    const start = Date.now();

    for (const catId of CATEGORIES) {
        if (products.size >= TARGET_ITEMS) break;
        console.log(`\n>>> Category: ${catId}`);

        let pi = 1; // Page index starts at 1 for Load More
        // The endpoint is for "Load More", so pi=1 is the first "Load More".
        // The initial page has items too.
        // We will start at 0 just in case.

        let emptyPages = 0;

        while (true) {
            const html = await fetchDmxBatch(catId, pi);
            if (!html || html.trim().length === 0) {
                console.log(`[DMX Debug] Empty response for Cat ${catId} Page ${pi}`);
                emptyPages++;
                if (emptyPages > 1) break; // Stop if empty response
            } else {
                if (pi === 0) console.log(`[DMX Debug] HTML Preview: ${html.substring(0, 100)}...`);
                emptyPages = 0;
            }

            const newItems = parseItems(html);
            if (newItems.length === 0 && pi > 0) break; // If no items found and not first page

            let added = 0;
            for (const item of newItems) {
                if (!products.has(item.id)) {
                    products.set(item.id, item);
                    added++;
                }
            }

            console.log(`Cat ${catId} Page ${pi}: +${added} items. Total: ${products.size}`);

            if (products.size >= TARGET_ITEMS) break;

            pi++;
            await new Promise(r => setTimeout(r, 300));
        }
    }

    const end = Date.now();
    console.log(`DONE. Fetched ${products.size} items in ${(end - start) / 1000}s`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(products.values()), null, 2));
}

run();
