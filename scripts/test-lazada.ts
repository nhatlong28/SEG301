
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Manually set if needed, but dotenv should work
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://krmmecymmyaiixnygzam.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybW1lY3ltbXlhaWl4bnlnemFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU3ODc4MSwiZXhwIjoyMDgzMTU0NzgxfQ.KDahhIpIn1E8IXeREkkfYqf0b74zvspUOujPbNSfhKI';
}

async function testLazada() {
    const { LazadaCrawler } = await import('../src/lib/crawler/lazada');

    console.log('--- TESTING LAZADA CRAWLER ---');
    const crawler = new LazadaCrawler();

    // Valid Search Term
    const keyword = 'iphone 15 pro max';
    console.log(`Crawling keyword: ${keyword}`);

    try {
        const products = await crawler.crawl({
            keyword: keyword,
            maxPages: 1
        });

        console.log(`Crawled ${products.length} products.`);
        if (products.length > 0) {
            console.log('Sample:', products[0]);
        }
    } catch (e) {
        console.error('Crawl failed:', e);
    }
}

testLazada();
