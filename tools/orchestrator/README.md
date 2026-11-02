# Deterministic local Cursor orchestrator

Run these commands from the repository root with Node.js 22.13 or later. The modules and fixtures are strict TypeScript, checked with the root NodeNext/noEmit configuration and executed directly by `tsx`. Local imports use `.ts` extensions; no compiled JavaScript is checked in.

```bash
npm ci
npm run typecheck
npm test
npm run orchestrator:dry-run
npm run skills -- list
npm run skills -- show why
npm run memory -- show
npm run memory -- check
npm run login
npm run models
```

The default configuration is `tools/orchestrator/config.json`. Copy `tools/orchestrator/config.example.json` to that path before a live run. `npm run orchestrator:dry-run` explicitly uses the supplied example configuration, whose placeholders are permitted only in a dry run. To choose another configuration, run `npm run orchestrator -- --dry-run --config path/to/config.json`. Paths in `--config` and `taskFile` resolve from the repository root, regardless of the terminal's current directory. Configure an account-visible `model.id`, the task document, and milestones. A live run refuses empty task text, unresolved starter placeholders, and the unauthorized example task. Browser login uses the SDK's own credential store and does not print the key. It does not reuse the IDE's sign-in. `CURSOR_API_KEY` is also supported by the SDK; keep it outside project files.

The root package and lockfile own all dependencies: Cursor SDK 1.0.40, Zod 4.6.7, YAML, TypeScript, `tsx`, and Node types. Zod validates untrusted configuration and worker reports and supplies the SDK's peer dependency; YAML parses skill frontmatter. Install only at the root; this directory has no dependencies or separate lockfile. Its compatibility scripts forward to root scripts, including `npm run dry-run`, `npm run live`, `npm run check`, and `npm test` when invoked from this directory.

Before `npm run orchestrator:live`, review and commit the setup and your intended task/configuration so the Git tree is clean. The runner only reads Git status; it never initializes Git, creates branches, commits, or worktrees. Run in a dedicated checkout and avoid simultaneous IDE edits. The `.orchestrator` output directory is excluded from the clean-tree check.

## Project memory and skills

After loading the configuration and task, the runner loads root `AGENTS.md`, curated project memory, the available skill catalog, and selected skill Markdown through `loadProjectContext`. It refreshes that context for every implementer, reviewer, and fixer, including later milestones. The current context precedes the task in each worker prompt. The task itself remains the document loaded at startup.

The optional top-level `skills` configuration defaults to `[]`. Supply unique lowercase kebab-case IDs, for example `"skills": ["unslop"]`, to include their full Markdown. IDs contain lowercase letters or digits with single hyphens between segments, matching the skill catalog's naming rules. Unknown IDs fail before workers start. Use `npm run skills -- list` and `npm run skills -- show <skill-name>` to inspect the installed skills before selecting them. `config.example.json` selects `tdd` for writers, `diagnosing-bugs` for repairs, and `code-review` for the two review lenses. Every worker receives all selected bodies, and each skill states how it applies to runner writers and reviewers; `diagnosing-bugs` applies to writers only. `review-contract` takes the Spec axis and `review-invariants` takes the Standards axis. Because every finding consumes a repair round, the review skill limits runner findings to demonstrated defects.

Memory under `docs/project-memory` is read-only for workers. They must confirm remembered evidence against current source; matching hashes alone do not establish a claim's correctness. Missing or stale evidence emits `memory-warning` events and is retained in the final report's `memoryWarnings` array. Repeated identical warnings are logged once per workflow, and warnings observed before a later failure remain in the blocked report. Malformed memory fails closed. Use `npm run memory -- show` and `npm run memory -- check` to inspect it; the coordinator owns explicit initialization and verified updates through the memory CLI.

Skills cannot expand worker roles, file ownership, tool permissions, or the required JSON report. Interactive tstack workflows, `why` investigations that require shell or external tools, and `grill-me`/grilling sessions that require user answers cannot run fully in a restricted worker. Use those workflows in the interactive coordinator. A worker that needs unavailable interaction or tools must report the limitation; it must not fabricate answers, claim completion, or bypass the restrictions.

## Execution contract

