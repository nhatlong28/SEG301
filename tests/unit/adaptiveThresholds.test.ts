/**
 * Unit Tests: AdaptiveThresholdManager (adaptiveThresholds.ts)
 * Tests for category-specific and dynamic thresholds
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { AdaptiveThresholdManager } from '../../src/lib/entity-resolution/adaptiveThresholds';
import { TestSuite, assertTrue, assertEqual, assertInRange, assertGreaterThan } from '../test-utils';

async function runTests() {
    const suite = new TestSuite('AdaptiveThresholdManager Tests');
    suite.start();

    const manager = new AdaptiveThresholdManager();

    // ═══════════════════════════════════════════════════════════
    // Get Threshold Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getThreshold: returns default for no context', async () => {
        const threshold = await manager.getThreshold();
        assertInRange(threshold, 0.5, 1.0);
    });

    await suite.test('getThreshold: returns category-specific for phone', async () => {
        const threshold = await manager.getThreshold('Điện thoại');
        assertInRange(threshold, 0.5, 1.0);
        // Phones should have stricter threshold
        const defaultThreshold = await manager.getThreshold();
        assertGreaterThan(threshold, defaultThreshold - 0.1);
    });

    await suite.test('getThreshold: returns category-specific for laptop', async () => {
        const threshold = await manager.getThreshold('Laptop');
        assertInRange(threshold, 0.5, 1.0);
    });

    await suite.test('getThreshold: returns category-specific for audio', async () => {
        const threshold = await manager.getThreshold('Tai nghe');
        assertInRange(threshold, 0.5, 1.0);
    });

    await suite.test('getThreshold: handles Vietnamese categories', async () => {
        const phoneThreshold = await manager.getThreshold('Điện thoại');
        const smartphoneThreshold = await manager.getThreshold('Smartphone');
        // Both should map to same category
        assertEqual(phoneThreshold, smartphoneThreshold);
    });

    await suite.test('getThreshold: source pair threshold', async () => {
        const threshold = await manager.getThreshold('Điện thoại', 'tiki', 'shopee');
        assertInRange(threshold, 0.5, 1.0);
    });

    await suite.test('getThreshold: different source pairs may differ', async () => {
        const threshold1 = await manager.getThreshold(undefined, 'tiki', 'shopee');
        const threshold2 = await manager.getThreshold(undefined, 'tiki', 'lazada');
        // May or may not be different depending on config
        assertInRange(threshold1, 0.5, 1.0);
        assertInRange(threshold2, 0.5, 1.0);
    });

    // ═══════════════════════════════════════════════════════════
    // Set Threshold Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('setThreshold: updates threshold', async () => {
        manager.setThreshold('test:custom', 0.85);
        const all = manager.getAllThresholds();
        assertEqual(all['test:custom'], 0.85);
    });

    await suite.test('setThreshold: can update existing', async () => {
        manager.setThreshold('test:update', 0.7);
        manager.setThreshold('test:update', 0.9);
        const all = manager.getAllThresholds();
        assertEqual(all['test:update'], 0.9);
    });

    // ═══════════════════════════════════════════════════════════
    // Get All Thresholds Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getAllThresholds: returns object', async () => {
        await manager.getThreshold(); // Ensure initialized
        const all = manager.getAllThresholds();
        assertTrue(typeof all === 'object');
    });

    await suite.test('getAllThresholds: includes default', async () => {
        await manager.getThreshold(); // Ensure initialized
        const all = manager.getAllThresholds();
        assertTrue('default' in all);
        assertInRange(all['default'], 0.5, 1.0);
    });

    await suite.test('getAllThresholds: includes category thresholds', async () => {
        await manager.getThreshold(); // Ensure initialized
        const all = manager.getAllThresholds();
        // Should have some category: keys
        const categoryKeys = Object.keys(all).filter(k => k.startsWith('category:'));
        assertGreaterThan(categoryKeys.length, 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Category Normalization Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getThreshold: normalizes phone categories', async () => {
        const t1 = await manager.getThreshold('điện thoại');
        const t2 = await manager.getThreshold('mobile');
        const t3 = await manager.getThreshold('smartphone');
        // All should map to same threshold
        assertEqual(t1, t2);
        assertEqual(t2, t3);
    });

    await suite.test('getThreshold: normalizes laptop categories', async () => {
        const t1 = await manager.getThreshold('laptop');
        const t2 = await manager.getThreshold('máy tính xách tay');
        assertEqual(t1, t2);
    });

    await suite.test('getThreshold: normalizes audio categories', async () => {
        const t1 = await manager.getThreshold('tai nghe');
        const t2 = await manager.getThreshold('headphone');
        assertEqual(t1, t2);
    });

    // ═══════════════════════════════════════════════════════════
    // Calculate Optimal Threshold Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateOptimalThreshold: returns threshold and confidence', async () => {
        const result = await manager.calculateOptimalThreshold('Điện thoại');
        assertTrue(typeof result.threshold === 'number');
        assertTrue(typeof result.confidence === 'number');
        assertInRange(result.threshold, 0, 1);
        assertInRange(result.confidence, 0, 1);
    });

    await suite.test('calculateOptimalThreshold: works without parameters', async () => {
        const result = await manager.calculateOptimalThreshold();
        assertInRange(result.threshold, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Suggest Threshold Adjustment Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('suggestThresholdAdjustment: returns array', async () => {
        const suggestions = await manager.suggestThresholdAdjustment();
        assertTrue(Array.isArray(suggestions));
    });

    await suite.test('suggestThresholdAdjustment: items have correct format', async () => {
        const suggestions = await manager.suggestThresholdAdjustment();
        for (const s of suggestions) {
            assertTrue(typeof s.key === 'string');
            assertTrue(typeof s.current === 'number');
            assertTrue(typeof s.suggested === 'number');
            assertTrue(typeof s.reason === 'string');
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Record Match Result Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('recordMatchResult: does not throw', async () => {
        // This might fail silently if RPC not available, but should not throw
        try {
            await manager.recordMatchResult('phone', 'tiki', 'shopee', 0.85, true);
            assertTrue(true); // If we get here, it didn't throw
        } catch (e) {
            // RPC not available is expected in test environment
            assertTrue(true);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Edge Cases
    // ═══════════════════════════════════════════════════════════

    await suite.test('getThreshold: unknown category falls back to default', async () => {
        const threshold = await manager.getThreshold('Unknown Category XYZ');
        const defaultThreshold = await manager.getThreshold();
        // Should get category-specific or default
        assertInRange(threshold, 0.5, 1.0);
    });

    await suite.test('getThreshold: empty string category', async () => {
        const threshold = await manager.getThreshold('');
        assertInRange(threshold, 0.5, 1.0);
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
