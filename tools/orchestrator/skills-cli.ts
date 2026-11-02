import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkills, selectedSkills } from './skills.ts';
import { errorMessage } from './files.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [command, name, ...extra] = process.argv.slice(2);
try {
  if (extra.length || (command === 'list' && name) || !['list', 'show'].includes(command ?? '') || (command === 'show' && !name)) {
    throw new Error('Usage: npm run skills -- list | show <skill-name>');
  }
  const skills = await listSkills(root);
  if (command === 'show' && name) console.log(selectedSkills(skills, [name])[0].content);
  else for (const skill of skills) console.log(`${skill.name}${skill.manualOnly ? ' (manual)' : ''}\t${skill.description}\n  ${skill.path}`);
} catch (error) { console.error(errorMessage(error)); process.exitCode = 1; }
