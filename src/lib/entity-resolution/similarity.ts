/**
 * String Similarity Matching Module
 * Implements Levenshtein distance, Jaccard similarity, and combined scoring
 */

export class StringMatcher {
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1: string, str2: string): number {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 0;
        if (s1.length === 0) return s2.length;
        if (s2.length === 0) return s1.length;

        const track = Array(s2.length + 1)
            .fill(null)
            .map(() => Array(s1.length + 1).fill(0));

        for (let i = 0; i <= s1.length; i++) {
            track[0][i] = i;
        }

        for (let j = 0; j <= s2.length; j++) {
            track[j][0] = j;
        }

        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return track[s2.length][s1.length];
    }

    /**
     * Levenshtein distance-based similarity (0-1)
     */
    levenshteinSimilarity(str1: string, str2: string): number {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 1;

        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen === 0) return 1;

        const distance = this.levenshteinDistance(s1, s2);
        return 1 - distance / maxLen;
    }

    /**
     * Tokenize string into words
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1);
    }

    /**
     * Jaccard similarity (intersection / union of tokens)
     */
    jaccardSimilarity(str1: string, str2: string): number {
        const tokens1 = new Set(this.tokenize(str1));
        const tokens2 = new Set(this.tokenize(str2));

        if (tokens1.size === 0 && tokens2.size === 0) return 1;
        if (tokens1.size === 0 || tokens2.size === 0) return 0;

        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);

        return intersection.size / union.size;
    }

    /**
     * Dice coefficient (similar to Jaccard but emphasizes overlap)
     * 2 * |intersection| / (|A| + |B|)
     */
    diceSimilarity(str1: string, str2: string): number {
        const tokens1 = new Set(this.tokenize(str1));
        const tokens2 = new Set(this.tokenize(str2));

        if (tokens1.size === 0 && tokens2.size === 0) return 1;
        if (tokens1.size === 0 || tokens2.size === 0) return 0;

        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));

        return (2 * intersection.size) / (tokens1.size + tokens2.size);
    }

    /**
     * N-gram based similarity (for catching typos and variations)
     */
    ngramSimilarity(str1: string, str2: string, n = 2): number {
        const ngrams1 = this.getNgrams(str1.toLowerCase(), n);
        const ngrams2 = this.getNgrams(str2.toLowerCase(), n);

        if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
        if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

        const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
        const union = new Set([...ngrams1, ...ngrams2]);

        return intersection.size / union.size;
    }

    private getNgrams(text: string, n: number): Set<string> {
        const ngrams = new Set<string>();
        const cleaned = text.replace(/\s+/g, ' ').trim();

        for (let i = 0; i <= cleaned.length - n; i++) {
            ngrams.add(cleaned.substring(i, i + n));
        }

        return ngrams;
    }

    /**
     * Word order similarity - checks if important words appear in similar order
     */
    wordOrderSimilarity(str1: string, str2: string): number {
        const words1 = this.tokenize(str1);
        const words2 = this.tokenize(str2);

        if (words1.length === 0 || words2.length === 0) return 0;

        let matchingPairs = 0;
        let totalPairs = 0;

        // Check consecutive word pairs
        for (let i = 0; i < words1.length - 1; i++) {
            const pair1 = `${words1[i]} ${words1[i + 1]}`;
            for (let j = 0; j < words2.length - 1; j++) {
                const pair2 = `${words2[j]} ${words2[j + 1]}`;
                totalPairs++;
                if (pair1 === pair2) {
                    matchingPairs++;
                }
            }
        }

        return totalPairs > 0 ? matchingPairs / Math.sqrt(totalPairs) : 0;
    }

    /**
     * Combined similarity using multiple metrics
     * Weights can be adjusted based on use case
     */
    combinedSimilarity(
        str1: string,
        str2: string,
        weights: {
            levenshtein?: number;
            jaccard?: number;
            dice?: number;
            ngram?: number;
            wordOrder?: number;
        } = {}
    ): number {
        const w = {
            levenshtein: weights.levenshtein ?? 0.25,
            jaccard: weights.jaccard ?? 0.25,
            dice: weights.dice ?? 0.2,
            ngram: weights.ngram ?? 0.2,
            wordOrder: weights.wordOrder ?? 0.1,
        };

        const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);

        const score =
            w.levenshtein * this.levenshteinSimilarity(str1, str2) +
            w.jaccard * this.jaccardSimilarity(str1, str2) +
            w.dice * this.diceSimilarity(str1, str2) +
            w.ngram * this.ngramSimilarity(str1, str2) +
            w.wordOrder * this.wordOrderSimilarity(str1, str2);

        return score / totalWeight;
    }

    /**
     * Quick similarity check for pre-filtering candidates
     * Returns true if strings might be similar enough to warrant full comparison
     */
    quickSimilarityCheck(str1: string, str2: string, threshold = 0.3): boolean {
        // Length check - if lengths differ by more than 50%, unlikely to match
        const len1 = str1.length;
        const len2 = str2.length;
        if (Math.abs(len1 - len2) / Math.max(len1, len2) > 0.5) {
            return false;
        }

        // Quick token overlap check
        const tokens1 = new Set(this.tokenize(str1).slice(0, 5));
        const tokens2 = new Set(this.tokenize(str2).slice(0, 5));

        if (tokens1.size === 0 || tokens2.size === 0) return false;

        const overlap = [...tokens1].filter(t => tokens2.has(t)).length;
        return overlap / Math.min(tokens1.size, tokens2.size) >= threshold;
    }
}
