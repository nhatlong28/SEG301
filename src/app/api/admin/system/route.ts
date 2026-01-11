import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';
import { ShopeeCrawler } from '@/lib/crawler/shopee';
import { TikiCrawler } from '@/lib/crawler/tiki';
import { LazadaCrawler } from '@/lib/crawler/lazada';
import { CellphonesCrawler } from '@/lib/crawler/cellphones';
import { DienmayxanhCrawler } from '@/lib/crawler/dienmayxanh';
import { Deduplicator } from '@/lib/entity-resolution/deduplicator';
import logger from '@/lib/utils/logger';

// Global flags to prevent multiple instances
let isCrawling = false;
let isDeduplicating = false;
let crawlProgress = {
    currentSource: '',
    totalSources: 5,
    completedSources: 0,
    totalProducts: 0,
    startedAt: '',
};

/**
 * Mass crawl all 5 sources using their massCrawl methods
 */
async function runMassCrawl() {
    if (isCrawling) return;
    isCrawling = true;

    crawlProgress = {
        currentSource: '',
        totalSources: 5,
        completedSources: 0,
        totalProducts: 0,
        startedAt: new Date().toISOString(),
    };

    try {
        logger.info('🚀 SYSTEM: Starting Mass Crawl Background Job...');

        // Crawl each source with their new massCrawl methods
        const crawlers = [
            { name: 'Shopee', crawler: new ShopeeCrawler() },
            { name: 'Tiki', crawler: new TikiCrawler() },
            { name: 'Lazada', crawler: new LazadaCrawler() },
            { name: 'CellphoneS', crawler: new CellphonesCrawler() },
            { name: 'DienmayXanh', crawler: new DienmayxanhCrawler() },
        ];

        for (const { name, crawler } of crawlers) {
            try {
                crawlProgress.currentSource = name;
                logger.info(`🕷️ [System] Starting mass crawl for: ${name}`);

                // Use massCrawl if available, otherwise regular crawl
                let products;
                if ('massCrawl' in crawler && typeof (crawler as unknown as { massCrawl: unknown }).massCrawl === 'function') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    products = await (crawler as any).massCrawl(10);
                } else {
                    products = await crawler.crawl({ maxPages: 50 });
                }

                crawlProgress.totalProducts += products?.length || 0;
                crawlProgress.completedSources++;

                logger.info(`✅ [System] Completed ${name}: ${products?.length || 0} products`);

                // Small delay between sources
                await new Promise(r => setTimeout(r, 5000));
            } catch (err) {
                logger.error(`❌ [System] Failed to crawl ${name}:`, err);
                crawlProgress.completedSources++;
            }
        }

        logger.info(`🎉 SYSTEM: Mass Crawl completed! Total: ${crawlProgress.totalProducts} products`);
    } catch (err) {
        logger.error('SYSTEM: Mass Crawl job failed', err);
    } finally {
        isCrawling = false;
        crawlProgress.currentSource = '';
    }
}

/**
 * Run entity resolution to merge duplicate products using SmartDeduplicator
 */
async function runDeduplication() {
    if (isDeduplicating) return;
    isDeduplicating = true;

    try {
        logger.info('🚀 SYSTEM: Starting Smart Deduplication with Cross-Source Matching...');

        // Use SmartDeduplicator which includes cross-source matching phase
        const { SmartDeduplicator } = await import('@/lib/entity-resolution/smartDeduplicator');
        const deduplicator = new SmartDeduplicator();

        const stats = await deduplicator.deduplicate({
            mode: 'fresh', // Clean and rebuild from scratch
            batchSize: 500,
            minMatchScore: 0.70, // Lower threshold for more matches
        });

        logger.info(`✅ SYSTEM: Smart Deduplication completed!`);
        logger.info(`   - ${stats.totalCanonical} canonical products created`);
        logger.info(`   - ${stats.totalMappings} product mappings`);
        logger.info(`   - Reduction rate: ${stats.reductionRate.toFixed(2)}x`);
        logger.info(`   - Cross-source matrix: ${JSON.stringify(stats.crossSourceMatrix)}`);
    } catch (err) {
        logger.error('SYSTEM: Smart Deduplication job failed', err);
    } finally {
        isDeduplicating = false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json();

        if (action === 'mass-crawl') {
            if (isCrawling) {
                return NextResponse.json({
                    error: 'Mass crawl is already running',
                    progress: crawlProgress
                }, { status: 400 });
            }
            runMassCrawl(); // Trigger background
            return NextResponse.json({
                message: 'Mass crawl started in background',
                status: 'started'
            });
        }

        if (action === 'deduplicate') {
            if (isDeduplicating) {
                return NextResponse.json({
                    error: 'Deduplication is already running'
                }, { status: 400 });
            }
            runDeduplication(); // Trigger background
            return NextResponse.json({
                message: 'Deduplication started in background',
                status: 'started'
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        isCrawling,
        isDeduplicating,
        crawlProgress: isCrawling ? crawlProgress : null,
        lastUpdate: new Date().toISOString()
    });
}
