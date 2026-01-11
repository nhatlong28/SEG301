/**
 * Deduplication Engine
 * Groups similar products and creates canonical entries
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import { MLEntityMatcher, ProductData } from './mlMatcher';
import { ProductCodeExtractor } from './codeExtractor';
import { getEmbeddingService } from '../search/embeddingService';
import logger from '@/lib/utils/logger';

export interface DeduplicationStats {
    totalRaw: number;
    totalCanonical: number;
    totalMappings: number;
    reductionRate: number;
    executionTimeMs: number;
}

interface RawProduct {
    id: number;
    source_id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    brand_raw?: string;
    category_raw?: string;
    price?: number;
    rating?: number;
    specs?: Record<string, unknown>;
    review_count?: number;
    available?: boolean;
    description?: string;
    image_url?: string;
    images?: string[];
}

export class Deduplicator {
    private matcher = new MLEntityMatcher();
    private extractor = new ProductCodeExtractor();
    private embeddingService = getEmbeddingService();

    /**
     * Main deduplication workflow: 5M → 1M products
     */
    async deduplicateAll(options: {
        batchSize?: number;
        minMatchScore?: number;
    } = {}): Promise<DeduplicationStats> {
        const startTime = Date.now();
        const batchSize = options.batchSize || 1000;
        const minMatchScore = options.minMatchScore || 0.7;

        logger.info('Starting deduplication process...');

        // Get total count
        const { count: totalRaw } = await supabaseAdmin
            .from('raw_products')
            .select('*', { count: 'exact', head: true });

        logger.info(`Total raw products: ${totalRaw}`);

        let canonicalCount = 0;
        let mappingCount = 0;
        let offset = 0;

        while (true) {
            // Fetch batch of raw products
            const { data: products, error } = await supabaseAdmin
                .from('raw_products')
                .select('id, source_id, external_id, name, name_normalized, brand_raw, category_raw, price, rating, specs, review_count, available, image_url, description, images')
                .range(offset, offset + batchSize - 1)
                .order('brand_raw')
                .order('name_normalized');

            if (error) {
                logger.error('Failed to fetch products:', error);
                break;
            }

            if (!products?.length) {
                break;
            }

            // Process batch
            const batchResult = await this.processBatch(products, minMatchScore);
            canonicalCount += batchResult.canonicalCreated;
            mappingCount += batchResult.mappingsCreated;

            offset += batchSize;
            logger.info(`Processed ${offset} products, ${canonicalCount} canonical, ${mappingCount} mappings`);
        }

        const executionTimeMs = Date.now() - startTime;

        return {
            totalRaw: totalRaw || 0,
            totalCanonical: canonicalCount,
            totalMappings: mappingCount,
            reductionRate: canonicalCount > 0 ? (totalRaw || 0) / canonicalCount : 1,
            executionTimeMs,
        };
    }

    /**
     * Process a batch of products
     */
    private async processBatch(
        products: RawProduct[],
        minMatchScore: number
    ): Promise<{ canonicalCreated: number; mappingsCreated: number }> {
        let canonicalCreated = 0;
        let mappingsCreated = 0;

        // PRE-CALCULATE EMBEDDINGS FOR ENTIRE BATCH (optimization)
        let embeddings: (number[] | null)[] = [];
        if (this.embeddingService.isAvailable()) {
            logger.info(`Generating semantic embeddings for batch of ${products.length} products...`);
            embeddings = await this.embeddingService.generateBatchDocumentEmbeddings(
                products.map(p => p.name)
            );
        }

        // Group products by brand and normalized name prefix
        const groups = this.groupProducts(products);

        for (const [groupKey, groupProducts] of groups) {
            logger.debug(`Processing group: ${groupKey} with ${groupProducts.length} products`);
            // Cluster similar products within group
            const productData: ProductData[] = groupProducts.map(p => {
                // Find embedding for this product from our batch results
                const originalIndex = products.findIndex(origP => origP.id === p.id);
                const embedding = originalIndex !== -1 ? embeddings[originalIndex] : undefined;

                return {
                    externalId: p.external_id,
                    sourceId: p.source_id,
                    name: p.name,
                    brand: p.brand_raw,
                    category: p.category_raw,
                    price: p.price,
                    rating: p.rating,
                    specs: p.specs as Record<string, string>,
                    embedding: embedding || undefined,
                };
            });

            const clusters = await this.matcher.clusterProducts(productData, minMatchScore);

            // Create canonical entries for each cluster
            for (const cluster of clusters) {
                if (cluster.length === 0) continue;

                // Check if canonical already exists
                const existingCanonical = await this.findExistingCanonical(cluster[0]);

                if (existingCanonical) {
                    // Add mappings to existing canonical
                    const newMappings = await this.addMappingsToCanonical(
                        existingCanonical.id,
                        cluster,
                        groupProducts
                    );
                    mappingsCreated += newMappings;
                } else {
                    // Create new canonical entry
                    const bestProduct = this.selectBestProduct(cluster, groupProducts);
                    const canonical = await this.createCanonical(bestProduct, cluster, groupProducts);

                    if (canonical) {
                        canonicalCreated++;
                        mappingsCreated += cluster.length;
                    }
                }
            }
        }

        return { canonicalCreated, mappingsCreated };
    }

    /**
     * Group products by brand and name prefix for efficient processing
     */
    private groupProducts(products: RawProduct[]): Map<string, RawProduct[]> {
        const groups = new Map<string, RawProduct[]>();

        for (const product of products) {
            const brand = (product.brand_raw || 'unknown').toLowerCase();
            const namePrefix = (product.name_normalized || product.name)
                .toLowerCase()
                .substring(0, 20);

            const key = `${brand}:${namePrefix}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(product);
        }

        return groups;
    }

    /**
     * Select best product as canonical representative
     */
    private selectBestProduct(cluster: ProductData[], rawProducts: RawProduct[]): RawProduct {
        // Find corresponding raw products
        const clusterRaw = rawProducts.filter(rp =>
            cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id)
        );

        // Sort by quality: reviews > rating > availability
        return clusterRaw.sort((a, b) => {
            // Prefer products with more reviews
            if ((b.review_count || 0) !== (a.review_count || 0)) {
                return (b.review_count || 0) - (a.review_count || 0);
            }
            // Then by rating
            if ((b.rating || 0) !== (a.rating || 0)) {
                return (b.rating || 0) - (a.rating || 0);
            }
            // Then by availability
            return (b.available ? 1 : 0) - (a.available ? 1 : 0);
        })[0];
    }

    /**
     * Find existing canonical product that matches
     */
    private async findExistingCanonical(product: ProductData): Promise<{ id: number } | null> {
        const code = this.extractor.extract(product.name);
        const canonicalCode = this.extractor.toCanonicalCode(code);

        // Search by canonical code first if available
        if (canonicalCode) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: codeMatches } = await (supabaseAdmin as any)
                .from('canonical_products')
                .select('id')
                .eq('slug', canonicalCode)
                .limit(1);
            if (codeMatches?.length) return { id: codeMatches[0].id };
        }

        // Search by normalized name similarity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('id, name_normalized')
            .ilike('name_normalized', `%${product.name.substring(0, 30)}%`)
            .limit(5);

        if (!data?.length) return null;

        // Check similarity
        for (const candidate of data) {
            const candidateCode = this.extractor.extract(candidate.name_normalized || '');
            const similarity = this.extractor.compareExtractedCodes(code, candidateCode);

            if (similarity > 0.8) {
                return { id: candidate.id };
            }
        }

        return null;
    }

    /**
     * Create canonical product entry
     */
    private async createCanonical(
        bestProduct: RawProduct,
        cluster: ProductData[],
        rawProducts: RawProduct[]
    ): Promise<{ id: number } | null> {
        try {
            // Calculate aggregate stats
            const prices = cluster.map(p => p.price).filter((p): p is number => p !== undefined && p > 0);
            const ratings = cluster.map(p => p.rating).filter((r): r is number => r !== undefined && r > 0);

            // Extract code for slug
            const code = this.extractor.extract(bestProduct.name);
            const slug = this.extractor.toCanonicalCode(code) + '-' + Date.now();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('canonical_products')
                .insert({
                    name: bestProduct.name,
                    name_normalized: bestProduct.name_normalized,
                    slug: slug,
                    brand_id: await this.getBrandId(bestProduct.brand_raw),
                    category_id: await this.getCategoryId(bestProduct.category_raw),
                    description: bestProduct.description,
                    image_url: bestProduct.image_url,
                    images: bestProduct.images || [],
                    canonical_specs: bestProduct.specs || {},
                    min_price: prices.length > 0 ? Math.min(...prices) : null,
                    max_price: prices.length > 0 ? Math.max(...prices) : null,
                    avg_rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
                    total_reviews: 0,
                    source_count: new Set(cluster.map(p => p.sourceId)).size,
                    quality_score: this.calculateQualityScore(bestProduct),
                    is_active: true,
                })
                .select('id')
                .single();

            if (error) {
                logger.error('Failed to create canonical:', error);
                return null;
            }

            // Create mappings for all products in cluster
            const mappings = rawProducts
                .filter(rp => cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id))
                .map(rp => ({
                    canonical_id: data.id,
                    raw_product_id: rp.id,
                    confidence_score: 0.9,
                    matching_method: 'ml_classifier',
                }));

            if (mappings.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseAdmin as any).from('product_mappings').insert(mappings);
            }

            return { id: data.id };
        } catch (error) {
            logger.error('Error creating canonical:', error);
            return null;
        }
    }

    /**
     * Add mappings to existing canonical
     */
    private async addMappingsToCanonical(
        canonicalId: number,
        cluster: ProductData[],
        rawProducts: RawProduct[]
    ): Promise<number> {
        const mappings = rawProducts
            .filter(rp => cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id))
            .map(rp => ({
                canonical_id: canonicalId,
                raw_product_id: rp.id,
                confidence_score: 0.85,
                matching_method: 'ml_classifier',
            }));

        if (mappings.length === 0) return 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('product_mappings')
            .upsert(mappings, { onConflict: 'canonical_id,raw_product_id' });

        if (error) {
            logger.error('Failed to add mappings:', error);
            return 0;
        }

        return mappings.length;
    }

    private async getBrandId(brandName?: string): Promise<number | null> {
        if (!brandName) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('brands')
            .select('id')
            .ilike('name', brandName)
            .single();

        return data?.id || null;
    }

    private async getCategoryId(categoryName?: string): Promise<number | null> {
        if (!categoryName) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('categories')
            .select('id')
            .ilike('name', `%${categoryName}%`)
            .single();

        return data?.id || null;
    }

    private calculateQualityScore(product: RawProduct): number {
        let score = 0;

        // Has rating (0-0.2)
        if (product.rating) {
            score += Math.min(product.rating / 5, 1) * 0.2;
        }

        // Has reviews (0-0.3)
        if (product.review_count) {
            score += Math.min(product.review_count / 1000, 1) * 0.3;
        }

        // Available (0-0.2)
        if (product.available) {
            score += 0.2;
        }

        // Has complete specs (0-0.15)
        const specCount = Object.keys(product.specs || {}).length;
        if (specCount > 3) {
            score += 0.15;
        } else if (specCount > 0) {
            score += 0.1;
        }

        // Has image (0-0.15)
        if (product.image_url) {
            score += 0.15;
        }

        return Math.min(score, 1);
    }
}
