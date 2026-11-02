import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { AgentOptions, Run, RunResult } from '@cursor/sdk';
import { execute, validateConfig, validateReport, assertReadyForLive, classifyGateExit,
  type Finding, type GateResult, type ImplementationReport, type ReviewReport, type WorkerRequest } from '../engine.ts';
import { cancelActive, makeWorker, type WorkerRuntime } from '../sdk.ts';

const config = { model: { id: 'fixture' }, taskFile: 'task.md', maxFixes: 2, timeoutMs: 1000, milestones: [{ id: 'A1', title: 'Feature', brief: 'Deliver it' }, { id: 'A2', title: 'Next', brief: 'Only after A1 passes' }] };
const done = (): ImplementationReport => ({ status: 'done', summary: 'Changed source', filesChanged: ['A.swift'], openIssues: [] });
const clean = (): ReviewReport => ({ status: 'done', findings: [] });
const finding = (): Finding => ({ id: 'R1', severity: 'major', file: 'A.swift', line: 3, claim: 'Wrong result', evidence: 'Current source returns the wrong branch', fix: 'Correct the branch' });
const passed = async (): Promise<GateResult> => ({ status: 'passed', summary: 'Checked by fixture' });

test('only reviews run concurrently; milestones wait for both reviews', async () => {
  const events: string[] = [];
  let reviewers = 0;
  let highWater = 0;
  let release = (): void => {};
  const together = new Promise<void>(resolve => { release = resolve; });
  const result = await execute(config, { gate: passed, worker: async ({ milestone, role }) => {
    events.push(`${milestone.id}:${role}:start`);
    if (role.startsWith('review-')) {
      reviewers++; highWater = Math.max(highWater, reviewers);
      if (reviewers === 2) release();
      await together;
      reviewers--;
      events.push(`${milestone.id}:${role}:end`);
      return clean();
    }
    assert.equal(reviewers, 0);
    return done();
  } });
  assert.equal(result.status, 'completed');
  assert.equal(highWater, 2);
  assert.ok(events.indexOf('A2:implement:start') > events.indexOf('A1:review-invariants:end'));
});

test('two fixes always receive a final review; unresolved final findings block next milestone', async () => {
  const calls: string[] = [];
  const result = await execute(config, { gate: passed, worker: async p => {
    calls.push(`${p.milestone.id}:${p.role}:${p.round}`);
    return p.role.startsWith('review-') ? { status: 'done', findings: [finding()] } : done();
  } });
  assert.equal(result.status, 'blocked');
  assert.equal(calls.filter(x => x.includes(':fix:')).length, 2);
  assert.ok(calls.includes('A1:review-contract:2'));
  assert.ok(calls.includes('A1:review-invariants:2'));
  assert.ok(!calls.some(x => x.startsWith('A2:')));
});

test('clean post-fix review advances and records both lenses', async () => {
  const result = await execute(config, { gate: passed, worker: async ({ role, round }) => role.startsWith('review-') ? { status: 'done', findings: round === 0 ? [finding()] : [] } : done() });
  assert.equal(result.status, 'completed');
  const reviews = result.milestones[0].rounds[1].reviews;
  assert.ok(reviews);
  assert.deepEqual(reviews.map(r => r.lens), ['review-contract', 'review-invariants']);
});

const invalidReviewResponses: [string, unknown][] = [['null', null], ['partial', { status: 'partial', findings: [] }], ['invalid JSON', 'not-json'], ['wrong schema', { findings: [] }]];
for (const [label, response] of invalidReviewResponses) {
  test(`a ${label} reviewer blocks, including when the other reviewer is clean`, async () => {
    const result = await execute(config, { gate: passed, worker: async ({ role }) => role === 'review-contract' ? response : role.startsWith('review-') ? clean() : done() });
    assert.equal(result.status, 'blocked');
    assert.equal(result.milestones.length, 1);
    assert.equal(result.milestones[0].rounds[0].fix, undefined);
  });
}

test('cancelled/error reviewer rejects instead of becoming an empty findings list', async () => {
  const result = await execute(config, { gate: passed, worker: async ({ role }) => { if (role === 'review-invariants') throw new Error('SDK run cancelled'); return role.startsWith('review-') ? clean() : done(); } });
  assert.equal(result.status, 'blocked');
  assert.match(result.reason ?? '', /cancelled/);
  const reviews = result.milestones[0].rounds[0].reviews;
  assert.ok(reviews);
  assert.equal(reviews[0].status, 'done');
  assert.equal(reviews[1].status, 'failed');
});

