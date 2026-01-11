import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';
import { CanonicalProduct } from '@/types/database';

interface PopularProduct extends CanonicalProduct {
    brands: { name: string } | null;
}

export async function GET() {
    try {
        // Get popular products
        const { data: prePopularProducts } = await supabaseAdmin
            .from('canonical_products')
            .select(`
                id,
                name,
                slug,
                image_url,
                min_price,
                max_price,
                avg_rating,
                total_reviews,
                source_count,
                brands(name)
            `)
            .eq('is_active', true)
            .order('total_reviews', { ascending: false })
            .limit(10) as { data: PopularProduct[] | null };

        // Fetch fallback images for products with null image_url
        const popularProducts = await Promise.all((prePopularProducts || []).map(async (p: PopularProduct) => {
            if (!p.image_url) {
                const { data: raw } = await supabaseAdmin
                    .from('product_mappings')
                    .select('raw_products(image_url)')
                    .eq('canonical_id', p.id)
                    .limit(1)
                    .single() as { data: { raw_products: { image_url: string | null } } | null };

                return {
                    ...p,
                    image_url: raw?.raw_products?.image_url || null
                };
            }
            return p;
        }));

        // Get best deals (highest discount)
        const { data: deals } = await supabaseAdmin
            .from('raw_products')
            .select(`
                id,
                name,
                price,
                original_price,
                discount_percent,
                image_url,
                source_id
            `)
            .eq('available', true)
            .not('discount_percent', 'is', null)
            .gt('discount_percent', 20)
            .order('discount_percent', { ascending: false })
            .limit(10);

        // Get categories
        const { data: categories } = await supabaseAdmin
            .from('categories')
            .select('id, name, slug, icon')
            .eq('is_active', true)
            .eq('level', 1);

        // Get brands
        const { data: brands } = await supabaseAdmin
            .from('brands')
            .select('id, name, slug, logo_url')
            .eq('is_verified', true)
            .limit(20);

        // Get stats
        const { count: totalProducts } = await supabaseAdmin
            .from('canonical_products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        const { count: totalSources } = await supabaseAdmin
            .from('sources')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        return NextResponse.json({
            popularProducts: popularProducts || [],
            deals: deals || [],
            categories: categories || [],
            brands: brands || [],
            stats: {
                totalProducts: totalProducts || 0,
                totalSources: totalSources || 0,
            },
        });
    } catch (error) {
        console.error('Homepage API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch homepage data' },
            { status: 500 }
        );
    }
}
