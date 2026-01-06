/**
 * Variant Manager (Gap 3 Fix)
 * Detects and manages product variants (storage, RAM, color)
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import { ProductCodeExtractor, ExtractedCode } from './codeExtractor';
import logger from '@/lib/utils/logger';

export interface VariantInfo {
    variant_key: string;
    storage?: string;
    ram?: string;
    color?: string;
    min_price: number;
    max_price: number;
    raw_product_ids: number[];
}

export interface VariantGroupResult {
    mainProduct: RawProductLike;
    variants: VariantInfo[];
    isVariantGroup: boolean;
}

interface RawProductLike {
    id: number;
    source_id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    brand_raw?: string;
    price?: number;
    rating?: number;
    review_count?: number;
    available?: boolean;
    [key: string]: unknown;
}

export class VariantManager {
    private extractor = new ProductCodeExtractor();

    /**
     * Analyze a cluster and determine if it contains variants
     */
    handleVariants(cluster: RawProductLike[]): VariantGroupResult {
        if (cluster.length <= 1) {
            return {
                mainProduct: cluster[0],
                variants: [],
                isVariantGroup: false,
            };
        }

        // Extract features for all products
        const productFeatures = cluster.map(p => ({
            product: p,
            features: this.extractVariantFeatures(p),
        }));

        // Group by variant key
        const variantGroups = new Map<string, RawProductLike[]>();
        for (const { product, features } of productFeatures) {
            const variantKey = this.createVariantKey(features);
            if (!variantGroups.has(variantKey)) {
                variantGroups.set(variantKey, []);
            }
            variantGroups.get(variantKey)!.push(product);
        }

        // If more than 1 unique variant, treat as variant group
        if (variantGroups.size > 1) {
            return this.createVariantGroup(variantGroups, cluster);
        }

        // Single variant or no variant info - merge normally
        return {
            mainProduct: this.selectBestProduct(cluster),
            variants: [],
            isVariantGroup: false,
        };
    }

    /**
     * Extract variant-relevant features from a product
     */
    private extractVariantFeatures(product: RawProductLike): ExtractedCode {
        return this.extractor.extract(product.name);
    }

    /**
     * Create a variant key from extracted features
     * Format: "storage|ram|color" with "base" for missing values
     */
    private createVariantKey(features: ExtractedCode): string {
        const storage = features.storage || 'base';
        const ram = features.ram || 'base';
        const color = features.color || 'base';
        return `${storage}|${ram}|${color}`;
    }

    /**
     * Parse a variant key back into components
     */
    parseVariantKey(key: string): { storage?: string; ram?: string; color?: string } {
        const [storage, ram, color] = key.split('|');
        return {
            storage: storage !== 'base' ? storage : undefined,
            ram: ram !== 'base' ? ram : undefined,
            color: color !== 'base' ? color : undefined,
        };
    }

    /**
     * Create a variant group from multiple variants
     */
    private createVariantGroup(
        variantGroups: Map<string, RawProductLike[]>,
        allProducts: RawProductLike[]
    ): VariantGroupResult {
        // Main product = best overall
        const mainProduct = this.selectBestProduct(allProducts);

        // Build variant info for each group
        const variants: VariantInfo[] = [];
        for (const [variantKey, products] of variantGroups) {
            const prices = products
                .map(p => p.price)
                .filter((p): p is number => p !== undefined && p > 0);

            const parsed = this.parseVariantKey(variantKey);

            variants.push({
                variant_key: variantKey,
                storage: parsed.storage,
                ram: parsed.ram,
                color: parsed.color,
                min_price: prices.length > 0 ? Math.min(...prices) : 0,
                max_price: prices.length > 0 ? Math.max(...prices) : 0,
                raw_product_ids: products.map(p => p.id),
            });
        }

        logger.debug(`[VariantManager] Found ${variants.length} variants for "${mainProduct.name.substring(0, 40)}..."`);

        return {
            mainProduct,
            variants,
            isVariantGroup: true,
        };
    }

    /**
     * Select the best product from a cluster
     */
    private selectBestProduct(products: RawProductLike[]): RawProductLike {
        return products.sort((a, b) => {
            // Prefer higher review count
            if ((b.review_count || 0) !== (a.review_count || 0)) {
                return (b.review_count || 0) - (a.review_count || 0);
            }
            // Then higher rating
            if ((b.rating || 0) !== (a.rating || 0)) {
                return (b.rating || 0) - (a.rating || 0);
            }
            // Then available products
            return (b.available ? 1 : 0) - (a.available ? 1 : 0);
        })[0];
    }

    /**
     * Save variants to database
     */
    async saveVariants(canonicalId: number, variants: VariantInfo[]): Promise<void> {
        if (variants.length === 0) return;

        const variantRecords = variants.map(v => ({
            canonical_id: canonicalId,
            variant_key: v.variant_key,
            storage: v.storage,
            ram: v.ram,
            color: v.color,
            min_price: v.min_price,
            max_price: v.max_price,
            raw_product_ids: v.raw_product_ids,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('product_variants')
            .upsert(variantRecords, { onConflict: 'canonical_id,variant_key' });

        if (error) {
            logger.error('[VariantManager] Failed to save variants:', error);
        } else {
            logger.debug(`[VariantManager] Saved ${variants.length} variants for canonical #${canonicalId}`);
        }
    }

    /**
     * Get variants for a canonical product
     */
    async getVariants(canonicalId: number): Promise<VariantInfo[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('product_variants')
            .select('*')
            .eq('canonical_id', canonicalId);

        if (error) {
            logger.error('[VariantManager] Failed to get variants:', error);
            return [];
        }

        return (data || []).map((v: {
            variant_key: string;
            storage?: string;
            ram?: string;
            color?: string;
            min_price: number;
            max_price: number;
            raw_product_ids: number[];
        }) => ({
            variant_key: v.variant_key,
            storage: v.storage,
            ram: v.ram,
            color: v.color,
            min_price: v.min_price,
            max_price: v.max_price,
            raw_product_ids: v.raw_product_ids || [],
        }));
    }

    /**
     * Detect if a product name indicates a specific variant
     */
    isSpecificVariant(productName: string): boolean {
        const features = this.extractor.extract(productName);
        // Has at least storage or color = likely specific variant
        return !!(features.storage || features.color || features.ram);
    }

    /**
     * Get variant display name (e.g., "256GB - Blue")
     */
    getVariantDisplayName(variantKey: string): string {
        const parsed = this.parseVariantKey(variantKey);
        const parts: string[] = [];

        if (parsed.storage) parts.push(parsed.storage);
        if (parsed.ram) parts.push(`RAM ${parsed.ram}`);
        if (parsed.color) parts.push(parsed.color.charAt(0).toUpperCase() + parsed.color.slice(1));

        return parts.join(' - ') || 'Standard';
    }
}

export const variantManager = new VariantManager();
