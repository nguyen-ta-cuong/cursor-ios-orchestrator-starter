# Working in this starter

This repository contains TypeScript development tooling for an existing iOS app. Swift application code remains Swift. Read `docs/agent-task.md` only when working on an application milestone; its placeholders are not authorization to change an unspecified app.

Before nontrivial work, read `docs/project-memory/index.md`, then use `npm run memory -- show` or read `docs/project-memory/memory.json`. Locate the relevant codebase, business-logic, dependency, and decision entries. Check their evidence against current source; memory is a discovery aid, not authority. Run `npm run memory -- check` to detect changed evidence. Missing knowledge requires investigation, not invented assumptions.

After verified changes, the coordinator records durable findings with the `project-memory` skill and the CLI documented in `docs/memory.md`. Record behavior, ownership, dependency constraints, and decisions with their source paths. Keep logs and transient task status in `.orchestrator/`, and keep secrets and personal data out of memory. Workers and reviewers propose corrections in reports; they do not edit the knowledge store. SDK runner workers follow the routing in their worker policy.

Use the root `package.json` scripts. Install with `npm ci`, validate TypeScript with `npm run typecheck`, and run offline tests with `npm test`. Dry runs exercise fixtures or print the planned Xcode command; they do not prove live Cursor operation or an iOS build. A changed scheduling or validation contract needs a meaningful regression test.

Cursor discovers `.cursor/skills/*/SKILL.md`. Read `docs/skills.md` when selecting a workflow: `grill-me` clarifies plans, `why` investigates decisions, `unslop` edits prose, and tstack supplies review and PR workflows. Run these through the interactive coordinator when they need Git, shell, other providers, or user input. Explicitly selected SDK skills add instructions, never tools or authority. Follow the assigned worker role and report format even when a skill describes broader actions.

For multi-agent iOS work follow `.cursor/rules/ios-orchestration.mdc`: one writer, a serial gate, two independent reviews, and at most two repairs. Concurrent work requires disjoint file ownership or isolated checkouts. A failed or incomplete review blocks its milestone. Git publication and merging belong only to an explicitly requested interactive workflow.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- Use `codegraph_explore` when available; name files or symbols to get their source and call paths. Load a deferred tool by name if necessary.
- Otherwise run `codegraph explore "<symbol names or question>"`.

If there is no `.codegraph/` directory, skip CodeGraph entirely. Indexing is the user's decision.
<!-- CODEGRAPH_END -->
