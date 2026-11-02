import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateTestSummary, type TestSummaryValidation } from './validate-summary.ts';

type StopReason = 'timeout' | 'SIGINT' | 'SIGTERM';

interface CommandExit {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

interface CommandResult extends CommandExit {
  gateExitCode: number;
  stopReason: StopReason | null;
  spawnError: string | null;
  startedAt: string;
  finishedAt: string;
}

type TestVerification = TestSummaryValidation & {
  rawSummaryPath: string;
  extractionLogPath: string;
  extraction: CommandResult | null;
};

const here = dirname(fileURLToPath(import.meta.url));
const root = await realpath(resolve(here, '../..'));
const dryRun = process.argv.length === 3 && process.argv[2] === '--dry-run';
const runID = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const stateDir = resolve(root, '.orchestrator');
const lockDir = resolve(stateDir, 'build-lock');
const runDir = resolve(stateDir, 'gates', runID);
let ownsLock = false;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
function localPath(path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel);
}
async function localDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  requireValue(await realpath(path) === path, `Refusing symlinked output directory: ${path}`);
}

async function runCommand(command: string, args: string[], timeoutSeconds: number, logPath: string, stdoutPath: string | null = null): Promise<CommandResult> {
  const startedAt = new Date().toISOString();
  const log = createWriteStream(logPath, { flags: 'wx' });
  await new Promise<void>((ok, fail) => { log.once('open', () => ok()); log.once('error', fail); });
  const output = stdoutPath ? createWriteStream(stdoutPath, { flags: 'wx' }) : null;
  if (output) await new Promise<void>((ok, fail) => { output.once('open', () => ok()); output.once('error', fail); });
  const child = spawn(command, args, {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  if (output) child.stdout.pipe(output, { end: false });
  let stopReason: StopReason | null = null;
  let spawnError: string | null = null;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  function signalGroup(signal: NodeJS.Signals): void {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); }
    catch (error) { if (!hasErrorCode(error, 'ESRCH')) log.write(`${errorMessage(error)}\n`); }
  }
  function stop(reason: StopReason): void {
    if (stopReason) return;
    stopReason = reason;
    signalGroup('SIGTERM');
    killTimer = setTimeout(() => signalGroup('SIGKILL'), 10_000);
  }
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  const timeout = setTimeout(() => stop('timeout'), timeoutSeconds * 1000);
  child.once('error', error => { spawnError = error.message; log.write(`${error.message}\n`); });
  const result = await new Promise<CommandExit>(ok => child.once('close', (exitCode, signal) => ok({ exitCode, signal })));
  clearTimeout(timeout);
  clearTimeout(killTimer);
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onTerminate);
  await new Promise<void>((ok, fail) => { log.once('error', fail); log.end(ok); });
  if (output) await new Promise<void>((ok, fail) => { output.once('error', fail); output.end(ok); });
  const gateExitCode = stopReason === 'timeout' ? 124 : stopReason === 'SIGINT' ? 130
    : stopReason === 'SIGTERM' ? 143 : spawnError ? 127 : (result.exitCode ?? 1);
  return { ...result, gateExitCode, stopReason, spawnError, startedAt, finishedAt: new Date().toISOString() };
}

async function verifyResults(resultBundle: string): Promise<TestVerification> {
  const rawSummaryPath = resolve(runDir, 'test-summary.json');
  const extractionLogPath = resolve(runDir, 'xcresulttool.log');
  let extraction: CommandResult | null = null;
  try {
    requireValue((await stat(resultBundle)).isDirectory(), 'Missing Xcode result bundle.');
    extraction = await runCommand('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', resultBundle], 60, extractionLogPath, rawSummaryPath);
    requireValue(extraction.gateExitCode === 0, 'Could not extract the Xcode test summary.');
    const raw: unknown = JSON.parse(await readFile(rawSummaryPath, 'utf8'));
    return { ...validateTestSummary(raw), rawSummaryPath, extractionLogPath, extraction };
  } catch (error) {
    return { status: 'blocked', gateExitCode: 2, error: errorMessage(error), counts: null, rawSummaryPath, extractionLogPath, extraction };
  }
}

