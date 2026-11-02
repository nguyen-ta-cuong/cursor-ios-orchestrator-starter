// Field names verified against MobileBuildMCP's xcresulttool parser:
// https://github.com/getsentry/MobileBuildMCP/blob/2847efff/src/utils/test-common.ts
const countNames = ['totalTestCount', 'passedTests', 'failedTests', 'skippedTests'] as const;
type SummaryCounts = Record<typeof countNames[number], number>;

export interface TestCounts extends SummaryCounts {
  executedTests: number;
}

export type TestSummaryValidation =
  | { status: 'blocked'; gateExitCode: 2; error: string; counts: TestCounts | null }
  | { status: 'failed'; gateExitCode: 65; error: string; counts: TestCounts }
  | { status: 'passed'; gateExitCode: 0; error: null; counts: TestCounts };

function hasSummaryCounts(summary: object): summary is SummaryCounts {
  const values = summary as Record<string, unknown>;
  return countNames.every(name => {
    if (!Object.hasOwn(summary, name)) return false;
    const value = values[name];
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  });
}

export function validateTestSummary(summary: unknown): TestSummaryValidation {
  const blocked = (error: string, counts: TestCounts | null = null): TestSummaryValidation => ({ status: 'blocked', gateExitCode: 2, error, counts });
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return blocked('Unrecognized Xcode test summary: expected an object.');
  }
  if (!hasSummaryCounts(summary)) {
    return blocked('Unrecognized Xcode test summary: missing or invalid top-level test counts.');
  }
  const counts: TestCounts = {
    totalTestCount: summary.totalTestCount,
    passedTests: summary.passedTests,
    failedTests: summary.failedTests,
    skippedTests: summary.skippedTests,
    executedTests: 0,
  };
  counts.executedTests = counts.passedTests + counts.failedTests;
  const accountedTests = counts.executedTests + counts.skippedTests;
  if (!Number.isSafeInteger(accountedTests) || counts.totalTestCount < accountedTests) {
    return blocked('Inconsistent Xcode test counts.', counts);
  }
  if (counts.executedTests === 0) {
    return blocked('No passing or failing tests executed. Check target selection and skipped tests.', counts);
  }
  if (counts.failedTests > 0) {
    return { status: 'failed', gateExitCode: 65, error: 'The result bundle contains failed tests.', counts };
  }
  return { status: 'passed', gateExitCode: 0, error: null, counts };
}
