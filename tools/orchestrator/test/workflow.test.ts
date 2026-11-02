import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { generateWorkflow, loadWorkflowConfig, unresolvedPlaceholders } from '../workflow.ts';

type Options = { label: string; phase?: string; schema?: unknown; model?: string; effort?: string };
type Responder = (label: string, prompt: string) => unknown;
interface Call { label: string; prompt: string; options: Options }

const base = {
  name: 'demo-flow',
  description: 'Demo milestones with lens reviews',
  vars: { RES: '{{root}}/docs/research' },
  shared: 'Source of truth: {{RES}}/plan.md.',
  lenses: { invariants: 'Lens: INVARIANTS.', contract: 'Lens: CONTRACT against {{RES}}/goldens.' },
  milestones: [
    { id: 'A1', title: 'A1 goldens', brief: 'Freeze the goldens.', lenses: ['contract', 'invariants'] },
    { id: 'A2', title: 'A2 extract', brief: 'Extract the executor.', lenses: ['invariants', 'contract'] },
  ],
  gate: { instructions: 'make lint && make build' },
  final: { tester: 'Run every gate and the full unit run.', critic: 'Compare the result with the plan.' },
  agents: { gate: { effort: 'low' }, review: { model: 'claude-opus-5-5' } },
};

async function scriptFor(t: test.TestContext, config: object = base): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'workflow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'tools/orchestrator'), { recursive: true });
  await writeFile(resolve(root, 'tools/orchestrator/workflow.json'), JSON.stringify(config));
  return generateWorkflow(await loadWorkflowConfig(root, 'tools/orchestrator/workflow.json'));
}

const done = (extra: object = {}) => ({ status: 'done', summary: 'ok', filesChanged: ['A.swift'], testsAddedOrChanged: [], gates: 'passed', focusedTests: 'MockTests/Suite', renders: [], deviations: [], openIssues: [], ...extra });
const passed = { status: 'passed', summary: 'all green', commands: [{ command: 'make build', exitCode: 0, excerpt: '' }] };
const clean = { findings: [] };
const finding = (id: string, severity = 'major') => ({ id, severity, file: 'A.swift', line: 3, claim: 'Wrong', evidence: 'Source', fix: 'Correct it' });

function defaults(label: string): unknown {
  if (label.endsWith(':implement') || label === 'final:test') return done();
  if (label.includes(':gate-')) return passed;
  if (label.includes(':review-')) return clean;
  if (label.includes(':fix-')) return { ...done(), fixed: [], rejected: [] };
  if (label === 'final:critic') return 'Nothing missing.';
  throw new Error(`Unexpected agent ${label}`);
}

async function run(script: string, respond: Responder = defaults, args: unknown = { root: '/repo' }) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...params: string[]) => (...values: unknown[]) => Promise<unknown>;
  const body = script.replace(/^export const meta = /, 'const meta = ');
  const agent = async (prompt: string, options: Options) => { calls.push({ label: options.label, prompt, options }); return respond(options.label, prompt); };
  const parallel = (thunks: Array<() => Promise<unknown>>) => Promise.all(thunks.map(thunk => thunk().catch(() => null)));
  const result = await new AsyncFunction('agent', 'parallel', 'phase', 'log', 'args', body)(agent, parallel, () => {}, (message: string) => logs.push(message), args) as Record<string, any>;
  return { result, calls, labels: calls.map(call => call.label), logs };
}

