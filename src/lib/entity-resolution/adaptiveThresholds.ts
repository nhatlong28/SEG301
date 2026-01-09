/**
 * Adaptive Threshold Manager (Gap 9 Fix)
 * Category-specific and dynamic matching thresholds
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export interface ThresholdConfig {
    default: number;
    categories: Record<string, number>;
    sourcePairs: Record<string, number>;
}

export class AdaptiveThresholdManager {
    private thresholds: Map<string, number> = new Map();
    private initialized = false;

    /**
     * Initialize default thresholds
     */
    async initializeThresholds(): Promise<void> {
        if (this.initialized) return;

        // Default global threshold
        this.thresholds.set('default', 0.75);

        // Category-specific thresholds (tuned for Vietnamese e-commerce)
        this.thresholds.set('category:phone', 0.80);      // Phones: stricter (many variants)
        this.thresholds.set('category:laptop', 0.78);     // Laptops: stricter
        this.thresholds.set('category:tablet', 0.78);     // Tablets: stricter
        this.thresholds.set('category:audio', 0.72);      // Audio: looser (less variants)
        this.thresholds.set('category:watch', 0.75);      // Watches: default
        this.thresholds.set('category:tv', 0.80);         // TVs: stricter (model numbers matter)
        this.thresholds.set('category:appliance', 0.82);  // Appliances: stricter

        // Source-pair specific thresholds
        // (Some sources have similar naming conventions, others don't)
        this.thresholds.set('sources:tiki_shopee', 0.72);    // Different naming styles
        this.thresholds.set('sources:tiki_lazada', 0.70);    // Very different
        this.thresholds.set('sources:shopee_lazada', 0.68);  // Very different
        this.thresholds.set('sources:cellphones_dienmayxanh', 0.78); // Similar style

        this.initialized = true;
        logger.info('[ThresholdManager] Initialized adaptive thresholds');
    }

    /**
     * Get matching threshold for a specific context
     */
    async getThreshold(
        category?: string,
        source1?: string,
        source2?: string
    ): Promise<number> {
        await this.initializeThresholds();

        // First check source-pair specific threshold
        if (source1 && source2) {
            const sourceKey = this.getSourcePairKey(source1, source2);
            if (this.thresholds.has(`sources:${sourceKey}`)) {
                return this.thresholds.get(`sources:${sourceKey}`)!;
            }
        }

        // Then check category threshold
        if (category) {
            const normalizedCat = this.normalizeCategory(category);
            if (this.thresholds.has(`category:${normalizedCat}`)) {
                return this.thresholds.get(`category:${normalizedCat}`)!;
            }
        }

        // Fall back to default
        return this.thresholds.get('default') || 0.75;
    }

    /**
     * Get source pair key (alphabetically sorted for consistency)
     */
    private getSourcePairKey(source1: string, source2: string): string {
        const sources = [source1.toLowerCase(), source2.toLowerCase()].sort();
        return `${sources[0]}_${sources[1]}`;
    }

    /**
     * Normalize category name
     */
    private normalizeCategory(category: string): string {
        const lowerCat = category.toLowerCase();

        const categoryMap: Record<string, string[]> = {
            audio: ['tai nghe', 'headphone', 'earphone', 'airpods', 'speaker', 'loa'],
            phone: ['điện thoại', 'mobile', 'smartphone', 'phone'],
            laptop: ['laptop', 'máy tính xách tay', 'macbook', 'notebook'],
            tablet: ['tablet', 'máy tính bảng', 'ipad'],
            watch: ['đồng hồ', 'smartwatch', 'watch', 'apple watch'],
            tv: ['tivi', 'tv', 'television', 'smart tv'],
            appliance: ['tủ lạnh', 'máy giặt', 'điều hòa', 'fridge', 'washer', 'ac'],
        };

        for (const [normalized, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(kw => lowerCat.includes(kw))) {
                return normalized;
            }
        }

        return 'default';
    }

    /**
     * Update threshold dynamically
     */
    setThreshold(key: string, value: number): void {
        this.thresholds.set(key, value);
        logger.info(`[ThresholdManager] Updated threshold ${key} = ${value}`);
    }

    /**
     * Get all current thresholds
     */
    getAllThresholds(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [key, value] of this.thresholds) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Record match result for future threshold tuning
     */
    async recordMatchResult(
        category: string,
        source1: string,
        source2: string,
        score: number,
        wasCorrect: boolean
    ): Promise<void> {
        // Store in database for future analysis
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any).rpc('record_match_result', {
                p_category: category,
                p_source1: source1,
                p_source2: source2,
                p_score: score,
                p_correct: wasCorrect,
            });
        } catch {
            // RPC might not exist, that's okay
            logger.debug('[ThresholdManager] Match result not recorded (RPC not available)');
        }
    }

    /**
     * Calculate optimal threshold based on historical data
     */
    async calculateOptimalThreshold(
        category?: string,
        source1?: string,
        source2?: string
    ): Promise<{ threshold: number; confidence: number }> {
        // This would analyze historical match results to find optimal threshold
        // For now, return the current threshold with low confidence
        const current = await this.getThreshold(category, source1, source2);
        return {
            threshold: current,
            confidence: 0.5, // Low confidence = needs more data
        };
    }

    /**
     * Suggest threshold adjustment based on recent accuracy
     */
    async suggestThresholdAdjustment(): Promise<Array<{
        key: string;
        current: number;
        suggested: number;
        reason: string;
    }>> {
        // This would analyze false positive/negative rates and suggest adjustments
        // Placeholder for future ML-based optimization
        return [];
    }
}

export const thresholdManager = new AdaptiveThresholdManager();
