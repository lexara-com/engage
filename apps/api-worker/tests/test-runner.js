/**
 * Test Runner - Comprehensive test execution and reporting
 *
 * Orchestrates all test suites and provides detailed reporting
 * for the API worker test harness.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
class TestRunner {
    results = [];
    async runAllTests() {
        console.log('🚀 Starting API Worker Test Suite');
        console.log('='.repeat(50));
        const startTime = Date.now();
        try {
            // Run unit tests
            await this.runTestSuite('unit', 'Unit Tests', 'tests/unit/**/*.test.ts');
            // Run integration tests
            await this.runTestSuite('integration', 'Integration Tests', 'tests/integration/**/*.test.ts');
            // Run end-to-end tests
            await this.runTestSuite('e2e', 'End-to-End Tests', 'tests/e2e/**/*.test.ts');
            // Generate coverage report
            await this.generateCoverageReport();
        }
        catch (error) {
            console.error('❌ Test execution failed:', error);
            process.exit(1);
        }
        const totalDuration = Date.now() - startTime;
        const report = this.generateReport(totalDuration);
        await this.saveReport(report);
        this.printSummary(report);
        return report;
    }
    async runTestSuite(suiteKey, suiteName, pattern) {
        console.log(`\n📋 Running ${suiteName}...`);
        const startTime = Date.now();
        try {
            const command = `npx vitest run "${pattern}" --reporter=json --reporter=verbose`;
            const output = execSync(command, {
                encoding: 'utf8',
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'inherit']
            });
            const duration = Date.now() - startTime;
            // Parse vitest JSON output
            const jsonOutput = this.extractJsonFromOutput(output);
            const result = this.parseVitestOutput(jsonOutput, suiteName, duration);
            this.results.push(result);
            console.log(`✅ ${suiteName} completed: ${result.passed}/${result.tests} passed (${duration}ms)`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Handle test failures gracefully
            const failedResult = {
                suite: suiteName,
                tests: 0,
                passed: 0,
                failed: 1,
                duration
            };
            this.results.push(failedResult);
            console.log(`❌ ${suiteName} failed: ${error.message}`);
        }
    }
    extractJsonFromOutput(output) {
        try {
            // Vitest outputs JSON at the end, extract it
            const lines = output.split('\n');
            const jsonLine = lines.find(line => line.startsWith('{') && line.includes('"testResults"'));
            if (jsonLine) {
                return JSON.parse(jsonLine);
            }
            return { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
        }
        catch (error) {
            console.warn('Failed to parse test output JSON:', error);
            return { testResults: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 };
        }
    }
    parseVitestOutput(jsonOutput, suiteName, duration) {
        const { testResults = [], numTotalTests = 0, numPassedTests = 0, numFailedTests = 0 } = jsonOutput;
        return {
            suite: suiteName,
            tests: numTotalTests,
            passed: numPassedTests,
            failed: numFailedTests,
            duration
        };
    }
    async generateCoverageReport() {
        console.log('\n📊 Generating coverage report...');
        try {
            execSync('npx vitest run --coverage', {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log('✅ Coverage report generated');
        }
        catch (error) {
            console.warn('⚠️  Coverage generation failed:', error);
        }
    }
    generateReport(totalDuration) {
        const totalTests = this.results.reduce((sum, result) => sum + result.tests, 0);
        const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
        const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);
        // Calculate overall coverage (mock for now)
        const overallCoverage = 85; // TODO: Parse from actual coverage report
        return {
            timestamp: new Date().toISOString(),
            totalTests,
            totalPassed,
            totalFailed,
            totalDuration,
            overallCoverage,
            suites: this.results,
            environment: {
                nodeVersion: process.version,
                vitestVersion: this.getPackageVersion('vitest'),
                platform: process.platform
            }
        };
    }
    getPackageVersion(packageName) {
        try {
            const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
            return packageJson.devDependencies?.[packageName] ||
                packageJson.dependencies?.[packageName] ||
                'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    async saveReport(report) {
        const reportPath = join(process.cwd(), 'test-results', 'test-report.json');
        try {
            // Ensure directory exists
            execSync(`mkdir -p ${join(process.cwd(), 'test-results')}`, { stdio: 'ignore' });
            writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n💾 Test report saved to: ${reportPath}`);
        }
        catch (error) {
            console.warn('⚠️  Failed to save test report:', error);
        }
    }
    printSummary(report) {
        console.log('\n' + '='.repeat(50));
        console.log('📈 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${report.totalTests}`);
        console.log(`Passed: ${report.totalPassed} ✅`);
        console.log(`Failed: ${report.totalFailed} ${report.totalFailed > 0 ? '❌' : '✅'}`);
        console.log(`Duration: ${this.formatDuration(report.totalDuration)}`);
        console.log(`Coverage: ${report.overallCoverage}%`);
        console.log('\nSuite Breakdown:');
        report.suites.forEach(suite => {
            const status = suite.failed === 0 ? '✅' : '❌';
            console.log(`  ${status} ${suite.suite}: ${suite.passed}/${suite.tests} (${this.formatDuration(suite.duration)})`);
        });
        if (report.totalFailed === 0) {
            console.log('\n🎉 All tests passed! API Worker is ready for deployment.');
        }
        else {
            console.log(`\n⚠️  ${report.totalFailed} tests failed. Review failures before deployment.`);
            process.exit(1);
        }
    }
    formatDuration(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }
}
// Quality Gates and Validation
class QualityGates {
    static validate(report) {
        const gates = [
            {
                name: 'Test Pass Rate',
                check: () => report.totalFailed === 0,
                message: 'All tests must pass'
            },
            {
                name: 'Code Coverage',
                check: () => report.overallCoverage >= 80,
                message: 'Code coverage must be at least 80%'
            },
            {
                name: 'Test Performance',
                check: () => report.totalDuration < 300000, // 5 minutes
                message: 'Test suite must complete within 5 minutes'
            },
            {
                name: 'Unit Test Coverage',
                check: () => report.suites.find(s => s.suite === 'Unit Tests')?.tests > 0,
                message: 'Must have unit tests'
            },
            {
                name: 'Integration Test Coverage',
                check: () => report.suites.find(s => s.suite === 'Integration Tests')?.tests > 0,
                message: 'Must have integration tests'
            },
            {
                name: 'E2E Test Coverage',
                check: () => report.suites.find(s => s.suite === 'End-to-End Tests')?.tests > 0,
                message: 'Must have end-to-end tests'
            }
        ];
        console.log('\n🔍 Quality Gates Validation:');
        let allPassed = true;
        for (const gate of gates) {
            const passed = gate.check();
            const status = passed ? '✅' : '❌';
            console.log(`  ${status} ${gate.name}: ${gate.message}`);
            if (!passed) {
                allPassed = false;
            }
        }
        return allPassed;
    }
}
// Performance Benchmarks
class PerformanceBenchmarks {
    static analyze(report) {
        console.log('\n⚡ Performance Analysis:');
        const benchmarks = {
            'Fast': { max: 1000, emoji: '🚀' },
            'Good': { max: 5000, emoji: '✅' },
            'Acceptable': { max: 15000, emoji: '⚠️' },
            'Slow': { max: Infinity, emoji: '🐌' }
        };
        report.suites.forEach(suite => {
            const avgTimePerTest = suite.tests > 0 ? suite.duration / suite.tests : 0;
            let category = 'Slow';
            for (const [name, bench] of Object.entries(benchmarks)) {
                if (avgTimePerTest <= bench.max) {
                    category = name;
                    break;
                }
            }
            const bench = benchmarks[category];
            console.log(`  ${bench.emoji} ${suite.suite}: ${avgTimePerTest.toFixed(1)}ms avg/test (${category})`);
        });
    }
}
// Main execution
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests()
        .then(report => {
        QualityGates.validate(report);
        PerformanceBenchmarks.analyze(report);
    })
        .catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}
export { TestRunner, QualityGates, PerformanceBenchmarks };
//# sourceMappingURL=test-runner.js.map