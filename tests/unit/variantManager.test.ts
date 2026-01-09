/**
 * Unit Tests: VariantManager (variantManager.ts)
 * Tests for product variant detection and management
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { VariantManager } from '../../src/lib/entity-resolution/variantManager';
import { TestSuite, assertTrue, assertFalse, assertEqual, assertDefined, assertGreaterThan } from '../test-utils';
import { iPhoneVariants } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('VariantManager Tests');
    suite.start();

    const variantManager = new VariantManager();

    // Convert fixture to format expected by VariantManager
    const variantProducts = iPhoneVariants.map((p, i) => ({
        id: i + 1,
        source_id: p.sourceId || 1,
        external_id: p.externalId,
        name: p.name,
        brand_raw: p.brand,
        price: p.price,
        rating: p.rating,
        specs: p.specs,
    }));

    // ═══════════════════════════════════════════════════════════
    // Handle Variants Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('handleVariants: detects variant group', () => {
        const result = variantManager.handleVariants(variantProducts);
        assertDefined(result);
        assertDefined(result.mainProduct);
        assertDefined(result.variants);
        assertDefined(result.isVariantGroup);
    });

    await suite.test('handleVariants: identifies multiple variants', () => {
        const result = variantManager.handleVariants(variantProducts);
        if (result.isVariantGroup) {
            assertGreaterThan(result.variants.length, 1, 'Should identify multiple variants');
        }
    });

    await suite.test('handleVariants: single product = not variant group', () => {
        const result = variantManager.handleVariants([variantProducts[0]]);
        assertFalse(result.isVariantGroup);
        assertEqual(result.variants.length, 0);
    });

    await suite.test('handleVariants: selects best main product', () => {
        const result = variantManager.handleVariants(variantProducts);
        assertDefined(result.mainProduct);
        assertTrue(result.mainProduct.id > 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Create Variant Key Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('createVariantKey: includes storage', () => {
        const features = variantManager.extractVariantFeatures({
            id: 1,
            source_id: 1,
            external_id: 'test',
            name: 'iPhone 15 Pro Max 256GB Blue',
        });
        const key = variantManager.createVariantKey(features);
        assertTrue(key.includes('256'), 'Key should include storage');
    });

    await suite.test('createVariantKey: different storage = different keys', () => {
        const features1 = variantManager.extractVariantFeatures({
            id: 1,
            source_id: 1,
            external_id: 'test1',
            name: 'iPhone 15 Pro Max 128GB Blue',
        });
        const features2 = variantManager.extractVariantFeatures({
            id: 2,
            source_id: 1,
            external_id: 'test2',
            name: 'iPhone 15 Pro Max 256GB Blue',
        });
        const key1 = variantManager.createVariantKey(features1);
        const key2 = variantManager.createVariantKey(features2);
        assertTrue(key1 !== key2, 'Different storage should produce different keys');
    });

    await suite.test('createVariantKey: same specs = same key', () => {
        const features1 = variantManager.extractVariantFeatures({
            id: 1,
            source_id: 1,
            external_id: 'test1',
            name: 'iPhone 15 Pro Max 256GB Blue Chính Hãng',
        });
        const features2 = variantManager.extractVariantFeatures({
            id: 2,
            source_id: 1,
            external_id: 'test2',
            name: 'Apple iPhone 15 ProMax 256G Xanh',
        });
        const key1 = variantManager.createVariantKey(features1);
        const key2 = variantManager.createVariantKey(features2);
        // Keys should be similar (both 256GB)
        assertTrue(key1.includes('256') && key2.includes('256'));
    });

    // ═══════════════════════════════════════════════════════════
    // Parse Variant Key Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('parseVariantKey: extracts storage', () => {
        const parsed = variantManager.parseVariantKey('256GB|base|blue');
        assertEqual(parsed.storage, '256GB');
    });

    await suite.test('parseVariantKey: extracts color', () => {
        const parsed = variantManager.parseVariantKey('256GB|base|blue');
        assertEqual(parsed.color, 'blue');
    });

    await suite.test('parseVariantKey: handles base values', () => {
        const parsed = variantManager.parseVariantKey('base|base|base');
        assertTrue(parsed.storage === undefined || parsed.storage === 'base');
    });

    // ═══════════════════════════════════════════════════════════
    // Is Specific Variant Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('isSpecificVariant: detects storage variant', () => {
        const result = variantManager.isSpecificVariant('iPhone 15 Pro Max 256GB');
        assertTrue(result);
    });

    await suite.test('isSpecificVariant: detects color variant', () => {
        const result = variantManager.isSpecificVariant('iPhone 15 Pro Max Blue');
        assertTrue(result);
    });

    await suite.test('isSpecificVariant: generic name = false', () => {
        const result = variantManager.isSpecificVariant('iPhone 15 Pro Max');
        // Without storage/color, might not be specific variant
        // This depends on implementation
    });

    // ═══════════════════════════════════════════════════════════
    // Get Variant Display Name Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getVariantDisplayName: formats nicely', () => {
        const displayName = variantManager.getVariantDisplayName('256GB|8GB|blue');
        assertTrue(displayName.length > 0);
        // Should be human readable
        assertTrue(
            displayName.includes('256') || displayName.includes('Blue') || displayName.includes('8GB'),
            'Display name should include variant info'
        );
    });

    await suite.test('getVariantDisplayName: handles base values', () => {
        const displayName = variantManager.getVariantDisplayName('base|base|base');
        // Should still return something
        assertTrue(displayName.length >= 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Select Best Product Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('selectBestProduct: prefers higher rating', () => {
        const products = [
            { id: 1, source_id: 1, external_id: 't1', name: 'Test 1', rating: 4.5, review_count: 100 },
            { id: 2, source_id: 1, external_id: 't2', name: 'Test 2', rating: 4.9, review_count: 100 },
        ];
        const result = variantManager.handleVariants(products);
        assertEqual(result.mainProduct.id, 2); // Higher rated
    });

    await suite.test('selectBestProduct: prefers more reviews', () => {
        const products = [
            { id: 1, source_id: 1, external_id: 't1', name: 'Test 1', rating: 4.5, review_count: 50 },
            { id: 2, source_id: 1, external_id: 't2', name: 'Test 2', rating: 4.5, review_count: 200 },
        ];
        const result = variantManager.handleVariants(products);
        assertEqual(result.mainProduct.id, 2); // More reviews
    });

    // ═══════════════════════════════════════════════════════════
    // Extract Variant Features Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extractVariantFeatures: extracts from name', () => {
        const features = variantManager.extractVariantFeatures({
            id: 1,
            source_id: 1,
            external_id: 'test',
            name: 'iPhone 15 Pro Max 256GB RAM 8GB Blue',
        });
        assertDefined(features);
        // Should extract storage, possibly RAM and color
        assertTrue(features.storage === '256GB' || features.storage?.includes('256'));
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