test('generated meta is a pure literal whose phases match milestones and Final', async t => {
  const script = await scriptFor(t);
  assert.match(script, /^export const meta = \{/);
  const meta = JSON.parse(script.slice('export const meta = '.length, script.indexOf('\n\nconst CONFIG')));
  assert.deepEqual(meta.phases.map((phase: { title: string }) => phase.title), ['A1', 'A2', 'Final']);
  assert.equal(meta.name, 'demo-flow');
});

test('a clean run gates and reviews every milestone with each lens, then runs the final tester and critic', async t => {
  const { result, calls, labels } = await run(await scriptFor(t));
  assert.equal(result.status, 'completed');
  assert.deepEqual(labels, ['A1:implement', 'A1:gate-r0', 'A1:review-contract-r0', 'A1:review-invariants-r0', 'A2:implement', 'A2:gate-r0', 'A2:review-invariants-r0', 'A2:review-contract-r0', 'final:test', 'final:critic']);
  assert.equal(calls.find(call => call.label === 'A1:gate-r0')?.options.effort, 'low');
  assert.equal(calls.find(call => call.label === 'A1:review-contract-r0')?.options.model, 'claude-opus-5-5');
  assert.equal(calls.find(call => call.label === 'A1:implement')?.options.model, undefined, 'Unset roles inherit the session model');
  for (const call of calls) assert.doesNotMatch(call.prompt, /\{\{/, `${call.label} kept an unresolved variable`);
  assert.match(calls[0].prompt, /Source of truth: \/repo\/docs\/research\/plan\.md/);
  assert.match(calls[2].prompt, /CONTRACT against \/repo\/docs\/research\/goldens/);
});

test('a missing lens review blocks the milestone and halts later milestones', async t => {
  const { result, labels, logs } = await run(await scriptFor(t), label => label === 'A1:review-contract-r0' ? null : defaults(label));
  assert.equal(result.status, 'blocked');
  assert.match(result.milestones[0].reason, /review missing for lens contract/);
  assert.ok(!labels.includes('A2:implement'));
  assert.ok(!labels.includes('final:test'), 'No completed milestone to test');
  assert.ok(labels.includes('final:critic'));
  assert.ok(logs.some(message => /Not run: A2/.test(message)));
});

test('every repair, including the last allowed one, is gated and reviewed again, then unresolved findings block', async t => {
  const { result, labels } = await run(await scriptFor(t), (label, prompt) => {
    if (label.startsWith('A1:review-invariants')) return { findings: [finding('race')] };
    if (label.startsWith('A1:fix-')) return { ...done(), fixed: [...prompt.matchAll(/"id": "(invariants:[^"]+)"/g)].map(match => match[1]), rejected: [] };
    return defaults(label);
  });
  assert.equal(result.status, 'blocked');
  assert.equal(labels.filter(label => label.startsWith('A1:fix-')).length, 2);
  assert.equal(labels.filter(label => label.startsWith('A1:gate-')).length, 3);
  assert.equal(labels.filter(label => label.startsWith('A1:review-invariants')).length, 3);
  assert.match(result.milestones[0].reason, /remain after 2 repairs/);
});

test('a repair must account for every finding in fixed or rejected', async t => {
  const { result } = await run(await scriptFor(t), label => {
    if (label === 'A1:review-contract-r0') return { findings: [finding('golden'), finding('bytes')] };
    if (label === 'A1:fix-r1') return { ...done(), fixed: ['contract:golden:0'], rejected: [] };
    return defaults(label);
  });
  assert.equal(result.status, 'blocked');
  assert.match(result.milestones[0].reason, /missing contract:bytes:1/);
});

test('rejected findings and their evidence go back to the reviewers in the next round', async t => {
  const { result, calls } = await run(await scriptFor(t), label => {
    if (label === 'A1:review-contract-r0') return { findings: [finding('golden')] };
    if (label === 'A1:fix-r1') return { ...done(), fixed: [], rejected: [{ id: 'contract:golden:0', evidence: 'Fixtures/Agent/tools.json:1 already pins it' }] };
    return defaults(label);
  });
  assert.equal(result.status, 'completed');
  assert.match(calls.find(call => call.label === 'A1:review-contract-r1')?.prompt ?? '', /already pins it/);
});

test('a failed gate goes to the repair writer without reviews, and a blocked gate stops the milestone', async t => {
  const script = await scriptFor(t);
  const failing = await run(script, label => {
    if (label === 'A1:gate-r0') return { status: 'failed', summary: 'lint failed', commands: [{ command: 'make lint', exitCode: 2, excerpt: 'opening_brace' }] };
    if (label === 'A1:fix-r1') return { ...done(), fixed: ['gate-r0'], rejected: [] };
    return defaults(label);
  });
  assert.equal(failing.result.status, 'completed');
  assert.ok(!failing.labels.includes('A1:review-contract-r0'));
  assert.match(failing.calls.find(call => call.label === 'A1:fix-r1')?.prompt ?? '', /opening_brace/);
  assert.ok(failing.labels.includes('A1:review-contract-r1'));
  const blocked = await run(script, label => label === 'A1:gate-r0' ? { status: 'blocked', summary: 'no simulator', commands: [] } : defaults(label));
  assert.match(blocked.result.milestones[0].reason, /gate was blocked/);
});

test('minor findings are repaired in the first round only and later ones are logged as deferred', async t => {
  const { result, labels, logs } = await run(await scriptFor(t), (label, prompt) => {
    if (label.startsWith('A1:review-invariants')) return { findings: [finding('naming', 'minor')] };
    if (label === 'A1:fix-r1') return { ...done(), fixed: [...prompt.matchAll(/"id": "(invariants:[^"]+)"/g)].map(match => match[1]), rejected: [] };
    return defaults(label);
  });
  assert.equal(result.status, 'completed');
  assert.equal(labels.filter(label => label.startsWith('A1:fix-')).length, 1);
  assert.ok(logs.some(message => /1 minor deferred by policy/.test(message)));
});

test('partial or stopped writers block, and a run without a root refuses to start', async t => {
  const script = await scriptFor(t);
  const partial = await run(script, label => label === 'A1:implement' ? done({ status: 'partial', openIssues: ['simulator unavailable'] }) : defaults(label));
  assert.match(partial.result.milestones[0].reason, /partial: simulator unavailable/);
  await assert.rejects(run(script, defaults, null), /Pass the repository root/);
});

test('configuration errors fail before generation', async t => {
  const broken = [
    { ...base, milestones: [{ ...base.milestones[0], lenses: ['security'] }] },
    { ...base, shared: 'Uses {{UNKNOWN}}.' },
    { ...base, maxRepairs: 3 },
    { ...base, milestones: [{ ...base.milestones[0], id: 'Final' }] },
    { ...base, sharedFile: 'docs/shared.md' },
    { ...base, agents: { review: { effort: 'ultracode' } } },
    { ...base, milestones: [{ ...base.milestones[0], lenses: ['contract'] }] },
  ];
  for (const config of broken) await assert.rejects(scriptFor(t, config));
  const root = await mkdtemp(resolve(tmpdir(), 'workflow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'tools/orchestrator'), { recursive: true });
  await writeFile(resolve(root, 'tools/orchestrator/workflow.json'), JSON.stringify({ ...base, gate: { instructions: 'REPLACE_WITH_GATE_COMMANDS' } }));
  assert.deepEqual(unresolvedPlaceholders(await loadWorkflowConfig(root, 'tools/orchestrator/workflow.json')), ['REPLACE_WITH_GATE_COMMANDS']);
});
