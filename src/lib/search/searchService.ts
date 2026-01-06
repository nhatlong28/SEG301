/**
 * World-Class Hybrid Search Service
 * Combines PostgreSQL FTS + E5 Semantic Search for Vietnamese
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import { getEmbeddingService } from './embeddingService';
import logger from '@/lib/utils/logger';

export interface SearchOptions {
    query: string;
    type?: 'full_text' | 'semantic' | 'hybrid';
    filters?: {
        brands?: string[];
        categories?: string[];
        priceMin?: number;
        priceMax?: number;
        minRating?: number;
        sources?: number[];
        inStock?: boolean;
    };
    sort?: {
        field: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
    };
    page?: number;
    limit?: number;
}

export interface SearchResult {
    id: number;
    name: string;
    slug: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    minPrice: number | null;
    maxPrice: number | null;
    avgRating: number | null;
    totalReviews: number;
    sourceCount: number;
    sources: Array<{
        sourceId: number;
        sourceName: string;
        price: number;
        originalPrice?: number;
        discountPercent?: number;
        available: boolean;
        externalUrl?: string;
    }>;
    relevanceScore?: number;
    matchType?: 'exact' | 'semantic' | 'hybrid';
}

export interface SearchResponse {
    results: SearchResult[];
    total: number;
    page: number;
    limit: number;
    executionTimeMs: number;
    searchType: string;
    semanticEnabled: boolean;
}

export interface SearchSuggestion {
    text: string;
    type: 'product' | 'brand' | 'category' | 'history';
    count?: number;
}

export class SearchService {
    private readonly sourceNames: Record<number, string> = {
        1: 'Shopee',
        2: 'Tiki',
        3: 'Lazada',
        4: 'CellphoneS',
        5: 'Điện Máy Xanh',
    };

    private embeddingService = getEmbeddingService();

    /**
     * Main search method - World-class hybrid search
     */
    async search(options: SearchOptions): Promise<SearchResponse> {
        const startTime = Date.now();
        const {
            query,
            type = 'hybrid',
            filters = {},
            sort = { field: 'relevance' },
            page = 1,
            limit = 20,
        } = options;

        const normalizedQuery = this.normalizeQuery(query);
        logger.info(`🔍 Search: "${normalizedQuery}", type: ${type}, page: ${page}`);

        let results: SearchResult[] = [];
        let total = 0;

        try {
            if (type === 'full_text') {
                const response = await this.fullTextSearch(normalizedQuery, filters, sort, page, limit);
                results = response.results;
                total = response.total;
            } else if (type === 'semantic') {
                const response = await this.semanticSearch(normalizedQuery, filters, sort, page, limit);
                results = response.results;
                total = response.total;
            } else {
                // Hybrid search - best of both worlds
                const response = await this.hybridSearch(normalizedQuery, filters, sort, page, limit);
                results = response.results;
                total = response.total;
            }

            // Log search for analytics
            await this.logSearch(query, type, filters, total, Date.now() - startTime);

        } catch (error) {
            logger.error('Search error:', error);
        }

        return {
            results,
            total,
            page,
            limit,
            executionTimeMs: Date.now() - startTime,
            searchType: type,
            semanticEnabled: this.embeddingService.isAvailable(),
        };
    }

    /**
     * Get search suggestions/autocomplete
     */
    async getSuggestions(query: string, limit: number = 8): Promise<SearchSuggestion[]> {
        const suggestions: SearchSuggestion[] = [];
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery || normalizedQuery.length < 2) {
            return suggestions;
        }

        try {
            // Search in products
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: products } = await (supabaseAdmin as any)
                .from('canonical_products')
                .select('name')
                .ilike('name', `%${normalizedQuery}%`)
                .eq('is_active', true)
                .limit(5);

            for (const p of products || []) {
                suggestions.push({ text: p.name, type: 'product' });
            }

            // Search in brands
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: brands } = await (supabaseAdmin as any)
                .from('brands')
                .select('name')
                .ilike('name', `%${normalizedQuery}%`)
                .limit(3);

            for (const b of brands || []) {
                suggestions.push({ text: b.name, type: 'brand' });
            }

            // Search history
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: history } = await (supabaseAdmin as any)
                .from('search_history')
                .select('query')
                .ilike('query', `%${normalizedQuery}%`)
                .order('searched_at', { ascending: false })
                .limit(3);

            const historyQueries = new Set<string>();
            for (const h of history || []) {
                if (!historyQueries.has(h.query.toLowerCase())) {
                    historyQueries.add(h.query.toLowerCase());
                    suggestions.push({ text: h.query, type: 'history' });
                }
            }

        } catch (error) {
            logger.error('Suggestions error:', error);
        }

        return suggestions.slice(0, limit);
    }

    /**
     * Full-Text Search using PostgreSQL with Vietnamese support
     */
    private async fullTextSearch(
        query: string,
        filters: SearchOptions['filters'],
        sort: SearchOptions['sort'],
        page: number,
        limit: number
    ): Promise<{ results: SearchResult[]; total: number }> {
        const offset = (page - 1) * limit;

        // Build search query with ts_rank
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let queryBuilder = (supabaseAdmin as any)
            .from('canonical_products')
            .select(`
                id,
                name,
                slug,
                brand_id,
                category_id,
                image_url,
                min_price,
                max_price,
                avg_rating,
                total_reviews,
                source_count,
                brands(name),
                categories(name)
            `, { count: 'exact' })
            .eq('is_active', true);

        // Apply text search
        const searchTerms = query.split(' ').filter(t => t.length > 1).join(' & ');
        if (searchTerms) {
            queryBuilder = queryBuilder.textSearch('name', searchTerms, {
                type: 'websearch',
                config: 'simple',
            });
        }

        // Apply filters
        queryBuilder = this.applyFilters(queryBuilder, filters);

        // Apply sorting
        queryBuilder = this.applySorting(queryBuilder, sort);

        // Apply pagination
        queryBuilder = queryBuilder.range(offset, offset + limit - 1);

        const { data, count, error } = await queryBuilder;

        if (error) {
            logger.error('FTS error:', error);
            return { results: [], total: 0 };
        }

        // Fetch sources for each product
        const results = await this.enrichWithSources(data || []);

        // Mark match type
        results.forEach(r => r.matchType = 'exact');

        return {
            results,
            total: count || 0,
        };
    }

    /**
     * Semantic Search using E5 embeddings
     */
    private async semanticSearch(
        query: string,
        filters: SearchOptions['filters'],
        sort: SearchOptions['sort'],
        page: number,
        limit: number
    ): Promise<{ results: SearchResult[]; total: number }> {
        // Generate embedding for query using E5 model with "query:" prefix
        const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

        if (!queryEmbedding) {
            logger.warn('Failed to generate embedding, falling back to FTS');
            return this.fullTextSearch(query, filters, sort, page, limit);
        }

        // Get candidates from FTS first, then re-rank with semantic similarity
        const candidateLimit = Math.min(limit * 5, 100);
        const ftsResults = await this.fullTextSearch(query, filters, sort, 1, candidateLimit);

        if (ftsResults.results.length === 0) {
            // If no FTS results, try broader search
            return this.broadSemanticSearch(query, queryEmbedding, filters, page, limit);
        }

        // Generate embeddings for product names (batch)
        const productNames = ftsResults.results.map(p => p.name);
        const productEmbeddings = await this.embeddingService.generateBatchDocumentEmbeddings(productNames);

        // Calculate similarity scores
        const scoredResults = ftsResults.results.map((result, idx) => {
            const productEmb = productEmbeddings[idx];
            const score = productEmb
                ? this.embeddingService.cosineSimilarity(queryEmbedding, productEmb)
                : 0.3;
            return { ...result, relevanceScore: score, matchType: 'semantic' as const };
        });

        // Sort by semantic similarity
        scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

        // Paginate
        const offset = (page - 1) * limit;
        const paginatedResults = scoredResults.slice(offset, offset + limit);

        return {
            results: paginatedResults,
            total: scoredResults.length,
        };
    }

    /**
     * Broad semantic search when FTS returns no results
     * Useful for synonyms like "thiết bị làm mát" -> "quạt điện"
     */
    private async broadSemanticSearch(
        query: string,
        queryEmbedding: number[],
        filters: SearchOptions['filters'],
        page: number,
        limit: number
    ): Promise<{ results: SearchResult[]; total: number }> {
        // Get all products and rank by semantic similarity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let queryBuilder = (supabaseAdmin as any)
            .from('canonical_products')
            .select(`
                id,
                name,
                slug,
                brand_id,
                category_id,
                image_url,
                min_price,
                max_price,
                avg_rating,
                total_reviews,
                source_count,
                brands(name),
                categories(name)
            `)
            .eq('is_active', true);

        // Apply basic filters
        queryBuilder = this.applyFilters(queryBuilder, filters);
        queryBuilder = queryBuilder.limit(200);

        const { data, error } = await queryBuilder;

        if (error || !data?.length) {
            return { results: [], total: 0 };
        }

        // Generate embeddings for all products
        const productNames = data.map((p: { name: string }) => p.name);
        const productEmbeddings = await this.embeddingService.generateBatchDocumentEmbeddings(productNames);

        // Score and rank
        const scoredResults = data.map((product: { name: string }, idx: number) => {
            const productEmb = productEmbeddings[idx];
            const score = productEmb
                ? this.embeddingService.cosineSimilarity(queryEmbedding, productEmb)
                : 0;
            return { product, score };
        });

        // Filter by minimum similarity threshold
        const minScore = 0.4;
        const filteredResults = scoredResults
            .filter((r: { score: number }) => r.score >= minScore)
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        if (filteredResults.length === 0) {
            return { results: [], total: 0 };
        }

        // Convert and enrich
        const offset = (page - 1) * limit;
        const paginatedData = filteredResults.slice(offset, offset + limit);
        const enriched = await this.enrichWithSources(paginatedData.map((r: { product: unknown }) => r.product));

        // Add scores
        enriched.forEach((result, idx) => {
            result.relevanceScore = paginatedData[idx].score;
            result.matchType = 'semantic';
        });

        return {
            results: enriched,
            total: filteredResults.length,
        };
    }

    /**
     * Hybrid Search: Combined FTS + Semantic with intelligent ranking
     */
    private async hybridSearch(
        query: string,
        filters: SearchOptions['filters'],
        sort: SearchOptions['sort'],
        page: number,
        limit: number
    ): Promise<{ results: SearchResult[]; total: number }> {
        // Check if semantic search is available
        const canDoSemantic = this.embeddingService.isAvailable();

        if (!canDoSemantic) {
            // Fall back to pure FTS
            return this.fullTextSearch(query, filters, sort, page, limit);
        }

        // Run both searches in parallel
        const [ftsResults, semanticResults] = await Promise.all([
            this.fullTextSearch(query, filters, sort, 1, limit * 2),
            this.semanticSearch(query, filters, sort, 1, limit * 2),
        ]);

        // Merge and re-rank results using RRF (Reciprocal Rank Fusion)
        const mergedMap = new Map<number, {
            result: SearchResult;
            ftsRank: number;
            semanticRank: number;
            ftsScore: number;
            semanticScore: number;
        }>();

        // Add FTS results with rank-based scores
        ftsResults.results.forEach((result, idx) => {
            mergedMap.set(result.id, {
                result,
                ftsRank: idx + 1,
                semanticRank: 0,
                ftsScore: 1 / (idx + 1),
                semanticScore: 0,
            });
        });

        // Merge semantic results
        semanticResults.results.forEach((result, idx) => {
            const semanticRank = idx + 1;
            const semanticScore = result.relevanceScore || (1 / semanticRank);
            const existing = mergedMap.get(result.id);

            if (existing) {
                existing.semanticRank = semanticRank;
                existing.semanticScore = semanticScore;
            } else {
                mergedMap.set(result.id, {
                    result,
                    ftsRank: 0,
                    semanticRank,
                    ftsScore: 0,
                    semanticScore,
                });
            }
        });

        // Calculate hybrid score using RRF with k=60
        const k = 60;
        const ranked = Array.from(mergedMap.values())
            .map(({ result, ftsRank, semanticRank, ftsScore, semanticScore }) => {
                // RRF formula: score = 1/(k+rank)
                const ftsRRF = ftsRank > 0 ? 1 / (k + ftsRank) : 0;
                const semanticRRF = semanticRank > 0 ? 1 / (k + semanticRank) : 0;

                // Weighted combination: 35% FTS + 65% Semantic for Vietnamese
                const hybridScore = 0.35 * ftsRRF + 0.65 * semanticRRF;

                // Determine match type
                const matchType: 'exact' | 'semantic' | 'hybrid' =
                    ftsRank > 0 && semanticRank > 0 ? 'hybrid' :
                        ftsRank > 0 ? 'exact' : 'semantic';

                return {
                    ...result,
                    relevanceScore: hybridScore,
                    matchType,
                };
            })
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

        // Paginate
        const offset = (page - 1) * limit;
        const paginatedResults = ranked.slice(offset, offset + limit);

        return {
            results: paginatedResults,
            total: ranked.length,
        };
    }

    /**
     * Normalize query for better search
     */
    private normalizeQuery(query: string): string {
        return query
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            // Remove special characters but keep Vietnamese diacritics
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .trim();
    }

    /**
     * Apply filters to Supabase query
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private applyFilters(query: any, filters: SearchOptions['filters']) {
        if (!filters) return query;

        if (filters.brands?.length) {
            query = query.in('brands.name', filters.brands);
        }

        if (filters.categories?.length) {
            query = query.in('categories.name', filters.categories);
        }

        if (filters.priceMin !== undefined) {
            query = query.gte('min_price', filters.priceMin);
        }

        if (filters.priceMax !== undefined) {
            query = query.lte('max_price', filters.priceMax);
        }

        if (filters.minRating !== undefined) {
            query = query.gte('avg_rating', filters.minRating);
        }

        if (filters.inStock === true) {
            query = query.gt('source_count', 0);
        }

        return query;
    }

    /**
     * Apply sorting
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private applySorting(query: any, sort: SearchOptions['sort']) {
        const field = sort?.field || 'relevance';

        switch (field) {
            case 'price_asc':
                return query.order('min_price', { ascending: true, nullsFirst: false });
            case 'price_desc':
                return query.order('max_price', { ascending: false, nullsFirst: false });
            case 'rating':
                return query.order('avg_rating', { ascending: false, nullsFirst: false });
            case 'popularity':
                return query.order('total_reviews', { ascending: false });
            case 'newest':
                return query.order('created_at', { ascending: false });
            default:
                return query.order('quality_score', { ascending: false, nullsFirst: false });
        }
    }

    /**
     * Enrich results with source data (prices from each platform)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async enrichWithSources(products: any[]): Promise<SearchResult[]> {
        if (!products.length) return [];

        const productIds = products.map(p => p.id);

        // Fetch all mappings with raw products
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mappings } = await (supabaseAdmin as any)
            .from('product_mappings')
            .select(`
                canonical_id,
                raw_products(
                    source_id,
                    price,
                    original_price,
                    discount_percent,
                    available,
                    external_url
                )
            `)
            .in('canonical_id', productIds);

        // Group by canonical_id
        const sourcesMap = new Map<number, SearchResult['sources']>();

        for (const mapping of mappings || []) {
            const raw = mapping.raw_products as unknown as {
                source_id: number;
                price: number;
                original_price?: number;
                discount_percent?: number;
                available: boolean;
                external_url: string;
            };
            if (!raw) continue;

            const canonicalId = (mapping as unknown as { canonical_id: number }).canonical_id;
            if (!sourcesMap.has(canonicalId)) {
                sourcesMap.set(canonicalId, []);
            }

            sourcesMap.get(canonicalId)!.push({
                sourceId: raw.source_id,
                sourceName: this.sourceNames[raw.source_id] || 'Unknown',
                price: raw.price,
                originalPrice: raw.original_price,
                discountPercent: raw.discount_percent,
                available: raw.available,
                externalUrl: raw.external_url,
            });
        }

        // Map to SearchResult
        return products.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            brand: p.brands?.name || null,
            category: p.categories?.name || null,
            imageUrl: p.image_url,
            minPrice: p.min_price,
            maxPrice: p.max_price,
            avgRating: p.avg_rating,
            totalReviews: p.total_reviews,
            sourceCount: p.source_count,
            sources: (sourcesMap.get(p.id) || []).sort((a, b) => a.price - b.price),
            relevanceScore: p.relevanceScore,
        }));
    }

    /**
     * Log search for analytics
     */
    private async logSearch(
        query: string,
        type: string,
        filters: SearchOptions['filters'],
        resultsCount: number,
        executionTimeMs: number
    ): Promise<void> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any).from('search_history').insert({
                query,
                query_normalized: query.toLowerCase().trim(),
                search_type: type,
                filters: filters || {},
                results_count: resultsCount,
                execution_time_ms: executionTimeMs,
            });
        } catch (error) {
            logger.debug('Failed to log search:', error);
        }
    }
}

// Singleton
let searchServiceInstance: SearchService | null = null;

export function getSearchService(): SearchService {
    if (!searchServiceInstance) {
        searchServiceInstance = new SearchService();
    }
    return searchServiceInstance;
}
