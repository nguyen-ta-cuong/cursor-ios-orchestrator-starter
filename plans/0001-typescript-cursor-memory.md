# TypeScript, Cursor skills, and durable project knowledge

This ExecPlan is a living document. Keep Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective current. There is no PLANS.md in this starter.

## Purpose / Big Picture

The starter will run its existing implementation, gate, review, and bounded-repair workflow from strict TypeScript. Cursor users will have repository-local everyday skills, including tstack, unslop, why, and grill-me. Agents will read durable project knowledge with evidence and freshness information before changing code, and the coordinator can record new knowledge after verification.

## Progress

- [x] (2026-11-02) Inspected all orchestration source, existing contracts, and Cursor documentation; identified the upstream skill repositories.
- [x] (2026-11-02) Assigned independent file ownership for skill installation and iOS harness migration.
- [x] (2026-11-02) Converted the orchestrator, SDK adapter, runner, and fixture tests; installed pinned dependencies and passed strict type checking.
- [x] (2026-11-02) Implemented memory storage, freshness checks, CLI commands, SDK context loading, and eight source-backed starter records.
- [x] (2026-11-02) Finished Cursor instructions, editor tasks, 14 local skills, attribution, and setup documentation.
- [x] (2026-11-02) Passed strict typecheck, 46 offline tests, both dry runs, fresh locked installation, SDK import, skill integrity, and memory checks. Reproduced and fixed three independent review findings; a second read-only review accepted all repairs.

## Surprises & Discoveries

The starting folder has no .git metadata and no .codegraph index. Git operations and live orchestration therefore cannot be validated here. t3dotgg/tstack is a skill collection, not an application stack. Original production code consisted of five small JavaScript modules and two test files; the iOS application's Swift code is not included.

TypeScript 7.0.2 passed the compiler check but did not contain lib/tsserver.js, which the classic Cursor workspace SDK setting needs. TypeScript 6.0.3 supplies that file and passes the same strict checks. The initial Zod 4.0.0 dependency had an audit finding; the compatible 4.6.7 patch passes the audit with zero vulnerabilities.

Independent review showed that the pinned SDK rejects write as a selected tool name even though its types allow arbitrary strings. The policy now uses edit for mutation and has a vocabulary regression. Memory initially hashed decoded UTF-8 text and stored resolved evidence paths; both missed real changes in UTF-16 resources or retargeted symlinks. Failing regressions reproduced both problems before switching to raw bytes and preserved caller paths.

## Decision Log

On 2026-11-02, retain Node >=22.13, the pinned Cursor SDK 1.0.40, and the current serial writer / parallel reviewer contracts. Use a root package.json, strict TypeScript, and tsx to run source directly. This avoids checked-in compiled JavaScript and gives Cursor reliable type navigation.

On 2026-11-02, install skills inside .cursor/skills with upstream commit and license attribution. This makes them portable with the project without modifying global agent configuration. Git/PR skills run in the interactive coordinator; deterministic SDK workers retain their restricted tools.

On 2026-11-02, store curated knowledge in docs/project-memory/memory.json with source hashes. The memory CLI records only explicit summaries and repository-relative source paths, never source contents. SDK workers read memory but the coordinator owns updates. This separates durable observations from unverified worker claims.

On 2026-11-02, pin TypeScript 6.0.3 for the existing Cursor editor SDK integration and Zod 4.6.7 for the corrected collection validation behavior. Parse real YAML skill frontmatter with the pinned YAML package rather than an incomplete custom parser. Recheck memory before every worker so source edits become visible as freshness warnings within a run.

On 2026-11-02, accept all three independent review findings and repair them without broadening SDK permissions. Hash raw file bytes, retain repository-relative caller paths, and revalidate realpath containment on every inspection. The full suite grew to 46 passing fixtures; a focused independent follow-up verifies the repairs.

## Context and Orientation

tools/orchestrator/engine.ts validates input and schedules workers, harness gates, two reviews, and at most two repairs. sdk.ts creates fresh Cursor SDK agents; run.ts is the CLI and filesystem integration. tools/ios-harness/check.ts invokes Xcode and validate-summary.ts rejects malformed or zero-execution results. These replace the original .mjs files. .cursor/agents contains three iOS roles and a project researcher; .cursor/rules carries their coordination and memory policies. docs/agent-task.md is intentionally an incomplete example, so a live run must refuse it.

