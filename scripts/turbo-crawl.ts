require('dotenv').config({ path: '.env.local' });
console.log('--- TURBO START ---');
import { runMassCrawl } from '../src/lib/crawler/orchestrator';
import logger from '../src/lib/utils/logger';

/**
 * TURBO CRAWL ACTIVATION SCRIPT
 * Runs all 5 platforms concurrently with maximum performance settings
 */
async function activeTurboCrawl() {
    logger.info('🔥🔥🔥 [TURBO] ACTIVATING FULL SCALE MASS CRAWL 🔥🔥🔥');

    try {
        const result = await runMassCrawl({
            sources: ['shopee', 'tiki', 'lazada', 'cellphones', 'dienmayxanh'],
            pagesPerKeyword: 100 // Maximum depth
        });

        logger.info('🎉🎉🎉 [TURBO] MASS CRAWL COMPLETED 🎉🎉🎉');
        logger.info(`Total Products Saved: ${result.totalProducts}`);
        logger.info(`Total Errors: ${result.totalErrors}`);
        logger.info(`Total Duration: ${(result.duration / 1000 / 60).toFixed(2)} minutes`);

    } catch (error) {
        logger.error('❌ [TURBO] MASS CRAWL CRITICAL FAILURE:', error);
    }
}

activeTurboCrawl();
