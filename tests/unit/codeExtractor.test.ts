/**
 * Unit Tests: ProductCodeExtractor (codeExtractor.ts)
 * Tests for product code extraction from Vietnamese e-commerce names
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { ProductCodeExtractor } from '../../src/lib/entity-resolution/codeExtractor';
import { TestSuite, assertEqual, assertTrue, assertDefined, assertGreaterThan, assertInRange } from '../test-utils';
import { productNamesForExtraction } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('ProductCodeExtractor Tests');
    suite.start();

    const extractor = new ProductCodeExtractor();

    // ═══════════════════════════════════════════════════════════
    // Brand Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: Apple brand from iPhone', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB');
        assertEqual(code.brand, 'apple');
    });

    await suite.test('extract: Samsung brand from Galaxy', () => {
        const code = extractor.extract('Samsung Galaxy S24 Ultra 256GB');
        assertEqual(code.brand, 'samsung');
    });

    await suite.test('extract: Xiaomi brand from Redmi', () => {
        const code = extractor.extract('Xiaomi Redmi Note 13 Pro+ 256GB');
        assertEqual(code.brand, 'xiaomi');
    });

    await suite.test('extract: Apple brand from MacBook', () => {
        const code = extractor.extract('MacBook Air M2 2024 13 inch');
        assertEqual(code.brand, 'apple');
    });

    await suite.test('extract: Sony brand', () => {
        const code = extractor.extract('Tivi Sony Bravia XR-55X90L 55 inch');
        assertEqual(code.brand, 'sony');
    });

    await suite.test('extract: LG brand', () => {
        const code = extractor.extract('Máy giặt LG TurboDrum T2555VSAB 15.5kg');
        assertEqual(code.brand, 'lg');
    });

    // ═══════════════════════════════════════════════════════════
    // Storage Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: storage 256GB', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB Blue');
        assertEqual(code.storage, '256GB');
    });

    await suite.test('extract: storage 512GB', () => {
        const code = extractor.extract('Samsung Galaxy S24 Ultra 512GB Black');
        assertEqual(code.storage, '512GB');
    });

    await suite.test('extract: storage 1TB', () => {
        const code = extractor.extract('MacBook Pro 14 inch 1TB SSD');
        assertTrue(code.storage === '1TB' || code.storage === '1024GB');
    });

    await suite.test('extract: storage 128GB with variations', () => {
        const code1 = extractor.extract('iPhone 15 128GB');
        const code2 = extractor.extract('iPhone 15 128 GB');
        const code3 = extractor.extract('iPhone 15 128G');
        assertEqual(code1.storage, '128GB');
        // Other formats should also be normalized
        assertDefined(code2.storage);
        assertDefined(code3.storage);
    });

    // ═══════════════════════════════════════════════════════════
    // RAM Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: RAM 8GB', () => {
        const code = extractor.extract('MacBook Air M2 8GB/256GB');
        assertEqual(code.ram, '8GB');
    });

    await suite.test('extract: RAM 16GB', () => {
        const code = extractor.extract('Laptop Dell XPS 15 Core i7 16GB 512GB');
        assertEqual(code.ram, '16GB');
    });

    // ═══════════════════════════════════════════════════════════
    // Color Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: color Blue/Xanh', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB Titanium Blue');
        assertDefined(code.color);
        assertTrue(code.color!.toLowerCase().includes('blue') || code.color!.toLowerCase().includes('titanium'));
    });

    await suite.test('extract: color Black/Đen', () => {
        const code = extractor.extract('Samsung Galaxy S24 Ultra Black');
        assertDefined(code.color);
    });

    await suite.test('extract: Vietnamese color Xanh Dương', () => {
        const code = extractor.extract('Xiaomi Redmi Note 13 Pro+ Xanh Dương');
        assertDefined(code.color);
    });

    // ═══════════════════════════════════════════════════════════
    // Model Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: iPhone model number', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB');
        assertTrue(
            code.model?.includes('15') || code.modelNumber?.includes('15'),
            'Should extract iPhone 15 model'
        );
    });

    await suite.test('extract: Galaxy model S24', () => {
        const code = extractor.extract('Samsung Galaxy S24 Ultra 256GB');
        assertTrue(
            code.model?.toLowerCase().includes('s24') || code.model?.toLowerCase().includes('galaxy'),
            'Should extract Galaxy S24 model'
        );
    });

    // ═══════════════════════════════════════════════════════════
    // Year Extraction Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: year 2024', () => {
        const code = extractor.extract('MacBook Air M2 2024 13 inch');
        assertEqual(code.year, '2024');
    });

    await suite.test('extract: year 2023 from name', () => {
        const code = extractor.extract('MacBook Pro 14 inch M3 Pro 2023');
        assertEqual(code.year, '2023');
    });

    // ═══════════════════════════════════════════════════════════
    // Confidence Score Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: high confidence for clear product name', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB Titanium Blue');
        assertGreaterThan(code.confidence, 0.5, 'Should have high confidence');
    });

    await suite.test('extract: has confidence score', () => {
        const code = extractor.extract('Some random product name');
        assertInRange(code.confidence, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Canonical Code Generation Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('toCanonicalCode: generates string', () => {
        const code = extractor.extract('iPhone 15 Pro Max 256GB Blue');
        const canonical = extractor.toCanonicalCode(code);
        assertTrue(canonical.length > 0, 'Should generate non-empty canonical code');
        assertTrue(canonical.includes('apple') || canonical.includes('iphone'), 'Should include brand/model');
    });

    await suite.test('toCanonicalCode: similar products have similar codes', () => {
        const code1 = extractor.extract('iPhone 15 Pro Max 256GB Blue');
        const code2 = extractor.extract('Apple iPhone 15 ProMax 256G Xanh');
        const canonical1 = extractor.toCanonicalCode(code1);
        const canonical2 = extractor.toCanonicalCode(code2);
        // Both should contain similar elements
        assertTrue(canonical1.includes('apple') && canonical2.includes('apple'));
    });

    // ═══════════════════════════════════════════════════════════
    // Code Comparison Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('compareExtractedCodes: same product high score', () => {
        const code1 = extractor.extract('iPhone 15 Pro Max 256GB Blue');
        const code2 = extractor.extract('Apple iPhone 15 ProMax 256G Xanh');
        const score = extractor.compareExtractedCodes(code1, code2);
        assertGreaterThan(score, 0.6, 'Same product should have high comparison score');
    });

    await suite.test('compareExtractedCodes: different products low score', () => {
        const code1 = extractor.extract('iPhone 15 Pro Max 256GB');
        const code2 = extractor.extract('Samsung Galaxy S24 Ultra 256GB');
        const score = extractor.compareExtractedCodes(code1, code2);
        assertTrue(score < 0.5, 'Different products should have low comparison score');
    });

    await suite.test('compareExtractedCodes: different storage affects score', () => {
        const code1 = extractor.extract('iPhone 15 Pro Max 128GB');
        const code2 = extractor.extract('iPhone 15 Pro Max 256GB');
        const score = extractor.compareExtractedCodes(code1, code2);
        // Same model but different storage = still somewhat similar
        assertInRange(score, 0.4, 0.9);
    });

    // ═══════════════════════════════════════════════════════════
    // All Fixture Products Test
    // ═══════════════════════════════════════════════════════════

    await suite.test('extract: all fixture products extract something', () => {
        for (const name of productNamesForExtraction) {
            const code = extractor.extract(name);
            assertTrue(
                code.brand !== undefined || code.model !== undefined || code.storage !== undefined,
                `Should extract something from: "${name}"`
            );
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Normalize Model Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('normalizeModel: removes whitespace variations', () => {
        const normalized = extractor.normalizeModel('Pro Max');
        assertTrue(normalized === 'promax' || normalized === 'pro max');
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
