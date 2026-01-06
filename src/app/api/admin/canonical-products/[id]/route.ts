import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: Get single canonical product with all related raw products
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get canonical product
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: product, error } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select(`
                *,
                brands(id, name),
                categories(id, name)
            `)
            .eq('id', parseInt(id))
            .single();

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Get all mapped raw products with their sources
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mappings } = await (supabaseAdmin as any)
            .from('product_mappings')
            .select(`
                canonical_id,
                confidence_score,
                matching_method,
                raw_products(
                    id,
                    external_id,
                    external_url,
                    name,
                    price,
                    original_price,
                    discount_percent,
                    image_url,
                    rating,
                    review_count,
                    sold_count,
                    available,
                    updated_at,
                    sources(id, name, type)
                )
            `)
            .eq('canonical_id', parseInt(id));

        // Get price history for all related raw products
        const rawProductIds = mappings?.map((m: { raw_products: { id: number } }) => m.raw_products?.id).filter(Boolean) || [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let priceHistory: any[] = [];
        if (rawProductIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: history } = await (supabaseAdmin as any)
                .from('price_history')
                .select('raw_product_id, price, original_price, recorded_at')
                .in('raw_product_id', rawProductIds)
                .order('recorded_at', { ascending: false })
                .limit(100);

            priceHistory = history || [];
        }

        // Format sources with prices
        const sources = mappings?.map((m: { raw_products: { sources: { id: number; name: string; type: string }; id: number; name: string; price: number; original_price?: number; discount_percent?: number; external_url: string; rating: number; review_count: number; sold_count: number; available: boolean; updated_at: string }; confidence_score: number }) => ({
            sourceId: m.raw_products?.sources?.id,
            sourceName: m.raw_products?.sources?.name,
            sourceType: m.raw_products?.sources?.type,
            rawProductId: m.raw_products?.id,
            productName: m.raw_products?.name,
            price: m.raw_products?.price,
            originalPrice: m.raw_products?.original_price,
            discountPercent: m.raw_products?.discount_percent,
            externalUrl: m.raw_products?.external_url,
            rating: m.raw_products?.rating,
            reviewCount: m.raw_products?.review_count,
            soldCount: m.raw_products?.sold_count,
            available: m.raw_products?.available,
            updatedAt: m.raw_products?.updated_at,
            confidence: m.confidence_score,
        })).filter((s: { sourceId: number }) => s.sourceId) || [];

        // Sort by price ascending
        sources.sort((a: { price: number }, b: { price: number }) => (a.price || 0) - (b.price || 0));

        return NextResponse.json({
            product: {
                ...product,
                sources,
                priceHistory,
            },
        });
    } catch (error) {
        console.error('Canonical product detail error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
