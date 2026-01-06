import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: List raw products with pagination and filtering
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const source = searchParams.get('source');
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') || 'updated_at';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        const offset = (page - 1) * limit;

        // Build query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabaseAdmin as any)
            .from('raw_products')
            .select(`
                id,
                external_id,
                external_url,
                name,
                name_normalized,
                price,
                original_price,
                discount_percent,
                brand_raw,
                category_raw,
                image_url,
                rating,
                review_count,
                sold_count,
                available,
                source_id,
                crawled_at,
                updated_at,
                sources(name, type),
                product_mappings(
                    canonical_id,
                    canonical_products(name)
                )
            `, { count: 'exact' });

        // Filter by source
        if (source) {
            query = query.eq('source_id', parseInt(source));
        }

        // Search by name
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        // Sorting
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) {
            console.error('Raw products query error:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        return NextResponse.json({
            products: data || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        });
    } catch (error) {
        console.error('Raw products API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