## Plan of Work

Move executable JavaScript and tests to .ts and replace untyped boundaries with validated data and concrete interfaces. Retain check.sh as the stable harness entry point. Add root scripts for typecheck, tests, orchestrator and harness dry runs, memory, and skills. Keep development dependencies out of the shipped iOS app.

Add memory.ts for schema validation, evidence hashing, atomic writes, and context formatting; memory-cli.ts for init, record, show, and check. Add skills.ts and skills-cli.ts for local skill discovery and display. context.ts loads root instructions, current memory, and configured skill text for the SDK adapter. Record real facts about this starter and explain how to initialize different knowledge when copying it into an application.

Update AGENTS.md and Cursor rules to require relevant memory lookup and source verification. Provide concise setup and day-to-day usage documentation. Preserve third-party skill assets and dependency skills instead of copying isolated prompts that cannot run.

## Concrete Steps

Run these from the repository root:

    npm install
    npm run typecheck
    npm test
    npm run orchestrator:dry-run
    npm run harness:dry-run
    npm run skills -- list
    npm run memory -- check

Dependency installation produces package-lock.json; subsequent checkouts use npm ci. Fixtures must complete without Cursor credentials or Xcode. A dry-run workflow must include both reviewer lenses after its simulated repair. The harness dry run must show the planned Xcode invocation without launching it.

## Validation and Acceptance

Strict type checking passes across production and fixture code. Existing scheduling, failure, cancellation, configuration, and test-count assertions remain. New tests prove memory round trips, changed/missing evidence, malformed memory handling, path containment, skill discovery, and integration into context. Skills list includes the requested names and upstream assets resolve locally. Offline success does not establish authenticated SDK operation, actual Cursor UI discovery, or an iOS build.

## Idempotence and Recovery

Memory initialization refuses to overwrite an existing store. Recording replaces only an explicitly named entry via an atomic file replacement. Missing or changed source references make a fact stale; they are never silently marked verified. Project copies initialize their own memory rather than inheriting this starter's business assumptions. Existing task and harness placeholders remain until the user supplies their app's configuration.

## Artifacts and Notes

The original source and tests were inspected before migration. No live SDK run, Xcode build, Git initialization, global skill installation, or changes to personal memory are authorized by this plan.

## Interfaces and Dependencies

The root package owns @cursor/sdk 1.0.40, zod 4.6.7, yaml 2.8.3, TypeScript 6.0.3, tsx 4.23.15, and Node 22 type declarations. The memory interface returns formatted context with warnings and a parsed store. loadProjectContext(root, skills) returns {text, memoryWarnings}; the runner includes it with the task. Skills are Markdown resources rather than executable application dependencies.

## Outcomes & Retrospective

All requested work is implemented. Five production modules and the original fixtures are now TypeScript, with root package and editor setup. Fourteen repository-local skills include all requested upstream content and supporting dependencies. Eight durable observations describe this starter with evidence hashes, and Cursor plus SDK workers have explicit recall and coordinator-owned recording workflows.

Strict type checking, all 46 fixtures, both dry runs, fresh npm ci, SDK import, all 36 skill/license hashes, and memory freshness checks pass. Independent review found and helped close three concrete defects; the follow-up accepted the repairs. VALIDATION.md records exact evidence and the final fixture report. Live authentication/model calls, Cursor UI discovery, and actual Xcode application builds remain unperformed because this work delivers a configured starter, not an application or account-specific run.

The main lesson is that strict types do not validate open-ended SDK tool names or prove file-evidence freshness. Installed SDK vocabulary and raw source bytes need their own meaningful checks.

Change note, 2026-11-02: Created from source inspection and upstream documentation, with parallel ownership boundaries and acceptance criteria.

Change note, 2026-11-02: Completed implementation and independent repair verification; recorded TypeScript editor compatibility, patched dependencies, source-backed memory, and explicit live-validation limits.
