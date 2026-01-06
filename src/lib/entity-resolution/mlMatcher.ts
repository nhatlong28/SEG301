import { ProductCodeExtractor, ExtractedCode } from './codeExtractor';
import { StringMatcher } from './similarity';
import { getEmbeddingService } from '../search/embeddingService';
import logger from '@/lib/utils/logger';

export interface MatchFeatures {
    nameStringSimilarity: number;
    semanticSimilarity: number;
    brandMatch: number;
    codeMatch: number;
    priceProximity: number;
    specsMatch: number;
    categoryMatch: number;
    ratingProximity: number;
}

export interface MatchResult {
    score: number;
    method: 'exact_match' | 'code_extract' | 'ml_classifier' | 'high_similarity' | 'moderate_similarity' | 'no_match';
    confidence: 'high' | 'medium' | 'low';
    features: MatchFeatures;
}

export class MLEntityMatcher {
    private extractor = new ProductCodeExtractor();
    private stringMatcher = new StringMatcher();
    private embeddingService = getEmbeddingService();

    // Weights for rule-based matching (can be learned from labeled data)
    // Weights for rule-based matching (tuned for precision)
    private readonly weights = {
        nameStringSimilarity: 0.25, // Increased from 0.2
        semanticSimilarity: 0.2,    // Decreased from 0.3 (too generous for same-brand)
        brandMatch: 0.1,
        codeMatch: 0.25,            // Increased from 0.2 (crucial for variants)
        priceProximity: 0.15,       // Increased from 0.1
        specsMatch: 0.05,
        categoryMatch: 0.05,        // Increased from 0.02
        ratingProximity: 0.0,       // Removed (irrelevant for identity)
    };

    /**
     * Generate features for machine learning model
     */
    async generateFeatures(prod1: ProductData, prod2: ProductData): Promise<MatchFeatures> {
        const code1 = this.extractor.extract(prod1.name);
        const code2 = this.extractor.extract(prod2.name);

        let semanticScore = 0;

        // Use pre-calculated embeddings if available
        if (prod1.embedding && prod2.embedding) {
            semanticScore = this.embeddingService.cosineSimilarity(prod1.embedding, prod2.embedding);
        } else if (this.embeddingService.isAvailable()) {
            // Fallback for individual calls (though not ideal for large batches)
            try {
                const [emb1, emb2] = await Promise.all([
                    this.embeddingService.generateDocumentEmbedding(prod1.name),
                    this.embeddingService.generateDocumentEmbedding(prod2.name)
                ]);

                if (emb1 && emb2) {
                    semanticScore = this.embeddingService.cosineSimilarity(emb1, emb2);
                }
            } catch (e) {
                logger.warn('Failed to generate semantic embedding for matching');
            }
        }

        return {
            // String similarity between names (0-1)
            nameStringSimilarity: this.stringMatcher.combinedSimilarity(prod1.name, prod2.name),

            // Semantic similarity from HF model (0-1)
            semanticSimilarity: semanticScore,

            // Brand match (0 or 1)
            brandMatch: this.getBrandMatch(code1, code2, prod1.brand, prod2.brand),

            // Code matching (model + storage + color)
            codeMatch: this.extractor.compareExtractedCodes(code1, code2),

            // Price proximity (0-1, 1 = same price)
            priceProximity: this.getPriceProximity(prod1.price, prod2.price),

            // Specs match (0-1)
            specsMatch: this.getSpecsMatch(prod1.specs, prod2.specs),

            // Category match (0 or 1)
            categoryMatch: this.getCategoryMatch(prod1.category, prod2.category),

            // Rating proximity (0-1)
            ratingProximity: 0,
        };
    }

