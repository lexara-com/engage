/**
 * Test Runner - Comprehensive test execution and reporting
 *
 * Orchestrates all test suites and provides detailed reporting
 * for the API worker test harness.
 */
interface TestResult {
    suite: string;
    tests: number;
    passed: number;
    failed: number;
    duration: number;
    coverage?: number;
}
interface TestReport {
    timestamp: string;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalDuration: number;
    overallCoverage: number;
    suites: TestResult[];
    environment: {
        nodeVersion: string;
        vitestVersion: string;
        platform: string;
    };
}
declare class TestRunner {
    private results;
    runAllTests(): Promise<TestReport>;
    private runTestSuite;
    private extractJsonFromOutput;
    private parseVitestOutput;
    private generateCoverageReport;
    private generateReport;
    private getPackageVersion;
    private saveReport;
    private printSummary;
    private formatDuration;
}
declare class QualityGates {
    static validate(report: TestReport): boolean;
}
declare class PerformanceBenchmarks {
    static analyze(report: TestReport): void;
}
export { TestRunner, QualityGates, PerformanceBenchmarks };
//# sourceMappingURL=test-runner.d.ts.map