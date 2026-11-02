import { z } from 'zod';

const nonemptyText = z.string().refine(value => value.trim().length > 0, 'Text must be nonempty');
const milestoneSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  title: nonemptyText,
  brief: nonemptyText,
}).passthrough();
const configSchema = z.object({
  model: z.object({
    id: z.string().min(1),
    params: z.array(z.strictObject({ id: z.string(), value: z.string() })).optional(),
  }).passthrough(),
  taskFile: z.string().min(1),
  maxFixes: z.number().int().min(0).max(2),
  timeoutMs: z.number().int().min(1000),
  milestones: z.array(milestoneSchema).min(1).refine(
    milestones => new Set(milestones.map(milestone => milestone.id)).size === milestones.length,
    'milestone IDs must be unique',
  ),
  skills: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Skill IDs must be kebab-case'))
    .refine(skills => new Set(skills).size === skills.length, 'skill IDs must be unique').default([]),
}).passthrough();

const findingSchema = z.strictObject({
  id: nonemptyText,
  severity: z.enum(['blocker', 'major', 'minor']),
  file: nonemptyText,
  line: z.number().int().positive(),
  claim: nonemptyText,
  evidence: nonemptyText,
  fix: nonemptyText,
});
const reviewSchema = z.strictObject({ status: z.literal('done'), findings: z.array(findingSchema) });
const implementationSchema = z.strictObject({
  status: z.string(), summary: z.string(), filesChanged: z.array(z.string()), openIssues: z.array(z.string()),
});
const gateSchema = z.object({
  status: z.enum(['passed', 'failed']), summary: z.string(), artifacts: z.array(z.string()).optional(),
}).passthrough();

export type Config = z.infer<typeof configSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type ReviewReport = z.infer<typeof reviewSchema>;
export type ImplementationReport = Omit<z.infer<typeof implementationSchema>, 'status'> & { status: 'done' };
export type GateResult = z.infer<typeof gateSchema>;
export type GateStatus = GateResult['status'] | 'blocked';
export type WriterRole = 'implement' | 'fix';
export type ReviewRole = 'review-contract' | 'review-invariants';
export type WorkerRole = WriterRole | ReviewRole;
export type RepairFinding = (Finding & { lens: ReviewRole }) | {
  id: 'build-gate'; severity: 'blocker'; evidence: string; fix: string;
};

export interface WorkerRequest {
  milestone: Milestone;
  role: WorkerRole;
  round: number;
  previous: ImplementationReport | null;
  findings: RepairFinding[];
  gateResult: GateResult | null;
}
export interface GateRequest { milestone: Milestone; round: number }
// Reports from models and external gates remain untrusted until validated.
export type Worker = (request: WorkerRequest) => unknown | Promise<unknown>;
export type Gate = (request: GateRequest) => unknown | Promise<unknown>;
export type WorkflowEvent =
  | { type: 'worker'; label: string; status: 'started' | 'done' }
  | { type: 'gate'; label: string; status: 'started' | GateResult['status'] }
  | { type: 'workflow'; label: string; status: 'blocked' }
  | { type: 'mode'; status: string }
  | { type: 'tool'; label: string; name: string; status: string }
  | { type: 'usage'; label: string; tokens: number | null }
  | { type: 'memory-warning'; message: string };
export type EventSink = (event: WorkflowEvent) => void;
export type RecordedReview = (ReviewReport & { lens: ReviewRole }) | {
  lens: ReviewRole; status: 'failed'; error: string;
};
export interface RoundReport {
  round: number;
  gate: GateResult;
  reviews?: RecordedReview[];
  fix?: ImplementationReport;
}
export interface MilestoneReport {
  id: string;
  rounds: RoundReport[];
  implementation?: ImplementationReport;
  status?: 'completed';
}
export interface WorkflowReport {
  status: 'running' | 'completed' | 'blocked';
  milestones: MilestoneReport[];
  reason?: string;
}
export interface ExecutionDependencies { worker: Worker; gate: Gate; event?: EventSink }

function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function validateConfig(value: unknown): Config {
  return configSchema.parse(value);
}

export function assertReadyForLive(config: unknown, task: string): void {
  const pending = /REPLACE_WITH_[A-Z0-9_]*|YOUR_MODEL[A-Z0-9_]*|NONE_UNLESS_THIS_APP_ALREADY_USES_THEM/;
  requireThat(task.trim().length > 0, 'Complete the task contract before a live run');
  requireThat(!pending.test(JSON.stringify(config) ?? '') && !pending.test(task), 'Complete configuration and the task contract: unresolved starter placeholders remain');
  requireThat(!task.includes('This is an example, not authorization to change an unspecified app.') && !task.includes('Replace this paragraph with the real user outcome.'), 'Replace the example task with an authorized, concrete task before a live run');
}

