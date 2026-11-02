import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { initMemory, recordMemory } from '../memory.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const exec = promisify(execFile);
async function fixture(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'orchestrator-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repository, 'tools/orchestrator'), resolve(root, 'tools/orchestrator'), { recursive: true });
  // The example configuration selects installed skills, so the fixture carries them.
  await cp(resolve(repository, '.cursor/skills'), resolve(root, '.cursor/skills'), { recursive: true });
  await symlink(resolve(repository, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  await mkdir(resolve(root, 'docs'), { recursive: true });
  await writeFile(resolve(root, 'docs/agent-task.md'), 'Fixture task; no real implementation.');
  return root;
}
async function run(root: string): Promise<string> {
  const { stdout } = await exec(process.execPath, [resolve(repository, 'node_modules/tsx/dist/cli.mjs'), resolve(root, 'tools/orchestrator/run.ts'), '--dry-run', '--config', 'tools/orchestrator/config.example.json'], { cwd: tmpdir() });
  return stdout;
}
async function report(root: string): Promise<{ result: Record<string, unknown>; events: Array<Record<string, unknown>> }> {
  const runs = await readdir(resolve(root, '.orchestrator/runs'));
  assert.equal(runs.length, 1);
  const directory = resolve(root, '.orchestrator/runs', runs[0]);
  const result: Record<string, unknown> = JSON.parse(await readFile(resolve(directory, 'report.json'), 'utf8'));
  const events: Array<Record<string, unknown>> = (await readFile(resolve(directory, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { result, events };
}

test('CLI dry run persists and deduplicates missing-memory warnings across every worker', async t => {
  const root = await fixture(t);
  assert.match(await run(root), /Workflow completed/);
  const { result, events } = await report(root);
  assert.equal(result.dryRun, true);
  assert.equal(result.status, 'completed');
  assert.ok(Array.isArray(result.memoryWarnings));
  assert.equal(result.memoryWarnings.length, 1);
  assert.match(String(result.memoryWarnings[0]), /missing/);
  assert.equal(events.filter(event => event.type === 'memory-warning').length, 1);
  assert.ok(events.some(event => event.label === 'A1:review-invariants:1' && event.status === 'done'));
});

test('CLI dry run reports stale evidence and resolves selected skills from a foreign CWD', async t => {
  const root = await fixture(t);
  await initMemory(root, 'CLI fixture');
  await recordMemory(root, { id: 'task', topic: 'business-logic', summary: 'A fixture task.', sources: ['docs/agent-task.md'] });
  await writeFile(resolve(root, 'docs/agent-task.md'), 'Changed fixture task.');
  await mkdir(resolve(root, '.cursor/skills/local'), { recursive: true });
  await writeFile(resolve(root, '.cursor/skills/local/SKILL.md'), '---\nname: local\ndescription: Local fixture skill.\n---\nRead current evidence.');
  const config = JSON.parse(await readFile(resolve(root, 'tools/orchestrator/config.example.json'), 'utf8')) as Record<string, unknown>;
  await writeFile(resolve(root, 'tools/orchestrator/config.example.json'), JSON.stringify({ ...config, skills: ['local'] }));
  await run(root);
  const { result, events } = await report(root);
  assert.equal(result.status, 'completed');
  assert.match(JSON.stringify(result.memoryWarnings), /source changed/);
  assert.equal(events.filter(event => event.type === 'memory-warning').length, 1);
});