test('a failed gate gets a bounded repair and reviewers inspect the repaired result', async () => {
  let gates = 0;
  const calls: string[] = [];
  const result = await execute({ ...config, milestones: config.milestones.slice(0, 1) }, {
    gate: async () => ({ status: ++gates === 1 ? 'failed' : 'passed', summary: 'Fixture compiler diagnostic' }),
    worker: async p => { calls.push(p.role); if (p.role === 'fix') assert.equal(p.findings[0].id, 'build-gate'); return p.role.startsWith('review-') ? clean() : done(); },
  });
  assert.equal(result.status, 'completed');
  assert.equal(gates, 2);
  assert.deepEqual(calls, ['implement', 'fix', 'review-contract', 'review-invariants']);
});

test('infrastructure failure blocks immediately, and partial implementation never reaches gate', async () => {
  const failed = await execute(config, { gate: async () => { throw new Error('xcodebuild missing'); }, worker: done });
  assert.equal(failed.status, 'blocked');
  assert.match(failed.reason ?? '', /xcodebuild missing/);
  const partial = await execute(config, { gate: () => assert.fail('must not run'), worker: async () => ({ ...done(), status: 'partial', summary: 'Missing supplied image' }) });
  assert.equal(partial.status, 'blocked');
  assert.match(partial.reason ?? '', /Missing supplied image/);
});

test('invalid configuration, report extras, and invented line numbers are rejected', () => {
  assert.throws(() => validateConfig({ ...config, maxFixes: 3 }));
  assert.throws(() => validateConfig({ ...config, milestones: [{ title: 'X', brief: 'Y' }] }));
  assert.throws(() => validateReport({ ...done(), fabricated: true }));
  assert.throws(() => validateReport({ status: 'done', findings: [{ ...finding(), line: 0 }] }, true));
});

test('reviewers receive gate summary and artifact paths alongside the implementation report', async () => {
  let inspected = 0;
  const evidence: GateResult = { status: 'passed', summary: 'Scoped test result from the harness', artifacts: ['/repo/.orchestrator/gates/run/Tests.xcresult'] };
  const result = await execute({ ...config, milestones: config.milestones.slice(0, 1) }, {
    gate: async () => evidence,
    worker: async p => {
      if (!p.role.startsWith('review-')) return done();
      assert.deepEqual(p.gateResult, evidence);
      assert.deepEqual(p.previous, done());
      inspected++;
      return clean();
    },
  });
  assert.equal(result.status, 'completed');
  assert.equal(inspected, 2);
});

test('configuration errors, missing binaries, timeouts and cancellation cannot become source repairs', () => {
  for (const code of [2, 127, 124, 130, 143, null]) assert.equal(classifyGateExit(code, null), 'blocked');
  assert.equal(classifyGateExit(null, 'SIGTERM'), 'blocked');
  // xcodebuild reports usage (64) and destination/internal errors (70) that no source repair can fix.
  for (const code of [64, 70]) assert.equal(classifyGateExit(code, null), 'blocked');
  assert.equal(classifyGateExit(65, null), 'failed');
  assert.equal(classifyGateExit(1, null), 'failed');
  assert.equal(classifyGateExit(0, null), 'passed');
});

test('live preflight refuses unresolved placeholders and the unauthorized example contract', () => {
  assert.throws(() => assertReadyForLive({ ...config, model: { id: 'REPLACE_WITH_MODEL_ID' } }, 'Real task'));
  assert.throws(() => assertReadyForLive(config, 'Files: REPLACE_WITH_REAL_PATH'));
  assert.throws(() => assertReadyForLive(config, 'This is an example, not authorization to change an unspecified app.'));
  assert.throws(() => assertReadyForLive(config, ' \n\t'));
  assert.doesNotThrow(() => assertReadyForLive(config, 'Fix the empty-state view in App/Features/ with focused tests.'));
});

