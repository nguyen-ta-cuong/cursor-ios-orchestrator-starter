import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execute, validateConfig, assertReadyForLive, classifyGateExit, errorMessage,
  type EventSink, type GateResult, type GateRequest, type Worker, type WorkflowReport } from './engine.ts';
import { makeWorker, login, models, cancelActive } from './sdk.ts';
import { loadProjectContext } from './context.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const commands = ['--dry-run', '--live', '--login', '--models'];
const selected = commands.filter(command => args.includes(command));
if (selected.length !== 1) throw new Error('Choose exactly one: --dry-run | --live | --login | --models; optionally --config <root-relative JSON path>');
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--config' && args[index + 1]) { index++; continue; }
  if (!commands.includes(args[index])) throw new Error(`Unknown argument: ${args[index]}`);
}
const exec = promisify(execFile);
const inside = (path: string): string => {
  const resolved = resolve(root, path);
  const relativePath = relative(root, resolved);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Task file must be inside the repository');
  return resolved;
};
let stopping = false;
let gateChild: ChildProcess | undefined;
const interruption = new AbortController();
function interrupt(signal: NodeJS.Signals): void {
  // A second signal forces exit when graceful cancellation is itself stuck.
  if (stopping) process.exit(signal === 'SIGINT' ? 130 : 143);
  stopping = true;
  interruption.abort();
  gateChild?.kill(signal);
  void cancelActive();
}
process.on('SIGINT', () => interrupt('SIGINT'));
process.on('SIGTERM', () => interrupt('SIGTERM'));

interface GateExit { code: number | null; signal: NodeJS.Signals | null }
type RunReport = WorkflowReport & { dryRun: boolean; memoryWarnings: string[] };

async function main(): Promise<void> {
  if (selected[0] === '--login') { await login(); console.log('Cursor SDK login complete.'); return; }
  if (selected[0] === '--models') { for (const model of await models()) console.log(model.id); return; }
  const dryRun = selected[0] === '--dry-run';
  const index = args.indexOf('--config');
  const configPath = resolve(root, index === -1 ? 'tools/orchestrator/config.json' : args[index + 1]);
  const config = validateConfig(JSON.parse(await readFile(configPath, 'utf8')));
  const task = await readFile(inside(config.taskFile), 'utf8');
  const initialContext = await loadProjectContext(root, config.skills);
  if (!dryRun) {
    assertReadyForLive(config, task);
    const { stdout } = await exec('git', ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude).orchestrator'], { cwd: root });
    if (stdout.trim()) throw new Error('Live runs require a clean Git tree (excluding .orchestrator). Review and commit your intended setup/changes first; this runner will not commit for you.');
  }
  const directory = resolve(root, '.orchestrator/runs', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(directory, { recursive: true });
  let writes = Promise.resolve();
  const event: EventSink = value => {
    const record = { time: new Date().toISOString(), ...value };
    console.log(JSON.stringify(record));
    writes = writes.then(() => appendFile(resolve(directory, 'events.jsonl'), JSON.stringify(record) + '\n'));
  };
  const memoryWarnings = new Set<string>();
  const reportWarnings = (warnings: string[]): void => {
    for (const message of warnings) {
      if (memoryWarnings.has(message)) continue;
      memoryWarnings.add(message);
      event({ type: 'memory-warning', message });
    }
  };
  event({ type: 'mode', status: dryRun ? 'DRY RUN: fixture agents and gates; no API or Xcode calls' : 'live' });
  reportWarnings(initialContext.memoryWarnings);
  const context = async (): Promise<string> => {
    const current = await loadProjectContext(root, config.skills);
    reportWarnings(current.memoryWarnings);
    return `${current.text}\n\nTask:\n${task}`;
  };
  const fixture: Worker = async ({ milestone, role, round }) => {
    await context();
    if (stopping) throw new Error('Interrupted');
    return role.startsWith('review-')
      ? { status: 'done', findings: role === 'review-contract' && round === 0 ? [{ id: 'fixture-only', severity: 'minor', file: 'dry-run.txt', line: 1, claim: 'Simulated issue', evidence: 'Fixture; no source was inspected', fix: 'Exercise the bounded repair loop' }] : [] }
      : { status: 'done', summary: `Simulated ${milestone.id} ${role}`, filesChanged: [], openIssues: [] };
  };
  const selectedWorker = dryRun ? fixture : await makeWorker({
    root, model: config.model, timeoutMs: config.timeoutMs, context, event, signal: interruption.signal,
  });
  const worker: Worker = async request => {
    if (stopping) throw new Error('Interrupted');
    return selectedWorker(request);
  };
  const gate = async ({ milestone, round }: GateRequest): Promise<GateResult> => {
    if (stopping) throw new Error('Interrupted');
    if (dryRun) return { status: 'passed', summary: 'Fixture gate only; no build or tests executed' };
    const logPath = resolve(directory, `${milestone.id}-gate-${round}.log`);
    const chunks: Buffer[] = [];
    let tail = '';
    let result: GateExit;
    try {
      result = await new Promise<GateExit>((ok, fail) => {
        const child = spawn('bash', [resolve(root, 'tools/ios-harness/check.sh')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
        gateChild = child;
        const collect = (buffer: Buffer): void => { chunks.push(buffer); tail = (tail + buffer.toString()).slice(-12000); };
        child.stdout.on('data', collect); child.stderr.on('data', collect);
        child.once('error', fail); child.once('close', (code, signal) => ok({ code, signal }));
      });
    } finally {
      gateChild = undefined;
      await writeFile(logPath, Buffer.concat(chunks));
    }
    const status = classifyGateExit(result.code, result.signal);
    if (stopping || status === 'blocked') throw new Error(`Gate infrastructure failure or interruption: exit ${result.code}, signal ${result.signal ?? 'none'}; log ${logPath}\n${tail}`);
    return { status, summary: `Exit ${result.code}; log ${logPath}\n${tail}`, artifacts: [logPath] };
  };
  const report: RunReport = { dryRun, ...await execute(config, { worker, gate, event }), memoryWarnings: [...memoryWarnings] };
  if (stopping) { report.status = 'blocked'; report.reason = 'Interrupted by user'; }
  await writes;
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Workflow ${report.status}. Report: ${resolve(directory, 'report.json')}`);
  if (report.reason) console.error(report.reason);
  if (report.status !== 'completed') process.exitCode = stopping ? 130 : 1;
}
main().catch((error: unknown) => { console.error(errorMessage(error)); process.exitCode = 1; });
