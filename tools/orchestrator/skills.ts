import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { hasCode, readBounded, repositoryFile } from './files.ts';

const metadataSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1),
  'disable-model-invocation': z.boolean().optional(),
});
export interface ProjectSkill {
  name: string;
  description: string;
  manualOnly: boolean;
  path: string;
  content: string;
}

export async function listSkills(root: string): Promise<ProjectSkill[]> {
  const skills: ProjectSkill[] = [];
  async function walk(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    const skillFile = children.find(child => child.name === 'SKILL.md');
    if (skillFile) {
      const path = relative(root, resolve(directory, skillFile.name)).split(sep).join('/');
      const content = await readBounded(await repositoryFile(root, path), 128 * 1024);
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      if (!match) throw new Error(`Skill requires YAML frontmatter: ${path}`);
      const metadata = metadataSchema.parse(parse(match[1]));
      if (skills.some(skill => skill.name === metadata.name)) throw new Error(`Duplicate skill name: ${metadata.name}`);
      skills.push({ name: metadata.name, description: metadata.description, manualOnly: metadata['disable-model-invocation'] ?? false, path, content });
      return; // scripts and references belong to this skill, not another discovery root.
    }
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.isDirectory() && !child.name.startsWith('.')) await walk(resolve(directory, child.name));
    }
  }
  try { await walk(resolve(root, '.cursor/skills')); }
  catch (error) {
    // Missing root is legitimate in a project that has not installed skills yet.
    if (hasCode(error, 'ENOENT') && error instanceof Error && 'path' in error && error.path === resolve(root, '.cursor/skills')) return [];
    throw error;
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function selectedSkills(skills: ProjectSkill[], names: string[]): ProjectSkill[] {
  if (new Set(names).size !== names.length) throw new Error('Selected skill names must be unique');
  return names.map(name => {
    const skill = skills.find(item => item.name === name);
    if (!skill) throw new Error(`Unknown project skill: ${name}. Run npm run skills -- list.`);
    return skill;
  });
}
