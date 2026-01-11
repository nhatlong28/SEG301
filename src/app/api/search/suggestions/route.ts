import { NextRequest, NextResponse } from 'next/server';
import { getSearchService } from '@/lib/search/searchService';

const searchService = getSearchService();

/**
 * GET /api/search/suggestions - Autocomplete suggestions
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20);

        if (!query || query.length < 2) {
            return NextResponse.json({ suggestions: [] });
        }

        const suggestions = await searchService.getSuggestions(query, limit);

        return NextResponse.json({ suggestions });
    } catch (error) {
        console.error('Suggestions API error:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestions' },
            { status: 500 }
        );
    }
}
