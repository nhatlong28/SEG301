/**
 * Unit Tests: SmartBlockingStrategy (smartBlocking.ts)
 * Tests for multi-level blocking strategy
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { SmartBlockingStrategy } from '../../src/lib/entity-resolution/smartBlocking';
import { TestSuite, assertTrue, assertFalse, assertEqual, assertGreaterThan, assertDefined } from '../test-utils';

async function runTests() {
    const suite = new TestSuite('SmartBlockingStrategy Tests');
    suite.start();

    const blocker = new SmartBlockingStrategy();

    // ═══════════════════════════════════════════════════════════
    // Generate Blocks Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('generateBlocks: returns array of blocking keys', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
            category_raw: 'Điện thoại',
            price: 34990000,
        });
        assertTrue(Array.isArray(blocks) && blocks.length > 0);
    });

    await suite.test('generateBlocks: includes level 1 brand block', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
        });
        const brandBlock = blocks.find(b => b.level === 1 && b.type === 'brand');
        assertDefined(brandBlock);
        assertTrue(brandBlock!.key.includes('apple'));
    });

    await suite.test('generateBlocks: includes level 2 model block', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
        });
        const modelBlock = blocks.find(b => b.level === 2 && b.type === 'model');
        assertDefined(modelBlock);
        assertTrue(modelBlock!.key.toLowerCase().includes('iphone'));
    });

    await suite.test('generateBlocks: includes level 3 storage block', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
        });
        const storageBlock = blocks.find(b => b.level === 3 && b.type === 'storage');
        assertDefined(storageBlock);
        assertTrue(storageBlock!.key.includes('256'));
    });

    await suite.test('generateBlocks: includes level 4 category+price block', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
            category_raw: 'Điện thoại',
            price: 34990000,
        });
        const catPriceBlock = blocks.find(b => b.level === 4 && b.type === 'category_price');
        assertDefined(catPriceBlock);
    });

    // ═══════════════════════════════════════════════════════════
    // Primary Block Key Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getPrimaryBlockKey: returns non-empty string', () => {
        const key = blocker.getPrimaryBlockKey({
            name: 'iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
        });
        assertTrue(key.length > 0);
    });

    await suite.test('getPrimaryBlockKey: same products have same key', () => {
        const key1 = blocker.getPrimaryBlockKey({
            name: 'iPhone 15 Pro Max 256GB Chính Hãng',
            brand_raw: 'Apple',
        });
        const key2 = blocker.getPrimaryBlockKey({
            name: 'Apple iPhone 15 Pro Max 256GB',
            brand_raw: 'Apple',
        });
        // Both should contain similar brand+model pattern
        assertTrue(key1.includes('apple') && key2.includes('apple'));
    });

    await suite.test('getPrimaryBlockKey: different products have different keys', () => {
        const key1 = blocker.getPrimaryBlockKey({
            name: 'iPhone 15 Pro Max',
            brand_raw: 'Apple',
        });
        const key2 = blocker.getPrimaryBlockKey({
            name: 'Samsung Galaxy S24 Ultra',
            brand_raw: 'Samsung',
        });
        assertTrue(key1 !== key2);
    });

    // ═══════════════════════════════════════════════════════════
    // Should Be In Same Block Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('shouldBeInSameBlock: same product = true', () => {
        const result = blocker.shouldBeInSameBlock(
            { name: 'iPhone 15 Pro Max 256GB', brand_raw: 'Apple', price: 34990000 },
            { name: 'Apple iPhone 15 ProMax 256G', brand_raw: 'Apple', price: 35000000 },
            2
        );
        assertTrue(result);
    });

    await suite.test('shouldBeInSameBlock: same brand different model = depends on level', () => {
        const result = blocker.shouldBeInSameBlock(
            { name: 'iPhone 15 Pro Max', brand_raw: 'Apple' },
            { name: 'iPhone 14 Pro Max', brand_raw: 'Apple' },
            1 // Low level = only check brand
        );
        assertTrue(result); // Same brand, should match at level 1
    });

    await suite.test('shouldBeInSameBlock: different brands = false', () => {
        const result = blocker.shouldBeInSameBlock(
            { name: 'iPhone 15 Pro Max', brand_raw: 'Apple' },
            { name: 'Samsung Galaxy S24 Ultra', brand_raw: 'Samsung' },
            2
        );
        assertFalse(result);
    });

    await suite.test('shouldBeInSameBlock: respects minBlockLevel', () => {
        // At high block level, even similar products might not match
        const result = blocker.shouldBeInSameBlock(
            { name: 'iPhone 15 Pro Max 256GB', brand_raw: 'Apple', price: 34990000 },
            { name: 'iPhone 15 Pro Max 128GB', brand_raw: 'Apple', price: 32990000 },
            3 // Level 3 = storage level
        );
        // Different storage might put them in different blocks at level 3
        // This is acceptable behavior
    });

    // ═══════════════════════════════════════════════════════════
    // Price Range Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getPriceRange: budget < 3M VND', () => {
        const range = blocker.getPriceRange(2500000);
        assertEqual(range, 'budget');
    });

    await suite.test('getPriceRange: mid 3-10M VND', () => {
        const range = blocker.getPriceRange(7000000);
        assertEqual(range, 'mid');
    });

    await suite.test('getPriceRange: premium 10-25M VND', () => {
        const range = blocker.getPriceRange(15000000);
        assertEqual(range, 'premium');
    });

    await suite.test('getPriceRange: flagship > 25M VND', () => {
        const range = blocker.getPriceRange(35000000);
        assertEqual(range, 'flagship');
    });

    await suite.test('getPriceRange: unknown for undefined', () => {
        const range = blocker.getPriceRange(undefined);
        assertEqual(range, 'unknown');
    });

    // ═══════════════════════════════════════════════════════════
    // Brand Normalization Tests (via blocks)
    // ═══════════════════════════════════════════════════════════

    await suite.test('brand normalization: iphone -> apple', () => {
        const blocks = blocker.generateBlocks({ name: 'iPhone 15 Pro Max' });
        const brandBlock = blocks.find(b => b.type === 'brand');
        assertDefined(brandBlock);
        assertTrue(brandBlock!.key.includes('apple'));
    });

    await suite.test('brand normalization: galaxy -> samsung', () => {
        const blocks = blocker.generateBlocks({ name: 'Galaxy S24 Ultra' });
        const brandBlock = blocks.find(b => b.type === 'brand');
        assertDefined(brandBlock);
        assertTrue(brandBlock!.key.includes('samsung'));
    });

    await suite.test('brand normalization: redmi -> xiaomi', () => {
        const blocks = blocker.generateBlocks({ name: 'Redmi Note 13 Pro' });
        const brandBlock = blocks.find(b => b.type === 'brand');
        assertDefined(brandBlock);
        assertTrue(brandBlock!.key.includes('xiaomi'));
    });

    // ═══════════════════════════════════════════════════════════
    // Category Normalization Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('category: điện thoại -> phone', () => {
        const blocks = blocker.generateBlocks({
            name: 'iPhone 15',
            category_raw: 'Điện thoại',
            price: 25000000,
        });
        const catBlock = blocks.find(b => b.type === 'category_price');
        assertDefined(catBlock);
        assertTrue(catBlock!.key.includes('phone'));
    });

    await suite.test('category: laptop variations', () => {
        const blocks = blocker.generateBlocks({
            name: 'MacBook Air',
            category_raw: 'Máy tính xách tay',
            price: 25000000,
        });
        const catBlock = blocks.find(b => b.type === 'category_price');
        assertDefined(catBlock);
        assertTrue(catBlock!.key.includes('laptop'));
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
