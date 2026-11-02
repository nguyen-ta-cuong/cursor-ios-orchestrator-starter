import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTestSummary } from './validate-summary.ts';

const passing = { totalTestCount: 3, passedTests: 2, failedTests: 0, skippedTests: 1 };

test('requires actual passing tests, preserving skipped count', () => {
  const result = validateTestSummary(passing);
  assert.equal(result.gateExitCode, 0);
  assert.ok(result.counts);
  assert.equal(result.counts.executedTests, 2);
  assert.equal(result.counts.skippedTests, 1);
});

test('zero-test successful builds and all-skipped runs cannot pass', () => {
  for (const totalTestCount of [0, 10]) {
    const result = validateTestSummary({ totalTestCount, passedTests: 0, failedTests: 0, skippedTests: totalTestCount });
    assert.equal(result.status, 'blocked');
    assert.equal(result.gateExitCode, 2);
  }
});

test('failed tests return the build/test failure code even with passing tests', () => {
  const result = validateTestSummary({ ...passing, failedTests: 1, skippedTests: 0 });
  assert.equal(result.status, 'failed');
  assert.equal(result.gateExitCode, 65);
});

test('missing, negative, fractional, and string counters fail closed', () => {
  for (const bad of [null, [], {}, { ...passing, passedTests: -1 },
    { ...passing, passedTests: 1.5 }, { ...passing, passedTests: '2' },
    { ...passing, failedTests: undefined }, { ...passing, skippedTests: NaN }]) {
    assert.equal(validateTestSummary(bad).gateExitCode, 2);
  }
});

test('impossible counts cannot pass', () => {
  assert.equal(validateTestSummary({ ...passing, totalTestCount: 1 }).gateExitCode, 2);
  assert.equal(validateTestSummary({ ...passing, skippedTests: 4 }).gateExitCode, 2);
  assert.equal(validateTestSummary({ ...passing, skippedTests: 2 }).gateExitCode, 2);
});

test('nested device counters do not substitute for top-level evidence', () => {
  const result = validateTestSummary({ devicesAndConfigurations: [passing] });
  assert.equal(result.gateExitCode, 2);
});
