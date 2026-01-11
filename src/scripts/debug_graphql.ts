
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    console.log('🚀 Launching Debug Browser for GraphQL...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on('request', request => {
        const url = request.url();
        if (url.includes('graphql') && request.method() === 'POST') {
            console.log('---------------------------------------------------');
            console.log('🎯 GraphQL Request Detected:');
            console.log('URL:', url);
            console.log('Headers:', request.headers());
            console.log('Post Data:', request.postData());
            console.log('---------------------------------------------------');
        }
        request.continue();
    });

    try {
        console.log('🌐 Navigating to CellphoneS Search...');
        await page.goto('https://cellphones.com.vn/catalogsearch/result?q=samsung', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('⏳ Waiting 10 seconds to ensure requests fire...');
        await new Promise(r => setTimeout(r, 10000));

    } catch (e) {
        console.error('🔥 Error:', e);
    } finally {
        await browser.close();
    }
}

run();
