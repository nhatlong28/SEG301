/**
 * Main Test Runner
 * Runs all test suites and generates summary report
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { colors, header, success, error, info } from './test-utils';

// Import all test modules
import { runTests as runSimilarityTests } from './unit/similarity.test';
import { runTests as runCodeExtractorTests } from './unit/codeExtractor.test';
import { runTests as runSmartBlockingTests } from './unit/smartBlocking.test';
import { runTests as runMLMatcherTests } from './unit/mlMatcher.test';
import { runTests as runVariantManagerTests } from './unit/variantManager.test';
import { runTests as runIntraSourceDedupTests } from './unit/intraSourceDedup.test';
import { runTests as runQualityScorerTests } from './unit/qualityScorer.test';
import { runTests as runAdaptiveThresholdsTests } from './unit/adaptiveThresholds.test';
import { runTests as runEmbeddingServiceTests } from './integration/embeddingService.test';

interface SuiteResult {
    name: string;
    passed: number;
    failed: number;
    total: number;
    duration: number;
}

const suites: { name: string; run: () => Promise<Omit<SuiteResult, 'name'>> }[] = [
    { name: 'StringMatcher', run: runSimilarityTests },
    { name: 'ProductCodeExtractor', run: runCodeExtractorTests },
    { name: 'SmartBlockingStrategy', run: runSmartBlockingTests },
    { name: 'MLEntityMatcher', run: runMLMatcherTests },
    { name: 'VariantManager', run: runVariantManagerTests },
    { name: 'IntraSourceDeduplicator', run: runIntraSourceDedupTests },
    { name: 'CanonicalQualityScorer', run: runQualityScorerTests },
    { name: 'AdaptiveThresholdManager', run: runAdaptiveThresholdsTests },
    { name: 'EmbeddingService', run: runEmbeddingServiceTests },
];

async function runAllTests() {
    const args = process.argv.slice(2);
    const runUnit = args.includes('--unit') || args.length === 0;
    const runIntegration = args.includes('--integration') || args.length === 0;
    const specificSuite = args.find(a => !a.startsWith('--'));

    console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║     COMPREHENSIVE DEDUPLICATION SYSTEM TEST SUITE              ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const startTime = Date.now();
    const results: SuiteResult[] = [];

    let suitesToRun = suites;

    if (specificSuite) {
        suitesToRun = suites.filter(s => s.name.toLowerCase().includes(specificSuite.toLowerCase()));
        if (suitesToRun.length === 0) {
            error(`No test suite found matching: ${specificSuite}`);
            console.log(`Available suites: ${suites.map(s => s.name).join(', ')}`);
            process.exit(1);
        }
    } else {
        // Filter based on --unit or --integration flags
        const unitSuites = suites.slice(0, 8); // First 8 are unit tests
        const integrationSuites = suites.slice(8); // Last one is integration

        suitesToRun = [];
        if (runUnit) suitesToRun.push(...unitSuites);
        if (runIntegration) suitesToRun.push(...integrationSuites);
    }

    info(`Running ${suitesToRun.length} test suite(s)...\n`);

    for (const suite of suitesToRun) {
        try {
            const result = await suite.run();
            results.push({ name: suite.name, ...result });
        } catch (e) {
            error(`Suite ${suite.name} crashed: ${e}`);
            results.push({
                name: suite.name,
                passed: 0,
                failed: 1,
                total: 1,
                duration: 0,
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Final Summary
    // ═══════════════════════════════════════════════════════════

    header('FINAL TEST SUMMARY');

    console.log(`${'Suite'.padEnd(30)} Tests    Passed   Failed   Time`);
    console.log('─'.repeat(70));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const r of results) {
        const status = r.failed === 0 ? colors.green + '✓' : colors.red + '✗';
        console.log(
            `${status} ${r.name.padEnd(28)}${colors.reset} ` +
            `${String(r.total).padStart(5)}    ` +
            `${colors.green}${String(r.passed).padStart(5)}${colors.reset}   ` +
            `${r.failed > 0 ? colors.red : colors.dim}${String(r.failed).padStart(5)}${colors.reset}   ` +
            `${colors.dim}${String(r.duration).padStart(5)}ms${colors.reset}`
        );
        totalPassed += r.passed;
        totalFailed += r.failed;
        totalTests += r.total;
    }

    console.log('─'.repeat(70));
    console.log(
        `${'TOTAL'.padEnd(30)} ` +
        `${String(totalTests).padStart(5)}    ` +
        `${colors.green}${String(totalPassed).padStart(5)}${colors.reset}   ` +
        `${totalFailed > 0 ? colors.red : colors.dim}${String(totalFailed).padStart(5)}${colors.reset}   ` +
        `${colors.dim}${String(Date.now() - startTime).padStart(5)}ms${colors.reset}`
    );

    console.log('');

    if (totalFailed === 0) {
        console.log(`${colors.green}${colors.bold}🎉 ALL ${totalTests} TESTS PASSED!${colors.reset}`);
    } else {
        console.log(`${colors.red}${colors.bold}❌ ${totalFailed}/${totalTests} TESTS FAILED${colors.reset}`);
    }

    // ═══════════════════════════════════════════════════════════
    // Feature Completeness Check
    // ═══════════════════════════════════════════════════════════

    header('FEATURE COMPLETENESS');

    const features = [
        { name: 'String Similarity (Levenshtein, Jaccard, Dice, N-gram)', passed: results.find(r => r.name === 'StringMatcher')?.failed === 0 },
        { name: 'Product Code Extraction (brand, model, storage, color)', passed: results.find(r => r.name === 'ProductCodeExtractor')?.failed === 0 },
        { name: 'Smart Multi-level Blocking Strategy', passed: results.find(r => r.name === 'SmartBlockingStrategy')?.failed === 0 },
        { name: 'ML Entity Matching (8 weighted features)', passed: results.find(r => r.name === 'MLEntityMatcher')?.failed === 0 },
        { name: 'Variant Detection and Management', passed: results.find(r => r.name === 'VariantManager')?.failed === 0 },
        { name: 'Intra-Source Duplicate Detection', passed: results.find(r => r.name === 'IntraSourceDeduplicator')?.failed === 0 },
        { name: 'Canonical Quality Scoring', passed: results.find(r => r.name === 'CanonicalQualityScorer')?.failed === 0 },
        { name: 'Adaptive Category-specific Thresholds', passed: results.find(r => r.name === 'AdaptiveThresholdManager')?.failed === 0 },
        { name: 'HuggingFace Semantic Embeddings', passed: results.find(r => r.name === 'EmbeddingService')?.failed === 0 },
    ];

    for (const f of features) {
        console.log(`  ${f.passed ? colors.green + '✅' : colors.red + '❌'} ${f.name}${colors.reset}`);
    }

    const featuresComplete = features.filter(f => f.passed).length;
    console.log('');
    console.log(`  ${colors.bold}${featuresComplete}/${features.length} features fully tested${colors.reset}`);
    console.log('');

    // Exit code
    process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
    console.error('Test runner failed:', e);
    process.exit(1);
});
