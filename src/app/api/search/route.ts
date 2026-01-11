import { NextRequest, NextResponse } from 'next/server';
import { getSearchService, SearchOptions } from '@/lib/search/searchService';
import { FacetService } from '@/lib/search/facetService';

const searchService = getSearchService();
const facetService = new FacetService();

/**
 * POST /api/search - Main search endpoint
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const options: SearchOptions = {
            query: body.query || '',
            type: body.type || 'hybrid',
            filters: body.filters || {},
            sort: body.sort || { field: 'relevance' },
            page: body.page || 1,
            limit: Math.min(body.limit || 20, 100),
        };

        const response = await searchService.search(options);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/search - Search with query params
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const sort = searchParams.get('sort') || 'relevance';
        const type = searchParams.get('type') || 'hybrid';

        // Parse filters
        const filters: SearchOptions['filters'] = {};

        const brands = searchParams.get('brands');
        if (brands) filters.brands = brands.split(',');

        const categories = searchParams.get('categories');
        if (categories) filters.categories = categories.split(',');

        const priceMin = searchParams.get('priceMin');
        if (priceMin) filters.priceMin = parseInt(priceMin);

        const priceMax = searchParams.get('priceMax');
        if (priceMax) filters.priceMax = parseInt(priceMax);

        const minRating = searchParams.get('minRating');
        if (minRating) filters.minRating = parseFloat(minRating);

        const sources = searchParams.get('sources');
        if (sources) filters.sources = sources.split(',').map(Number);

        const inStock = searchParams.get('inStock');
        if (inStock === 'true') filters.inStock = true;

        const response = await searchService.search({
            query,
            type: type as SearchOptions['type'],
            filters,
            sort: { field: sort as NonNullable<SearchOptions['sort']>['field'] },
            page,
            limit,
        });

        // Also generate facets
        const facets = await facetService.generateFacets(query, {
            brands: filters.brands || [],
            categories: filters.categories || [],
        });

        return NextResponse.json({
            ...response,
            facets: facets.facets,
            priceRange: facets.priceRange,
            ratingRange: facets.ratingRange,
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
