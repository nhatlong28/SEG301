/**
 * Facet Service - Dynamic Filter Generation
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export interface Facet {
    name: string;
    displayName: string;
    type: 'checkbox' | 'range' | 'radio';
    values: Array<{
        value: string;
        label: string;
        count: number;
    }>;
}

export interface FacetResponse {
    facets: Facet[];
    priceRange: {
        min: number;
        max: number;
    };
    ratingRange: {
        min: number;
        max: number;
    };
}

interface FacetProduct {
    brand_id: number | null;
    category_id: number | null;
    min_price: number | null;
    max_price: number | null;
    avg_rating: number | null;
    source_count: number | null;
    brands: { name: string } | null;
    categories: { name: string } | null;
}

export class FacetService {
    /**
     * Generate dynamic facets based on search query
     */
    async generateFacets(
        query: string,
        existingFilters: Record<string, string[]> = {}
    ): Promise<FacetResponse> {
        try {
            // Get matching products for facet calculation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let queryBuilder = (supabaseAdmin as any)
                .from('canonical_products')
                .select(`
          brand_id,
          category_id,
          min_price,
          max_price,
          avg_rating,
          source_count,
          brands(name),
          categories(name)
        `)
                .eq('is_active', true);

            // Apply text search if query provided
            if (query) {
                queryBuilder = queryBuilder.textSearch('name', query.split(' ').join(' & '), {
                    type: 'websearch',
                    config: 'simple',
                });
            }

            // Apply existing filters for drill-down
            if (existingFilters.brands?.length) {
                queryBuilder = queryBuilder.in('brands.name', existingFilters.brands);
            }
            if (existingFilters.categories?.length) {
                queryBuilder = queryBuilder.in('categories.name', existingFilters.categories);
            }

            const { data: products, error } = await queryBuilder.limit(10000) as { data: FacetProduct[] | null; error: unknown };

            if (error || !products?.length) {
                return this.getDefaultFacets();
            }

            // Aggregate facet values
            const brandCounts = new Map<string, number>();
            const categoryCounts = new Map<string, number>();
            const sourceCountDist = new Map<number, number>();
            let minPrice = Infinity;
            let maxPrice = 0;
            let minRating = 5;
            let maxRating = 0;

            for (const product of products) {
                // Brand
                const brandName = product.brands?.name;
                if (brandName) {
                    brandCounts.set(brandName, (brandCounts.get(brandName) || 0) + 1);
                }

                // Category
                const categoryName = product.categories?.name;
                if (categoryName) {
                    categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
                }

                // Source count
                if (product.source_count) {
                    sourceCountDist.set(product.source_count, (sourceCountDist.get(product.source_count) || 0) + 1);
                }

                // Price range
                if (product.min_price) {
                    minPrice = Math.min(minPrice, product.min_price);
                    maxPrice = Math.max(maxPrice, product.max_price || product.min_price);
                }

                // Rating range
                if (product.avg_rating) {
                    minRating = Math.min(minRating, product.avg_rating);
                    maxRating = Math.max(maxRating, product.avg_rating);
                }
            }

            const facets: Facet[] = [];

            // Brand facet
            if (brandCounts.size > 0) {
                facets.push({
                    name: 'brand',
                    displayName: '🏢 Thương Hiệu',
                    type: 'checkbox',
                    values: Array.from(brandCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 15)
                        .map(([value, count]) => ({
                            value,
                            label: value,
                            count,
                        })),
                });
            }

            // Category facet
            if (categoryCounts.size > 0) {
                facets.push({
                    name: 'category',
                    displayName: '📁 Danh Mục',
                    type: 'checkbox',
                    values: Array.from(categoryCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([value, count]) => ({
                            value,
                            label: value,
                            count,
                        })),
                });
            }

            // Rating facet
            facets.push({
                name: 'rating',
                displayName: '⭐ Đánh Giá',
                type: 'radio',
                values: [
                    { value: '4', label: 'Từ 4 sao', count: products.filter(p => (p.avg_rating || 0) >= 4).length },
                    { value: '3', label: 'Từ 3 sao', count: products.filter(p => (p.avg_rating || 0) >= 3).length },
                    { value: '2', label: 'Từ 2 sao', count: products.filter(p => (p.avg_rating || 0) >= 2).length },
                ],
            });

            // Source count facet
            if (sourceCountDist.size > 1) {
                facets.push({
                    name: 'sources',
                    displayName: '🛒 Số Nguồn',
                    type: 'checkbox',
                    values: Array.from(sourceCountDist.entries())
                        .sort((a, b) => b[0] - a[0])
                        .map(([value, count]) => ({
                            value: value.toString(),
                            label: `${value} sàn`,
                            count,
                        })),
                });
            }

            // Availability facet
            facets.push({
                name: 'inStock',
                displayName: '📦 Tình Trạng',
                type: 'checkbox',
                values: [
                    { value: 'true', label: 'Còn hàng', count: products.length },
                ],
            });

            return {
                facets,
                priceRange: {
                    min: minPrice === Infinity ? 0 : minPrice,
                    max: maxPrice,
                },
                ratingRange: {
                    min: minRating === 5 ? 0 : minRating,
                    max: maxRating,
                },
            };
        } catch (error) {
            logger.error('Facet generation error:', error);
            return this.getDefaultFacets();
        }
    }

    /**
     * Get popular brands for homepage
     */
    async getPopularBrands(limit = 10): Promise<Array<{ name: string; count: number }>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('brands')
            .select(`
        name,
        canonical_products(count)
      `)
            .eq('is_verified', true)
            .limit(limit);

        return (data || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((b: any) => ({
                name: b.name,
                count: (b.canonical_products as unknown as { count: number }[])?.[0]?.count || 0,
            }))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => b.count - a.count);
    }

    /**
     * Get popular categories for navigation
     */
    async getPopularCategories(): Promise<Array<{ name: string; slug: string; icon?: string; count: number }>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('categories')
            .select(`
        name,
        slug,
        icon,
        canonical_products(count)
      `)
            .eq('is_active', true)
            .eq('level', 1);

        return (data || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((c: any) => ({
                name: c.name,
                slug: c.slug,
                icon: c.icon,
                count: (c.canonical_products as unknown as { count: number }[])?.[0]?.count || 0,
            }))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => b.count - a.count);
    }

    private getDefaultFacets(): FacetResponse {
        return {
            facets: [],
            priceRange: { min: 0, max: 50000000 },
            ratingRange: { min: 0, max: 5 },
        };
    }
}
