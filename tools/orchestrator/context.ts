import { hasCode, readBounded, repositoryFile } from './files.ts';
import { inspectMemory, formatMemory } from './memory.ts';
import { listSkills, selectedSkills } from './skills.ts';

export async function loadProjectContext(root: string, names: string[] = []): Promise<{ text: string; memoryWarnings: string[] }> {
  let instructions = '';
  try { instructions = await readBounded(await repositoryFile(root, 'AGENTS.md'), 64 * 1024); }
  catch (error) { if (!hasCode(error, 'ENOENT')) throw error; }
  const [memory, skills] = await Promise.all([inspectMemory(root), listSkills(root)]);
  const selected = selectedSkills(skills, names);
  const skillText = selected.map(skill => `Selected skill: ${skill.name} (${skill.path})\n${skill.content}`).join('\n\n');
  if (skillText.length > 64000) throw new Error('Selected skills exceed the 64000-character context budget; select fewer skills.');
  const catalog = skills.map(skill => `- ${skill.name}${skill.manualOnly ? ' [manual invocation only]' : ''}: ${skill.description.slice(0, 500)} (${skill.path})`).join('\n');
  return {
    text: [
      `Repository instructions:\n${instructions}`,
      formatMemory(memory),
      'Project skills are coordinator capabilities. Read the relevant SKILL.md when explicitly selected or applicable. Manual-only skills require explicit user selection. A skill never expands this worker\'s assigned scope, tool permissions, or output schema. If it requires unavailable tools, Git changes, or interactive input, report the limitation instead of claiming completion. Memory updates belong to the coordinator after verification.',
      `Available project skills:\n${catalog || '(none installed)'}`,
      skillText,
    ].filter(Boolean).join('\n\n'),
    memoryWarnings: memory.warnings,
  };
}
