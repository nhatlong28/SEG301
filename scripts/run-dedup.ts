/**
 * Manual Deduplication Trigger
 * Run this to deduplicate existing products immediately without waiting for crawl
 */

import path from 'path';
import fs from 'fs';

// Load env BEFORE other imports
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`📂 Loading env from: ${envPath}`);
    require('dotenv').config({ path: envPath });
} else {
    console.warn('⚠️ .env.local not found');
}

// Debug env load
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing from env!');
    process.exit(1);
}

import logger from '../src/lib/utils/logger';

async function runDedup() {
    console.log('🚀 STARING MANUAL DEDUPLICATION...');

    // Dynamic import to ensure env is loaded first
    const { Deduplicator } = await import('../src/lib/entity-resolution/deduplicator');

    try {
        const deduplicator = new Deduplicator();

        // Run with the tuned settings
        const stats = await deduplicator.deduplicateAll({
            batchSize: 1000,
            minMatchScore: 0.70 // Using our tuned threshold
        });

        console.log('\n✅ DEDUPLICATION COMPLETE');
        console.log('-----------------------------------');
        console.log(`📦 Raw Products Processed: ${stats.totalRaw}`);
        console.log(`🔗 Canonical Products:     ${stats.totalCanonical}`);
        console.log(`📌 Mappings Created:       ${stats.totalMappings}`);
        console.log(`📉 Reduction Rate:         ${stats.reductionRate.toFixed(2)}x`);
        console.log(`⏱️ Execution Time:         ${(stats.executionTimeMs / 1000).toFixed(2)}s`);
        console.log('-----------------------------------');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

runDedup();
