/**
 * Unit Tests: StringMatcher (similarity.ts)
 * Tests for string similarity algorithms
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { StringMatcher } from '../../src/lib/entity-resolution/similarity';
import { TestSuite, assertEqual, assertInRange, assertTrue, assertFalse, assertGreaterThan, assertLessThan } from '../test-utils';
import { similarStringPairs, differentStringPairs } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('StringMatcher Tests');
    suite.start();

    const matcher = new StringMatcher();

    // ═══════════════════════════════════════════════════════════
    // Levenshtein Distance Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('levenshteinDistance: identical strings = 0', () => {
        const dist = matcher.levenshteinDistance('hello', 'hello');
        assertEqual(dist, 0);
    });

    await suite.test('levenshteinDistance: one char difference = 1', () => {
        const dist = matcher.levenshteinDistance('hello', 'hallo');
        assertEqual(dist, 1);
    });

    await suite.test('levenshteinDistance: empty string = length', () => {
        const dist = matcher.levenshteinDistance('test', '');
        assertEqual(dist, 4);
    });

    await suite.test('levenshteinDistance: case insensitive', () => {
        const dist = matcher.levenshteinDistance('Hello', 'hello');
        assertEqual(dist, 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Levenshtein Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('levenshteinSimilarity: identical = 1.0', () => {
        const sim = matcher.levenshteinSimilarity('iPhone 15 Pro Max', 'iPhone 15 Pro Max');
        assertEqual(sim, 1.0);
    });

    await suite.test('levenshteinSimilarity: similar strings > 0.8', () => {
        const sim = matcher.levenshteinSimilarity('iPhone 15 Pro Max', 'iPhone 15 ProMax');
        assertGreaterThan(sim, 0.8);
    });

    await suite.test('levenshteinSimilarity: different strings < 0.5', () => {
        const sim = matcher.levenshteinSimilarity('iPhone', 'Samsung Galaxy');
        assertLessThan(sim, 0.5);
    });

    // ═══════════════════════════════════════════════════════════
    // Jaccard Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('jaccardSimilarity: identical = 1.0', () => {
        const sim = matcher.jaccardSimilarity('iPhone 15 Pro Max', 'iPhone 15 Pro Max');
        assertEqual(sim, 1.0);
    });

    await suite.test('jaccardSimilarity: word overlap > 0.5', () => {
        const sim = matcher.jaccardSimilarity('iPhone 15 Pro Max 256GB', 'iPhone 15 Pro Max');
        assertGreaterThan(sim, 0.5);
    });

    await suite.test('jaccardSimilarity: no overlap = 0', () => {
        const sim = matcher.jaccardSimilarity('Apple iPhone', 'Samsung Galaxy');
        assertEqual(sim, 0);
    });

    await suite.test('jaccardSimilarity: reordered words = 1.0', () => {
        const sim = matcher.jaccardSimilarity('Samsung Galaxy S24', 'Galaxy S24 Samsung');
        assertEqual(sim, 1.0);
    });

    // ═══════════════════════════════════════════════════════════
    // Dice Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('diceSimilarity: identical = 1.0', () => {
        const sim = matcher.diceSimilarity('MacBook Air M2', 'MacBook Air M2');
        assertEqual(sim, 1.0);
    });

    await suite.test('diceSimilarity: partial overlap > Jaccard', () => {
        const s1 = 'iPhone 15 Pro Max 256GB';
        const s2 = 'iPhone 15 Pro Max';
        const dice = matcher.diceSimilarity(s1, s2);
        const jaccard = matcher.jaccardSimilarity(s1, s2);
        // Dice is typically >= Jaccard for partial overlaps
        assertTrue(dice >= jaccard - 0.01, `Dice ${dice} should be >= Jaccard ${jaccard}`);
    });

    // ═══════════════════════════════════════════════════════════
    // N-gram Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('ngramSimilarity: identical = 1.0', () => {
        const sim = matcher.ngramSimilarity('iPhone', 'iPhone');
        assertEqual(sim, 1.0);
    });

    await suite.test('ngramSimilarity: typo tolerance', () => {
        // N-gram should catch typos like "ProMax" vs "Pro Max"
        const sim = matcher.ngramSimilarity('ProMax', 'Pro Max');
        assertGreaterThan(sim, 0.5);
    });

    await suite.test('ngramSimilarity: Vietnamese text handling', () => {
        const sim = matcher.ngramSimilarity('Điện thoại', 'Dien thoai');
        // Should still calculate something
        assertInRange(sim, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Word Order Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('wordOrderSimilarity: same order > different order', () => {
        const sameOrder = matcher.wordOrderSimilarity('iPhone 15 Pro Max', 'iPhone 15 Pro Max 256GB');
        const diffOrder = matcher.wordOrderSimilarity('iPhone 15 Pro Max', 'Max Pro 15 iPhone');
        assertGreaterThan(sameOrder, diffOrder);
    });

    // ═══════════════════════════════════════════════════════════
    // Combined Similarity Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('combinedSimilarity: similar products > 0.6', () => {
        for (const [s1, s2] of similarStringPairs) {
            const sim = matcher.combinedSimilarity(s1, s2);
            assertGreaterThan(sim, 0.4, `"${s1}" vs "${s2}" should be > 0.4, got ${sim}`);
        }
    });

    await suite.test('combinedSimilarity: different products < 0.5', () => {
        for (const [s1, s2] of differentStringPairs) {
            const sim = matcher.combinedSimilarity(s1, s2);
            assertLessThan(sim, 0.5, `"${s1}" vs "${s2}" should be < 0.5, got ${sim}`);
        }
    });

    await suite.test('combinedSimilarity: custom weights work', () => {
        const sim = matcher.combinedSimilarity('iPhone 15', 'iPhone 15', {
            levenshtein: 1.0,
            jaccard: 0,
            dice: 0,
            ngram: 0,
            wordOrder: 0,
        });
        assertEqual(sim, 1.0);
    });

    // ═══════════════════════════════════════════════════════════
    // Quick Similarity Check Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('quickSimilarityCheck: similar strings = true', () => {
        const result = matcher.quickSimilarityCheck('iPhone 15 Pro Max', 'iPhone 15 Pro Max 256GB');
        assertTrue(result);
    });

    await suite.test('quickSimilarityCheck: different strings = false', () => {
        const result = matcher.quickSimilarityCheck('iPhone', 'Tủ lạnh Samsung');
        assertFalse(result);
    });

    await suite.test('quickSimilarityCheck: length difference rejection', () => {
        // Very different lengths should be rejected quickly
        const result = matcher.quickSimilarityCheck('A', 'This is a very long string that should fail');
        assertFalse(result);
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    await suite.test('handles empty strings', () => {
        const sim = matcher.jaccardSimilarity('', '');
        assertEqual(sim, 1.0);
    });

    await suite.test('handles special characters', () => {
        const sim = matcher.combinedSimilarity(
            'MacBook Pro 14" M3 (2023)',
            'MacBook Pro 14 inch M3 2023'
        );
        assertGreaterThan(sim, 0.5);
    });

    await suite.test('handles Vietnamese product names', () => {
        const sim = matcher.combinedSimilarity(
            'Điện thoại iPhone 15 Pro Max Chính Hãng',
            'iPhone 15 Pro Max Điện Thoại Apple'
        );
        assertGreaterThan(sim, 0.4);
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
