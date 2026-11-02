import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { initMemory, recordMemory, inspectMemory, loadMemory, formatMemory, MEMORY_PATH } from '../memory.ts';

async function fixture(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'orchestrator-memory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'domain.ts'), 'export const limit = 2;\n');
  return root;
}
const fact = { id: 'retry-limit', topic: 'business-logic', summary: 'Two repairs are allowed.', sources: ['domain.ts'] };

test('memory survives reload, updates only the named fact, and refuses reinitialization', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Demo');
  await recordMemory(root, fact);
  await recordMemory(root, { ...fact, id: 'module', topic: 'codebase', summary: 'domain.ts owns the retry limit.' });
  await recordMemory(root, { ...fact, summary: 'At most two source repairs per milestone.' });
  const store = await loadMemory(root);
  assert.equal(store?.entries.length, 2);
  assert.equal(store?.entries.find(entry => entry.id === fact.id)?.summary, 'At most two source repairs per milestone.');
  assert.deepEqual((await inspectMemory(root)).warnings, []);
  await assert.rejects(initMemory(root, 'Overwrite'), /EEXIST/);
  assert.equal((await loadMemory(root))?.project, 'Demo');
});

test('changed and missing evidence becomes stale instead of silently fresh', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Demo');
  await recordMemory(root, fact);
  await writeFile(resolve(root, 'domain.ts'), 'export const limit = 3;\n');
  const changed = await inspectMemory(root);
  assert.match(changed.warnings.join(), /source changed: domain.ts/);
  assert.match(formatMemory(changed), /STALE/);
  await unlink(resolve(root, 'domain.ts'));
  assert.match((await inspectMemory(root)).warnings.join(), /source unavailable/);
});

test('memory hashes raw UTF-16 source bytes without losing non-UTF-8 changes', async t => {
  const root = await fixture(t);
  const source = 'Localizable.strings';
  await writeFile(resolve(root, source), Buffer.from('"label" = "亀";', 'utf16le'));
  await initMemory(root, 'Localized app');
  await recordMemory(root, { ...fact, sources: [source] });
  await writeFile(resolve(root, source), Buffer.from('"label" = "亁";', 'utf16le'));
  assert.match((await inspectMemory(root)).warnings.join(), /source changed: Localizable.strings/);
});

test('memory follows the supplied evidence path and detects a retargeted symlink', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'v1.ts'), 'export const limit = 1;');
  await writeFile(resolve(root, 'v2.ts'), 'export const limit = 2;');
  await unlink(resolve(root, 'domain.ts'));
  await symlink('v1.ts', resolve(root, 'domain.ts'));
  await initMemory(root, 'Linked app');
  const recorded = await recordMemory(root, fact);
  assert.equal(recorded.sources[0].path, 'domain.ts');
  await unlink(resolve(root, 'domain.ts'));
  await symlink('v2.ts', resolve(root, 'domain.ts'));
  assert.match((await inspectMemory(root)).warnings.join(), /source changed: domain.ts/);
});

test('missing, empty, and malformed stores are distinct and never fabricate knowledge', async t => {
  const root = await fixture(t);
  assert.equal((await inspectMemory(root)).store, null);
  await initMemory(root, 'Demo');
  assert.match((await inspectMemory(root)).warnings.join(), /empty/);
  await writeFile(resolve(root, MEMORY_PATH), '{"version":1,"project":"Demo","entries":[{}]}');
  await assert.rejects(inspectMemory(root));
});

test('evidence rejects traversal, external symlinks, secrets, and self-referential memory without mutating the store', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Demo');
  await writeFile(resolve(root, '.env'), 'not-a-real-secret');
  const outside = await mkdtemp(resolve(tmpdir(), 'orchestrator-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(resolve(outside, 'outside.ts'), 'outside');
  await symlink(resolve(outside, 'outside.ts'), resolve(root, 'link.ts'));
  await symlink(resolve(root, '.env'), resolve(root, 'innocent.ts'));
  for (const source of ['../outside.ts', resolve(outside, 'outside.ts'), 'link.ts', '.env', 'innocent.ts', MEMORY_PATH]) {
    await assert.rejects(recordMemory(root, { ...fact, sources: [source] }));
  }
  assert.deepEqual((await loadMemory(root))?.entries, []);
});

test('write locks preserve existing facts and symlinked memory directories are rejected', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Demo');
  await mkdir(resolve(root, 'docs/project-memory/.write-lock'));
  await assert.rejects(recordMemory(root, fact), /writer already active/);
  assert.deepEqual((await loadMemory(root))?.entries, []);
  const redirected = await fixture(t);
  await symlink(resolve(root, 'docs'), resolve(redirected, 'docs'));
  await assert.rejects(initMemory(redirected, 'Other'), /real directory/);
  assert.equal((await loadMemory(root))?.project, 'Demo');
});

test('invalid records preserve the prior file and bounded context explicitly reports omissions', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Demo');
  await recordMemory(root, fact);
  const before = await readFile(resolve(root, MEMORY_PATH), 'utf8');
  await assert.rejects(recordMemory(root, { ...fact, topic: 'invented', sources: [] }));
  assert.equal(await readFile(resolve(root, MEMORY_PATH), 'utf8'), before);
  assert.match(formatMemory(await inspectMemory(root), 10), /1 entries omitted/);
});