try {
  requireValue(process.argv.length === 2 || dryRun, 'Usage: bash tools/ios-harness/check.sh [--dry-run]');
  const configuredPath = resolve(here, 'config.json');
  const configPath = dryRun && !existsSync(configuredPath) ? resolve(here, 'config.example.json') : configuredPath;
  requireValue(existsSync(configPath), 'Create tools/ios-harness/config.json from config.example.json first.');
  const parsedConfig: unknown = JSON.parse(await readFile(configPath, 'utf8'));
  requireValue(parsedConfig !== null && typeof parsedConfig === 'object', 'Set exactly one of workspace or project.');
  const config = parsedConfig as Record<string, unknown>;
  const kind = typeof config.workspace === 'string' ? 'workspace' : 'project';
  requireValue((typeof config.workspace === 'string') !== (typeof config.project === 'string'), 'Set exactly one of workspace or project.');
  const configuredProject = config[kind];
  requireValue(typeof configuredProject === 'string' && configuredProject.trim().length > 0, 'Project/workspace path must be nonempty.');
  requireValue(!isAbsolute(configuredProject), 'Project/workspace path must be relative to the repository.');
  requireValue(configuredProject.endsWith(kind === 'workspace' ? '.xcworkspace' : '.xcodeproj'), 'Project/workspace extension does not match its setting.');
  requireValue(typeof config.scheme === 'string' && /^[^\r\n\0]+$/.test(config.scheme) && config.scheme.trim() !== '', 'Set a nonempty scheme.');
  requireValue(Array.isArray(config.unitTestTargets) && config.unitTestTargets.length > 0, 'unitTestTargets must contain at least one unit test bundle name.');
  requireValue(config.unitTestTargets.every((t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_. -]*$/.test(t) && t.trim() === t), 'Use test bundle names only: no paths, suite selectors, or control characters.');
  requireValue(new Set(config.unitTestTargets).size === config.unitTestTargets.length, 'unitTestTargets contains duplicates.');
  const timeoutSeconds = config.timeoutSeconds ?? 1800;
  requireValue(typeof timeoutSeconds === 'number' && Number.isInteger(timeoutSeconds) && timeoutSeconds >= 10 && timeoutSeconds <= 7200, 'timeoutSeconds must be an integer from 10 to 7200.');
  const projectPath = resolve(root, configuredProject);
  requireValue(localPath(projectPath), 'Project/workspace must be inside this repository.');
  if (!dryRun) {
    requireValue(process.platform === 'darwin', 'A real run requires macOS and Xcode. Use --dry-run to inspect arguments elsewhere.');
    requireValue(!JSON.stringify(config).includes('REPLACE_WITH_'), 'Replace every REPLACE_WITH_ placeholder before running.');
    requireValue(typeof config.simulatorUDID === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(config.simulatorUDID), 'Set simulatorUDID to an installed Simulator UUID.');
    requireValue(localPath(await realpath(projectPath)), 'Project/workspace resolves outside the repository.');
    requireValue((await stat(projectPath)).isDirectory(), 'Project/workspace must be a directory.');
  } else {
    requireValue(typeof config.simulatorUDID === 'string' && config.simulatorUDID.trim() !== '', 'Set simulatorUDID or retain the example placeholder for a dry run.');
  }
  const args = ['test', `-${kind}`, projectPath, '-scheme', config.scheme,
    '-destination', `platform=iOS Simulator,id=${config.simulatorUDID}`,
    '-derivedDataPath', resolve(runDir, 'DerivedData'),
    '-resultBundlePath', resolve(runDir, 'Tests.xcresult'),
    '-parallel-testing-enabled', 'NO', ...config.unitTestTargets.map(t => `-only-testing:${t}`)];
  const plan = { runID, configPath, cwd: root, command: 'xcodebuild', args, timeoutSeconds };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...plan }, null, 2));
  } else {
    await localDirectory(stateDir);
    try { await mkdir(lockDir); ownsLock = true; }
    catch (error) { if (hasErrorCode(error, 'EEXIST')) throw new Error('Build lock exists at .orchestrator/build-lock. Another gate may be running; inspect owner.json before clearing a stale lock.'); throw error; }
    await writeFile(resolve(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, runID }, null, 2));
    await localDirectory(resolve(stateDir, 'gates'));
    await mkdir(runDir);
    const logPath = resolve(runDir, 'xcodebuild.log');
    await writeFile(resolve(runDir, 'invocation.json'), JSON.stringify(plan, null, 2));
    const result = await runCommand('xcodebuild', args, timeoutSeconds, logPath);
    const resultBundle = resolve(runDir, 'Tests.xcresult');
    const testVerification = result.gateExitCode === 0 ? await verifyResults(resultBundle) : { status: 'not-run' as const };
    const gateExitCode = testVerification.status === 'not-run' ? result.gateExitCode : testVerification.gateExitCode;
    const summary = { ...plan, ...result, gateExitCode, logPath, resultBundle, testVerification };
    await writeFile(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = gateExitCode;
  }
} catch (error) {
  console.error(JSON.stringify({ error: errorMessage(error), gateExitCode: 2 }));
  process.exitCode = 2;
} finally {
  if (ownsLock) await rm(lockDir, { recursive: true, force: true });
}
