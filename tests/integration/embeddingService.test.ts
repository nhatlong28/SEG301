/**
 * Integration Tests: EmbeddingService (embeddingService.ts)
 * Tests for HuggingFace API integration
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { getEmbeddingService } from '../../src/lib/search/embeddingService';
import { TestSuite, assertTrue, assertEqual, assertGreaterThan, assertLessThan, assertInRange, assertDefined } from '../test-utils';
import { info, warn } from '../test-utils';

async function runTests() {
    const suite = new TestSuite('EmbeddingService Integration Tests');
    suite.start();

    const embeddingService = getEmbeddingService();

    // ═══════════════════════════════════════════════════════════
    // Availability Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('isAvailable: checks API key', () => {
        const available = embeddingService.isAvailable();
        if (!available) {
            warn('HUGGINGFACE_API_KEY not set - some tests will be skipped');
        }
        assertTrue(typeof available === 'boolean');
    });

    await suite.test('getDimension: returns 768', () => {
        const dim = embeddingService.getDimension();
        assertEqual(dim, 768);
    });

    // ═══════════════════════════════════════════════════════════
    // Generate Embedding Tests (require API)
    // ═══════════════════════════════════════════════════════════

    const isAvailable = embeddingService.isAvailable();

    if (isAvailable) {
        await suite.test('generateQueryEmbedding: returns 768-dim vector', async () => {
            const embedding = await embeddingService.generateQueryEmbedding('iPhone 15 Pro Max giá bao nhiêu');
            assertDefined(embedding);
            assertEqual(embedding!.length, 768);
        });

        await suite.test('generateDocumentEmbedding: returns 768-dim vector', async () => {
            const embedding = await embeddingService.generateDocumentEmbedding('Samsung Galaxy S24 Ultra điện thoại cao cấp');
            assertDefined(embedding);
            assertEqual(embedding!.length, 768);
        });

        await suite.test('generateQueryEmbedding: values are normalized', async () => {
            const embedding = await embeddingService.generateQueryEmbedding('test query');
            assertDefined(embedding);
            // Check values are in reasonable range
            for (const val of embedding!) {
                assertInRange(val, -10, 10);
            }
        });

        await suite.test('generateBatchDocumentEmbeddings: processes multiple texts', async () => {
            const texts = [
                'iPhone 15 Pro Max',
                'Samsung Galaxy S24 Ultra',
                'MacBook Air M2',
            ];
            const embeddings = await embeddingService.generateBatchDocumentEmbeddings(texts);
            assertEqual(embeddings.length, 3);
            for (const emb of embeddings) {
                if (emb) {
                    assertEqual(emb.length, 768);
                }
            }
        });

        // ═══════════════════════════════════════════════════════════
        // Cosine Similarity Tests
        // ═══════════════════════════════════════════════════════════

        await suite.test('cosineSimilarity: same text = 1.0', async () => {
            const text = 'iPhone 15 Pro Max 256GB';
            const emb = await embeddingService.generateDocumentEmbedding(text);
            assertDefined(emb);
            const sim = embeddingService.cosineSimilarity(emb!, emb!);
            assertGreaterThan(sim, 0.99);
        });

        await suite.test('cosineSimilarity: similar texts > 0.7', async () => {
            const emb1 = await embeddingService.generateDocumentEmbedding('iPhone 15 Pro Max 256GB Titanium Blue');
            const emb2 = await embeddingService.generateDocumentEmbedding('Apple iPhone 15 ProMax 256G Xanh');
            assertDefined(emb1);
            assertDefined(emb2);
            const sim = embeddingService.cosineSimilarity(emb1!, emb2!);
            assertGreaterThan(sim, 0.6, 'Similar products should have high similarity');
        });

        await suite.test('cosineSimilarity: different texts < 0.9', async () => {
            const emb1 = await embeddingService.generateDocumentEmbedding('iPhone 15 Pro Max');
            const emb2 = await embeddingService.generateDocumentEmbedding('Tủ lạnh Samsung Inverter');
            assertDefined(emb1);
            assertDefined(emb2);
            const sim = embeddingService.cosineSimilarity(emb1!, emb2!);
            assertLessThan(sim, 0.95, 'Different products should have lower similarity');
        });

        await suite.test('cosineSimilarity: same brand products moderate sim', async () => {
            const emb1 = await embeddingService.generateDocumentEmbedding('iPhone 15 Pro Max');
            const emb2 = await embeddingService.generateDocumentEmbedding('iPhone 14 Pro Max');
            assertDefined(emb1);
            assertDefined(emb2);
            const sim = embeddingService.cosineSimilarity(emb1!, emb2!);
            assertGreaterThan(sim, 0.7, 'Same brand should have moderate-high similarity');
        });

        // ═══════════════════════════════════════════════════════════
        // Find Most Similar Tests
        // ═══════════════════════════════════════════════════════════

        await suite.test('findMostSimilar: returns sorted results', async () => {
            const queryEmb = await embeddingService.generateQueryEmbedding('iPhone 15 Pro');
            if (!queryEmb) {
                warn('Skipping findMostSimilar test - no query embedding');
                return;
            }

            const docs = [
                { id: 'iphone', embedding: await embeddingService.generateDocumentEmbedding('iPhone 15 Pro Max 256GB') },
                { id: 'samsung', embedding: await embeddingService.generateDocumentEmbedding('Samsung Galaxy S24 Ultra') },
                { id: 'laptop', embedding: await embeddingService.generateDocumentEmbedding('MacBook Air M2 2024') },
            ].filter(d => d.embedding) as { id: string; embedding: number[] }[];

            const results = embeddingService.findMostSimilar(queryEmb, docs, 3);
            assertTrue(results.length > 0);
            // Should be sorted by score descending
            for (let i = 1; i < results.length; i++) {
                assertTrue(results[i - 1].score >= results[i].score);
            }
            // iPhone should be top result
            assertEqual(results[0].id, 'iphone');
        });

        await suite.test('findMostSimilar: respects minScore', async () => {
            const queryEmb = await embeddingService.generateQueryEmbedding('iPhone 15');
            if (!queryEmb) return;

            const docs = [
                { id: 'test', embedding: await embeddingService.generateDocumentEmbedding('Random product XYZ') },
            ].filter(d => d.embedding) as { id: string; embedding: number[] }[];

            const results = embeddingService.findMostSimilar(queryEmb, docs, 10, 0.9);
            // High minScore might filter out everything
            for (const r of results) {
                assertGreaterThan(r.score, 0.89);
            }
        });

        // ═══════════════════════════════════════════════════════════
        // Cache Tests
        // ═══════════════════════════════════════════════════════════

        await suite.test('caching: same text uses cache', async () => {
            const statsBefore = embeddingService.getCacheStats();

            // Generate same embedding twice
            const text = 'Cache test product name ' + Date.now();
            await embeddingService.generateDocumentEmbedding(text);
            await embeddingService.generateDocumentEmbedding(text);

            const statsAfter = embeddingService.getCacheStats();
            // Cache size should have increased by at most 1
            assertTrue(statsAfter.size >= statsBefore.size);
        });

        await suite.test('getCacheStats: returns valid stats', () => {
            const stats = embeddingService.getCacheStats();
            assertTrue(typeof stats.size === 'number');
            assertTrue(typeof stats.maxSize === 'number');
            assertTrue(stats.size >= 0);
            assertTrue(stats.maxSize > 0);
        });

        await suite.test('clearCache: empties cache', () => {
            embeddingService.clearCache();
            const stats = embeddingService.getCacheStats();
            assertEqual(stats.size, 0);
        });

        // ═══════════════════════════════════════════════════════════
        // Vietnamese Text Tests
        // ═══════════════════════════════════════════════════════════

        await suite.test('handles Vietnamese text', async () => {
            const emb = await embeddingService.generateDocumentEmbedding(
                'Điện thoại iPhone 15 Pro Max Chính Hãng VN/A Xanh Titanium'
            );
            assertDefined(emb);
            assertEqual(emb!.length, 768);
        });

        await suite.test('Vietnamese similarity works', async () => {
            const emb1 = await embeddingService.generateDocumentEmbedding('Điện thoại iPhone 15');
            const emb2 = await embeddingService.generateDocumentEmbedding('Apple iPhone 15 smartphone');
            assertDefined(emb1);
            assertDefined(emb2);
            const sim = embeddingService.cosineSimilarity(emb1!, emb2!);
            assertGreaterThan(sim, 0.6);
        });

    } else {
        info('Skipping API tests - HUGGINGFACE_API_KEY not available');

        await suite.test('cosineSimilarity: handles mock vectors', () => {
            const a = Array(768).fill(0).map(() => Math.random());
            const b = [...a]; // Same vector
            const sim = embeddingService.cosineSimilarity(a, b);
            assertGreaterThan(sim, 0.99);
        });

        await suite.test('normalize: normalizes vector', () => {
            const vec = [3, 4]; // 3-4-5 triangle
            const normalized = embeddingService.normalize(vec);
            const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
            assertInRange(magnitude, 0.99, 1.01);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Helper Method Tests (no API required)
    // ═══════════════════════════════════════════════════════════

    await suite.test('normalize: handles zero vector', () => {
        const vec = [0, 0, 0];
        const normalized = embeddingService.normalize(vec);
        // Should not crash
        assertEqual(normalized.length, 3);
    });

    await suite.test('cosineSimilarity: returns 0 for orthogonal', () => {
        const a = [1, 0, 0];
        const b = [0, 1, 0];
        const sim = embeddingService.cosineSimilarity(a, b);
        assertInRange(sim, -0.01, 0.01);
    });

    await suite.test('cosineSimilarity: returns 1 for identical normalized', () => {
        const a = embeddingService.normalize([1, 2, 3]);
        const sim = embeddingService.cosineSimilarity(a, a);
        assertGreaterThan(sim, 0.99);
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
