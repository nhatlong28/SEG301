/**
 * FULLY AUTOMATED MASS CRAWL PIPELINE
 * Goal: 1M+ Products with 5 Concurrent Workers
 * Pipeline: Crawl -> Deduplicate -> Price Alerts
 * 
 * Usage: npx tsx scripts/mass-crawl.ts
 */

import fs from 'fs';
import path from 'path';

// --- ENV LOADER ---
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        console.log(`📂 Loading env from: ${envPath}`);

        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach((line) => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
            console.log('✅ Loaded .env.local');
        } else {
            console.warn('⚠️ .env.local not found');
        }
    } catch (error) {
        console.error('Error loading .env.local:', error);
    }
}

// Load env BEFORE imports
loadEnv();

// --- MAIN ---
async function main() {
    // Dynamic imports to ensure env is loaded first
    const { runMassCrawl } = await import('../src/lib/crawler');
    const { Deduplicator } = await import('../src/lib/entity-resolution/deduplicator');
    const { getPriceAlertService } = await import('../src/lib/priceAlerts');
    const logger = (await import('../src/lib/utils/logger')).default;

    logger.info('🚀 STARTING FULLY AUTOMATED MASS CRAWL PIPELINE...');
    logger.info('📊 Target: 15k products/day | 1M+ in 7 days');
    logger.info('⚙️ Pipeline: Crawl -> Deduplicate -> Price Alerts');
    logger.info('');

    try {
        // --- STEP 1: MASS CRAWL ---
        logger.info('=== STEP 1: MASS CRAWL ===');
        const crawlResult = await runMassCrawl({
            workers: 5,
            pagesPerKeyword: 2, // Start with smaller batch for testing
            sources: ['shopee', 'lazada'], // Prioritize fixed sources
            onProgress: (stats) => {
                logger.info(`[Crawl Progress] ${stats.source}: ${stats.status} - ${stats.products} products`);
            },
        });

        logger.info('');
        logger.info('🎉 CRAWL COMPLETE!');
        logger.info(`📊 Total Products: ${crawlResult.totalProducts}`);
        logger.info(`⚠️ Total Errors: ${crawlResult.totalErrors}`);
        logger.info(`⏱️ Duration: ${Math.round(crawlResult.duration / 1000 / 60)} minutes`);
        logger.info('');

        // --- STEP 2: DEDUPLICATION ---
        if (crawlResult.totalProducts > 0) {
            logger.info('=== STEP 2: DEDUPLICATION & ENTITY RESOLUTION ===');
            const deduplicator = new Deduplicator();
            const dedupStats = await deduplicator.deduplicateAll({
                batchSize: 1000,
                minMatchScore: 0.70
            });

            logger.info('✅ DEDUPLICATION COMPLETE');
            logger.info(`   Raw Products: ${dedupStats.totalRaw}`);
            logger.info(`   Canonical Products: ${dedupStats.totalCanonical}`);
            logger.info(`   Mappings Created: ${dedupStats.totalMappings}`);
            logger.info(`   Reduction Rate: ${dedupStats.reductionRate.toFixed(2)}x`);
            logger.info('');
        } else {
            logger.warn('⚠️ Skipping Deduplication (No products crawled)');
        }

        // --- STEP 3: PRICE ALERTS ---
        logger.info('=== STEP 3: CHECKING PRICE ALERTS ===');
        const alertService = getPriceAlertService();
        const notifications = await alertService.checkAllAlerts();

        logger.info('✅ PRICE ALERTS CHECKED');
        logger.info(`   Notifications Generated: ${notifications}`);
        logger.info('');

        logger.info('✅ PIPELINE EXECUTION FINISHED SUCCESSFULLY');
        logger.info('🔄 RESTARTING IN 1 HOUR...');

        // Repeat every hour
        setTimeout(main, 3600000);

    } catch (error) {
        // Safe logger usage if import failed
        console.error('❌ CRITICAL ERROR:', error);

        // Retry in 5 minutes on error
        console.log('🔄 Retrying in 5 minutes...');
        setTimeout(main, 300000);
    }
}

// Start the automation
main().catch((err) => {
    console.error('SYSTEM ERROR:', err);
    process.exit(1);
});
