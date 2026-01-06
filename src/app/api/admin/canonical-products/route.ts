import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: List canonical products with pagination and filtering
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search');
        const brand = searchParams.get('brand');
        const category = searchParams.get('category');
        const sortBy = searchParams.get('sortBy') || 'quality_score';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        const offset = (page - 1) * limit;

        // Build query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabaseAdmin as any)
            .from('canonical_products')
            .select(`
                id,
                name,
                name_normalized,
                slug,
                description,
                image_url,
                images,
                min_price,
                max_price,
                avg_rating,
                total_reviews,
                source_count,
                quality_score,
                is_active,
                created_at,
                updated_at,
                brands(id, name),
                categories(id, name)
            `, { count: 'exact' });

        // Filter by active only
        query = query.eq('is_active', true);

        // Search by name
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        // Filter by brand
        if (brand) {
            query = query.eq('brand_id', parseInt(brand));
        }

        // Filter by category
        if (category) {
            query = query.eq('category_id', parseInt(category));
        }

        // Sorting
        query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false });

        // Pagination
        query = query.range(offset, offset + limit - 1);

        const { data: preData, count, error } = await query;

        if (error) {
            console.error('Canonical products query error:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        // Fallback images for canonical products missing image_url
        const data = await Promise.all((preData || []).map(async (p: any) => {
            if (!p.image_url) {
                const { data: firstRaw } = await supabaseAdmin
                    .from('product_mappings')
                    .select('raw_products(image_url)')
                    .eq('canonical_id', p.id)
                    .limit(1)
                    .single();

                return {
                    ...p,
                    image_url: (firstRaw as any)?.raw_products?.image_url || null
                };
            }
            return p;
        }));

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
        console.error('Canonical products API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
