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

        // Get canonical product with all related data
        const { data: product, error } = await supabaseAdmin
            .from('canonical_products')
            .select(`
        *,
        brands(id, name, slug, logo_url),
        categories(id, name, slug, icon)
      `)
            .eq('id', productId)
            .eq('is_active', true)
            .single() as { data: { id: number; name: string; slug: string; description?: string; image_url?: string; images?: string[]; canonical_specs?: Record<string, unknown>; brands: { name: string }; categories: { name: string }; min_price: number; max_price: number; avg_rating: number; total_reviews: number; source_count: number; is_verified: boolean } | null; error: Error | null };

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Get all source prices through mappings
        const { data: mappings } = await supabaseAdmin
            .from('product_mappings')
            .select(`
        confidence_score,
        matching_method,
        raw_products(
          id,
          source_id,
          external_id,
          external_url,
          name,
          price,
          original_price,
          discount_percent,
          rating,
          review_count,
          sold_count,
          available,
          stock_quantity,
          image_url,
          images,
          specs,
          updated_at,
          sources(id, name, base_url, type)
        )
      `)
            .eq('canonical_id', productId) as {
                data: Array<{
                    raw_products: {
                        id: number;
                        source_id: number;
                        sources: { name: string; type: string };
                        price: number;
                        original_price?: number;
                        discount_percent?: number;
                        rating?: number;
                        review_count?: number;
                        sold_count?: number;
                        available: boolean;
                        stock_quantity?: number;
                        external_url?: string;
                        image_url?: string;
                        images?: string[];
                        specs?: Record<string, unknown>;
                        updated_at: string;
                    } | null;
                }> | null;
            };

        // Get price history (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const rawProductIds = mappings?.map(m => m.raw_products?.id).filter((id): id is number => !!id) || [];

        const { data: priceHistory } = await supabaseAdmin
            .from('price_history')
            .select('raw_product_id, price, discount_percent, available, recorded_at')
            .in('raw_product_id', rawProductIds)
            .gte('recorded_at', thirtyDaysAgo.toISOString())
            .order('recorded_at', { ascending: true }) as { data: Array<{ raw_product_id: number; price: number; recorded_at: string }> | null };

        // Get reviews
        const { data: reviews } = await supabaseAdmin
            .from('reviews')
            .select(`
        id,
        author,
        author_avatar,
        rating,
        content,
        images,
        helpful_count,
        verified_purchase,
        sentiment,
        review_date,
        sources(name)
      `)
            .in('raw_product_id', rawProductIds)
            .order('helpful_count', { ascending: false })
            .limit(50) as { data: Array<{ rating: number; sentiment: string }> | null };

        // Format response
        const sources = (mappings || []).map(m => {
            const raw = m.raw_products;
            return {
                sourceId: raw?.source_id,
                sourceName: raw?.sources?.name || 'Unknown',
                sourceType: raw?.sources?.type,
                price: raw?.price,
                originalPrice: raw?.original_price,
                discountPercent: raw?.discount_percent,
                rating: raw?.rating,
                reviewCount: raw?.review_count,
                soldCount: raw?.sold_count,
                available: raw?.available,
                stockQuantity: raw?.stock_quantity,
                externalUrl: raw?.external_url,
                imageUrl: raw?.image_url,
                images: raw?.images,
                specs: raw?.specs,
                updatedAt: raw?.updated_at,
                rawProductId: raw?.id,
            };
        }).sort((a, b) => (a.price || Infinity) - (b.price || Infinity));

        // Group price history by source
        const priceHistoryGrouped: Record<number, Array<{ date: string; price: number }>> = {};
        for (const ph of priceHistory || []) {
            if (!priceHistoryGrouped[ph.raw_product_id]) {
                priceHistoryGrouped[ph.raw_product_id] = [];
            }
            priceHistoryGrouped[ph.raw_product_id].push({
                date: ph.recorded_at,
                price: ph.price,
            });
        }

        // Calculate review stats
        const reviewStats = {
            total: reviews?.length || 0,
            average: reviews?.length
                ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
                : 0,
            distribution: [0, 0, 0, 0, 0],
            sentiment: { positive: 0, negative: 0, neutral: 0 },
        };

        for (const review of reviews || []) {
            if (review.rating) {
                reviewStats.distribution[review.rating - 1]++;
            }
            if (review.sentiment === 'positive') reviewStats.sentiment.positive++;
            else if (review.sentiment === 'negative') reviewStats.sentiment.negative++;
            else reviewStats.sentiment.neutral++;
        }

        return NextResponse.json({
            product: {
                id: product.id,
                name: product.name,
                slug: product.slug,
                description: product.description,
                imageUrl: product.image_url,
                images: product.images,
                specs: product.canonical_specs,
                brand: product.brands,
                category: product.categories,
                minPrice: product.min_price,
                maxPrice: product.max_price,
                avgRating: product.avg_rating,
                totalReviews: product.total_reviews,
                sourceCount: product.source_count,
                isVerified: product.is_verified,
            },
            sources,
            priceHistory: priceHistoryGrouped,
            reviews: reviews?.slice(0, 20) || [],
            reviewStats,
        });
    } catch (error) {
        console.error('Product API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
