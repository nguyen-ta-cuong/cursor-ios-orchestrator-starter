# Validation of this starter

Checked on 2 November 2026 on Darwin 27.0.0 arm64 with Node.js 24.18.0 and npm 11.16.0. This records development-tool validation, not an iOS application build or live model run.

## Completed checks

| Check | Result |
| --- | --- |
| Strict TypeScript check against installed Cursor SDK declarations | Passed with TypeScript 6.0.3 |
| Offline behavioral tests | 61 passed, 0 failed, 0 skipped |
| Fresh install from package-lock.json in a temporary directory | Passed |
| Dependency audit | 0 vulnerabilities |
| SDK package import | Agent.create, Cursor.auth.login, and Cursor.models.list available; no calls made |
| Orchestrator fixture run | Completed implementation, gate, both reviews, repair, and fresh gate/reviews |
| Harness command dry run and Bash syntax | Passed; no Xcode command executed |
| Memory CLI | Twelve recorded facts persisted; all evidence hashes unchanged |
| Skills | 23 discovered (7 distilled from mattpocock/skills, 1 from XcodeBuildMCP); 46 installed skill/license file hashes, executable modes, inventories, and dependencies verified by `npm test` |
| Skill support files | Dependency paths and Python watcher syntax checked without executing workflows |
| XcodeBuildMCP | 2.3.2 server started from the repository root with `.xcodebuildmcp/config.yaml` (46 tools); on Xcode 27.0 a throwaway SwiftUI app built and ran on an iPhone 17 simulator, `screenshot` captured it, and a filtered `test_sim` ran 1 of 2 tests and passed. `snapshot_ui` failed: bundled AXe cannot load `SimulatorKit.framework` on Xcode 27 (fixed upstream in 2.7.0) |
| Claude Code workflow generator | 10 tests execute generated scripts with stub hooks; mutations removing the missing-review block, the repair limit, or finding accounting each fail a test. A config reproducing the user's 9-phase Mockphine script generated without placeholders and scheduled A0–A7 plus Final in a stub run. Not run in a live Claude Code session |
| Editor setup | Task JSON parsed, root script targets resolved, configured tsserver.js exists |
| Migration inventory | No .mjs production or test files remain under tools/ |

The tests comprise 29 engine/SDK fixture tests, 6 Xcode-summary validation tests, 8 memory tests, 4 context/skill tests, 2 skill-manifest tests, and 2 CLI integration tests. They cover scheduling, independent reviewer identity, bounded repairs, final re-review, malformed reports, cancellation, SDK cleanup, configuration boundaries, gate failure classification, and test counts. Memory tests cover persistence, update isolation, stale/missing evidence, malformed stores, traversal/symlink/secret-path rejection, write locks, raw UTF-16 evidence changes, retargeted symlinks, and context omissions. CLI tests run copied fixtures from a foreign working directory with the example configuration's selected skills and verify skill loading plus deduplicated warnings in events and report.json. Manifest tests fail on changed bytes or stray files; both failures were reproduced before acceptance.

Independent review found an unsupported SDK tool selection and two memory freshness defects. Regressions reproduced all three before repair. Writer selection now uses the pinned SDK's supported built-in names, evidence hashing uses raw bytes, and recorded evidence retains its supplied path so symlink retargeting is detected. All three regressions pass after repair. A focused independent follow-up accepted all three repairs and reran all 46 tests, typecheck, and the memory check successfully; additional temporary fixtures confirmed rejection of symlinks retargeted to sensitive files, self-evidence, or outside the checkout. SDK selection is checked offline against the installed declaration vocabulary; no live agent was created.

Council round 1 (GPT Sol 9/10, Claude Opus 7/10) found three further contract gaps, each reproduced by a failing regression test before repair: agent creation and send were outside the worker timeout and interruption, worker memory proposals had no valid place in the strict report schemas, and xcodebuild exits 64 and 70 were treated as repairable. Startup is now raced against timeout and interruption with late agents disposed and late runs cancelled, a second signal forces exit, the worker policy routes memory proposals to the writer summary, and 64/70 block. Council round 2 (Claude Opus 8/10, GPT Sol 8/10) found that `diagnosing-bugs` let writers without shell access, and reviewers, follow command-only phases that could block a milestone; that `code-review` diffed commits only, missing uncommitted runner edits; and that an abandoned SDK startup could still hang in disposal, because SDK 1.0.40 disposal awaits the same executor acquisition. The skill phases are now scoped by role, the review diff includes the working tree and untracked files, and abandoned startups dispose in the background; a shared-lease regression reproduced the hang before repair. Council round 3 accepted the work: GPT Sol 9/10 and Claude Opus 9/10. Two optional documentation nits from round 3 were applied afterward without another review: the `code-review` diff uses the merge-base for branch fixed points, and the skills table names both SDK writer roles for `diagnosing-bugs`. The round 3 nit that a live run may linger after a blocked startup until the SDK releases its executor was not changed; a second Ctrl-C exits. Optional nits (rejecting manual-only skill selection, duplicate evidence normalization, run.ts argument and task-path handling, event-log write failure, and the writer's lack of a delete tool) were not changed.

The harness migration also received mock-process checks for locking, cancellation, timeouts, spawn failures, exit interpretation, foreign working directories, and missing tsx. These used temporary fixture executables, not Xcode.

## Reproduce

From the repository root:

```bash
npm ci
npm run check
npm run orchestrator:dry-run
npm run harness:dry-run
bash -n tools/ios-harness/check.sh
npm run memory -- check
npm run skills -- list
npm run skills -- show grill-me
npm audit
```

The nested tools/orchestrator package forwards its scripts to the root installation. It has no independent dependency tree. A new checkout needs the root npm install before fixture commands.

The completed fixture report is retained at `.orchestrator/runs/2026-11-02T08-53-24-190Z/report.json`, with its event log beside it. Run artifacts are ignored by Git. The harness dry run creates no gate run directory.

## Not executed

- Cursor SDK login, model enumeration, or a billable model run.
- Actual Cursor UI skill discovery or editor task execution. The installed layout and metadata were checked against official discovery documentation.
- An Xcode build, simulator test, live xcresult extraction, preview capture, or UI test.
- Operational tstack/why/grilling workflows, GitHub actions, or external messages.
- Git initialization, commits, pushes, branches, or global skill/user-memory changes.

The supplied task and configuration retain placeholders. Complete them for the intended application and establish its baseline before a live run. The memory store describes the starter; initialize separate knowledge when installing this tooling into an app.

## Operating boundaries

Source and fixture evidence do not establish live acceptance. Worker protected paths are instructions, not filesystem controls. The runner has no hard financial cap, resumable checkpoints, or cross-repository simulator lock. Memory hashes detect evidence changes but do not prove a claim true. Interactive skills may require Git, credentials, model providers, MCP connections, or user responses absent from restricted SDK workers.
