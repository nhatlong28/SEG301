
import fs from 'fs';
import path from 'path';

// Manual .env loading
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
            console.log('✅ Loaded .env.local');
        }
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
};

loadEnv();

async function runTest() {
    const args = process.argv.slice(2);
    const source = args[0] || 'shopee';

    console.log(`🚀 Testing crawler: ${source}...`);

    const { getCrawler } = await import('./index');
    const { getGlobalBrowserPool } = await import('./browserPool');

    try {
        // CONFIGURE BROWSER POOL FOR SHOPEE (Use local Edge profile)
        if (source === 'shopee') {
            const edgeUserData = 'C:\\Users\\quang\\AppData\\Local\\Microsoft\\Edge\\User Data';
            if (fs.existsSync(edgeUserData)) {
                console.log('🚀 Using local Edge profile for Shopee crawl');
                getGlobalBrowserPool({
                    userDataDir: edgeUserData,
                    headless: false,
                    disableInterception: true // CRITICAL: Shopee detects request interception!
                });
            }
        }

        const crawler = getCrawler(source as any);
        await (crawler as any).initialize();

        let crawlOptions: any = {
            keyword: 'iphone',
            maxPages: 1
        };

        // LOAD SHOPEE COOKIES IF AVAILABLE
        if (source === 'shopee') {
            const cookiePath = path.resolve(process.cwd(), 'shopee-cookies.txt');
            if (fs.existsSync(cookiePath)) {
                const cookies = fs.readFileSync(cookiePath, 'utf-8');
                console.log('🍪 Loaded Shopee cookies from shopee-cookies.txt');
                // We need to recreate the crawler with cookies if your getCrawler supports it
                // Or just cast and set a property if it's already created
                (crawler as any).cookies = cookies;
            }
        }

        if (source === 'dienmayxanh') {
            crawlOptions = {
                categorySlug: 'tu-lanh', // Use a valid slug
                maxPages: 1
            };
        } else if (source === 'tiki') {
            crawlOptions = {
                query: 'tu lanh',
                maxPages: 1
            };
        }

        // Use a generic keyword for testing
        const results = await crawler.crawl(crawlOptions);

        console.log(`\n✨ Test Completed!`);
        console.log(`📦 Products found: ${results.length}`);

        if (results.length > 0) {
            console.log('📝 Sample product:', results[0].name, '-', results[0].price);
        } else {
            console.warn('⚠️ No products captured. Check for bot detection or proxy issues.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Shutdown pool if it's a puppeteer crawler
        const { shutdownGlobalPool } = await import('./browserPool');
        await shutdownGlobalPool();
        process.exit(0);
    }
}

runTest();
