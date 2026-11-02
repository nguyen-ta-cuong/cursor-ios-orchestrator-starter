import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage } from './files.ts';
import { generateWorkflow, loadWorkflowConfig, unresolvedPlaceholders } from './workflow.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const usage = 'Usage: npm run workflow -- generate [--config <root-relative JSON>] [--out <path>] [--allow-placeholders]';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value. ${usage}`);
  return value;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'generate') throw new Error(usage);
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--config' || args[index] === '--out') { index++; continue; }
    if (args[index] !== '--allow-placeholders') throw new Error(`Unknown argument: ${args[index]}. ${usage}`);
  }
  const configPath = option(args, '--config') ?? 'tools/orchestrator/workflow.json';
  const config = await loadWorkflowConfig(root, configPath);
  const pending = unresolvedPlaceholders(config);
  if (pending.length && !args.includes('--allow-placeholders')) {
    throw new Error(`Replace these placeholders before generating a runnable workflow: ${pending.join(', ')}`);
  }
  const requested = option(args, '--out');
  const out = requested ? (isAbsolute(requested) ? requested : resolve(process.cwd(), requested)) : resolve(root, '.orchestrator/workflows', `${config.name}.js`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, await generateWorkflow(config));
  const lensRuns = config.milestones.reduce((sum, milestone) => sum + milestone.lenses.length, 0);
  console.log(`Wrote ${out}`);
  console.log(`${config.milestones.length} milestones; up to ${(config.maxRepairs + 1) * lensRuns} reviews and ${config.maxRepairs * config.milestones.length} repairs.`);
  if (pending.length) console.log(`Preview only; unresolved placeholders: ${pending.join(', ')}`);
  console.log(`Run it from Claude Code on Opus 5.5 with ultracode: Workflow({ scriptPath: "${out}", args: { root: "${config.root ?? '<absolute repository root>'}" } })`);
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
