
import puppeteer from 'puppeteer';

async function testLazada() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        protocolTimeout: 0
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🧭 Navigating to Lazada home...');
        await page.goto('https://www.lazada.vn', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ Home page loaded/navigated.');

        const keyword = "iphone";
        const pageNum = 1;
        const encodedKw = encodeURIComponent(keyword);
        const url = `https://www.lazada.vn/catalog/?ajax=true&page=${pageNum}&q=${encodedKw}`;

        console.log(`🔍 Fetching URL: ${url}`);

        const result = await page.evaluate(async (fetchUrl) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                console.log('   In-browser: starting fetch...');
                const response = await fetch(fetchUrl, {
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                console.log('   In-browser: fetch complete, status:', response.status);
                if (!response.ok) return { error: `HTTP ${response.status}` };

                const text = await response.text();
                return { text: text.substring(0, 500) }; // Return snippet
            } catch (e: any) {
                return { error: e.message, name: e.name };
            }
        }, url);

        console.log('📦 Result:', result);

    } catch (e) {
        console.error('🔥 Error:', e);
    } finally {
        await browser.close();
    }
}

testLazada();
