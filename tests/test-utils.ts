/**
 * Test Utilities and Fixtures
 * Shared helpers for the test suite
 */

// Color helpers for output
export const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

export function success(msg: string) { console.log(`${colors.green}✅ ${msg}${colors.reset}`); }
export function error(msg: string) { console.log(`${colors.red}❌ ${msg}${colors.reset}`); }
export function info(msg: string) { console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`); }
export function warn(msg: string) { console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`); }
export function header(msg: string) { console.log(`\n${colors.bold}${colors.cyan}═══ ${msg} ═══${colors.reset}\n`); }
export function subheader(msg: string) { console.log(`${colors.dim}--- ${msg} ---${colors.reset}`); }

// Test result tracking
export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
}

export class TestSuite {
    name: string;
    results: TestResult[] = [];
    startTime: number = 0;

    constructor(name: string) {
        this.name = name;
    }

    start() {
        header(this.name);
        this.startTime = Date.now();
    }

    async test(name: string, fn: () => Promise<void> | void): Promise<boolean> {
        const testStart = Date.now();
        try {
            await fn();
            const duration = Date.now() - testStart;
            this.results.push({ name, passed: true, duration });
            console.log(`  ${colors.green}✓${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
            return true;
        } catch (e) {
            const duration = Date.now() - testStart;
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.results.push({ name, passed: false, error: errorMsg, duration });
            console.log(`  ${colors.red}✗${colors.reset} ${name}`);
            console.log(`    ${colors.red}${errorMsg}${colors.reset}`);
            return false;
        }
    }

    summary(): { passed: number; failed: number; total: number; duration: number } {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const duration = Date.now() - this.startTime;
        return { passed, failed, total: this.results.length, duration };
    }

    printSummary() {
        const { passed, failed, total, duration } = this.summary();
        console.log('');
        if (failed === 0) {
            console.log(`  ${colors.green}${colors.bold}All ${total} tests passed${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
        } else {
            console.log(`  ${colors.red}${failed}/${total} tests failed${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
        }
    }
}

// Assertion helpers
export function assertEqual<T>(actual: T, expected: T, msg?: string) {
    if (actual !== expected) {
        throw new Error(msg || `Expected ${expected}, got ${actual}`);
    }
}

export function assertApproxEqual(actual: number, expected: number, tolerance = 0.01, msg?: string) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(msg || `Expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
    }
}

export function assertTrue(condition: boolean, msg?: string) {
    if (!condition) {
        throw new Error(msg || 'Expected true, got false');
    }
}

export function assertFalse(condition: boolean, msg?: string) {
    if (condition) {
        throw new Error(msg || 'Expected false, got true');
    }
}

export function assertInRange(value: number, min: number, max: number, msg?: string) {
    if (value < min || value > max) {
        throw new Error(msg || `Expected ${value} to be in range [${min}, ${max}]`);
    }
}

export function assertGreaterThan(actual: number, expected: number, msg?: string) {
    if (actual <= expected) {
        throw new Error(msg || `Expected ${actual} > ${expected}`);
    }
}

export function assertLessThan(actual: number, expected: number, msg?: string) {
    if (actual >= expected) {
        throw new Error(msg || `Expected ${actual} < ${expected}`);
    }
}

export function assertDefined<T>(value: T | undefined | null, msg?: string): asserts value is T {
    if (value === undefined || value === null) {
        throw new Error(msg || 'Expected value to be defined');
    }
}

export function assertArrayLength<T>(arr: T[], length: number, msg?: string) {
    if (arr.length !== length) {
        throw new Error(msg || `Expected array length ${length}, got ${arr.length}`);
    }
}

export function assertContains<T>(arr: T[], item: T, msg?: string) {
    if (!arr.includes(item)) {
        throw new Error(msg || `Expected array to contain ${item}`);
    }
}
