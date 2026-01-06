import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export interface CrawlCategory {
    id: number;
    name: string;
    slug: string;
    level: number;
    is_active: boolean;
}

/**
 * Service to manage categories from database
 */
export class CategoryService {
    /**
     * Get all active categories
     */
    static async getCategories(
        sourceId?: number,
        freshnessHours?: number
    ): Promise<CrawlCategory[]> {
        try {
            const { data, error } = await (supabaseAdmin as any)
                .from('categories')
                .select('*')
                .select('*')
                .eq('is_active', true)
                .order('id', { ascending: true });

            if (error) {
                logger.error('[CategoryService] Error fetching categories:', error);
                return [];
            }

            let categories = data || [];

            // Intelligent freshness check using crawl_logs
            if (freshnessHours && sourceId) {
                const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).toISOString();

                // Get successful crawl logs for this source and categories since threshold
                const { data: recentLogs } = await (supabaseAdmin as any)
                    .from('crawl_logs')
                    .select('category_id')
                    .eq('source_id', sourceId)
                    .eq('status', 'completed') // Only completed crawls count
                    .gte('created_at', threshold)
                    .not('category_id', 'is', null);

                if (recentLogs && recentLogs.length > 0) {
                    const recentlyCrawledIds = new Set(recentLogs.map((l: any) => l.category_id));
                    categories = categories.filter((cat: CrawlCategory) => !recentlyCrawledIds.has(cat.id));

                    if (categories.length < (data?.length || 0)) {
                        logger.info(`[CategoryService] Skipped ${(data?.length || 0) - categories.length} recently crawled categories for source ${sourceId}`);
                    }
                }
            }

            return categories;
        } catch (error) {
            logger.error('[CategoryService] Failed to get categories:', error);
            return [];
        }
    }

    /**
     * Get source-specific slug mapping
     * Fallback to generic slug if no specific mapping exists
     */
    static getSourceSlug(category: CrawlCategory, source: string): string {
        // This could eventually be moved to a database table like 'source_categories'
        // For now, we use a mapping for known redirects/slug differences
        const mapping: Record<string, Record<string, string>> = {
            'lazada': {
                'dien-thoai': 'dien-thoai-di-dong',
                'tablet': 'may-tinh-bang',
                'phu-kien': 'phu-kien-dien-thoai',
                'do-gia-dung': 'do-gia-dung-dien-tu',
                'dong-ho': 'thiet-bi-deo-thong-minh',
                'may-anh': 'may-anh-may-quay-phim',
                'laptop': 'laptop',
                'tivi': 'tivi',
            },
            'tiki': {
                'dien-thoai': '1789',
                'laptop': '1846',
                'tablet': '1789',
                'tivi': '1815',
                'may-anh': '1882',
                'do-gia-dung': '1883',
                'phu-kien': '1801',
                'dong-ho': '8594',
            },
            'dienmayxanh': {
                'dien-thoai': 'dien-thoai',
                'laptop': 'laptop',
                'tablet': 'may-tinh-bang',
                'tivi': 'tivi',
                'tu-lanh': 'tu-lanh',
                'may-giat': 'may-giat',
                'do-gia-dung': 'do-gia-dung',
            },
            'shopee': {
                'dien-thoai': 'Điện thoại',
                'laptop': 'Laptop',
                'tablet': 'Máy tính bảng',
            },
            'cellphones': {
                'dien-thoai': 'mobile',
                'laptop': 'laptop',
                'tablet': 'tablet',
                'phu-kien': 'phu-kien',
                'dong-ho': 'do-choi-cong-nghe/dong-ho-thong-minh',
            }
        };

        return mapping[source]?.[category.slug] || category.slug;
    }
}

export default CategoryService;
