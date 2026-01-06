/**
 * Intra-Source Deduplicator (Gap 5 Fix)
 * Detects and merges duplicates within the same source
 */

import { StringMatcher } from './similarity';
import logger from '@/lib/utils/logger';

interface RawProductLike {
    id: number;
    source_id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    brand_raw?: string;
    category_raw?: string;
    price?: number;
    rating?: number;
    review_count?: number;
    available?: boolean;
    url?: string;
    shop_id?: string;
    specs?: Record<string, unknown>;
    images?: string[];
    [key: string]: unknown;
}

export interface DeduplicatedProduct extends RawProductLike {
    duplicate_count: number;
    duplicate_ids: number[];
    duplicate_shop_ids: string[];
}

export class IntraSourceDeduplicator {
    private stringMatcher = new StringMatcher();

    /**
     * Deduplicate products within each source
     * Returns deduplicated list with best representative from each duplicate group
     */
    deduplicateWithinSource(products: RawProductLike[]): DeduplicatedProduct[] {
        // Group by source
        const bySource = new Map<number, RawProductLike[]>();
        for (const p of products) {
            if (!bySource.has(p.source_id)) {
                bySource.set(p.source_id, []);
            }
            bySource.get(p.source_id)!.push(p);
        }

        // Deduplicate within each source
        const deduped: DeduplicatedProduct[] = [];
        for (const [sourceId, sourceProducts] of bySource) {
            const clusters = this.findDuplicateClusters(sourceProducts);
            let dupCount = 0;

            for (const cluster of clusters) {
                if (cluster.length === 1) {
                    deduped.push({
                        ...cluster[0],
                        duplicate_count: 1,
                        duplicate_ids: [cluster[0].id],
                        duplicate_shop_ids: cluster[0].shop_id ? [cluster[0].shop_id] : [],
                    });
                } else {
                    // Multiple listings of same product
                    const best = this.selectBestWithinSource(cluster);
                    deduped.push({
                        ...best,
                        duplicate_count: cluster.length,
                        duplicate_ids: cluster.map(p => p.id),
                        duplicate_shop_ids: cluster
                            .map(p => p.shop_id)
                            .filter((s): s is string => s !== undefined),
                    });
                    dupCount += cluster.length - 1;
                }
            }

            if (dupCount > 0) {
                logger.info(`[IntraSourceDedup] Source ${sourceId}: Merged ${dupCount} duplicates from ${sourceProducts.length} products`);
            }
        }

        return deduped;
    }

    /**
     * Find clusters of duplicate products within a source
     */
    private findDuplicateClusters(sourceProducts: RawProductLike[]): RawProductLike[][] {
        const clusters: RawProductLike[][] = [];
        const visited = new Set<number>();

        for (let i = 0; i < sourceProducts.length; i++) {
            if (visited.has(i)) continue;

            const cluster = [sourceProducts[i]];
            visited.add(i);

            for (let j = i + 1; j < sourceProducts.length; j++) {
                if (visited.has(j)) continue;

                if (this.isDuplicateWithinSource(sourceProducts[i], sourceProducts[j])) {
                    cluster.push(sourceProducts[j]);
                    visited.add(j);
                }
            }

            clusters.push(cluster);
        }

        return clusters;
    }

    /**
     * Determine if two products from the same source are duplicates
     */
    isDuplicateWithinSource(a: RawProductLike, b: RawProductLike): boolean {
        // Different sources = not intra-source duplicate
        if (a.source_id !== b.source_id) {
            return false;
        }

        // Same external ID = definite duplicate
        if (a.external_id && a.external_id === b.external_id) {
            return true;
        }

        // Same URL = definite duplicate
        if (a.url && a.url === b.url) {
            return true;
        }

        // Exact price match + high name similarity
        if (a.price && b.price && a.price === b.price) {
            const nameSim = this.stringMatcher.combinedSimilarity(
                a.name_normalized || a.name,
                b.name_normalized || b.name
            );
            if (nameSim > 0.9) {
                return true;
            }
        }

        // Very high name similarity (near-identical)
        const nameSim = this.stringMatcher.combinedSimilarity(
            a.name_normalized || a.name,
            b.name_normalized || b.name
        );
        if (nameSim > 0.95) {
            // Also check price within 2% if available
            if (a.price && b.price) {
                const priceDiff = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
                if (priceDiff < 0.02) {
                    return true;
                }
            } else {
                return true; // No price to compare, trust name similarity
            }
        }

        return false;
    }

    /**
     * Select the best product from a cluster of duplicates within same source
     */
    private selectBestWithinSource(cluster: RawProductLike[]): RawProductLike {
        return cluster.sort((a, b) => {
            // Prefer higher rating
            if ((b.rating || 0) !== (a.rating || 0)) {
                return (b.rating || 0) - (a.rating || 0);
            }
            // Then more reviews
            if ((b.review_count || 0) !== (a.review_count || 0)) {
                return (b.review_count || 0) - (a.review_count || 0);
            }
            // Then in stock
            return (b.available ? 1 : 0) - (a.available ? 1 : 0);
        })[0];
    }

    /**
     * Get duplicate statistics
     */
    getStats(original: RawProductLike[], deduped: DeduplicatedProduct[]): {
        original_count: number;
        deduped_count: number;
        duplicates_removed: number;
        reduction_rate: number;
    } {
        const duplicatesRemoved = original.length - deduped.length;
        return {
            original_count: original.length,
            deduped_count: deduped.length,
            duplicates_removed: duplicatesRemoved,
            reduction_rate: duplicatesRemoved / original.length,
        };
    }
}

export const intraSourceDeduplicator = new IntraSourceDeduplicator();
