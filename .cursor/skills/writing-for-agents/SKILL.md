---
name: writing-for-agents
description: Write documents agents consume. Use when creating or editing a skill, a Cursor rule or agent definition, AGENTS.md, a task contract, or a worker prompt.
---

# Writing for agents

Distilled from Matt Pocock's `writing-for-agents` skill, with this repository's packaging rules. Provenance is in `docs/skills.md`. Use `unslop` for general prose quality.

## Levers

- **Context pointers.** A skill description, an `alwaysApply` rule, or a line in `AGENTS.md` naming a doc decides when the agent reaches the material. Front-load the leading word, give one trigger per distinct case, and cut identity the body already states. Sharpen a weak pointer before inlining its target.
- **Two loads.** Always-loaded text costs context on every turn. Material the human must remember to invoke costs their attention. Spend each deliberately.
- **Information hierarchy.** Steps first, then in-file reference, then reference in a sibling file behind a pointer. Inline what every branch needs; disclose what only some branches reach. Keep a concept's definition, rules, and caveats under one heading.
- **Completion criteria.** End every step on a checkable condition. "Every acceptance criterion has a test at a named seam" drives more legwork than "write tests".
- **Leading words.** Reuse a compact concept the model already knows (tracer bullet, seam, red loop) instead of restating a triad at several sites.
- **Positive instructions.** State the target behavior. Keep prohibitions for hard guardrails, and pair each with what to do instead.
- **Pruning.** Keep one source of truth per meaning. Leave lookups to the environment (`package.json` scripts, config files, `--help`) and record what looking cannot reveal: conventions, reasons, gotchas. Delete sentences the model already obeys by default.

## Packaging in this repository

- **Skills:** `.cursor/skills/<name>/SKILL.md`, with `name` matching the folder in lowercase kebab-case and a nonempty `description`. Set `disable-model-invocation: true` when only a human should start it; the description then becomes a one-line human summary. The runner's catalog shows the first 500 characters of each description, and all selected skill bodies together must stay under 64,000 characters.
- **Runner compatibility:** SDK workers have read and edit tools only and must return a fixed JSON report. A skill meant for the runner needs a branch for that role, and it can never widen tools, ownership, or the report shape.
- **Rules:** `.cursor/rules/*.mdc` with `description` and `alwaysApply` frontmatter. Agent definitions live in `.cursor/agents/*.md`.
- **Registration:** add every new or changed skill to `skills-lock.json` and `docs/skills.md`, and to `THIRD_PARTY_NOTICES.md` when it derives from upstream material. Run `npm test`; it checks the manifest against the installed files.

Finish by rereading the document as a fresh agent: every step has a completion criterion and every pointer names its trigger.
