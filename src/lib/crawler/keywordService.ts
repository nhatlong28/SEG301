import { supabaseAdmin } from '../db/supabase';
import logger from '../utils/logger';

export interface CrawlKeyword {
    id: number;
    keyword: string;
    category: string;
    priority: number;
    is_active: boolean;
    applies_to: string[];
    last_crawled_at: string | null;
}

/**
 * Service để quản lý keywords tập trung cho tất cả crawlers
 */
export class KeywordService {
    /**
     * Get all active keywords for a specific source
     * @param source - Source type or 'all' for all keywords
     * @param category - Optional category filter
     */
    static async getKeywords(
        source: string = 'all',
        category?: string,
        freshnessHours?: number // If set, only returns keywords not crawled within this time
    ): Promise<CrawlKeyword[]> {
        try {
            let query = (supabaseAdmin as any)
                .from('crawl_keywords')
                .select('*')
                .eq('is_active', true)
                .order('priority', { ascending: true })
                .order('keyword', { ascending: true });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('[KeywordService] Error fetching keywords:', error);
                return [];
            }

            // Filter by source
            let filtered = (data || []).filter((kw: CrawlKeyword) =>
                source === 'all' || kw.applies_to.includes('all') || kw.applies_to.includes(source)
            );

            // Filter by freshness if requested
            if (freshnessHours) {
                const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).getTime();
                filtered = filtered.filter((kw: CrawlKeyword) => {
                    if (!kw.last_crawled_at) return true; // Never crawled
                    return new Date(kw.last_crawled_at).getTime() < threshold;
                });
            }

            return filtered;
        } catch (error) {
            logger.error('[KeywordService] Failed to get keywords:', error);
            return [];
        }
    }

    /**
     * Get keywords grouped by category
     */
    static async getKeywordsByCategory(source: string = 'all'): Promise<Record<string, CrawlKeyword[]>> {
        const keywords = await this.getKeywords(source);
        const grouped: Record<string, CrawlKeyword[]> = {};

        for (const kw of keywords) {
            const cat = kw.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(kw);
        }

        return grouped;
    }

    /**
     * Get only keyword strings for crawling
     */
    static async getKeywordStrings(
        source: string = 'all',
        category?: string,
        freshnessHours?: number
    ): Promise<string[]> {
        const keywords = await this.getKeywords(source, category, freshnessHours);
        return keywords.map(kw => kw.keyword);
    }

    /**
     * Mark keyword as crawled
     */
    static async markCrawled(keywordId: number): Promise<void> {
        try {
            await (supabaseAdmin as any)
                .from('crawl_keywords')
                .update({ last_crawled_at: new Date().toISOString() })
                .eq('id', keywordId);
        } catch (error) {
            logger.error('[KeywordService] Failed to mark keyword as crawled:', error);
        }
    }

    /**
     * Add new keyword
     */
    static async addKeyword(
        keyword: string,
        category: string,
        priority: number = 1,
        appliesTo: string[] = ['all']
    ): Promise<boolean> {
        try {
            const { error } = await (supabaseAdmin as any)
                .from('crawl_keywords')
                .insert({
                    keyword,
                    category,
                    priority,
                    applies_to: appliesTo,
                    is_active: true
                });

            if (error) {
                logger.error('[KeywordService] Failed to add keyword:', error);
                return false;
            }
            return true;
        } catch (error) {
            logger.error('[KeywordService] Failed to add keyword:', error);
            return false;
        }
    }

    /**
     * Get statistics about keywords
     */
    static async getStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
        try {
            const keywords = await this.getKeywords();
            const byCategory: Record<string, number> = {};

            for (const kw of keywords) {
                const cat = kw.category || 'other';
                byCategory[cat] = (byCategory[cat] || 0) + 1;
            }

            return {
                total: keywords.length,
                byCategory
            };
        } catch (error) {
            logger.error('[KeywordService] Failed to get stats:', error);
            return { total: 0, byCategory: {} };
        }
    }
}

export default KeywordService;
