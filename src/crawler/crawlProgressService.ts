/**
 * CrawlProgressService - Intelligent tracking of crawl progress
 * Provides smart auto-skip logic to prioritize uncrawled items
 */

import { supabaseAdmin } from '../db/supabase';
import logger from '../utils/logger';

export interface CrawlProgress {
    source: string;
    itemType: 'category' | 'keyword' | 'seller';
    itemId: string;
    itemName: string;
    lastCrawledAt: Date | null;
    productCount: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface CrawlQueue {
    pending: CrawlProgress[];
    recentlyCompleted: CrawlProgress[];
    inProgress: CrawlProgress[];
}

/**
 * CrawlProgressService - Smart auto-skip and progress tracking
 */
export class CrawlProgressService {
    private static progressCache: Map<string, CrawlProgress[]> = new Map();
    private static cacheExpiry: Map<string, number> = new Map();
    private static readonly CACHE_TTL = 60000; // 1 minute cache

    /**
     * Get crawl progress for a source
     * Fetches from crawl_logs and builds a priority queue
     */
    static async getCrawlProgress(
        sourceType: string,
        sourceId: number,
        freshnessHours: number = 24
    ): Promise<CrawlQueue> {
        const cacheKey = `${sourceType}-${sourceId}`;
        const now = Date.now();

        // Check cache
        if (this.progressCache.has(cacheKey) &&
            (this.cacheExpiry.get(cacheKey) || 0) > now) {
            const cached = this.progressCache.get(cacheKey)!;
            return this.buildQueue(cached, freshnessHours);
        }

        try {
            // Fetch recent crawl logs for this source
            const { data: logs, error } = await (supabaseAdmin as any)
                .from('crawl_logs')
                .select('*')
                .eq('source_id', sourceId)
                .order('started_at', { ascending: false })
                .limit(500);

            if (error) {
                logger.error('[CrawlProgressService] Error fetching logs:', error);
                return { pending: [], recentlyCompleted: [], inProgress: [] };
            }

            // Build progress from logs
            const progressMap = new Map<string, CrawlProgress>();

            for (const log of (logs || [])) {
                const key = log.keyword || log.category_id?.toString() || 'general';

                if (!progressMap.has(key)) {
                    progressMap.set(key, {
                        source: sourceType,
                        itemType: log.keyword ? 'keyword' : 'category',
                        itemId: key,
                        itemName: log.keyword || `Category ${log.category_id}`,
                        lastCrawledAt: log.ended_at ? new Date(log.ended_at) : null,
                        productCount: log.new_items || 0,
                        status: log.status === 'running' ? 'in_progress' :
                            log.status === 'completed' ? 'completed' :
                                log.status === 'failed' ? 'failed' : 'pending',
                    });
                }
            }

            const progress = Array.from(progressMap.values());

            // Cache results
            this.progressCache.set(cacheKey, progress);
            this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

            return this.buildQueue(progress, freshnessHours);
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to get progress:', error);
            return { pending: [], recentlyCompleted: [], inProgress: [] };
        }
    }

    /**
     * Build priority queue from progress data
     */
    private static buildQueue(progress: CrawlProgress[], freshnessHours: number): CrawlQueue {
        const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000);

        const pending: CrawlProgress[] = [];
        const recentlyCompleted: CrawlProgress[] = [];
        const inProgress: CrawlProgress[] = [];

        for (const item of progress) {
            if (item.status === 'in_progress') {
                inProgress.push(item);
            } else if (!item.lastCrawledAt || item.lastCrawledAt < threshold) {
                pending.push(item);
            } else {
                recentlyCompleted.push(item);
            }
        }

        // Sort pending by: never crawled first, then oldest first
        pending.sort((a, b) => {
            if (!a.lastCrawledAt && b.lastCrawledAt) return -1;
            if (a.lastCrawledAt && !b.lastCrawledAt) return 1;
            if (!a.lastCrawledAt && !b.lastCrawledAt) return 0;
            return a.lastCrawledAt!.getTime() - b.lastCrawledAt!.getTime();
        });

        return { pending, recentlyCompleted, inProgress };
    }