    /**
     * Score a potential match between two products
     */
    async scoreMatch(prod1: ProductData, prod2: ProductData): Promise<MatchResult> {
        const features = await this.generateFeatures(prod1, prod2);

        // Category Mismatch Penalty: If categories are present and clearly different, hard penalize
        if (features.categoryMatch === 0 && prod1.category && prod2.category) {
            return { score: 0.1, method: 'no_match', confidence: 'high', features };
        }

        // Price Mismatch Penalty: If price difference is massive (>50%), it's likely different products (e.g. accessory vs main product)
        if (features.priceProximity === 0) {
            return { score: 0.2, method: 'no_match', confidence: 'high', features };
        }

        // Calculate weighted score
        let weightedScore = 0;
        let totalWeight = 0;
        for (const [key, weight] of Object.entries(this.weights)) {
            weightedScore += features[key as keyof MatchFeatures] * weight;
            totalWeight += weight;
        }

        // Normalize if weights don't sum to 1 (they currently sum to 1.05)
        weightedScore = weightedScore / totalWeight;

        // Determine match method and confidence
        let method: MatchResult['method'];
        let confidence: MatchResult['confidence'];

        // Rule-based classification
        if (features.codeMatch === 1 && features.brandMatch === 1 && features.priceProximity > 0.8) {
            // Perfect code match (Variant match)
            method = 'code_extract';
            confidence = 'high';
            weightedScore = Math.max(weightedScore, 0.98);
        } else if (features.brandMatch === 1 && (features.nameStringSimilarity > 0.85 || features.semanticSimilarity > 0.96)) {
            // High textual/semantic match with same brand
            method = 'exact_match';
            confidence = 'high';
            weightedScore = Math.max(weightedScore, 0.9);
        } else if (features.codeMatch > 0.8 && features.priceProximity > 0.7) {
            // Strong code match
            method = 'code_extract';
            confidence = 'high';
            weightedScore = Math.max(weightedScore, 0.85);
        } else if (weightedScore > 0.75) {
            method = 'ml_classifier';
            confidence = 'high';
        } else if (weightedScore > 0.65) {
            method = 'high_similarity';
            confidence = 'medium';
        } else if (weightedScore > 0.5) {
            method = 'moderate_similarity';
            confidence = 'low';
        } else {
            method = 'no_match';
            confidence = 'low';
        }

        return {
            score: Math.min(weightedScore, 1),
            method,
            confidence,
            features,
        };
    }

    private getCategoryMatch(cat1?: string, cat2?: string): number {
        if (!cat1 || !cat2) return 0.5; // Uncertain
        const c1 = cat1.toLowerCase().trim();
        const c2 = cat2.toLowerCase().trim();

        if (c1 === c2) return 1;
        if (c1.includes(c2) || c2.includes(c1)) return 0.9;

        // Basic category grouping check
        const groups = [
            ['điện thoại', 'mobile', 'smartphone', 'phone'],
            ['laptop', 'máy tính xách tay', 'macbook', 'notebook'],
            ['tai nghe', 'headphone', 'earphone', 'airpods', 'headset', 'audio'],
            ['đồng hồ', 'smartwatch', 'watch'],
            ['tivi', 'tv', 'television'],
            ['tủ lạnh', 'fridge', 'refrigerator'],
            ['máy giặt', 'washing', 'washer']
        ];

        for (const group of groups) {
            const hasC1 = group.some(g => c1.includes(g));
            const hasC2 = group.some(g => c2.includes(g));
            if (hasC1 && hasC2) return 1; // Both in same group
            if (hasC1 !== hasC2) return 0; // Different groups (Strong mismatch)
        }

        return 0.5; // Unknown relationship
    }

    /**
     * Find best matches for a product in a list of candidates
     */
    async findBestMatches(
        product: ProductData,
        candidates: ProductData[],
        options: {
            minScore?: number;
            maxResults?: number;
        } = {}
    ): Promise<Array<{ product: ProductData; result: MatchResult }>> {
        const minScore = options.minScore ?? 0.5;
        const maxResults = options.maxResults ?? 10;

        const matches: Array<{ product: ProductData; result: MatchResult }> = [];

        for (const candidate of candidates) {
            // Skip same product
            if (product.externalId === candidate.externalId && product.sourceId === candidate.sourceId) {
                continue;
            }

            // Quick pre-filter
            if (!this.stringMatcher.quickSimilarityCheck(product.name, candidate.name, 0.2)) {
                continue;
            }

            const result = await this.scoreMatch(product, candidate);

            if (result.score >= minScore) {
                matches.push({ product: candidate, result });
            }
        }

        // Sort by score descending
        matches.sort((a, b) => b.result.score - a.result.score);

        return matches.slice(0, maxResults);
    }

