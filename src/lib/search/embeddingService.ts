/**
 * HuggingFace Embedding Service
 * Using BAAI/bge-base-en-v1.5 - Works reliably with HuggingFace Router API
 * Note: BGE models handle multilingual text through their tokenizer
 */

import logger from '@/lib/utils/logger';

// BGE model - works with HuggingFace Router, good for semantic search
const EMBEDDING_MODEL = 'BAAI/bge-base-en-v1.5';
// Updated: Use HuggingFace Router API with direct model endpoint
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}`;

// Dimension for bge-base model
const EMBEDDING_DIM = 768;


export interface EmbeddingResult {
    embedding: number[];
    text: string;
    model: string;
}

export class EmbeddingService {
    private apiKey: string | undefined;
    private cache: Map<string, number[]> = new Map();
    private maxCacheSize = 2000;
    private isWarmedUp = false;

    constructor() {
        this.apiKey = process.env.HUGGINGFACE_API_KEY;
        if (!this.apiKey) {
            logger.warn('⚠️ HUGGINGFACE_API_KEY not set. Semantic search disabled.');
        } else {
            logger.info(`✅ Embedding service initialized with model: ${EMBEDDING_MODEL}`);
            // Warm up the model on initialization
            this.warmUp();
        }
    }

    /**
     * Warm up the model to reduce cold start latency
     */
    private async warmUp(): Promise<void> {
        if (this.isWarmedUp || !this.apiKey) return;

        try {
            logger.info('🔥 Warming up embedding model...');
            await this.generateEmbedding('test warm up');
            this.isWarmedUp = true;
            logger.info('✅ Embedding model warmed up!');
        } catch (error) {
            logger.warn('Failed to warm up model, will try on first request');
        }
    }

    /**
     * Check if embedding service is available
     */
    isAvailable(): boolean {
        return !!this.apiKey;
    }

    /**
     * Get embedding dimension
     */
    getDimension(): number {
        return EMBEDDING_DIM;
    }

    /**
     * Generate embedding for a search query
     * Uses "query: " prefix for optimal E5 model performance
     */
    async generateQueryEmbedding(query: string): Promise<number[] | null> {
        // E5 model requires "query: " prefix for search queries
        const prefixedQuery = `query: ${query}`;
        return this.generateEmbedding(prefixedQuery);
    }

    /**
     * Generate embedding for a document/product (for indexing)
     * Uses "passage: " prefix for optimal E5 model performance
     */
    async generateDocumentEmbedding(text: string): Promise<number[] | null> {
        // E5 model requires "passage: " prefix for documents
        const prefixedText = `passage: ${text}`;
        return this.generateEmbedding(prefixedText);
    }

    /**
     * Generate embedding for a single text (internal)
     */
    async generateEmbedding(text: string): Promise<number[] | null> {
        if (!this.apiKey) {
            return null;
        }

        // Check cache first
        const cacheKey = text.toLowerCase().trim().substring(0, 200);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const response = await fetch(HF_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: text,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error(`HuggingFace API error: ${response.status} - ${error}`);

                // Handle rate limiting
                if (response.status === 429) {
                    logger.warn('Rate limited by HuggingFace. Waiting...');
                    await this.sleep(2000);
                    return this.generateEmbedding(text);
                }

                return null;
            }

            const result = await response.json();

            // Handle OpenAI-compatible response format: { data: [{ embedding: [...] }] }
            let embedding: number[];
            if (result.data && Array.isArray(result.data) && result.data[0]?.embedding) {
                embedding = result.data[0].embedding;
            } else if (Array.isArray(result) && typeof result[0] === 'number') {
                // Legacy format: direct array
                embedding = result;
            } else if (Array.isArray(result) && Array.isArray(result[0])) {
                // Legacy format: token-level embeddings requiring mean pooling
                embedding = this.meanPool(result);
            } else {
                logger.warn('Unexpected embedding format from HuggingFace:', JSON.stringify(result).substring(0, 100));
                return null;
            }

            // Normalize the embedding (important for cosine similarity)
            embedding = this.normalize(embedding);

            // Cache the result
            this.addToCache(cacheKey, embedding);

            return embedding;
        } catch (error) {
            logger.error('Embedding generation error:', error);
            return null;
        }
    }

    /**
     * Generate embeddings for multiple search queries in batch
     */
    async generateBatchQueryEmbeddings(queries: string[]): Promise<(number[] | null)[]> {
        // Add query prefix to all
        const prefixedQueries = queries.map(q => `query: ${q}`);
        return this.generateBatchEmbeddings(prefixedQueries);
    }

    /**
     * Generate embeddings for multiple documents in batch
     */
    async generateBatchDocumentEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
        // Add passage prefix to all
        const prefixedTexts = texts.map(t => `passage: ${t}`);
        return this.generateBatchEmbeddings(prefixedTexts);
    }

    /**
     * Generate embeddings for multiple texts in batch (internal)
     */
    private async generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
        if (!this.apiKey || texts.length === 0) {
            return texts.map(() => null);
        }

        // For small batches, process individually to use cache
        if (texts.length <= 3) {
            return Promise.all(texts.map(t => this.generateEmbedding(t)));
        }

        try {
            const response = await fetch(HF_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: texts,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error(`HuggingFace batch API error: ${response.status} - ${error}`);
                // Fall back to individual processing
                return Promise.all(texts.map(t => this.generateEmbedding(t)));
            }

            const results = await response.json();

            // Handle OpenAI-compatible format: { data: [{ embedding: [...], index: 0 }, ...] }
            if (results.data && Array.isArray(results.data)) {
                return results.data.map((item: { embedding: number[]; index: number }, index: number) => {
                    if (!item.embedding) return null;
                    let embedding = this.normalize(item.embedding);
                    const cacheKey = texts[index].toLowerCase().trim().substring(0, 200);
                    this.addToCache(cacheKey, embedding);
                    return embedding;
                });
            }

            // Legacy format fallback
            return results.map((result: number[] | number[][], index: number) => {
                let embedding: number[];
                if (Array.isArray(result) && typeof result[0] === 'number') {
                    embedding = result as number[];
                } else if (Array.isArray(result) && Array.isArray(result[0])) {
                    embedding = this.meanPool(result as number[][]);
                } else {
                    return null;
                }

                embedding = this.normalize(embedding);
                const cacheKey = texts[index].toLowerCase().trim().substring(0, 200);
                this.addToCache(cacheKey, embedding);
                return embedding;
            });
        } catch (error) {
            logger.error('Batch embedding generation error:', error);
            return Promise.all(texts.map(t => this.generateEmbedding(t)));
        }
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    /**
     * Find most similar items from a list
     */
    findMostSimilar(
        queryEmbedding: number[],
        embeddings: { id: string | number; embedding: number[] }[],
        topK: number = 10,
        minScore: number = 0.3
    ): { id: string | number; score: number }[] {
        const scores = embeddings.map(item => ({
            id: item.id,
            score: this.cosineSimilarity(queryEmbedding, item.embedding),
        }));

        return scores
            .filter(s => s.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Normalize vector for cosine similarity
     */
    private normalize(embedding: number[]): number[] {
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0) return embedding;
        return embedding.map(v => v / norm);
    }

    /**
     * Mean pooling for token-level embeddings
     */
    private meanPool(tokenEmbeddings: number[][]): number[] {
        if (tokenEmbeddings.length === 0) return [];

        const dim = tokenEmbeddings[0].length;
        const result = new Array(dim).fill(0);

        for (const token of tokenEmbeddings) {
            for (let i = 0; i < dim; i++) {
                result[i] += token[i];
            }
        }

        return result.map(v => v / tokenEmbeddings.length);
    }

    /**
     * Add to cache with LRU eviction
     */
    private addToCache(key: string, embedding: number[]): void {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry (first in map)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, embedding);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    getCacheStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
    if (!embeddingServiceInstance) {
        embeddingServiceInstance = new EmbeddingService();
    }
    return embeddingServiceInstance;
}
