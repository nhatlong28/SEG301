
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

async function debugLazada() {
    console.log('🚀 Launching Stealth Browser...');
    const browser = await puppeteerExtra.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=375,812'
        ],
        protocolTimeout: 0
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

        console.log('🧭 Navigating to Lazada...');
        try {
            await page.goto('https://www.lazada.vn', { waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log('✅ Home page loaded.');
        } catch (e) {
            console.log('⚠️ Navigation timeout/error:', e.message);
        }

        const keyword = "iphone";
        const searchUrl = `https://www.lazada.vn/catalog/?q=${encodeURIComponent(keyword)}`;

        console.log(`🧭 Navigating to Search URL: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const title = await page.title();
        console.log(`📄 Page Title: ${title}`);

        // Check for product elements
        const products = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-qa-locator="product-item"]');
            return items.length;
        });
        console.log(`📦 Found ${products} products via DOM selector`);

    } catch (e) {
        console.error('🔥 Error:', e);
    } finally {
        await browser.close();
    }
}

debugLazada();