    /**
     * Cluster similar products together
     */
    async clusterProducts(products: ProductData[], minScore = 0.7): Promise<ProductData[][]> {
        const clusters: ProductData[][] = [];
        const assigned = new Set<string>();

        for (const product of products) {
            const productKey = `${product.sourceId}-${product.externalId}`;

            if (assigned.has(productKey)) continue;

            const cluster: ProductData[] = [product];
            assigned.add(productKey);

            // Find all matches for this product
            for (const candidate of products) {
                const candidateKey = `${candidate.sourceId}-${candidate.externalId}`;

                if (assigned.has(candidateKey)) continue;

                const result = await this.scoreMatch(product, candidate);

                if (result.score >= minScore) {
                    cluster.push(candidate);
                    assigned.add(candidateKey);
                }
            }

            clusters.push(cluster);
        }

        return clusters;
    }

    private getBrandMatch(
        code1: ExtractedCode,
        code2: ExtractedCode,
        brand1?: string,
        brand2?: string
    ): number {
        // First check extracted codes
        if (code1.brand && code2.brand) {
            return code1.brand === code2.brand ? 1 : 0;
        }

        // Fall back to raw brand strings
        if (brand1 && brand2) {
            const normalized1 = brand1.toLowerCase().trim();
            const normalized2 = brand2.toLowerCase().trim();

            if (normalized1 === normalized2) return 1;
            if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return 0.8;
        }

        return 0.5; // Unknown
    }

    private getPriceProximity(price1?: number, price2?: number): number {
        if (!price1 || !price2 || price1 <= 0 || price2 <= 0) return 0.5;

        const priceDiff = Math.abs(price1 - price2) / Math.max(price1, price2);

        if (priceDiff < 0.02) return 1;      // Within 2%
        if (priceDiff < 0.05) return 0.95;   // Within 5%
        if (priceDiff < 0.1) return 0.85;    // Within 10%
        if (priceDiff < 0.2) return 0.7;     // Within 20%
        if (priceDiff < 0.3) return 0.5;     // Within 30%
        return 0;                             // Too different
    }

    private getSpecsMatch(specs1?: Record<string, string>, specs2?: Record<string, string>): number {
        if (!specs1 || !specs2) return 0.5;

        const keys1 = Object.keys(specs1);
        const keys2 = Object.keys(specs2);

        if (keys1.length === 0 && keys2.length === 0) return 0.5;

        let matches = 0;
        let total = 0;

        // Compare common keys
        for (const key of keys1) {
            const normalizedKey = key.toLowerCase().trim();

            // Find matching key in specs2
            const matchingKey = keys2.find(k => k.toLowerCase().trim() === normalizedKey);

            if (matchingKey) {
                total++;
                const value1 = specs1[key].toLowerCase().trim();
                const value2 = specs2[matchingKey].toLowerCase().trim();

                if (value1 === value2) {
                    matches++;
                } else if (this.stringMatcher.levenshteinSimilarity(value1, value2) > 0.8) {
                    matches += 0.8;
                }
            }
        }

        return total > 0 ? matches / total : 0.5;
    }

    private getRatingProximity(rating1?: number, rating2?: number): number {
        if (!rating1 || !rating2) return 0.5;

        const diff = Math.abs(rating1 - rating2);

        if (diff < 0.1) return 1;
        if (diff < 0.3) return 0.9;
        if (diff < 0.5) return 0.7;
        if (diff < 1) return 0.5;
        return 0.3;
    }
}

// Product data interface for matching
export interface ProductData {
    externalId: string;
    sourceId?: number;
    name: string;
    brand?: string;
    category?: string;
    price?: number;
    rating?: number;
    specs?: Record<string, string>;
    embedding?: number[]; // Added for optimization
}
