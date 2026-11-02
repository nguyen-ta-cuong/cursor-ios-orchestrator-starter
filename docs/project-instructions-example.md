# Suggested additions to your existing repository instructions

Merge only the applicable parts into the existing instructions. Do not replace AGENTS.md, CLAUDE.md, or team policy with this example.

## iOS engineering workflow

Follow this repository's established architecture, Swift language mode, deployment target, dependency policy, and source-generation process. Read scoped instructions in the directories you touch.

Treat the TypeScript orchestrator, the agent runtime, and Xcode as development tools. Keep Node dependencies out of the iOS target and application bundle.

The coordinator is the sole writer to shared project metadata and the sole owner of build/test scheduling. Worker agents receive one bounded task and explicit file ownership.

Use the configured build and test gate and preserve its scope. Do not start parallel simulator jobs in the same environment. Do not weaken a failing test or regenerate a golden to conceal an unexplained behavior change.

Review Swift concurrency, cancellation, observable state, accessibility, localization, and resource loading when a change affects them. Do not replace the existing architecture as part of a small feature.

A stopped or incomplete worker blocks dependent milestones. Every repair needs a fresh gate and independent review. Record commands, exit codes, artifacts, and unverified items.

Changes to Git history, publication, releases, account settings, credentials, or the verification policy are separate tasks.

Before nontrivial work, read docs/project-memory/index.md and relevant entries in memory.json. Verify evidence against current source. The coordinator records durable codebase, business-logic, dependency, and decision knowledge after verification; workers report proposed corrections. Initialize fresh memory for this app instead of copying the starter's records. Follow docs/memory.md.

Use .cursor/skills for everyday workflows, including tstack, unslop, why, grill-me, and project-memory. The interactive coordinator owns workflows requiring shell, user input, or Git operations. Skills do not expand SDK worker permissions.

For Claude Code, keep the appropriate instructions in CLAUDE.md or explicitly reference shared instructions there. Cursor and Claude Code do not necessarily discover the same files automatically. The SDK starter explicitly includes root AGENTS.md, project memory, a skill catalog, selected skill bodies, and the task contract; workers read relevant nested AGENTS.md files. It does not automatically include CLAUDE.md; name additional required instruction files in the task contract.
