import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: Get single raw product by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: product, error } = await (supabaseAdmin as any)
            .from('raw_products')
            .select(`
                *,
                sources(id, name, type, base_url),
                price_history(price, original_price, recorded_at)
            `)
            .eq('id', parseInt(id))
            .single();

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Sort price history by date
        if (product.price_history) {
            product.price_history.sort((a: { recorded_at: string }, b: { recorded_at: string }) =>
                new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
            );
        }

        return NextResponse.json({ product });
    } catch (error) {
        console.error('Raw product detail error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
