import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const productId = parseInt(id);

        if (isNaN(productId)) {
            return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
        }

        // Get raw product
        const { data: product, error } = await (supabaseAdmin as any)
            .from('raw_products')
            .select(`
                *,
                sources(id, name, type, base_url)
            `)
            .eq('id', productId)
            .single();

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Check if it's mapped to a canonical product
        const { data: mapping } = await (supabaseAdmin as any)
            .from('product_mappings')
            .select('canonical_id')
            .eq('raw_product_id', productId)
            .single();

        // Format similarly to standard product API but for a single source
        return NextResponse.json({
            product: {
                id: product.id,
                name: product.name,
                description: product.description,
                imageUrl: product.image_url,
                images: product.images || [],
                specs: product.specs || {},
                minPrice: product.price,
                maxPrice: product.price,
                avgRating: product.rating || 0,
                totalReviews: product.review_count || 0,
                sourceCount: 1,
                canonicalId: mapping?.canonical_id || null
            },
            sources: [{
                sourceId: product.source_id,
                sourceName: product.sources?.name,
                sourceType: product.sources?.type,
                price: product.price,
                originalPrice: product.original_price,
                discountPercent: product.discount_percent,
                available: product.available,
                externalUrl: product.external_url,
                rating: product.rating,
                reviewCount: product.review_count,
                updatedAt: product.updated_at
            }],
            priceHistory: {},
            reviews: [],
            reviewStats: {
                total: product.review_count || 0,
                average: product.rating || 0,
                distribution: [0, 0, 0, 0, 0],
                sentiment: { positive: 0, negative: 0, neutral: 0 }
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
