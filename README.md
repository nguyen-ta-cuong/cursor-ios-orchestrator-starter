# Cursor iOS orchestrator starter

Strict TypeScript tooling for working on an existing iOS app in Cursor: scoped agents, a deterministic implementation/review/repair loop, an Xcode test gate, everyday skills, and durable project memory. It adds development tools, not dependencies to the shipped app.

## Set up on a Mac with Cursor

Requirements: macOS with Xcode and an iOS Simulator runtime, Node.js 22.13 or later, [Cursor](https://cursor.com), and Homebrew.

```bash
git clone https://github.com/nguyen-ta-cuong/cursor-ios-orchestrator-starter.git
cd cursor-ios-orchestrator-starter
npm ci
npm run check                 # strict typecheck and offline tests
npm run orchestrator:dry-run  # fixture agents and gate; no Cursor or Xcode calls
npm run harness:dry-run       # prints the planned Xcode command
brew install xcodebuildmcp    # Simulator build, run, test, and screenshots for Cursor
```

Then open the folder in Cursor:

1. **Skills, rules, and subagents load from the repository.** Open **Customize** in the sidebar to see them, or type `/` in Agent chat. Cursor discovers them at startup, so reload the window (⇧⌘P → Developer: Reload Window) if they do not appear.
2. **Enable XcodeBuildMCP.** Cursor reads [.cursor/mcp.json](.cursor/mcp.json); open **Customize** in the sidebar and turn on the `XcodeBuildMCP` toggle. On Xcode 27, `brew upgrade xcodebuildmcp` to 2.7.0 or later before using its UI-automation tools.
3. **Point it at your app.** Copy `tools/ios-harness/config.example.json` to `tools/ios-harness/config.json` and fill in the workspace or project, scheme, simulator UUID (`xcrun simctl list devices available`), and unit-test bundles. Complete [docs/agent-task.md](docs/agent-task.md) for the work you want done. To work inside an existing app repository instead, see [Bring the starter into an existing repository](#bring-the-starter-into-an-existing-repository).
4. **Try it.** Follow [Use it in the Cursor IDE](#use-it-in-the-cursor-ide).
5. **Optional unattended runner.** `npm run login` signs in to the Cursor SDK, `npm run models` lists model IDs, and `npm run orchestrator:live` runs the configured milestones from a clean Git tree. Copy `tools/orchestrator/config.example.json` to `tools/orchestrator/config.json` first.

Terminal → Run Task offers the same commands from `.vscode/tasks.json`. [VALIDATION.md](VALIDATION.md) records what was checked and what was not. This is a starter for an existing app; no app source is included.

## Use it in the Cursor IDE

Everything below happens in Agent chat (⌘L or ⌘I). Type `/` to pick a skill or subagent; a `/skill` applies to that one message.

### What Cursor loads from this repository

| Piece | Where | How it applies |
| --- | --- | --- |
| Instructions | `AGENTS.md` | Every chat |
| Rules | `.cursor/rules/*.mdc` | `ios-orchestration` and `project-memory` always; `typescript` for `tools/**/*.ts`; `xcode-build-run` when you build, run, or test the app |
| Skills | `.cursor/skills/*/SKILL.md` | Agent picks relevant ones itself; manual-only ones (`/grill-me`, `/to-milestones`, `/to-workflow`, `/handoff`, `/why`, `/unslop`) run only when you type them |
| Subagents | `.cursor/agents/*.md` | `/project-researcher`, `/ios-implementer`, `/ios-correctness-reviewer`, `/ios-ui-reviewer`, or by name in a prompt; the two reviewers and the researcher are read-only |
| MCP | `.cursor/mcp.json` | XcodeBuildMCP tools once its toggle is on; Cursor asks before each tool call unless your run mode allows it |

### A feature from idea to merge-ready

Example prompts, in order. Replace the parts in angle brackets.

1. **Recall what is known.** `/project-memory What do we know about <area>?` On a new app, first run `npm run memory -- init --project "<App>"`, then `/project-researcher Map ownership, business rules, and dependencies for <area>` and ask Agent to record the verified findings.
2. **Pin down the plan.** `/grill-me I want to <feature>.` Answer its questions one at a time until the decisions are settled.
3. **Write the contract.** `/to-milestones` turns the agreed plan into `docs/agent-task.md` and runner milestones. Read and edit it; it is what every agent works against.
4. **Implement with review.** `Follow .cursor/rules/ios-orchestration.mdc for milestone A1.` Agent hands the work to `/ios-implementer`, runs the gate (`npm run harness`), then has `/ios-correctness-reviewer` and `/ios-ui-reviewer` review in parallel, and repairs findings at most twice. For a small change, skip the ceremony: `/tdd <change>`.
5. **See it running.** `Build and run the app in the Simulator and take a screenshot of <screen>.` Approve the XcodeBuildMCP calls. Use `Run only <Suite>/<test>` for a single test.
6. **Debug.** `/diagnosing-bugs <symptom>` builds a reproduction first, ranks hypotheses, and ends with a regression test.
7. **Review the change.** `/code-review against main` reviews it against the task contract and the repository rules separately.
8. **Keep the knowledge.** `/domain-modeling` for new terms and hard-to-reverse decisions; `/project-memory record <finding>` for other verified facts. Run `npm run memory -- check` before committing.
9. **Hand off or ship.** `/handoff` writes a summary for a fresh chat. `/file-pr` and `/babysit-pr` handle the pull request when you ask.

### Other ways in

- **Terminal → Run Task** runs the checks, dry runs, memory check, and the live runner from `.vscode/tasks.json`.
- **Unattended runner:** `npm run orchestrator:live` runs the configured milestones with Cursor SDK agents; see [below](#run-the-deterministic-typescript-orchestrator).
- **Claude Code:** `/to-workflow` generates a workflow script to run there; see [below](#generate-a-claude-code-ultracode-workflow).

### Troubleshooting

- **A skill, rule, or subagent is missing:** reload the window; Cursor discovers them at startup. Check that the folder name matches the skill's `name`.
- **XcodeBuildMCP does not start:** run `which xcodebuildmcp`. If Cursor cannot find it, put that absolute path (usually `/opt/homebrew/bin/xcodebuildmcp`) in `command` in `.cursor/mcp.json`.
- **"Missing required session defaults":** ask Agent to set the XcodeBuildMCP defaults from `tools/ios-harness/config.json`.
- **`snapshot_ui` or `tap` fails with a SimulatorKit error:** `brew upgrade xcodebuildmcp` to 2.7.0 or later.
- **The gate refuses to run:** finish `tools/ios-harness/config.json`; `npm run harness:dry-run` shows what it will execute.

## Everyday skills

The full [t3dotgg/tstack](https://github.com/t3dotgg/tstack) collection is included, along with Cursor pstack's [unslop](https://github.com/cursor/plugins/tree/main/pstack/skills/unslop) and [why](https://github.com/cursor/plugins/tree/main/pstack/skills/why), Matt Pocock's `grill-me` and `grilling`, seven skills distilled from [mattpocock/skills](https://github.com/mattpocock/skills) for this harness, and a local `project-memory` skill.

- `/grill-me`: work through ambiguities and tradeoffs before implementation.
- `/why`: investigate why code or a decision exists, with evidence and uncertainty.
- `/unslop`: make prose concrete and direct.
- `/project-memory`: recall and record durable project knowledge.
- `/tdd`, `/diagnosing-bugs`, and `/code-review`: test-first implementation, loop-first debugging, and two-axis review. The example runner configuration also gives these to SDK workers.
- `/to-milestones`: turn an agreed plan into `docs/agent-task.md` and runner milestones.
- `/domain-modeling`: settle domain terms and hard-to-reverse decisions, then record them in project memory.
- `/to-workflow`: turn an agreed plan into a Claude Code ultracode workflow with an independent gate, per-milestone review lenses, and bounded repairs.
- `/xcodebuildmcp`: XcodeBuildMCP's official tool guide, used with `.cursor/rules/xcode-build-run.mdc` to build and run in the Simulator.
- `/writing-for-agents` and `/handoff`: edit skills, rules, and agent instructions; hand a session to a fresh agent.
- `/council` and `/sol-loop`: independent reviews when the required model providers are available.
- `/file-pr`, `/full-stop`, `/full-send`, `/takeover`, `/modernize`, and `/babysit-pr`: Git/PR workflows when requested and configured.

See [docs/skills.md](docs/skills.md) for requirements, limitations, pinned source revisions, and update instructions. Skill installation does not invoke a workflow. Git and PR skills need a GitHub remote, an authenticated `gh`, and your request before they act. The complete supporting files and licenses are included.

## Memory for the project you are working on

[docs/project-memory/index.md](docs/project-memory/index.md) points to the durable knowledge store. Records cover code ownership, business rules, dependencies, and decisions. Each fact cites source files and records their hashes. Agents verify relevant evidence before reusing a fact; changed files are flagged as stale.

```bash
npm run memory -- show
npm run memory -- check
npm run memory -- record --id bounded-repairs --topic business-logic --summary "Each milestone permits at most two repairs, with another gate and independent review after each repair." --source tools/orchestrator/engine.ts
```

The coordinator records knowledge after reading source and verifying the work. SDK workers read memory and report corrections; they do not update it. The runner refreshes memory before each worker and includes warnings in its report. Memory stays in the repository across sessions, without storing source contents or credentials automatically.

The seeded memory describes **this starter**. When bringing the toolkit into an app, exclude `docs/project-memory/memory.json` and initialize knowledge for the actual app:

```bash
npm run memory -- init --project "Your app"
```

This refuses to overwrite an existing store. Ask the `project-researcher` agent to map the application's architecture, business logic, and dependencies, review the findings, then record them. See [docs/memory.md](docs/memory.md) for freshness, update ownership, and storage limits.

## Build and run with XcodeBuildMCP

The coordinator builds, runs, tests, debugs, and screenshots the app in the Simulator through [XcodeBuildMCP](https://github.com/getsentry/XcodeBuildMCP), configured in [.cursor/mcp.json](.cursor/mcp.json). Install it once with `brew install xcodebuildmcp`, then reload Cursor and enable the server under Settings → MCP. When merging into an app that already has `.cursor/mcp.json`, add the `XcodeBuildMCP` entry to it.

[.xcodebuildmcp/config.yaml](.xcodebuildmcp/config.yaml) enables the simulator, UI automation, logging, and debugging workflows and turns off XcodeBuildMCP's Sentry error telemetry; `.cursor/mcp.json` also sets `XCODEBUILDMCP_SENTRY_DISABLED`. It holds no machine-specific defaults. At the start of a session the coordinator sets the project, scheme, and simulator from `tools/ios-harness/config.json`, so interactive runs and the gate target the same app. [.cursor/rules/xcode-build-run.mdc](.cursor/rules/xcode-build-run.mdc) has the bindings, and the vendored `xcodebuildmcp` skill describes the tools.

The serial gate, `npm run harness`, remains the acceptance check. XcodeBuildMCP is for iteration, debugging, and visual evidence, and it waits while a gate holds `.orchestrator/build-lock`. Only the interactive coordinator uses it; the deterministic SDK workers have no MCP access. [examples/claude-mcp.json](examples/claude-mcp.json) is the same server entry for Claude Code.

Verified on 2 November 2026 with XcodeBuildMCP 2.3.2 and Xcode 27.0 against a throwaway SwiftUI app: `build_run_sim`, `screenshot`, and a single filtered `test_sim` succeeded. UI automation (`snapshot_ui`, `tap`, `swipe`, `type_text`) fails on Xcode 27 with 2.3.2 because its bundled AXe cannot load `SimulatorKit.framework`; upstream added Xcode 27 support in 2.7.0. Run `brew upgrade xcodebuildmcp` to use those tools.

## Run the deterministic TypeScript orchestrator

The SDK runner uses [Cursor's TypeScript SDK](https://cursor.com/docs/sdk/typescript), pinned in `package.json` and `package-lock.json`. Its native role definitions and Cursor's `.cursor/agents` are separate entry points.

1. Copy `tools/orchestrator/config.example.json` to `tools/orchestrator/config.json` and complete `docs/agent-task.md`.
2. Run `npm run login`, then `npm run models`. SDK authentication is separate from IDE sign-in. Select an account-visible model ID in the config.
3. Configure the iOS gate as described below and establish the app's baseline using its approved checks.
4. Review the intended task and setup, checkpoint them in your existing Git workflow, and use a dedicated clean checkout. Live mode checks Git status but never initializes Git, commits, creates branches, or resets changes.
5. Run `npm run orchestrator:live`. Keep other writers out of that checkout while it runs.

For a different config, paths resolve from the repository root:

```bash
npm run orchestrator -- --dry-run --config tools/orchestrator/config.example.json
```

An optional `skills` array in the config explicitly supplies selected skill bodies to workers, for example `"skills": ["project-memory"]`. The example configuration selects `tdd`, `diagnosing-bugs`, and `code-review`, which each include a branch for restricted runner workers. The runner also supplies root `AGENTS.md`, the task, current memory, and a local skill catalog. Unknown skills and malformed memory fail context loading. The catalog is not permission to execute every skill.

Interactive grilling, full `why` investigations, and tstack's Git/PR operations belong in the coordinator. SDK workers have file tools; reviewers have read tools only. Shell, MCP, and delegation remain denied. Skill text cannot widen permissions or change the required JSON report. See [tools/orchestrator/README.md](tools/orchestrator/README.md) for exact schemas, cancellation, and tool boundaries.

Reports and logs are written to `.orchestrator/runs/<timestamp>/`. Read the final report and inspect the source diff and test artifacts. A source review or fixture run does not establish visual acceptance. Capture and inspect a real preview or simulator screenshot when the task requires it.

## Generate a Claude Code ultracode workflow

When writers must run builds, tests, and renders themselves, or a milestone needs more than two review lenses, generate a Claude Code Workflow script and run it on Opus 5.5 with ultracode. Use `/to-workflow` to write `tools/orchestrator/workflow.json` from an agreed plan, or start from [workflow.example.json](tools/orchestrator/workflow.example.json):

```bash
npm run workflow:example                    # preview the example, placeholders allowed
npm run workflow -- generate                # tools/orchestrator/workflow.json → .orchestrator/workflows/<name>.js
```

The config holds shared context (`shared` or `sharedFile`), `{{root}}` and other `vars`, named review lenses, milestones with their briefs and two or more lenses each, gate commands, final tester and critic prompts, and optional per-role `model` and `effort`. Unset roles inherit the session's model and ultracode effort. Generation validates the config and refuses unresolved `REPLACE_WITH_` placeholders.

Each generated milestone runs one writer, then an independent gate agent that only runs checks, then every lens reviewer in parallel. Reviews are skipped when the gate fails, and the failure goes to the repair writer. A repair must list each finding as fixed or as rejected with evidence; rejected findings return to the reviewers in the next round. Every repair is gated and reviewed again, including the last of at most two. A missing review, a partial or stopped writer, a blocked gate, or findings left after the last repair stop the milestone and every later milestone, and the script logs what did not run. Minor findings are repaired in the first round and logged afterward by default (`minorFindings`).

To run, open Claude Code in the target repository on Opus 5.5 and send `ultracode: run the workflow script <path> with args {"root": "<repository root>"}`. Workflow agents have full tools, so the hard rules in the shared context are the only limit on what they run. Resume an interrupted run with the same script and `resumeFromRunId`.

## Configure the iOS gate

Use macOS, full Xcode 16 or later, and an installed iOS Simulator. Copy `tools/ios-harness/config.example.json` to `tools/ios-harness/config.json`. Set the real workspace or project, scheme, simulator UUID, and **unit test bundle** names. Preserve an existing repository's build-generation and verification conventions when adapting the gate.

```bash
npm run harness:dry-run
npm run harness
```

The real command runs `xcodebuild test`, retains raw output and an `.xcresult`, and checks the result summary. A successful exit with zero executed tests is not a pass. Each invocation has isolated output paths, and a repository-local lock serializes this harness. Separate worktrees still require simulator coordination. See [tools/ios-harness/README.md](tools/ios-harness/README.md) for configuration, exit codes, and cleanup.

## Bring the starter into an existing repository

Merge the `tools/` directories, `.cursor/` agents/rules/skills, the relevant `docs/` files, and root package/TypeScript settings with the app's conventions. Preserve existing instructions and package dependencies. Use [docs/project-instructions-example.md](docs/project-instructions-example.md) as guidance for merging agent instructions. Merge [examples/tasks.json](examples/tasks.json) and [examples/gitignore-additions.txt](examples/gitignore-additions.txt) with existing editor and Git settings.

Keep the skill provenance manifest, third-party notices, and license files alongside vendored skills. Initialize fresh application memory instead of copying the starter's facts. Fill in the actual task and harness configuration. Keep Node tooling out of Xcode application targets and bundles.

Claude Code users can adapt [docs/claude-workflow-brief.md](docs/claude-workflow-brief.md) for that runtime. Claude Dynamic Workflows are a separate runtime; their JavaScript is not the TypeScript SDK runner.

## Boundaries

This starter does not enforce per-path write permissions, a hard spending cap, resumable runs, cross-repository simulator locks, or visual acceptance. Protected paths are instructions, not filesystem access controls. It does not generate image bytes or automatically merge or release anything. Optional interactive skills can perform broader actions only within the user's requested workflow and available tools.

Live Cursor calls and actual iOS builds require credentials, configuration, and an application that are not included in this starter.
