/**
 * Canonical Quality Scorer (Gap 6 Fix)
 * Calculates quality score and identifies issues for canonical products
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import { ProductCodeExtractor } from './codeExtractor';
import logger from '@/lib/utils/logger';

export interface QualityResult {
    quality_score: number;  // 0-100
    confidence: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    needs_review: boolean;
}

interface RawProductLike {
    id: number;
    price?: number;
    rating?: number;
    review_count?: number;
    available?: boolean;
    name?: string;
    specs?: Record<string, unknown>;
}

interface CanonicalLike {
    id: number;
    name?: string;
    name_normalized?: string;
    brand_id?: number;
    category_id?: number;
    description?: string;
    image_url?: string;
    min_price?: number;
    max_price?: number;
    avg_rating?: number;
    total_reviews?: number;
    source_count?: number;
}

export class CanonicalQualityScorer {
    private extractor = new ProductCodeExtractor();

    /**
     * Calculate comprehensive quality score for a canonical product
     */
    calculateQuality(canonical: CanonicalLike, cluster: RawProductLike[]): QualityResult {
        let score = 100;
        const issues: string[] = [];

        // 1. Source coverage (10 points)
        const sourceScore = Math.min((canonical.source_count || 1) / 5, 1) * 10;
        score -= 10 - sourceScore;
        if ((canonical.source_count || 1) === 1) {
            issues.push('Single source coverage');
        }

        // 2. Price consistency (20 points)
        const priceVariance = this.calculatePriceVariance(cluster);
        if (priceVariance > 0.3) {
            score -= 15;
            issues.push('High price variance (>30%)');
        } else if (priceVariance > 0.15) {
            score -= 5;
            issues.push('Moderate price variance (>15%)');
        }

        // 3. Specification consistency (15 points)
        const specConsistency = this.checkSpecConsistency(cluster);
        if (specConsistency < 0.7) {
            score -= 15;
            issues.push('Inconsistent specifications');
        } else if (specConsistency < 0.85) {
            score -= 7;
        }

        // 4. Review count (15 points)
        if ((canonical.total_reviews || 0) < 5) {
            score -= 10;
            issues.push('Very low review count (<5)');
        } else if ((canonical.total_reviews || 0) < 20) {
            score -= 5;
            issues.push('Low review count (<20)');
        }

        // 5. Availability (10 points)
        const availabilityRate = cluster.filter(p => p.available).length / cluster.length;
        if (availabilityRate < 0.3) {
            score -= 10;
            issues.push('Low availability (<30%)');
        } else if (availabilityRate < 0.5) {
            score -= 5;
            issues.push('Moderate availability (<50%)');
        }

        // 6. Data completeness (15 points)
        const completeness = this.checkDataCompleteness(canonical);
        if (completeness < 0.5) {
            score -= 15;
            issues.push('Missing critical data');
        } else if (completeness < 0.7) {
            score -= 7;
            issues.push('Incomplete product data');
        }

        // 7. Rating confidence (10 points)
        const ratingConfidence = this.getRatingConfidence(canonical.total_reviews || 0);
        if (ratingConfidence < 0.3) {
            score -= 7;
            issues.push('Low confidence rating');
        } else if (ratingConfidence < 0.5) {
            score -= 3;
        }

        // 8. Name quality (5 points)
        const nameQuality = this.checkNameQuality(canonical.name || '');
        if (nameQuality < 0.5) {
            score -= 5;
            issues.push('Poor product name quality');
        }

        // Ensure score is within bounds
        score = Math.max(0, Math.min(100, score));

        return {
            quality_score: Math.round(score),
            confidence: this.getConfidenceLevel(score),
            issues,
            needs_review: score < 60 || issues.length > 2,
        };
    }

    /**
     * Calculate price variance coefficient
     */
    private calculatePriceVariance(cluster: RawProductLike[]): number {
        const prices = cluster
            .map(p => p.price)
            .filter((p): p is number => p !== undefined && p > 0);

        if (prices.length < 2) return 0;

        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);

        return stdDev / mean; // Coefficient of variation
    }

    /**
     * Check specification consistency across cluster
     */
    private checkSpecConsistency(cluster: RawProductLike[]): number {
        const allSpecs = cluster
            .map(p => p.specs)
            .filter((s): s is Record<string, unknown> => s !== undefined && Object.keys(s).length > 0);

        if (allSpecs.length < 2) return 1;

        // Extract key specs from names
        const extractedSpecs = cluster.map(p => this.extractor.extract(p.name || ''));

        // Check consistency of key fields
        const specKeys = ['storage', 'ram'] as const;
        let consistentCount = 0;
        let totalSpecs = 0;

        for (const key of specKeys) {
            const values = extractedSpecs
                .map(s => s[key])
                .filter((v): v is string => v !== undefined);

            if (values.length === 0) continue;

            totalSpecs++;
            const uniqueValues = new Set(values);
            if (uniqueValues.size === 1) {
                consistentCount++;
            }
        }

        return totalSpecs === 0 ? 1 : consistentCount / totalSpecs;
    }

    /**
     * Check data completeness
     */
    private checkDataCompleteness(canonical: CanonicalLike): number {
        const importantFields = [
            'name',
            'brand_id',
            'category_id',
            'description',
            'min_price',
            'max_price',
            'avg_rating',
            'image_url',
        ] as const;

        let filledCount = 0;
        for (const field of importantFields) {
            const value = canonical[field];
            if (value !== undefined && value !== null) {
                if (typeof value === 'string' && value.trim().length > 0) {
                    filledCount++;
                } else if (typeof value === 'number' && value > 0) {
                    filledCount++;
                }
            }
        }

        return filledCount / importantFields.length;
    }

    /**
     * Get rating confidence based on review count
     * More reviews = higher confidence
     */
    private getRatingConfidence(reviewCount: number): number {
        if (reviewCount >= 500) return 1;
        if (reviewCount >= 100) return 0.9;
        if (reviewCount >= 50) return 0.7;
        if (reviewCount >= 20) return 0.5;
        if (reviewCount >= 5) return 0.3;
        return 0.1;
    }

    /**
     * Check product name quality
     */
    private checkNameQuality(name: string): number {
        if (!name || name.length < 10) return 0;

        let score = 1;

        // Check for excessive special characters
        const specialCharRatio = (name.match(/[^\p{L}\p{N}\s]/gu) || []).length / name.length;
        if (specialCharRatio > 0.2) score -= 0.3;

        // Check for all caps
        const upperRatio = (name.match(/[A-Z]/g) || []).length / name.length;
        if (upperRatio > 0.8) score -= 0.2;

        // Check for very short name
        if (name.length < 20) score -= 0.2;

        // Extract features - more features = better name
        const extracted = this.extractor.extract(name);
        const featuresFound = [extracted.brand, extracted.model, extracted.storage, extracted.color]
            .filter(Boolean).length;
        score += featuresFound * 0.1;

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Get confidence level string
     */
    private getConfidenceLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
        if (score >= 85) return 'excellent';
        if (score >= 70) return 'good';
        if (score >= 50) return 'fair';
        return 'poor';
    }

    /**
     * Update quality score in database
     */
    async updateCanonicalQuality(
        canonicalId: number,
        qualityResult: QualityResult
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('canonical_products')
            .update({
                quality_score: qualityResult.quality_score,
                quality_issues: qualityResult.issues,
                needs_review: qualityResult.needs_review,
            })
            .eq('id', canonicalId);

        if (error) {
            logger.error(`[QualityScorer] Failed to update quality for #${canonicalId}:`, error);
        }
    }

    /**
     * Batch update quality scores
     */
    async batchUpdateQuality(
        updates: Array<{ canonicalId: number; qualityResult: QualityResult }>
    ): Promise<void> {
        for (const update of updates) {
            await this.updateCanonicalQuality(update.canonicalId, update.qualityResult);
        }
    }

    /**
     * Get products needing review
     */
    async getProductsNeedingReview(limit: number = 50): Promise<Array<{
        id: number;
        name: string;
        quality_score: number;
        quality_issues: string[];
    }>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('id, name, quality_score, quality_issues')
            .eq('needs_review', true)
            .order('quality_score', { ascending: true })
            .limit(limit);

        if (error) {
            logger.error('[QualityScorer] Failed to get products needing review:', error);
            return [];
        }

        return data || [];
    }
}

export const qualityScorer = new CanonicalQualityScorer();
