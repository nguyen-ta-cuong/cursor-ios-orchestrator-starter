# Repository skills

Skills live in `.cursor/skills/<name>/SKILL.md`. Open this repository in Cursor and use `/` in Agent chat to select a skill. Cursor discovers this project directory automatically on startup. If the repository was open during installation, start a new chat or reload the window and check Customize → Skills. The installation is local to this repository.

[Cursor's official skills documentation](https://cursor.com/docs/context/skills) specifies the directory, required `name` and `description` frontmatter, and slash invocation. Each installed name matches its folder. Separate `.cursor/commands` wrappers would duplicate the skill names, so none are needed. `agents/openai.yaml` files are retained upstream metadata; Cursor discovery relies on `SKILL.md`.

## Everyday use

| Invoke | Use it for | Included support |
| --- | --- | --- |
| `/to-workflow` | Turn an agreed plan into a Claude Code ultracode workflow | Repository-authored; writes `tools/orchestrator/workflow.json` and runs `npm run workflow -- generate` |
| `/xcodebuildmcp` | Build, run, test, debug, and screenshot in the Simulator | Exact upstream XcodeBuildMCP 2.3.2 MCP skill; repository bindings in `.cursor/rules/xcode-build-run.mdc` |
| `/project-memory` | Recall project decisions or record a requested lesson | Repository-authored instructions for `docs/memory.md` and `docs/project-memory/index.md` |
| `/grill-me` | Stress-test a plan through questions before implementation | Canonical Matt Pocock entry point plus its `grilling` dependency |
| `/unslop` | Edit prose for concrete, direct language | Exact upstream pstack skill |
| `/why` | Investigate why a design or behavior exists | Exact upstream skill, investigator and synthesizer prompts, confidence framework, and all source playbooks |

`grill-me`, `unslop`, and `why` retain upstream explicit-invocation frontmatter. `grilling` also responds to natural language such as “grill me.” It pauses for the user's decisions and confirmation before acting. Complete this conversation before an unattended implementation run.

The local `grill-me` wrapper reads `../grilling/SKILL.md` directly instead of assuming a harness-specific Skill tool. Its fallback gathers facts with available read tools if subagents are unavailable. The interview instructions in `grilling` are unchanged.

`project-memory` reads the project index and structured knowledge store, follows relevant source paths, and verifies older facts against current evidence. The coordinator records findings when requested or required by the repository's post-verification workflow. SDK workers and read-only reviewers propose updates. These are repository documents, separate from user-level agent memory.

## Distilled Matt Pocock skills

These seven skills condense skills from [mattpocock/skills](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills) and adapt them to this harness. They are rewrites, not byte-identical copies; `skills-lock.json` lists each adaptation and the upstream blobs it condenses.

| Invoke | Upstream | Where it applies | Adaptation |
| --- | --- | --- | --- |
| `/tdd` | `engineering/tdd` | Coordinator, `ios-implementer`, SDK writers; reviewers use its anti-patterns | Swift Testing/XCTest seams; runner writers take seams from the task contract and treat the gate as red/green |
| `/diagnosing-bugs` | `engineering/diagnosing-bugs` | Coordinator debugging, repair writers, SDK writers (`implement` and `fix`) | `xcodebuild`, LLDB, and Instruments loops; runner fixers use gate evidence as the loop and add no instrumentation |
| `/code-review` | `engineering/code-review` | Coordinator reviews, Cursor reviewer agents, SDK review lenses | Spec maps to `review-contract` and Standards to `review-invariants`; runner findings are limited to demonstrated defects |
| `/to-milestones` | `engineering/to-spec` + `engineering/to-tickets` | Coordinator only, manual | Writes `docs/agent-task.md` and runner milestones in dependency order instead of tracker tickets |
| `/domain-modeling` | `engineering/domain-modeling` | Coordinator only | Records terms and three-test decisions as project-memory entries instead of `GLOSSARY.md` and ADR files |
| `/writing-for-agents` | `productivity/writing-for-agents` | Editing skills, rules, agents, `AGENTS.md`, and task contracts | Adds this repository's packaging, runner-budget, and provenance rules |
| `/handoff` | `productivity/handoff` | Coordinator only, manual | Writes to ignored `.orchestrator/handoffs/` and points to run reports and memory IDs |

`config.example.json` selects `tdd`, `diagnosing-bugs`, and `code-review`. Every SDK worker receives all three bodies, and each skill states how it applies to runner writers and reviewers; `diagnosing-bugs` applies to writers only. Because each runner finding consumes one of at most two repair rounds, the runner branches of `tdd` and `code-review` exclude judgement-call smells and style preferences from findings. The Cursor agents in `.cursor/agents` and the iOS orchestration rule point to the same skills.

Other upstream skills were left out. Issue-tracker workflows (`triage`, `wayfinder`, `setup-matt-pocock-skills`) assume a configured tracker. `prototype`, `wizard`, `research`, and `teach` are general-purpose rather than orchestration-specific. `codebase-design` vocabulary is inlined where `tdd` needs it, and `grill-with-docs` is covered by `grill-me` plus `domain-modeling`.

## All tstack skills

| Skill | Purpose | Other included skills it uses |
| --- | --- | --- |
| `full-send` | Complete work through a merged PR when explicitly requested | `sol-loop`, `file-pr`, `babysit-pr` |
| `full-stop` | Prepare an open PR for the user to merge | `full-send` |
| `council` | Review with three different model providers | Harness-provided delegation |
| `sol-loop` | Bounded review rounds with an available GPT Sol model | Harness-provided delegation |
| `file-pr` | Write and create a concise PR | `leaving-pr-comments` |
| `takeover` | Continue existing work while preserving credit | `modernize`, `file-pr`, `babysit-pr`, `leaving-pr-comments` |
| `babysit-pr` | Watch review and CI, then handle findings | `leaving-pr-comments`, `scripts/pr-wait` |
| `modernize` | Reassess and rebase an older PR | `leaving-pr-comments` |
| `leaving-pr-comments` | Attribute and format authorized GitHub comments | No additional files |

All nine tstack skill directories are copied in full, including their script and agent metadata. Their sibling paths remain valid. Installing these workflows does not invoke them or authorize commits, comments, pushes, rebases, or merges.

## Runtime requirements

The Git/PR workflows are optional interactive workflows. They need an actual Git checkout, an appropriate remote and branch, an authenticated `gh`, and the user's task authorization. Apply them only in the repository you intend to change, never in a fresh clone of this starter by accident.

`babysit-pr/scripts/pr-wait` uses Python 3.10 or later, the standard library including Unix `fcntl`, and `gh`. Invoke it by its absolute installed path when the workflow calls for it. It writes watcher state under `~/.local/state/pr-wait/`. Its default `ready` condition expects Greptile or Macroscope review; upstream documents `--until green` for repositories without those bots. No watcher was started during installation.

`council` requires three available providers and `sol-loop` requires a real Sol model route. Upstream tstack documents T3-specific tools and native fallbacks. Use only capabilities exposed by the current host. Report missing models or delegation instead of inventing tool names or treating one provider as three.

`why` is the complete upstream skill, not the whole pstack plugin. Its Git/`gh` history anchor is unavailable in this starter until it is used in a Git checkout. Its MCP playbooks are examples, not installed connections. Discover actual servers and schemas, and report missing evidence categories. Upstream expects Cursor Task delegation and supplies default model identifiers; their availability depends on the account. It also references optional `pstack-models.mdc`, the wider `poteto-mode` skill's [Subagents guidance](https://github.com/cursor/plugins/blob/ae5650febf4320793844c12c4adaa937f417f8da/pstack/skills/poteto-mode/SKILL.md#subagents), and the companion `how` skill. Those broader plugin components are not installed. Check these dependencies before a full investigation and disclose unavailable capabilities or reduced coverage. Keep its evidence and inference labels when reporting partial results.

The `why` Sentry playbook includes a Seer analysis request. Treat that as an operation requiring the integration's actual permissions and task authorization, rather than assuming every investigation call only reads stored evidence. Warehouse examples also require checking real schemas and limiting query scope. These operations were not run during installation.

## Deterministic TypeScript runner

Cursor's interactive discovery and the SDK runner are separate mechanisms. The runner includes a skill catalog and loads explicitly configured skill bodies; listing or reading a skill is not executing it. Consult [the orchestrator documentation](../tools/orchestrator/README.md) for the configuration and CLI.

SDK workers have restricted file tools. Shell, MCP, and task/subagent tools are denied; the trusted host runs the fixed iOS gate. Skill text does not widen those permissions or replace the implement/check/review/repair sequence. Keep tstack's Git/PR workflows, full `why` investigations, and conversational grilling outside the unattended loop. Use compatible instructions such as `tdd`, `diagnosing-bugs`, `code-review`, `unslop`, or `project-memory` only for a relevant task, with the runner's existing file ownership and read/write restrictions.

Validation commands for the migrated TypeScript project are owned by the runner and its task contract. Skills must look up the actual package scripts and approved harness rather than import commands from another repository.

## Provenance and updates

Sources were inspected on 2026-11-02 and pinned to immutable commits:

| Source | Commit | Installed paths |
| --- | --- | --- |
| [t3dotgg/tstack](https://github.com/t3dotgg/tstack/tree/1085050f3baed1ac724caa4a8166145fb2ac88af) | `1085050f3baed1ac724caa4a8166145fb2ac88af` | Nine tstack folders above |
| [cursor/plugins pstack](https://github.com/cursor/plugins/tree/ae5650febf4320793844c12c4adaa937f417f8da/pstack/skills) | `ae5650febf4320793844c12c4adaa937f417f8da` | `unslop`, `why` |
| [getsentry/XcodeBuildMCP v2.3.2](https://github.com/getsentry/XcodeBuildMCP/tree/b6f49dd0636846c474334e2949b947ed0ea41aad/skills/xcodebuildmcp) | `b6f49dd0636846c474334e2949b947ed0ea41aad` | `xcodebuildmcp` |
| [mattpocock/skills](https://github.com/mattpocock/skills/tree/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills) | `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d` | `grill-me`, `grilling`; distilled `tdd`, `diagnosing-bugs`, `code-review`, `to-milestones`, `domain-modeling`, `writing-for-agents`, `handoff` |

[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) identifies the copyright holders and preserved licenses. [skills-lock.json](../skills-lock.json) is this repository's provenance manifest, not an npm lockfile or a skills-installer cache. It records upstream blob identities, installed SHA-256 hashes, paths, dependencies, the `grill-me` wrapper adaptation, and the distilled skills' adaptations. `project-memory` is identified as local content.

To update, inspect a specific upstream commit, replace complete skill folders and applicable licenses, review changed instructions and dependencies, reapply the documented wrapper adaptation, and regenerate the manifest. For a distilled skill, compare the new upstream blobs against `derivedFrom`, carry over meaningful changes by hand, and update its adaptations. `npm test` verifies every manifest entry, installed hash, executable mode, and dependency, and fails on unlisted files. Installation validation checks discovery metadata, complete upstream file inventories, byte identity, dependency paths, and Python syntax without executing workflow actions. It does not prove Cursor UI discovery, GitHub authentication, model availability, or live SDK/iOS operation.
