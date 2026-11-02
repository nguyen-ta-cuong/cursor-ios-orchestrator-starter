import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { readBounded, repositoryFile } from './files.ts';

const text = z.string().refine(value => value.trim().length > 0, 'Text must be nonempty');
const effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
const agentOptions = z.strictObject({ model: z.string().min(1).optional(), effort: effort.optional() });
const roles = ['implement', 'gate', 'review', 'fix', 'final', 'critic'] as const;
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
const lensId = /^[a-z][a-z0-9-]*$/;

const milestoneSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/).refine(id => id !== 'Final', 'Final is reserved for the final phase'),
  title: text,
  detail: text.optional(),
  brief: text,
  lenses: z.array(z.string().regex(lensId)).min(2, 'Each milestone needs at least two independent review lenses')
    .refine(lenses => new Set(lenses).size === lenses.length, 'Milestone lenses must be unique'),
});

export const workflowConfigSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Workflow names are kebab-case'),
  description: text,
  root: z.string().refine(isAbsolute, 'root must be an absolute path').optional(),
  vars: z.record(z.string().regex(identifier), z.string()).default({}),
  shared: text.optional(),
  sharedFile: z.string().min(1).optional(),
  writerInstructions: text.default('When done, every gate and the focused tests for what you touched must pass. Report failing gates or tests with their output, and use status "stopped" for a stop condition.'),
  reviewerInstructions: text.default('Assume defects until the source proves otherwise. Report only real defects with file:line evidence, and return findings: [] when there are none. Do not edit files.'),
  lenses: z.record(z.string().regex(lensId), text),
  milestones: z.array(milestoneSchema).min(1),
  maxRepairs: z.number().int().min(0).max(2).default(2),
  minorFindings: z.enum(['always', 'first-round', 'never']).default('first-round'),
  gate: z.strictObject({ instructions: text }).optional(),
  final: z.strictObject({ tester: text.optional(), critic: text.optional() }).default({}),
  agents: z.strictObject(Object.fromEntries(roles.map(role => [role, agentOptions.optional()])) as Record<typeof roles[number], z.ZodOptional<typeof agentOptions>>).default({}),
}).superRefine((config, context) => {
  if ((config.shared === undefined) === (config.sharedFile === undefined)) {
    context.addIssue({ code: 'custom', message: 'Set exactly one of shared or sharedFile' });
  }
  const ids = config.milestones.map(milestone => milestone.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Milestone ids must be unique' });
  for (const milestone of config.milestones) {
    for (const lens of milestone.lenses) {
      if (!(lens in config.lenses)) context.addIssue({ code: 'custom', message: `Milestone ${milestone.id} uses undefined lens ${lens}` });
    }
  }
});

export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;
type ResolvedConfig = Omit<WorkflowConfig, 'sharedFile' | 'shared'> & { shared: string };

const placeholder = /REPLACE_WITH_[A-Z0-9_]*/g;

function assertKnownVariables(config: ResolvedConfig): void {
  const known = new Set(['root']);
  const check = (value: string, where: string): void => {
    for (const match of value.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)) {
      if (!known.has(match[1])) throw new Error(`${where} uses {{${match[1]}}}, which is not root or a variable declared before it`);
    }
  };
  for (const [key, value] of Object.entries(config.vars)) {
    if (key === 'root') throw new Error('vars cannot redefine root; pass it in Workflow args or set root');
    check(value, `vars.${key}`);
    known.add(key);
  }
  check(config.shared, 'shared');
  for (const [lens, value] of Object.entries(config.lenses)) check(value, `lenses.${lens}`);
  for (const milestone of config.milestones) check(milestone.brief, `milestone ${milestone.id}`);
  if (config.gate) check(config.gate.instructions, 'gate.instructions');
  if (config.final.tester) check(config.final.tester, 'final.tester');
  if (config.final.critic) check(config.final.critic, 'final.critic');
}

export async function loadWorkflowConfig(root: string, path: string): Promise<ResolvedConfig> {
  const config = workflowConfigSchema.parse(JSON.parse(await readBounded(await repositoryFile(root, path), 512 * 1024)));
  const { sharedFile, shared, ...rest } = config;
  const resolved = { ...rest, shared: sharedFile ? await readBounded(await repositoryFile(root, sharedFile), 256 * 1024) : shared ?? '' };
  assertKnownVariables(resolved);
  return resolved;
}

export function unresolvedPlaceholders(config: ResolvedConfig): string[] {
  return [...new Set(JSON.stringify(config).match(placeholder) ?? [])];
}

export async function generateWorkflow(config: ResolvedConfig): Promise<string> {
  const runtime = await readFile(new URL('./workflow-runtime.js', import.meta.url), 'utf8');
  const phases = config.milestones.map(milestone => ({ title: milestone.id, detail: milestone.detail ?? milestone.title }));
  if (config.final.tester || config.final.critic) phases.push({ title: 'Final', detail: 'final tester and completeness critic' });
  const meta = { name: config.name, description: config.description, phases };
  return `export const meta = ${JSON.stringify(meta, null, 2)}\n\nconst CONFIG = ${JSON.stringify(config, null, 2)}\n\n${runtime}`;
}
