import { NextRequest, NextResponse } from 'next/server';
import { getCrawler, getOrchestrator, runMassCrawl } from '@/lib/crawler';
import type { SourceType } from '@/types/database';

/**
 * Crawl API - Single source or Mass crawl all sources
 * 
 * POST /api/admin/crawl
 * Body:
 *   - action: 'single' | 'mass-crawl'
 *   - source: SourceType (for single)
 *   - query: string (optional)
 *   - category: string (optional)
 *   - maxPages: number (optional)
 *   - workers: number (for mass-crawl, default 5)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, source, query, category, maxPages, workers, cookie } = body;

        // Mass crawl all sources
        if (action === 'mass-crawl') {
            return handleMassCrawl(workers, maxPages);
        }

        // Single source crawl
        if (!source) {
            return NextResponse.json({ error: 'Source is required' }, { status: 400 });
        }

        return handleSingleCrawl(source, query, category, maxPages, cookie);
    } catch (error) {
        console.error('Crawl trigger error:', error);
        return NextResponse.json(
            { error: 'Failed to start crawl', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * Handle mass crawl with orchestrator - ALL 5 PLATFORMS
 */
async function handleMassCrawl(workers = 5, pagesPerKeyword = 10) {
    const orchestrator = getOrchestrator();
    const sources = ['shopee', 'tiki', 'lazada', 'cellphones', 'dienmayxanh'];
    const started: string[] = [];
    const failed: string[] = [];

    for (const source of sources) {
        try {
            if (!orchestrator.isRunning(source)) {
                await orchestrator.startCrawler(source);
                started.push(source);
            }
        } catch (error) {
            console.error(`Failed to start ${source}:`, error);
            failed.push(source);
        }
    }

    return NextResponse.json({
        message: 'Mass crawl triggers processed',
        status: 'partial-started',
        results: {
            started,
            failed,
            ignored: sources.filter(s => !started.includes(s) && !failed.includes(s)) // Already running
        }
    });
}

/**
 * Handle single source crawl
 */
async function handleSingleCrawl(
    source: SourceType,
    query?: string,
    category?: string,
    maxPages?: number,
    cookie?: string
) {
    const orchestrator = getOrchestrator();

    try {
        await orchestrator.startCrawler(source, { cookie });
        return NextResponse.json({
            message: `Crawl started for ${source}`,
            source,
            status: 'started',
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to start crawl' },
            { status: 400 }
        );
    }
}

import { supabaseAdmin } from '@/lib/db/supabase';

// Cache for source counts - refresh every 30 seconds to reduce DB load
let sourceCountsCache: Record<number, number> = {};
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * GET - Check crawl status (optimized with batched queries & caching)
 */
export async function GET() {
    const orchestrator = getOrchestrator();
    const liveStats = orchestrator.getStats();

    // Fetch all sources definitions
    const { data: sources } = await (supabaseAdmin as any).from('sources').select('id, type');

    const now = Date.now();

    // Check if cache needs refresh
    if (now - cacheTimestamp > CACHE_TTL_MS) {
        // Batch query: Get counts for ALL sources in a single query using RPC or grouped query
        try {
            const { data: counts, error } = await (supabaseAdmin as any)
                .rpc('get_product_counts_by_source');

            if (!error && counts) {
                // RPC returns: [{ source_id: 1, count: 1000 }, ...]
                sourceCountsCache = {};
                for (const row of counts) {
                    sourceCountsCache[row.source_id] = row.count;
                }
            } else if (sources) {
                // Fallback: Parallel COUNT queries for each source (fast, max 5 parallel queries)
                sourceCountsCache = {};
                const countPromises = sources.map(async (source: any) => {
                    const { count } = await (supabaseAdmin as any)
                        .from('raw_products')
                        .select('*', { count: 'exact', head: true })
                        .eq('source_id', source.id);
                    return { source_id: source.id, count: count || 0 };
                });
                const results = await Promise.all(countPromises);
                for (const { source_id, count } of results) {
                    sourceCountsCache[source_id] = count;
                }
            }
            cacheTimestamp = now;
        } catch (e) {
            console.error('Failed to batch fetch counts:', e);
        }
    }

    // Build stats with cached totals
    const statsWithTotals = liveStats.map((stat) => {
        const sourceDef = sources?.find((s: any) => s.type === stat.source);
        return {
            ...stat,
            totalProducts: sourceDef ? (sourceCountsCache[sourceDef.id] || 0) : 0
        };
    });

    // Also include sources that are NOT in liveStats (idle ones)
    if (sources) {
        for (const source of sources) {
            if (!statsWithTotals.find(s => s.source === source.type)) {
                statsWithTotals.push({
                    source: source.type,
                    status: 'idle',
                    products: 0,
                    errors: 0,
                    totalProducts: sourceCountsCache[source.id] || 0
                });
            }
        }
    }

    return NextResponse.json({
        stats: statsWithTotals,
    });
}