Milestones are sequential. Each milestone runs one implementer, the fixed local Xcode harness, and two independent reviewers in parallel. Reviewers receive the implementation report, gate summary, and artifact/log paths. A reported defect or ordinary build/test failure goes to one fixer. Every fix is followed by another gate and, if that gate passes, both reviewers. Two fixes is the maximum; unresolved findings, including minor ones, block the workflow. A missing, malformed, partial, cancelled, or failed worker result blocks immediately. No subsequent milestone runs. Gate process errors also block. Exit 2 (configuration/infrastructure), 127 (missing executable), 124 (timeout), 130/143 (interruption), and termination signals block without asking a source fixer to repair the environment. Other nonzero gate exits may be repaired within the same two-fix budget.

Every stage creates a fresh SDK agent. Writers receive `read`, `grep`, `glob`, `ls`, and `edit`; reviewers receive only the four read tools. `write` is not an accepted tool selection name in the pinned SDK. Shell, MCP, and task/subagent tools are denied for both. Builds run through `bash tools/ios-harness/check.sh` in the trusted Node runner, never through a model-generated command. Configure that harness separately; its own timeout governs the build/test process.

The SDK adapter loads no ambient settings sources. The shared context loader supplies root `AGENTS.md`, memory, and skill context; the runner adds the task. It does not automatically load `CLAUDE.md` or arbitrary instruction files. Name additional applicable files in the task contract; the agent is instructed to read relevant nested `AGENTS.md` files. Existing hook policy is file-based SDK behavior; this starter does not rewrite or delete it. The SDK's sandbox is enabled, but it is not a complete read-access or file-ownership boundary. Protected paths, including `docs/project-memory`, are instructions, not a filesystem ACL. Use a dedicated checkout; do not treat this as a hostile-code sandbox.

`timeoutMs` bounds each worker from agent creation onward. If agent creation or `send` stalls, timeout or Ctrl-C rejects the worker immediately. Disposal continues in the background because the SDK's disposal can wait on the same stalled executor acquisition, and a late agent or run is disposed or cancelled when it arrives. Once a run has started, timeout requests cancellation, waits for the run to finish, and rejects it. Agents are disposed after every stage. Ctrl-C requests cancellation of active workers and the harness process; a second Ctrl-C exits immediately. Catalog lookup before the first worker is outside the timer. Timeouts and bounded rounds are not a hard financial budget. Check Cursor's account usage controls before lengthy runs.

Reports are validated after JSON parsing; the SDK does not guarantee the final response matches this schema. There is no automatic retry for malformed JSON. Tool event logs record only tool names/status, not tool arguments/results or environment variables. Structured reports and harness diagnostics can still contain source context: review them before sharing. Outputs are under `.orchestrator/runs/<timestamp>/`.

`--dry-run` uses fixture agents and fixture gates. It exercises one simulated repair per milestone and never calls Cursor or Xcode. It is not evidence that the app compiles or the SDK works with your account. Authenticated model calls and an actual Xcode application build are outside fixture validation.

## Schema

Implementation/fix: `{"status":"done","summary":"...","filesChanged":["relative/path"],"openIssues":[]}`. Any other status or unresolved issue stops.

Review: `{"status":"done","findings":[]}`. Each finding requires `id`, `severity` (`blocker`, `major`, `minor`), `file`, positive integer `line`, `claim`, `evidence`, and `fix`. Unexpected fields are rejected. Parent-supplied lens metadata is preserved separately.

## Claude Code workflow generator

`workflow.ts` validates a workflow config and emits a Claude Code Workflow script: the config as a JSON literal followed by `workflow-runtime.js`. `workflow-cli.ts` is the `npm run workflow` entry point. The runtime applies the same milestone contract as `engine.ts` with configurable lenses and Claude Code agents that have full tools: one writer, an independent gate agent, at least two lens reviewers, finding accounting through `fixed` and `rejected`, a fresh gate and review after every repair, at most two repairs, and fail-closed halting. `test/workflow.test.ts` executes generated scripts against stub `agent`, `parallel`, `phase`, and `log` hooks.

## Documentation

- [Cursor SDK](https://cursor.com/docs/sdk/typescript): API contract, tool filtering, auth, cancellation, settings sources, limitations.
- [SDK release notes](https://cursor.com/docs/release-notes/sdk): the pinned `@cursor/sdk` version, 1.0.40, is listed here.
- [Cursor subagents](https://cursor.com/docs/subagents): native IDE delegation; separate from this deterministic runner.
- [Hooks](https://cursor.com/docs/hooks): file-based project policies.
- [Cursor Cookbook](https://github.com/cursor/cookbook): official SDK examples.

Offline fixture tests cover the orchestration state machine and SDK adapter behavior through an injected fixture runtime. They do not authenticate, call live models, run Xcode, or establish behavior with your account and application.
