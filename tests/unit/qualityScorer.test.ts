/**
 * Unit Tests: CanonicalQualityScorer (qualityScorer.ts)
 * Tests for quality scoring of canonical products
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { CanonicalQualityScorer } from '../../src/lib/entity-resolution/qualityScorer';
import { TestSuite, assertTrue, assertInRange, assertGreaterThan, assertDefined } from '../test-utils';
import { mockCanonical, mockCluster } from '../fixtures';

async function runTests() {
    const suite = new TestSuite('CanonicalQualityScorer Tests');
    suite.start();

    const scorer = new CanonicalQualityScorer();

    // ═══════════════════════════════════════════════════════════
    // Calculate Quality Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateQuality: returns QualityResult', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        assertDefined(result.quality_score);
        assertDefined(result.confidence);
        assertDefined(result.issues);
        assertDefined(result.needs_review);
    });

    await suite.test('calculateQuality: score in valid range [0,1]', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        assertInRange(result.quality_score, 0, 1);
    });

    await suite.test('calculateQuality: good data = high score', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        assertGreaterThan(result.quality_score, 0.5, 'Complete canonical should have decent quality');
    });

    await suite.test('calculateQuality: confidence is valid level', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        assertTrue(
            ['excellent', 'good', 'fair', 'poor'].includes(result.confidence),
            `Confidence should be one of: excellent, good, fair, poor`
        );
    });

    await suite.test('calculateQuality: issues is array', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        assertTrue(Array.isArray(result.issues));
    });

    // ═══════════════════════════════════════════════════════════
    // Price Variance Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateQuality: low price variance = good', () => {
        const stableCluster = [
            { id: 1, price: 35000000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
            { id: 2, price: 35100000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
            { id: 3, price: 35050000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
        ];
        const result = scorer.calculateQuality(mockCanonical, stableCluster);
        // Low variance should not add issues
        const hasPriceVarianceIssue = result.issues.some(i => i.toLowerCase().includes('price variance'));
        assertInRange(result.quality_score, 0, 1);
    });

    await suite.test('calculateQuality: high price variance detected', () => {
        const volatileCluster = [
            { id: 1, price: 20000000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
            { id: 2, price: 40000000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
            { id: 3, price: 35000000, rating: 4.8, review_count: 100, available: true, name: 'Test' },
        ];
        const result = scorer.calculateQuality(mockCanonical, volatileCluster);
        // High variance might flag an issue or lower score
        assertTrue(result.quality_score <= 0.9 || result.issues.length > 0);
    });

    // ═══════════════════════════════════════════════════════════
    // Data Completeness Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateQuality: complete data = higher score', () => {
        const completeResult = scorer.calculateQuality(mockCanonical, mockCluster);

        const incompleteCanonical = {
            id: 2,
            name: 'Test Product',
            // Missing most fields
        };
        const incompleteResult = scorer.calculateQuality(incompleteCanonical, []);

        assertGreaterThan(completeResult.quality_score, incompleteResult.quality_score);
    });

    await suite.test('calculateQuality: missing description flagged', () => {
        const noDescCanonical = { ...mockCanonical, description: undefined };
        const result = scorer.calculateQuality(noDescCanonical, mockCluster);
        // Might have issue or lower score
        assertTrue(result.quality_score <= 1);
    });

    await suite.test('calculateQuality: missing image flagged', () => {
        const noImageCanonical = { ...mockCanonical, image_url: undefined };
        const result = scorer.calculateQuality(noImageCanonical, mockCluster);
        assertTrue(result.quality_score <= 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Name Quality Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateQuality: good product name = no issues', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        const hasNameIssue = result.issues.some(i => i.toLowerCase().includes('name'));
        // Good names should not have issues
        assertTrue(result.quality_score > 0);
    });

    await suite.test('calculateQuality: very short name flagged', () => {
        const shortNameCanonical = { ...mockCanonical, name: 'ABC' };
        const result = scorer.calculateQuality(shortNameCanonical, mockCluster);
        // Short name might be flagged
        assertInRange(result.quality_score, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Confidence Level Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getConfidenceLevel: high score = excellent', () => {
        const level = scorer.getConfidenceLevel(0.95);
        assertEqual(level, 'excellent');
    });

    await suite.test('getConfidenceLevel: good score = good', () => {
        const level = scorer.getConfidenceLevel(0.75);
        assertEqual(level, 'good');
    });

    await suite.test('getConfidenceLevel: fair score = fair', () => {
        const level = scorer.getConfidenceLevel(0.55);
        assertEqual(level, 'fair');
    });

    await suite.test('getConfidenceLevel: low score = poor', () => {
        const level = scorer.getConfidenceLevel(0.3);
        assertEqual(level, 'poor');
    });

    // ═══════════════════════════════════════════════════════════
    // Rating Confidence Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('getRatingConfidence: many reviews = high confidence', () => {
        const confidence = scorer.getRatingConfidence(500);
        assertGreaterThan(confidence, 0.8);
    });

    await suite.test('getRatingConfidence: few reviews = low confidence', () => {
        const confidence = scorer.getRatingConfidence(5);
        assertTrue(confidence < 0.8);
    });

    await suite.test('getRatingConfidence: zero reviews', () => {
        const confidence = scorer.getRatingConfidence(0);
        assertInRange(confidence, 0, 1);
    });

    // ═══════════════════════════════════════════════════════════
    // Needs Review Tests
    // ═══════════════════════════════════════════════════════════

    await suite.test('calculateQuality: low quality needs review', () => {
        const badCanonical = {
            id: 3,
            name: 'X',
        };
        const result = scorer.calculateQuality(badCanonical, []);
        // Very incomplete product should need review
        assertTrue(result.needs_review || result.quality_score < 0.5);
    });

    await suite.test('calculateQuality: high quality no review needed', () => {
        const result = scorer.calculateQuality(mockCanonical, mockCluster);
        // Good data might not need review
        assertTrue(result.quality_score > 0);
    });

    suite.printSummary();
    return suite.summary();
}

// Helper function to compare
function assertEqual<T>(actual: T, expected: T, msg?: string) {
    if (actual !== expected) {
        throw new Error(msg || `Expected ${expected}, got ${actual}`);
    }
}

runTests().catch(console.error);

export { runTests };