test('skills default to empty and accept only unique kebab-case IDs', () => {
  assert.deepEqual(validateConfig(config).skills, []);
  assert.deepEqual(validateConfig({ ...config, skills: ['why', 'grill-me', 'ios-v2', '3d-view'] }).skills, ['why', 'grill-me', 'ios-v2', '3d-view']);
  for (const skills of [null, 'why', [1], [''], ['Why'], ['two_words'], ['../why'], ['why/else'], ['why--else'], ['-why'], ['why-'], ['why', 'why']]) {
    assert.throws(() => validateConfig({ ...config, skills }), `Accepted invalid skills: ${JSON.stringify(skills)}`);
  }
  assert.equal(Object.hasOwn(config, 'skills'), false, 'Validation must not mutate the caller configuration');
});

test('configuration and reports retain their validation boundaries', () => {
  const invalidConfigs: unknown[] = [null, [], {},
    { ...config, model: { id: '' } },
    { ...config, model: { id: 'fixture', params: [{ id: 'x', value: 'y', extra: true }] } },
    { ...config, timeoutMs: 999 }, { ...config, timeoutMs: 1000.5 },
    { ...config, maxFixes: -1 }, { ...config, maxFixes: 0.5 },
    { ...config, milestones: [] }, { ...config, milestones: [config.milestones[0], config.milestones[0]] },
    { ...config, milestones: [{ id: 'bad/id', title: 'Title', brief: 'Brief' }] },
    { ...config, milestones: [{ id: 'A1', title: ' ', brief: 'Brief' }] },
  ];
  for (const value of invalidConfigs) assert.throws(() => validateConfig(value));
  assert.throws(() => validateReport({ ...done(), openIssues: ['Needs follow-up'] }), /Needs follow-up/);
  assert.throws(() => validateReport({ ...clean(), extra: true }, true));
  assert.throws(() => validateReport({ status: 'done', findings: [{ ...finding(), evidence: ' ' }] }, true));
  assert.throws(() => validateReport({ status: 'done', findings: [{ ...finding(), severity: 'info' }] }, true));
});

test('zero fixes still runs both reviews and blocks on any demonstrated finding', async () => {
  const roles: string[] = [];
  const result = await execute({ ...config, maxFixes: 0 }, {
    gate: passed,
    worker: request => {
      roles.push(request.role);
      return request.role.startsWith('review-') ? { status: 'done', findings: [finding()] } : done();
    },
  });
  assert.equal(result.status, 'blocked');
  assert.deepEqual(roles, ['implement', 'review-contract', 'review-invariants']);
});

test('malformed gates block without reviews or source fixes', async () => {
  for (const value of [null, { status: 'blocked', summary: 'Environment unavailable' }, { status: 'passed' }]) {
    const roles: string[] = [];
    const result = await execute(config, { gate: () => value, worker: request => { roles.push(request.role); return done(); } });
    assert.equal(result.status, 'blocked');
    assert.deepEqual(roles, ['implement']);
  }
});

type FixtureRun = Pick<Run, 'cancel' | 'status' | 'stream' | 'wait'>;
const request = (role: WorkerRequest['role'] = 'implement'): WorkerRequest => ({
  milestone: config.milestones[0], role, round: 0, previous: null, findings: [], gateResult: null,
});
function finishedRun(result: RunResult = { id: 'fixture', status: 'finished', result: JSON.stringify(done()) }): FixtureRun {
  return { status: result.status, async *stream() {}, wait: async () => result, cancel: async () => {} };
}
function fixtureRuntime(runFactory: () => FixtureRun = () => finishedRun()) {
  const options: AgentOptions[] = [];
  const prompts: string[] = [];
  let disposals = 0;
  let closes = 0;
  const runtime: WorkerRuntime = {
    listModels: async () => [{ id: 'fixture', displayName: 'Fixture' }],
    createAgent: async option => {
      options.push(option);
      return {
        send: async prompt => { prompts.push(prompt); return runFactory(); },
        close: () => { closes++; },
        [Symbol.asyncDispose]: async () => { disposals++; },
      };
    },
  };
  return { runtime, options, prompts, get disposals() { return disposals; }, get closes() { return closes; } };
}
const workerOptions = { root: '/fixture', model: { id: 'fixture' }, timeoutMs: 1000, context: 'Fixture context', event: () => {} };

