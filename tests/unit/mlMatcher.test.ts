/**
 * Unit Tests: MLEntityMatcher (mlMatcher.ts)
 * Tests for ML-based entity matching
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { MLEntityMatcher, ProductData } from '../../src/lib/entity-resolution/mlMatcher';
import { TestSuite, assertGreaterThan, assertLessThan, assertInRange, assertTrue, assertDefined } from '../test-utils';
import { iPhoneProducts, samsungProducts, differentProducts, allTestProducts } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('MLEntityMatcher Tests');
    suite.start();

    const matcher = new MLEntityMatcher();

    // ═══════════════════════════════════════════════════════════
    // Generate Features Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('generateFeatures: returns all feature fields', async () => {
        const features = await matcher.generateFeatures(iPhoneProducts[0], iPhoneProducts[1]);
        assertDefined(features.nameStringSimilarity);
        assertDefined(features.semanticSimilarity);
        assertDefined(features.brandMatch);
        assertDefined(features.codeMatch);
        assertDefined(features.priceProximity);
        assertDefined(features.specsMatch);
        assertDefined(features.categoryMatch);
        assertDefined(features.ratingProximity);
    });

    await suite.test('generateFeatures: same product high name similarity', async () => {
        const features = await matcher.generateFeatures(iPhoneProducts[0], iPhoneProducts[1]);
        assertGreaterThan(features.nameStringSimilarity, 0.3, 'Similar products should have name similarity > 0.3');
    });

    await suite.test('generateFeatures: same brand = 1.0', async () => {
        const features = await matcher.generateFeatures(iPhoneProducts[0], iPhoneProducts[1]);
        assertGreaterThan(features.brandMatch, 0.8, 'Same brand should have high brandMatch');
    });

    await suite.test('generateFeatures: different brands = 0', async () => {
        const features = await matcher.generateFeatures(iPhoneProducts[0], samsungProducts[0]);
        assertLessThan(features.brandMatch, 0.3, 'Different brands should have low brandMatch');
    });

    await suite.test('generateFeatures: features in valid range [0,1]', async () => {
        const features = await matcher.generateFeatures(iPhoneProducts[0], samsungProducts[0]);
        assertInRange(features.nameStringSimilarity, 0, 1);
        assertInRange(features.semanticSimilarity, 0, 1);
        assertInRange(features.brandMatch, 0, 1);
        assertInRange(features.codeMatch, 0, 1);
        assertInRange(features.priceProximity, 0, 1);
        assertInRange(features.specsMatch, 0, 1);
        assertInRange(features.categoryMatch, 0, 1);
        assertInRange(features.ratingProximity, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Score Match Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('scoreMatch: same product from different sources = HIGH', async () => {
        const result = await matcher.scoreMatch(iPhoneProducts[0], iPhoneProducts[1]);
        assertGreaterThan(result.score, 0.65, 'Same product should have high score');
        assertTrue(result.confidence === 'high' || result.confidence === 'medium');
    });

    await suite.test('scoreMatch: different products = LOW', async () => {
        const result = await matcher.scoreMatch(iPhoneProducts[0], samsungProducts[0]);
        assertLessThan(result.score, 0.5, 'Different products should have low score');
    });

    await suite.test('scoreMatch: returns valid MatchResult', async () => {
        const result = await matcher.scoreMatch(iPhoneProducts[0], iPhoneProducts[1]);
        assertDefined(result.score);
        assertDefined(result.method);
        assertDefined(result.confidence);
        assertDefined(result.features);
        assertInRange(result.score, 0, 1);
        assertTrue(['high', 'medium', 'low'].includes(result.confidence));
    });

    await suite.test('scoreMatch: completely different products = very low', async () => {
        const result = await matcher.scoreMatch(iPhoneProducts[0], differentProducts[0]); // iPhone vs TV
        assertLessThan(result.score, 0.4, 'iPhone vs TV should have very low score');
    });

    // ═══════════════════════════════════════════════════════════
    // Find Best Matches Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('findBestMatches: returns sorted results', async () => {
        const matches = await matcher.findBestMatches(iPhoneProducts[0], allTestProducts.slice(1), {
            minScore: 0.3,
            maxResults: 5,
        });
        assertTrue(Array.isArray(matches));
        // Should be sorted by score descending
        for (let i = 1; i < matches.length; i++) {
            assertTrue(matches[i - 1].result.score >= matches[i].result.score, 'Should be sorted by score descending');
        }
    });

    await suite.test('findBestMatches: respects maxResults', async () => {
        const matches = await matcher.findBestMatches(iPhoneProducts[0], allTestProducts.slice(1), {
            maxResults: 3,
        });
        assertTrue(matches.length <= 3);
    });

    await suite.test('findBestMatches: respects minScore', async () => {
        const matches = await matcher.findBestMatches(iPhoneProducts[0], allTestProducts.slice(1), {
            minScore: 0.5,
        });
        for (const match of matches) {
            assertGreaterThan(match.result.score, 0.49, 'All matches should be above minScore');
        }
    });

    await suite.test('findBestMatches: best match is same product', async () => {
        const matches = await matcher.findBestMatches(iPhoneProducts[0], [
            iPhoneProducts[1], // Same iPhone
            samsungProducts[0], // Different product
            differentProducts[0], // Very different
        ]);
        if (matches.length > 0) {
            assertTrue(
                matches[0].product.name.toLowerCase().includes('iphone'),
                'Best match should be the same iPhone product'
            );
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Cluster Products Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('clusterProducts: groups similar products', async () => {
        const products = [...iPhoneProducts.slice(0, 2), ...samsungProducts.slice(0, 2)];
        const clusters = await matcher.clusterProducts(products, 0.5);
        assertTrue(Array.isArray(clusters));
        assertTrue(clusters.length >= 1, 'Should create at least 1 cluster');
    });

    await suite.test('clusterProducts: iPhone cluster together', async () => {
        const clusters = await matcher.clusterProducts([...iPhoneProducts, ...samsungProducts], 0.55);
        // Find cluster containing first iPhone
        const iPhoneCluster = clusters.find(c =>
            c.some(p => p.name.toLowerCase().includes('iphone 15'))
        );
        if (iPhoneCluster && iPhoneCluster.length > 1) {
            // If clustered, all should be iPhones
            for (const p of iPhoneCluster) {
                assertTrue(
                    p.name.toLowerCase().includes('iphone'),
                    `iPhone cluster should only contain iPhones, got: ${p.name}`
                );
            }
        }
    });

    await suite.test('clusterProducts: singletons for very different products', async () => {
        const clusters = await matcher.clusterProducts(differentProducts, 0.8);
        // With high threshold, different products should be separate
        assertTrue(clusters.length >= differentProducts.length - 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Helper Method Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getPriceProximity: same price = 1.0', () => {
        const proximity = matcher.getPriceProximity(34990000, 34990000);
        assertGreaterThan(proximity, 0.99);
    });

    await suite.test('getPriceProximity: close prices = high', () => {
        const proximity = matcher.getPriceProximity(34990000, 35500000);
        assertGreaterThan(proximity, 0.9);
    });

    await suite.test('getPriceProximity: different prices = lower', () => {
        const proximity = matcher.getPriceProximity(34990000, 25000000);
        assertLessThan(proximity, 0.8);
    });

    await suite.test('getPriceProximity: handles undefined', () => {
        const proximity = matcher.getPriceProximity(undefined, 34990000);
        assertInRange(proximity, 0, 1);
    });

    await suite.test('getRatingProximity: same rating = 1.0', () => {
        const proximity = matcher.getRatingProximity(4.8, 4.8);
        assertGreaterThan(proximity, 0.99);
    });

    await suite.test('getRatingProximity: close ratings = high', () => {
        const proximity = matcher.getRatingProximity(4.8, 4.7);
        assertGreaterThan(proximity, 0.9);
    });

    await suite.test('getCategoryMatch: same category = 1.0', () => {
        const match = matcher.getCategoryMatch('Điện thoại', 'Điện thoại');
        assertGreaterThan(match, 0.99);
    });

    await suite.test('getCategoryMatch: similar categories = high', () => {
        const match = matcher.getCategoryMatch('Điện thoại', 'Smartphone');
        assertGreaterThan(match, 0.7);
    });

    await suite.test('getCategoryMatch: different categories = low', () => {
        const match = matcher.getCategoryMatch('Điện thoại', 'Tủ lạnh');
        assertLessThan(match, 0.5);
    });

    suite.printSummary();
    return suite.summary();
}

runTests().catch(console.error);

export { runTests };
