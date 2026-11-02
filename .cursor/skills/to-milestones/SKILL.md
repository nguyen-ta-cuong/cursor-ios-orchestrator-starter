---
name: to-milestones
description: Turn an agreed plan into the orchestrator's task contract and milestone configuration.
disable-model-invocation: true
---

# To milestones

Distilled from Matt Pocock's `to-spec` and `to-tickets` skills. Instead of an issue tracker, the output is this repository's task contract and runner configuration. Provenance is in `docs/skills.md`.

Synthesize what the conversation already settled; this is not an interview. If a product decision is still open, run `grill-me` first. If a required project fact is unknown, list it under open questions and stop before any live run.

## 1. Explore

Read `AGENTS.md`, the relevant project memory with its evidence, and the source the plan touches. Use the domain terms recorded in memory.

## 2. Agree the seams

Name the test seams for the work, preferring existing seams and the highest one that reaches the behavior. Confirm them with the user. The `tdd` skill defines a seam.

## 3. Slice into milestones

Cut the work into tracer-bullet milestones:

- Each is a narrow but complete path through the layers it needs (model, view model, view, test) and is verifiable alone by the gate and both reviews.
- Each fits one fresh worker context.
- Prefactoring comes first.
- The runner executes milestones serially in array order, so order them by dependency, blockers first.
- A wide mechanical refactor uses expand–contract: add the new form beside the old, migrate callers in batches that keep the gate green, then remove the old form. Each step is its own milestone.

## 4. Quiz the user

Show a numbered list with each milestone's title, what it depends on, and what it delivers. Ask whether the granularity and order are right and whether any should merge or split. Iterate until the user approves.

## 5. Write the contract and configuration

- `docs/agent-task.md`: keep its headings. Replace each placeholder with a verified fact. Give every milestone its acceptance criteria, then fill ownership, acceptance evidence, constraints, and the done report. Add testing decisions (seams and existing tests to imitate) and an out-of-scope list.
- `tools/orchestrator/config.json`, starting from `config.example.json`: one `{ "id", "title", "brief" }` per milestone. Each brief names its ownership paths and acceptance criteria. Leave `maxFixes`, the gate, and the harness as configured.

Use file paths only for ownership; describe behavior in prose and leave code snippets out, since they go stale.

## 6. Validate

Run `npm run orchestrator -- --dry-run --config tools/orchestrator/config.json`. It validates the configuration, selected skills, and memory without calling models or Xcode. A live run needs the user's explicit authorization and a clean Git tree; the runner rejects remaining placeholders.

Finish by naming the files written, the milestone order, and any open question that blocks a live run.
