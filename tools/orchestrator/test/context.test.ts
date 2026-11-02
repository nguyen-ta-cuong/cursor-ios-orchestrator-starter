import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadProjectContext } from '../context.ts';
import { listSkills, selectedSkills } from '../skills.ts';
import { initMemory, recordMemory } from '../memory.ts';

async function fixture(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'orchestrator-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, '.cursor/skills/planning/grill-me'), { recursive: true });
  await writeFile(resolve(root, '.cursor/skills/planning/grill-me/SKILL.md'), '---\nname: grill-me\ndescription: >\n  Ask about a plan.\ndisable-model-invocation: true\n---\nAsk one question at a time.\n');
  await writeFile(resolve(root, 'AGENTS.md'), 'Keep ownership explicit.\n');
  return root;
}

test('discovers nested skills, parses multiline YAML, and rejects missing or duplicate selections', async t => {
  const root = await fixture(t);
  const skills = await listSkills(root);
  assert.equal(skills[0].name, 'grill-me');
  assert.equal(skills[0].description.trim(), 'Ask about a plan.');
  assert.equal(skills[0].manualOnly, true);
  assert.throws(() => selectedSkills(skills, ['missing']), /Unknown/);
  assert.throws(() => selectedSkills(skills, ['grill-me', 'grill-me']), /unique/);
});

test('SDK context includes instructions, selected skill, and current memory on every load', async t => {
  const root = await fixture(t);
  await initMemory(root, 'Example');
  await recordMemory(root, { id: 'ownership', topic: 'decisions', summary: 'Writers have bounded ownership.', sources: ['AGENTS.md'] });
  const current = await loadProjectContext(root, ['grill-me']);
  assert.match(current.text, /Keep ownership explicit/);
  assert.match(current.text, /Writers have bounded ownership/);
  assert.match(current.text, /Ask one question at a time/);
  assert.deepEqual(current.memoryWarnings, []);
  await writeFile(resolve(root, 'AGENTS.md'), 'Updated policy.\n');
  const next = await loadProjectContext(root, []);
  assert.match(next.text, /Updated policy/);
  assert.match(next.text, /STALE/);
  assert.doesNotMatch(next.text, /Ask one question at a time/);
  assert.equal(next.memoryWarnings.length, 1);
});

test('missing memory is reported and malformed memory or an unavailable selected skill fails closed', async t => {
  const root = await fixture(t);
  assert.match((await loadProjectContext(root)).memoryWarnings.join(), /missing/);
  await assert.rejects(loadProjectContext(root, ['absent']), /Unknown/);
  await initMemory(root, 'Example');
  await writeFile(resolve(root, 'docs/project-memory/memory.json'), 'bad JSON');
  await assert.rejects(loadProjectContext(root));
});

test('duplicate and malformed installed skills cannot be silently selected', async t => {
  const root = await fixture(t);
  await mkdir(resolve(root, '.cursor/skills/duplicate'));
  await writeFile(resolve(root, '.cursor/skills/duplicate/SKILL.md'), '---\nname: grill-me\ndescription: Duplicate\n---\nBody');
  await assert.rejects(listSkills(root), /Duplicate/);
  await writeFile(resolve(root, '.cursor/skills/duplicate/SKILL.md'), 'No frontmatter');
  await assert.rejects(listSkills(root), /frontmatter/);
});
