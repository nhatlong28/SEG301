
try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { ProductCodeExtractor } from '../../src/lib/entity-resolution/codeExtractor';
import { MLEntityMatcher } from '../../src/lib/entity-resolution/mlMatcher';
import { TestSuite, assertLessThan, assertTrue, success } from '../test-utils';

async function runTests() {
    const suite = new TestSuite('Entity Resolution Strictness Repro');
    suite.start();

    const extractor = new ProductCodeExtractor();
    const matcher = new MLEntityMatcher();

    const iphone = {
        name: 'Apple iPhone 16 Pro 128GB - Chính Hãng (VN/A)',
        price: 30990000,
        id: 1,
        source_id: 1,
        externalId: 'iphone1'
    };

    const iphoneCase = {
        name: 'Ốp Lưng Sạc Từ Tính cho iPhone 16 Pro',
        price: 630000,
        id: 2,
        source_id: 2,
        externalId: 'case1'
    };

    // Test case for edge case: Different types but similar names
    const laptop = {
        name: 'MacBook Pro 14 M3',
        price: 40000000,
        id: 4,
        source_id: 1,
        externalId: 'mac1'
    };

    const laptopCharger = {
        name: 'Sạc MacBook Pro 14 M3 60W',
        price: 1000000,
        id: 5,
        source_id: 2,
        externalId: 'charger1'
    };

    await suite.test('extracted codes should have different types', () => {
        const code1 = extractor.extract(iphone.name);
        const code2 = extractor.extract(iphoneCase.name);

        console.log('    iPhone Type:', code1.type);
        console.log('    Case Type:', code2.type);

        assertTrue(code1.type === 'device', 'iPhone should be detected as device');
        assertTrue(code2.type === 'accessory', 'Case should be detected as accessory');
    });

    await suite.test('compareExtractedCodes should reject specific type mismatch', () => {
        const code1 = extractor.extract(iphone.name);
        const code2 = extractor.extract(iphoneCase.name);

        const similarity = extractor.compareExtractedCodes(code1, code2);
        console.log('    Code Similarity:', similarity);

        // This must be 0
        assertLessThan(similarity, 0.1, `Expected mismatch (0), got ${similarity}`);
    });

    await suite.test('strictness: laptop vs charger mismatch', () => {
        const code1 = extractor.extract(laptop.name);
        const code2 = extractor.extract(laptopCharger.name);

        console.log('    Laptop Type:', code1.type);
        console.log('    Charger Type:', code2.type);

        const similarity = extractor.compareExtractedCodes(code1, code2);
        assertLessThan(similarity, 0.1, `Expected mismatch, got ${similarity}`);
    });

    await suite.test('matcher.scoreMatch should reject mismatch based on strict rules', async () => {
        const matchResult = await matcher.scoreMatch(iphone as any, iphoneCase as any);
        console.log('    Match Method:', matchResult.method);
        console.log('    Match Score:', matchResult.score);

        // Should be no_match or very low score
        assertTrue(matchResult.method === 'no_match' || matchResult.score < 0.5, 'Matcher should reject mismatch');
    });

    suite.printSummary();
    if (suite.summary().failed > 0) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