export function classifyGateExit(code: number | null, signal: NodeJS.Signals | null): GateStatus {
  // 64 and 70 are xcodebuild usage and destination/internal errors, which source repairs cannot fix.
  if (signal || code === null || [2, 64, 70, 127, 124, 130, 143].includes(code)) return 'blocked';
  return code === 0 ? 'passed' : 'failed';
}

export function validateReport(value: unknown, review?: false): ImplementationReport;
export function validateReport(value: unknown, review: true): ReviewReport;
export function validateReport(value: unknown, review: boolean): ImplementationReport | ReviewReport;
export function validateReport(value: unknown, review = false): ImplementationReport | ReviewReport {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (review) return reviewSchema.parse(parsed);
  const report = implementationSchema.parse(parsed);
  requireThat(report.status === 'done' && report.openIssues.length === 0,
    `Worker ${report.status}: ${report.summary}; open issues: ${report.openIssues.join('; ')}`);
  return { ...report, status: 'done' };
}

export async function execute(input: unknown, { worker, gate, event = () => {} }: ExecutionDependencies): Promise<WorkflowReport> {
  const config = validateConfig(input);
  const report: WorkflowReport = { status: 'running', milestones: [] };
  let label = 'initialization';
  function call(m: Milestone, role: WriterRole, round: number, previous: ImplementationReport | null, findings: RepairFinding[], gateResult?: GateResult | null): Promise<ImplementationReport>;
  function call(m: Milestone, role: ReviewRole, round: number, previous: ImplementationReport | null, findings: RepairFinding[], gateResult?: GateResult | null): Promise<ReviewReport>;
  async function call(m: Milestone, role: WorkerRole, round: number, previous: ImplementationReport | null, findings: RepairFinding[], gateResult: GateResult | null = null): Promise<ImplementationReport | ReviewReport> {
    label = `${m.id}:${role}:${round}`;
    event({ type: 'worker', label, status: 'started' });
    const value = validateReport(await worker({ milestone: m, role, round, previous, findings, gateResult }), role.startsWith('review-'));
    event({ type: 'worker', label: `${m.id}:${role}:${round}`, status: 'done' });
    return value;
  }
  try {
    for (const m of config.milestones) {
      const entry: MilestoneReport = { id: m.id, rounds: [] };
      report.milestones.push(entry);
      let current = await call(m, 'implement', 0, null, []);
      entry.implementation = current;
      for (let round = 0; round <= config.maxFixes; round++) {
        label = `${m.id}:gate:${round}`;
        event({ type: 'gate', label, status: 'started' });
        const g = gateSchema.parse(await gate({ milestone: m, round }));
        event({ type: 'gate', label, status: g.status });
        const record: RoundReport = { round, gate: g };
        entry.rounds.push(record);
        let findings: RepairFinding[];
        if (g.status === 'failed') {
          findings = [{ id: 'build-gate', severity: 'blocker', evidence: g.summary, fix: 'Repair only failures caused by this milestone; preserve the harness and gates.' }];
        } else {
          const roles: ReviewRole[] = ['review-contract', 'review-invariants'];
          const settled = await Promise.allSettled(roles.map(role => call(m, role, round, current, [], g)));
          const reviews: RecordedReview[] = settled.map((result, index) => result.status === 'fulfilled'
            ? { lens: roles[index], ...result.value }
            : { lens: roles[index], status: 'failed', error: errorMessage(result.reason) });
          record.reviews = reviews;
          const failures = reviews.flatMap(review => review.status === 'failed' ? [`${review.lens} failed: ${review.error}`] : []);
          requireThat(failures.length === 0, failures.join('; '));
          findings = reviews.flatMap(review => review.status === 'done'
            ? review.findings.map(finding => ({ ...finding, lens: review.lens })) : []);
        }
        if (findings.length === 0) { entry.status = 'completed'; break; }
        requireThat(round < config.maxFixes, `Unresolved findings or failed gate after ${config.maxFixes} fixes`);
        current = await call(m, 'fix', round + 1, current, findings, g);
        record.fix = current;
      }
    }
    report.status = 'completed';
  } catch (error) {
    report.status = 'blocked';
    report.reason = `${label}: ${errorMessage(error)}`;
    event({ type: 'workflow', label, status: 'blocked' });
  }
  return report;
}
