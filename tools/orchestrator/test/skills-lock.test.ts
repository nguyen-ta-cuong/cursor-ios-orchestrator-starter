import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkills } from '../skills.ts';
import { loadProjectContext } from '../context.ts';
import { validateConfig } from '../engine.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

interface LockedFile { path: string; sha256: string; mode: string; sourcePath?: string; upstreamGitBlob?: string }
interface LockedSkill {
  path: string; source: string; dependencies: string[]; interactiveOnly: boolean; files: LockedFile[];
  distilled?: boolean; sourcePath?: string; sourcePaths?: string[]; derivedFrom?: { sourcePath: string; upstreamGitBlob: string }[];
}
interface Lock { sources: Record<string, { licenseFile: LockedFile }>; skills: Record<string, LockedSkill> }

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true, recursive: true });
  return entries.filter(entry => entry.isFile())
    .map(entry => relative(root, resolve(entry.parentPath, entry.name)).split(sep).join('/')).sort();
}

async function assertInstalled(file: LockedFile): Promise<void> {
  const bytes = await readFile(resolve(root, file.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Installed bytes changed: ${file.path}`);
  const executable = ((await stat(resolve(root, file.path))).mode & 0o111) !== 0;
  assert.equal(executable, file.mode === '100755', `Executable mode differs from manifest: ${file.path}`);
}

test('skills-lock.json matches every installed skill file, license, and dependency', async () => {
  const lock = JSON.parse(await readFile(resolve(root, 'skills-lock.json'), 'utf8')) as Lock;
  const installed = await listSkills(root);
  assert.deepEqual(Object.keys(lock.skills).sort(), installed.map(skill => skill.name), 'Every discovered skill needs exactly one manifest entry');
  for (const source of Object.values(lock.sources)) await assertInstalled(source.licenseFile);
  for (const [name, entry] of Object.entries(lock.skills)) {
    assert.equal(entry.path, `.cursor/skills/${name}`);
    assert.deepEqual(entry.files.map(file => file.path).sort(), await filesUnder(entry.path), `Unlisted or missing files in ${name}`);
    for (const file of entry.files) await assertInstalled(file);
    for (const dependency of entry.dependencies) assert.ok(lock.skills[dependency], `${name} depends on missing skill ${dependency}`);
    if (entry.source === 'local') continue;
    assert.ok(lock.sources[entry.source], `${name} cites unknown source ${entry.source}`);
    if (entry.distilled) {
      assert.ok(entry.sourcePaths?.length && entry.derivedFrom?.length, `${name} must record the upstream material it distills`);
      for (const origin of entry.derivedFrom) {
        assert.ok(entry.sourcePaths.some(path => origin.sourcePath.startsWith(`${path}/`)), `${name} derivedFrom is outside its sourcePaths`);
        assert.match(origin.upstreamGitBlob, /^[0-9a-f]{40}$/);
      }
    } else {
      assert.ok(entry.files.every(file => file.sourcePath && /^[0-9a-f]{40}$/.test(file.upstreamGitBlob ?? '')), `${name} copied files need upstream identities`);
    }
  }
});

test('the example configuration selects installed runner skills within the context budget', async () => {
  const config = validateConfig(JSON.parse(await readFile(resolve(root, 'tools/orchestrator/config.example.json'), 'utf8')));
  const lock = JSON.parse(await readFile(resolve(root, 'skills-lock.json'), 'utf8')) as Lock;
  assert.ok(config.skills.length > 0);
  for (const name of config.skills) assert.equal(lock.skills[name]?.interactiveOnly, false, `${name} is not marked runner-compatible`);
  const context = await loadProjectContext(root, config.skills);
  for (const name of config.skills) assert.match(context.text, new RegExp(`Selected skill: ${name} \\(`));
});
