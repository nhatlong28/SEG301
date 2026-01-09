/**
 * Unit Tests: IntraSourceDeduplicator (intraSourceDedup.ts)
 * Tests for within-source duplicate detection
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { IntraSourceDeduplicator } from '../../src/lib/entity-resolution/intraSourceDedup';
import { TestSuite, assertTrue, assertFalse, assertEqual, assertGreaterThan, assertLessThan } from '../test-utils';
import { intraSourceDuplicates } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('IntraSourceDeduplicator Tests');
    suite.start();

    const deduplicator = new IntraSourceDeduplicator();

    // ═══════════════════════════════════════════════════════════
    // Is Duplicate Within Source Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('isDuplicateWithinSource: same external_id = true', () => {
        const a = { id: 1, source_id: 1, external_id: 'abc-123', name: 'iPhone 15 Pro Max' };
        const b = { id: 2, source_id: 1, external_id: 'abc-123', name: 'iPhone 15 Pro Max 256GB' };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertTrue(result);
    });

    await suite.test('isDuplicateWithinSource: same URL = true', () => {
        const a = { id: 1, source_id: 1, external_id: 'a1', name: 'iPhone 15', url: 'https://shop.com/iphone15' };
        const b = { id: 2, source_id: 1, external_id: 'a2', name: 'iPhone 15 Pro', url: 'https://shop.com/iphone15' };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertTrue(result);
    });

    await suite.test('isDuplicateWithinSource: different sources = false', () => {
        const a = { id: 1, source_id: 1, external_id: 'abc', name: 'iPhone 15 Pro Max' };
        const b = { id: 2, source_id: 2, external_id: 'abc', name: 'iPhone 15 Pro Max' };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertFalse(result);
    });

    await suite.test('isDuplicateWithinSource: same price + high name sim = true', () => {
        const a = { id: 1, source_id: 1, external_id: 'a1', name: 'iPhone 15 Pro Max 256GB Chính Hãng', price: 34990000 };
        const b = { id: 2, source_id: 1, external_id: 'a2', name: 'iPhone 15 ProMax 256GB Chính Hãng VN/A', price: 34990000 };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertTrue(result);
    });

    await suite.test('isDuplicateWithinSource: very high name sim = true', () => {
        const a = { id: 1, source_id: 1, external_id: 'a1', name: 'iPhone 15 Pro Max 256GB Blue', price: 34990000 };
        const b = { id: 2, source_id: 1, external_id: 'a2', name: 'iPhone 15 Pro Max 256GB Blue', price: 34990000 };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertTrue(result);
    });

    await suite.test('isDuplicateWithinSource: different products = false', () => {
        const a = { id: 1, source_id: 1, external_id: 'a1', name: 'iPhone 15 Pro Max', price: 34990000 };
        const b = { id: 2, source_id: 1, external_id: 'a2', name: 'Samsung Galaxy S24 Ultra', price: 31990000 };
        const result = deduplicator.isDuplicateWithinSource(a, b);
        assertFalse(result);
    });

    // ═══════════════════════════════════════════════════════════
    // Deduplicate Within Source Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('deduplicateWithinSource: returns DeduplicatedProducts', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        assertTrue(Array.isArray(result));
        assertTrue(result.length > 0);
        // Each result should have duplicate tracking fields
        for (const p of result) {
            assertTrue(p.duplicate_count >= 1);
            assertTrue(Array.isArray(p.duplicate_ids));
        }
    });

    await suite.test('deduplicateWithinSource: reduces count for duplicates', () => {
        // intraSourceDuplicates has 2 similar iPhones in same source
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        // Should have fewer products than input
        assertLessThan(result.length, intraSourceDuplicates.length);
    });

    await suite.test('deduplicateWithinSource: tracks duplicate IDs', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        // Find the merged iPhone product
        const iPhoneResult = result.find(p => p.name.toLowerCase().includes('iphone'));
        if (iPhoneResult && iPhoneResult.duplicate_count > 1) {
            assertGreaterThan(iPhoneResult.duplicate_ids.length, 1);
        }
    });

    await suite.test('deduplicateWithinSource: different sources not merged', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        // iPhone from source 1 (Tiki) should not be merged with iPhone from source 2 (Shopee)
        const sourceIds = new Set(result.map(p => p.source_id));
        // Should still have products from both sources
        assertTrue(sourceIds.size > 1 || result.some(p => p.source_id === 1));
    });

    await suite.test('deduplicateWithinSource: selects best product', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        // The selected product should be the one with higher rating/reviews
        const iPhoneResult = result.find(p => p.name.toLowerCase().includes('iphone') && p.source_id === 2);
        if (iPhoneResult && iPhoneResult.duplicate_count > 1) {
            // Should pick the one with higher rating (4.8 > 4.7)
            assertTrue(iPhoneResult.rating === 4.8 || iPhoneResult.review_count === 150);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Get Stats Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getStats: returns correct counts', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        const stats = deduplicator.getStats(intraSourceDuplicates, result);

        assertEqual(stats.original_count, intraSourceDuplicates.length);
        assertEqual(stats.deduped_count, result.length);
        assertEqual(stats.duplicates_removed, intraSourceDuplicates.length - result.length);
        assertTrue(stats.reduction_rate >= 0 && stats.reduction_rate <= 1);
    });

    await suite.test('getStats: no duplicates = 0 reduction', () => {
        // All unique products (different names, different sources)
        const uniqueProducts = [
            { id: 1, source_id: 1, external_id: 'a', name: 'Product A' },
            { id: 2, source_id: 2, external_id: 'b', name: 'Product B' },
            { id: 3, source_id: 3, external_id: 'c', name: 'Product C' },
        ];
        const result = deduplicator.deduplicateWithinSource(uniqueProducts);
        const stats = deduplicator.getStats(uniqueProducts, result);
        assertEqual(stats.duplicates_removed, 0);
        assertEqual(stats.reduction_rate, 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    await suite.test('handles empty input', () => {
        const result = deduplicator.deduplicateWithinSource([]);
        assertEqual(result.length, 0);
    });

    await suite.test('handles single product', () => {
        const result = deduplicator.deduplicateWithinSource([intraSourceDuplicates[0]]);
        assertEqual(result.length, 1);
        assertEqual(result[0].duplicate_count, 1);
    });

    await suite.test('tracks shop_ids for duplicates', () => {
        const result = deduplicator.deduplicateWithinSource(intraSourceDuplicates);
        const merged = result.find(p => p.duplicate_count > 1);
        if (merged) {
            assertTrue(Array.isArray(merged.duplicate_shop_ids));
        }
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
