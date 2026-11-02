---
name: to-workflow
description: Turn an agreed plan into a Claude Code ultracode Workflow script with an independent gate, per-milestone review lenses, and bounded repairs.
disable-model-invocation: true
---

# To workflow

Writes `tools/orchestrator/workflow.json` and generates a Claude Code Workflow script from it. Run the script in a Claude Code session on Opus 5.5 with ultracode. Use this instead of the Cursor SDK runner when writers must run builds, tests, and renders themselves, or when a milestone needs more than two review lenses.

Synthesize what the conversation already settled. If a product decision is open, run `grill-me` first; if the milestones are not cut yet, run `to-milestones` first.

## 1. Gather the shared context

Collect what every agent needs, verified against the repository:

- **Source of truth:** plan documents, decision records, and the order of precedence when they conflict.
- **Decisions:** the user's approved and deferred decisions, with their identifiers.
- **Hard rules:** Git limits, process limits, secret handling, tests that must not run, style rules. State each as a rule the agent can check.
- **Recipes:** exact gate commands, the focused-test command with its scoping flags, the full-run command and its baseline, render steps. Run each recipe once yourself and correct it until it works.

Put this text in `shared` or, when long, a markdown file named by `sharedFile`. Use `{{root}}` for the repository root and declare other paths under `vars`, for example `"RES": "{{root}}/docs/research/2026-11-02-topic"`.

## 2. Define the lenses

Write one lens per independent risk: invariants, contract stability, privacy and credentials, repository rules and native UI, prototype parity. Each lens names what to check, the files or decisions it judges against, and "Do not build." Keep lenses distinct; overlapping lenses produce duplicate findings and extra repairs.

## 3. Write the milestones

One milestone per tracer-bullet slice, in dependency order. Each brief points at its plan section, lists the acceptance criteria, and states its stop condition. Choose two to four lenses per milestone by what it can break; the generator requires at least two, matching the repository's two-independent-reviews rule. Every lens multiplies review cost: a milestone runs up to `(maxRepairs + 1) × lenses` reviews.

## 4. Configure the run

- `gate.instructions`: the commands the independent gate agent runs after every write.
- `maxRepairs`: at most 2.
- `minorFindings`: `first-round` (default), `always`, or `never`.
- `final.tester` and `final.critic`: the final checks and the completeness comparison.
- `agents`: per-role `model` and `effort` overrides. Leave roles unset to inherit the session's Opus 5.5 ultracode settings; `gate` usually runs at `effort: "low"`.

## 5. Generate and hand off

Run `npm run workflow -- generate`. Fix every validation error and placeholder it reports. Read the generated script's meta and the cost line it prints, and confirm both with the user.

Tell the user to open Claude Code in the target repository on Opus 5.5 and start the run with a prompt that opts into workflows, for example: `ultracode: run the workflow script <path> with args {"root": "<repository root>"}`. The word ultracode, or an explicit request to run the workflow, is what authorizes Claude Code's Workflow tool. Resume an interrupted run with the same script and `resumeFromRunId`.

Finish by naming the config, the generated script path, the milestone order, and the maximum review and repair counts.
