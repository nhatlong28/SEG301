
import { CellphonesCrawler } from '../crawler/cellphones';
import logger from '../utils/logger';

async function test() {
    console.log('🧪 Testing CellphoneS Fix...');
    const crawler = new CellphonesCrawler();

    // Mock saveProducts to just log count
    crawler.saveProducts = async (products) => {
        console.log(`💾 Simulating Save: ${products.length} products`);
        products.forEach(p => console.log(`   - [${p.externalId}] ${p.name} (${p.price} VND) URL: ${p.externalUrl}`));
        return { inserted: products.length, updated: 0 };
    };
    crawler.createCrawlLog = async () => 1;
    crawler.updateCrawlLog = async () => { };

    try {
        console.log('🚀 Crawling "samsung" (1 page)...');
        const products = await crawler.crawl({ query: 'samsung', maxPages: 1 });
        console.log(`✅ Total Products Found: ${products.length}`);
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

test();
