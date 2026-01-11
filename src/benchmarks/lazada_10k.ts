import fs from 'fs';
import path from 'path';

// Config
const TARGET_ITEMS = 10000;
const OUTPUT_FILE = path.join(process.cwd(), 'lazada_10k_data.json');

// We need a diverse list of keywords because Lazada limits pagination (usually only 100 pages per query)
const KEYWORDS = [
    'dien thoai', 'iphone', 'samsung', 'ao thun', 'giay nam', 'giay nu',
    'dong ho', 'tai nghe', 'laptop', 'chuot may tinh', 'ban phim',
    'macbook', 'thoi trang nu', 'thoi trang nam', 'tui xach', 'my pham',
    'son moi', 'kem chong nang', 'sua rua mat', 'keo', 'banh',
    'do choi', 'xe mo hinh', 'lego', 'sach', 'truyen tranh'
];

async function fetchLazadaBatch(keyword: string, page: number) {
    const url = `https://www.lazada.vn/catalog/?ajax=true&page=${page}&q=${encodeURIComponent(keyword)}`;

    try {
        const res = await fetch(url, {
            headers: {
                // REALISTIC HEADERS ARE CRITICAL FOR LAZADA
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Referer': 'https://www.lazada.vn/',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/plain, */*',
                'Cookie': '__wpkreporterwid_=395bc667-ffd7-43ab-1879-7b8eb0679705; lwrid=AgGbpte2DpH0N3h%2BMO%2BAX39uI13Q; t_fv=1768030723449; t_uid=VeTR2xFf0O163cNBuQRyRYamksSzRQKL; __itrace_wid=3e55ba7d-e46e-4ab7-1fb4-3d1dbb278b0e; hng=VN|en|VND|704; userLanguageML=en; lzd_cid=d3dd4de2-49ae-418c-8f45-5adb69b5f7ca; xlly_s=1; cna=BPDoIdiKZCYCASpzwB6zrXXk; t_sid=4oWIy15IKpXb60k0p7gjipemhxVURySv; utm_channel=NA; _m_h5_tk=6719bdd6fea753d13bcca013dca99ab2_1768074479092; _m_h5_tk_enc=b65cf9224bb6e8309b716e34303cf199; LZD_WEB_TRACER_ROOT_SPAN_ID=400b1744303baaf4; LZD_WEB_TRACER_TRACE_ID=1970f411efc8401094e26cde24e5d792; lwrtk=AAIEaWL+fQE95oBLoXGagJAoH2hTa+cVbV6zVLcviN93AR2vNOyI1y4=; epssw=11*mmLsymUYOsN3gCvgEN0kCf0cL0IZ83yOiEItomZGHSMyuqsLrVg16TX1aowQEUicvgSj0tE66iiP0cV7mmm2lBAx3tevQRAZ3CmZpRj-djjeh-YranK8GpYps9Jlv8ErhsGHdOAZmTmTxsY8ryD57HZuncV3g9oI-I5DlwRVsBzFBWut2pQlJr7C1_kJPaNW-X0TmmmmmTyUuuMCtr6n1lwmmmXmjimmqmBE7DMv1RjTEmNV4ttVEmHJuFn0uukYNjaEBjaYNBmmVe3emeaaBja5Hmjy-6aQds7oWDSj8vga; isg=BFZW-uS1I0OIwxfn8db_grw8pwxY95ox6e-QkMC_QjnUg_YdKIfqQbzxHwdvK5JJ; tfstk=fy4Bl5TYIpvC7Cip07CwClHeGJ3SPJ_2NQG8i7Lew23peLFxQ45H4McSPANq4vBhxb37IR2EpzNkPbF8E6DPtGP3t40R3Tg5uWVhlvZBxOuRw5KsGqMGuZP39dJKckQ4Y0GzKmD-yDHKBAHiNbpKy83t6bH9JbLKwdCsZX_OjpCBw5B6SF-V227tq1x6fPGdtxFICfcg5XiIHcH6yBzsODgYOrBPEshT7PiqbQWSWSqapfgf5KHa-SrmmyfAv4E8Too0bOYIOWVLm0aN4IDuf5Eq6lXBjvUnNm3-fQL812MIXX0AkdGgXWr8-JOWyX4Uu0Mmf_Lo4VUqDoeBZsVtJbIPNEkjG7KW1mYS1x5113xofp2oEwbOohiKsXiN119LqDhi19111nYqvfcZu116cnf'
            }
        });

        if (res.status === 429) {
            console.warn("Rate limited (429)! Waiting 5s...");
            await new Promise(r => setTimeout(r, 5000));
            return null;
        }

        if (!res.ok) {
            // Often 302 to verify captcha
            return null;
        }

        const data = await res.json();
        return data?.mods?.listItems || [];
    } catch (e) {
        console.error(`Fetch fail ${url}`, e);
        return [];
    }
}

async function run() {
    console.log(`Starting Lazada Benchmark. Target: ${TARGET_ITEMS}`);

    const items = new Map<string, any>(); // itemId -> data
    const start = Date.now();

    for (const kw of KEYWORDS) {
        if (items.size >= TARGET_ITEMS) break;

        console.log(`\n>>> Keyword: ${kw}`);
        let page = 1;
        let emptyPages = 0;

        while (page <= 50) { // Lazada often caps at page 102, safer to do 50
            if (items.size >= TARGET_ITEMS) break;

            // Low concurrency for Lazada to avoid tough anti-bot
            const products = await fetchLazadaBatch(kw, page);

            if (!products || products.length === 0) {
                emptyPages++;
                if (emptyPages > 2) break;
            } else {
                emptyPages = 0;
                let newCount = 0;
                products.forEach((p: any) => {
                    const id = p.itemId;
                    if (id && !items.has(id)) {
                        items.set(id, {
                            id: p.itemId,
                            name: p.name,
                            price: p.price,
                            url: p.productUrl ? (p.productUrl.startsWith('//') ? 'https:' + p.productUrl : p.productUrl) : ''
                        });
                        newCount++;
                    }
                });
                console.log(`Page ${page}: +${newCount} new items (Total: ${items.size})`);
            }

            page++;
            await new Promise(r => setTimeout(r, 500)); // Respectful delay
        }
    }

    const end = Date.now();
    const sec = (end - start) / 1000;

    console.log("DONE");
    console.log(`Time: ${sec.toFixed(2)}s`);
    console.log(`Rate: ${(items.size / sec).toFixed(2)}/s`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(items.values()), null, 2));
}

run();
