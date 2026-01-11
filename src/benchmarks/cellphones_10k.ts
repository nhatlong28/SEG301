import fs from 'fs';
import path from 'path';

const TARGET_ITEMS = 10000;
const OUTPUT_FILE = path.join(process.cwd(), 'cellphones_10k_data.json');

const GRAPHQL_URL = 'https://api.cellphones.com.vn/graphql-search/v2/graphql/query';

// They use a flexible search query. We can just iterate categories or generic keywords.
// Using a generic "Filter" query is often better than "Search" for bulk data.
// But "Search" with a broad keyword like "a" or "samsung" might work.
// Let's try iterating broad categories: mobile, laptop, tablet, accessories.

const CATEGORIES = [
    { name: 'Mobile', filter: { static: { categories: ["3"] } } }, // 3 is usually mobile
    { name: 'Laptop', filter: { static: { categories: ["380"] } } },
    { name: 'Tablet', filter: { static: { categories: ["4"] } } },
    { name: 'Accessories', filter: { static: { categories: ["30"] } } }
];

async function fetchCellphones(filter: any, size: number, from: number) {
    // This is the payload structure observed in network tools
    const body = {
        "query": `
            query ($from: Int!, $size: Int!, $filters: JSON) {
                points_products (from: $from, size: $size, filters: $filters) {
                    total
                    data {
                        id
                        name
                        final_price
                        slug
                    }
                }
            }
        `,
        "variables": {
            "from": from,
            "size": size,
            "filters": filter
        }
    };

    try {
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        return json?.data?.points_products || { total: 0, data: [] };
    } catch (e) {
        console.error("Fetch error", e);
        return { total: 0, data: [] };
    }
}

async function run() {
    console.log("Starting CellphoneS Benchmark...");
    const products = new Map<string, any>();
    const start = Date.now();

    // Fallback: If category IDs fail, we can use keywords via a different query, 
    // but let's try a very broad search first if categories are tricky to guess.
    // OR just use a keyword search loop like others.

    const KEYWORDS = ['iphone', 'samsung', 'xiaomi', 'oppo', 'macbook', 'asus', 'dell', 'hp', 'sony', 'jbl'];

    for (const kw of KEYWORDS) {
        if (products.size >= TARGET_ITEMS) break;

        let pageIndex = 1;
        const size = 20; // Default page size

        console.log(`\nKW: ${kw}`);

        while (true) {
            // Search payload is slightly different usually, let's use the one that works for "Search Result" page
            // which is often a "search query". 
            // To be safe, let's use the exact payload validated in research or a generic search one.
            // Identified URL: https://api.cellphones.com.vn/graphql-search/v2/graphql/query

            // Correct 'advanced_search' payload captured from browser
            const body = {
                "query": `
                    query advanced_search {
                      advanced_search(
                        user_query: { 
                            terms: "${kw}",
                            province: 30
                        }
                        page: ${pageIndex}
                      ) 
                      {
                        products {
                          product_id
                          name
                          special_price
                          price
                          sku
                          url_path
                        }
                        meta {
                          total
                          page
                        }
                      }
                    }
                `,
                "variables": {}
            };

            const res = await fetch(GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://cellphones.com.vn',
                    'Referer': 'https://cellphones.com.vn/'
                },
                body: JSON.stringify(body)
            });

            const json = await res.json();
            const list = json?.data?.advanced_search?.products || [];

            if (list.length === 0) break;

            let newItems = 0;
            list.forEach((p: any) => {
                if (!products.has(p.product_id)) {
                    products.set(p.product_id, p);
                    newItems++;
                }
            });
            console.log(`From ${pageIndex}: Got ${list.length} (New: ${newItems}) Total: ${products.size}`);

            if (list.length < 5) break; // End of results (usually robust check)
            pageIndex++;

            if (products.size >= TARGET_ITEMS) break;
            await new Promise(r => setTimeout(r, 200));
        }
    }

    const end = Date.now();
    console.log(`DONE. Fetched ${products.size} items in ${(end - start) / 1000}s`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(products.values()), null, 2));
}

run();
