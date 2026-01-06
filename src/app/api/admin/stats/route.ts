import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

export async function GET() {
    try {
        // Get overview stats
        const [
            { count: totalProducts },
            { count: totalRaw },
            { count: totalBrands },
            { count: totalCategories },
        ] = await Promise.all([
            supabaseAdmin.from('canonical_products').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabaseAdmin.from('raw_products').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('brands').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }),
        ]);

        // Get recent crawl logs
        const { data: recentCrawls } = await supabaseAdmin
            .from('crawl_logs')
            .select(`
        id,
        started_at,
        completed_at,
        status,
        total_items,
        new_items,
        updated_items,
        error_count,
        error_message,
        sources(name, type)
      `)
            .order('started_at', { ascending: false })
            .limit(20);

        // Get products per source
        const { data: productsBySource } = await supabaseAdmin
            .from('raw_products')
            .select('source_id')
            .limit(100000) as { data: { source_id: number }[] | null };

        const sourceCounts = (productsBySource || []).reduce((acc: Record<number, number>, p) => {
            acc[p.source_id] = (acc[p.source_id] || 0) + 1;
            return acc;
        }, {});

        // Get sources
        const { data: sources } = await supabaseAdmin
            .from('sources')
            .select('id, name, type, is_active, last_crawled_at, total_items_crawled') as { data: { id: number; name: string; type: string; is_active: boolean; last_crawled_at: string; total_items_crawled: number }[] | null };

        // Get popular searches
        const { data: popularSearches } = await supabaseAdmin
            .from('search_history')
            .select('query, results_count')
            .order('searched_at', { ascending: false })
            .limit(100) as { data: { query: string; results_count: number }[] | null };

        // Aggregate searches
        const searchCounts = (popularSearches || []).reduce((acc: Record<string, { count: number; results: number }>, s) => {
            const q = s.query.toLowerCase().trim();
            if (!acc[q]) acc[q] = { count: 0, results: 0 };
            acc[q].count++;
            acc[q].results = Math.max(acc[q].results, s.results_count);
            return acc;
        }, {});

        const topSearches = Object.entries(searchCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([query, data]) => ({ query, ...data }));

        // Get brands list for filters
        const { data: brandsList } = await supabaseAdmin
            .from('brands')
            .select('id, name')
            .order('name') as { data: { id: number; name: string }[] | null };

        // Get categories list for filters  
        const { data: categoriesList } = await supabaseAdmin
            .from('categories')
            .select('id, name')
            .order('name') as { data: { id: number; name: string }[] | null };

        return NextResponse.json({
            stats: {
                totalProducts: totalProducts || 0,
                totalRaw: totalRaw || 0,
                totalBrands: totalBrands || 0,
                totalCategories: totalCategories || 0,
                deduplicationRate: totalRaw && totalProducts ? ((totalRaw - totalProducts) / totalRaw * 100).toFixed(1) : 0,
            },
            sources: (sources || []).map(s => ({
                ...s,
                productCount: sourceCounts[s.id] || 0,
            })),
            recentCrawls: recentCrawls || [],
            topSearches,
            brands: brandsList || [],
            categories: categoriesList || [],
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch admin stats' },
            { status: 500 }
        );
    }
}