test('worker tool policies use the pinned SDK built-in vocabulary', async () => {
  // ToolName includes a string escape hatch, so tsc alone accepts invalid names.
  // Our restricted workers use built-ins only, all declared in the pinned SDK.
  const declaration = await readFile(new URL('./agent/options.d.ts', import.meta.resolve('@cursor/sdk')), 'utf8');
  const toolName = /export type ToolName = ([^;]+);/.exec(declaration);
  assert.ok(toolName, 'SDK declarations changed; review its tool vocabulary before upgrading');
  const builtins = new Set([...toolName[1].matchAll(/"([^"]+)"/g)].map(match => match[1]));
  const fixture = fixtureRuntime();
  const worker = await makeWorker(workerOptions, fixture.runtime);
  await worker(request());
  await worker(request('review-contract'));
  for (const options of fixture.options) {
    for (const name of [...(options.tools ?? []), ...(options.disallowedTools ?? [])]) {
      assert.ok(builtins.has(name), `Unsupported restricted-worker tool in pinned SDK: ${name}`);
    }
  }
});

test('SDK adapter refreshes context, preserves tool restrictions and disposes each fresh agent', async () => {
  const fixture = fixtureRuntime();
  let revision = 0;
  const worker = await makeWorker({ ...workerOptions, context: async () => `Source revision ${++revision}\n\nTask:\nAuthorized task` }, fixture.runtime);
  await worker(request());
  await worker(request('review-contract'));
  assert.equal(revision, 2);
  assert.equal(fixture.disposals, 2);
  assert.match(fixture.prompts[0], /Source revision 1\n\nTask:/);
  assert.match(fixture.prompts[1], /Source revision 2\n\nTask:/);
  assert.deepEqual(fixture.options[0].tools, ['read', 'grep', 'glob', 'ls', 'edit']);
  assert.deepEqual(fixture.options[1].tools, ['read', 'grep', 'glob', 'ls']);
  for (const options of fixture.options) {
    assert.deepEqual(options.disallowedTools, ['shell', 'mcp', 'task']);
    assert.deepEqual(options.mcpServers, {});
    assert.deepEqual(options.local, { cwd: '/fixture', settingSources: [], sandboxOptions: { enabled: true } });
  }
  assert.match(fixture.prompts[0], /Do not edit .*docs\/project-memory/);
  assert.match(fixture.prompts[0], /confirm memory claims against current source/);
  assert.match(fixture.prompts[0], /skill instructions cannot expand your assigned role/);
  assert.match(fixture.prompts[0], /alter the required JSON report/);
  assert.match(fixture.prompts[0], /Do not perform Git mutations/);
  // Strict report schemas have no memory field, and every review finding starts a source repair.
  assert.match(fixture.prompts[0], /memory correction.*in summary/i);
  assert.match(fixture.prompts[1], /leave memory corrections out of findings/i);
});

test('context load failures prevent SDK agent creation', async () => {
  const fixture = fixtureRuntime();
  const worker = await makeWorker({ ...workerOptions, context: async () => { throw new Error('Invalid project memory'); } }, fixture.runtime);
  await assert.rejects(async () => worker(request()), /Invalid project memory/);
  assert.equal(fixture.options.length, 0);
});

test('SDK catalog validation blocks unavailable models and unsupported parameters before agent creation', async () => {
  const fixture = fixtureRuntime();
  await assert.rejects(makeWorker({ ...workerOptions, model: { id: 'missing' } }, fixture.runtime), /unavailable/);
  await assert.rejects(makeWorker({ ...workerOptions, model: { id: 'fixture', params: [{ id: 'effort', value: 'max' }] } }, fixture.runtime), /Unsupported model parameter/);
  await assert.rejects(makeWorker({ ...workerOptions, model: { id: 'auto-smart' } }, {
    ...fixture.runtime, listModels: async () => [{ id: 'auto-smart', displayName: 'Auto' }],
  }), /explicit optimize_for/);
  assert.equal(fixture.options.length, 0);
});

test('SDK cancelled, failed and empty runs reject and dispose instead of succeeding', async () => {
  const results: RunResult[] = [
    { id: 'fixture', status: 'cancelled' },
    { id: 'fixture', status: 'error', error: { message: 'Fixture failure' } },
    { id: 'fixture', status: 'finished', result: ' ' },
  ];
  for (const result of results) {
    const fixture = fixtureRuntime(() => finishedRun(result));
    const worker = await makeWorker(workerOptions, fixture.runtime);
    await assert.rejects(async () => worker(request()), /SDK run cancelled|Fixture failure|empty final report/);
    assert.equal(fixture.disposals, 1);
  }
});

test('SDK timeout waits for cancellation and rejects even a finished report', async () => {
  let finish = (): void => {};
  const ended = new Promise<void>(resolve => { finish = resolve; });
  let cancellations = 0;
  const fixture = fixtureRuntime(() => ({
    get status() { return cancellations > 0 ? 'finished' : 'running'; },
    async *stream() { await ended; },
    wait: async () => ({ id: 'fixture', status: 'finished', result: JSON.stringify(done()) }),
    cancel: async () => { cancellations++; finish(); },
  }));
  const worker = await makeWorker({ ...workerOptions, timeoutMs: 5 }, fixture.runtime);
  await assert.rejects(async () => worker(request()), /Worker timeout/);
  assert.equal(cancellations, 1);
  assert.equal(fixture.disposals, 1);
});

test('SDK cleanup still disposes and removes active runs when cancellation throws', async () => {
  let cancellations = 0;
  const fixture = fixtureRuntime(() => ({
    status: 'running',
    async *stream() { throw new Error('Stream failed'); },
    wait: async () => ({ id: 'fixture', status: 'error' }),
    cancel: async () => { cancellations++; throw new Error('Cancellation failed'); },
  }));
  const worker = await makeWorker(workerOptions, fixture.runtime);
  await assert.rejects(async () => worker(request()), /Cancellation failed/);
  assert.equal(fixture.disposals, 1);
  await cancelActive();
  assert.equal(cancellations, 1);
});

test('an interruption during asynchronous context loading prevents work from starting', async () => {
  const fixture = fixtureRuntime();
  const controller = new AbortController();
  const worker = await makeWorker({
    ...workerOptions, signal: controller.signal,
    context: async () => { controller.abort(); return 'Updated context'; },
  }, fixture.runtime);
  await assert.rejects(async () => worker(request()), /Interrupted/);
  assert.equal(fixture.options.length, 0);
});

test('SDK timeout covers a stalled send and cancels the late run', async () => {
  let lateCancels = 0;
  let deliver = (_run: FixtureRun): void => {};
  const fixture = fixtureRuntime();
  const runtime: WorkerRuntime = {
    ...fixture.runtime,
    createAgent: async option => ({
      ...await fixture.runtime.createAgent(option),
      send: () => new Promise<FixtureRun>(resolve => { deliver = resolve; }),
    }),
  };
  const worker = await makeWorker({ ...workerOptions, timeoutMs: 5 }, runtime);
  await assert.rejects(async () => worker(request()), /Worker timeout/);
  assert.equal(fixture.disposals, 1);
  deliver({ ...finishedRun(), cancel: async () => { lateCancels++; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lateCancels, 1);
});

test('an interruption during a stalled agent creation rejects promptly and disposes the late agent', async () => {
  const fixture = fixtureRuntime();
  const controller = new AbortController();
  let deliver = (): void => {};
  const runtime: WorkerRuntime = {
    ...fixture.runtime,
    createAgent: option => new Promise(resolve => { deliver = () => resolve(fixture.runtime.createAgent(option)); }),
  };
  const worker = await makeWorker({ ...workerOptions, timeoutMs: 60_000, signal: controller.signal }, runtime);
  const pending = Promise.resolve(worker(request()));
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /Interrupted/);
  deliver();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.disposals, 1);
  assert.equal(fixture.prompts.length, 0);
});

test('an abandoned startup does not wait on disposal that shares the stalled executor acquisition', async () => {
  // SDK 1.0.40 disposal awaits the same executor lease that a stalled send is acquiring.
  let acquire = (): void => {};
  const lease = new Promise<void>(resolve => { acquire = resolve; });
  let disposals = 0;
  const runtime: WorkerRuntime = {
    listModels: async () => [{ id: 'fixture', displayName: 'Fixture' }],
    createAgent: async () => ({
      send: async () => { await lease; return finishedRun(); },
      close: () => {},
      [Symbol.asyncDispose]: async () => { await lease; disposals++; },
    }),
  };
  const worker = await makeWorker({ ...workerOptions, timeoutMs: 5 }, runtime);
  const outcome = await Promise.race([
    Promise.resolve(worker(request())).then(() => 'resolved', (error: unknown) => String(error)),
    new Promise(resolve => setTimeout(() => resolve('hung'), 500)),
  ]);
  assert.match(String(outcome), /Worker timeout/);
  assert.equal(disposals, 0);
  acquire();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(disposals, 1, 'Late disposal still completes once the lease settles');
});
