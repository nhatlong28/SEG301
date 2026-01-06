import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: Get cross-source matching matrix and recent matching pairs
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const limit = parseInt(searchParams.get('limit') || '20');

        // Get sources
        const { data: sources } = await supabaseAdmin
            .from('sources')
            .select('id, name, type')
            .eq('is_active', true);

        const sourceMap = new Map((sources || []).map((s: { id: number; name: string }) => [s.id, s.name]));
        const sourceNames = (sources || []).map((s: { id: number; name: string }) => s.name);

        // Initialize matrix
        const matrix: Record<string, Record<string, number>> = {};
        for (const s1 of sourceNames) {
            matrix[s1] = {};
            for (const s2 of sourceNames) {
                matrix[s1][s2] = 0;
            }
        }

        // Build matrix query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let matrixQuery = (supabaseAdmin as any)
            .from('matching_pairs')
            .select('source_1, source_2');

        if (jobId) {
            matrixQuery = matrixQuery.eq('job_id', parseInt(jobId));
        }

        const { data: pairs } = await matrixQuery;

        // Populate matrix
        for (const pair of pairs || []) {
            const s1Name = sourceMap.get(pair.source_1) || 'Unknown';
            const s2Name = sourceMap.get(pair.source_2) || 'Unknown';
            if (matrix[s1Name]?.[s2Name] !== undefined) {
                matrix[s1Name][s2Name]++;
                matrix[s2Name][s1Name]++;
            }
        }

        // Get recent matching pairs with product info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pairsQuery = (supabaseAdmin as any)
            .from('matching_pairs')
            .select(`
                id,
                match_score,
                match_method,
                canonical_id,
                created_at,
                raw_product_1,
                raw_product_2,
                source_1,
                source_2
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (jobId) {
            pairsQuery = pairsQuery.eq('job_id', parseInt(jobId));
        }

        const { data: recentPairs } = await pairsQuery;

        // Get product names for recent pairs
        const productIds = new Set<number>();
        for (const pair of recentPairs || []) {
            productIds.add(pair.raw_product_1);
            productIds.add(pair.raw_product_2);
        }

        const { data: products } = await supabaseAdmin
            .from('raw_products')
            .select('id, name, price, source_id')
            .in('id', [...productIds]);

        const productMap = new Map((products || []).map((p: { id: number; name: string; price?: number; source_id: number }) => [p.id, p]));

        // Format pairs with product info
        const formattedPairs = (recentPairs || []).map((pair: {
            id: number;
            match_score: number;
            match_method: string;
            canonical_id: number;
            created_at: string;
            raw_product_1: number;
            raw_product_2: number;
            source_1: number;
            source_2: number;
        }) => {
            const p1 = productMap.get(pair.raw_product_1);
            const p2 = productMap.get(pair.raw_product_2);

            return {
                id: pair.id,
                product1: {
                    id: pair.raw_product_1,
                    name: p1?.name || 'Unknown',
                    price: p1?.price,
                    source: sourceMap.get(pair.source_1) || 'Unknown',
                },
                product2: {
                    id: pair.raw_product_2,
                    name: p2?.name || 'Unknown',
                    price: p2?.price,
                    source: sourceMap.get(pair.source_2) || 'Unknown',
                },
                score: pair.match_score,
                method: pair.match_method,
                canonicalId: pair.canonical_id,
                createdAt: pair.created_at,
            };
        });

        // Get summary stats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: totalPairs } = await (supabaseAdmin as any)
            .from('matching_pairs')
            .select('*', { count: 'exact', head: true });

        const { count: totalCanonical } = await supabaseAdmin
            .from('canonical_products')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            matrix,
            sources: sourceNames,
            recentPairs: formattedPairs,
            stats: {
                totalPairs: totalPairs || 0,
                totalCanonical: totalCanonical || 0,
            },
        });
    } catch (error) {
        console.error('Matrix API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