    /**
     * Check if a specific item should be skipped
     */
    static async shouldSkip(
        sourceId: number,
        itemType: 'category' | 'keyword',
        itemId: string,
        freshnessHours: number = 24
    ): Promise<boolean> {
        try {
            const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).toISOString();

            const query = (supabaseAdmin as any)
                .from('crawl_logs')
                .select('id')
                .eq('source_id', sourceId)
                .eq('status', 'completed')
                .gte('ended_at', threshold);

            if (itemType === 'keyword') {
                query.eq('keyword', itemId);
            } else {
                query.eq('category_id', parseInt(itemId));
            }

            const { data, error } = await query.limit(1);

            if (error) {
                logger.warn('[CrawlProgressService] Error checking skip:', error);
                return false; // Don't skip on error
            }

            return data && data.length > 0;
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to check skip:', error);
            return false;
        }
    }

    /**
     * Mark item as started crawling
     */
    static async markStarted(
        sourceId: number,
        itemType: 'category' | 'keyword',
        itemId: string,
        itemName: string
    ): Promise<number | null> {
        try {
            const { data, error } = await (supabaseAdmin as any)
                .from('crawl_logs')
                .insert({
                    source_id: sourceId,
                    status: 'running',
                    started_at: new Date().toISOString(),
                    keyword: itemType === 'keyword' ? itemName : null,
                    category_id: itemType === 'category' ? parseInt(itemId) : null,
                    total_items: 0,
                    new_items: 0,
                    updated_items: 0,
                    errors: 0,
                })
                .select('id')
                .single();

            if (error) {
                logger.error('[CrawlProgressService] Error marking started:', error);
                return null;
            }

            // Invalidate cache
            this.progressCache.clear();

            return data?.id;
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to mark started:', error);
            return null;
        }
    }

    /**
     * Mark item as completed
     */
    static async markCompleted(
        logId: number,
        productCount: number,
        errors: number = 0
    ): Promise<void> {
        try {
            await (supabaseAdmin as any)
                .from('crawl_logs')
                .update({
                    status: 'completed',
                    ended_at: new Date().toISOString(),
                    new_items: productCount,
                    total_items: productCount,
                    errors,
                })
                .eq('id', logId);

            // Invalidate cache
            this.progressCache.clear();
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to mark completed:', error);
        }
    }

    /**
     * Get uncrawled categories for a source
     * Returns categories that haven't been crawled within freshnessHours
     */
    static async getUncrawledCategories<T extends { id: number | string; name: string; slug?: string }>(
        sourceId: number,
        allCategories: T[],
        freshnessHours: number = 24
    ): Promise<T[]> {
        try {
            const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).toISOString();

            // Get recently crawled category IDs
            const { data: recentLogs, error } = await (supabaseAdmin as any)
                .from('crawl_logs')
                .select('category_id, keyword')
                .eq('source_id', sourceId)
                .eq('status', 'completed')
                .gte('ended_at', threshold)
                .not('category_id', 'is', null);

            if (error) {
                logger.warn('[CrawlProgressService] Error fetching recent logs:', error);
                return allCategories;
            }

            const recentlyCrawledIds = new Set(
                (recentLogs || []).map((l: { category_id: number }) => l.category_id.toString())
            );

            // Filter to only uncrawled categories
            const uncrawled = allCategories.filter(cat =>
                !recentlyCrawledIds.has(cat.id.toString())
            );

            logger.info(`[CrawlProgressService] ${uncrawled.length}/${allCategories.length} categories need crawling`);

            return uncrawled;
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to get uncrawled categories:', error);
            return allCategories;
        }
    }

    /**
     * Get uncrawled keywords for a source
     */
    static async getUncrawledKeywords(
        sourceId: number,
        allKeywords: string[],
        freshnessHours: number = 24
    ): Promise<string[]> {
        try {
            const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).toISOString();

            // Get recently crawled keywords
            const { data: recentLogs, error } = await (supabaseAdmin as any)
                .from('crawl_logs')
                .select('keyword')
                .eq('source_id', sourceId)
                .eq('status', 'completed')
                .gte('ended_at', threshold)
                .not('keyword', 'is', null);

            if (error) {
                logger.warn('[CrawlProgressService] Error fetching recent keyword logs:', error);
                return allKeywords;
            }

            const recentlyCrawled = new Set(
                (recentLogs || []).map((l: { keyword: string }) => l.keyword?.toLowerCase())
            );

            // Filter to only uncrawled keywords
            const uncrawled = allKeywords.filter(kw =>
                !recentlyCrawled.has(kw.toLowerCase())
            );

            logger.info(`[CrawlProgressService] ${uncrawled.length}/${allKeywords.length} keywords need crawling`);

            return uncrawled;
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to get uncrawled keywords:', error);
            return allKeywords;
        }
    }

    /**
     * Get crawl statistics summary
     */
    static async getCrawlStats(sourceId: number): Promise<{
        totalCrawled: number;
        last24h: number;
        lastWeek: number;
        pendingCategories: number;
        pendingKeywords: number;
    }> {
        try {
            const now = new Date();
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // Get counts
            const [totalResult, last24hResult, lastWeekResult] = await Promise.all([
                (supabaseAdmin as any)
                    .from('crawl_logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('source_id', sourceId)
                    .eq('status', 'completed'),
                (supabaseAdmin as any)
                    .from('crawl_logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('source_id', sourceId)
                    .eq('status', 'completed')
                    .gte('ended_at', last24h),
                (supabaseAdmin as any)
                    .from('crawl_logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('source_id', sourceId)
                    .eq('status', 'completed')
                    .gte('ended_at', lastWeek),
            ]);

            return {
                totalCrawled: totalResult.count || 0,
                last24h: last24hResult.count || 0,
                lastWeek: lastWeekResult.count || 0,
                pendingCategories: 0, // Will be calculated when categories are provided
                pendingKeywords: 0,
            };
        } catch (error) {
            logger.error('[CrawlProgressService] Failed to get stats:', error);
            return {
                totalCrawled: 0,
                last24h: 0,
                lastWeek: 0,
                pendingCategories: 0,
                pendingKeywords: 0,
            };
        }
    }

    /**
     * Clear progress cache
     */
    static clearCache(): void {
        this.progressCache.clear();
        this.cacheExpiry.clear();
    }
}

export default CrawlProgressService;
