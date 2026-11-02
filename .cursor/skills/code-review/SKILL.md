---
name: code-review
description: Two-axis review of a change. Spec checks the change against the task contract; Standards checks it against this repository's documented rules and invariants. Use when reviewing a milestone, a branch, or work in progress.
---

# Two-axis code review

Distilled from Matt Pocock's `code-review` skill for this repository's iOS harness. Provenance is in `docs/skills.md`.

A change can satisfy one axis and fail the other. Review them separately and report them separately; do not merge or rerank findings across axes.

- **Spec:** (a) requirements missing or partial, (b) behavior nobody asked for, (c) requirements that look implemented but behave wrongly. Quote the contract line for each finding.
- **Standards:** (a) violations of a documented rule, citing the file and rule, and (b) broken invariants the project relies on: `business-logic` memory entries confirmed against source, concurrency and actor isolation, cancellation, error paths, and accessibility requirements in the rules. Skip anything tooling already enforces.

Sources: the spec is the milestone in `docs/agent-task.md`, a path the user supplies, or an issue referenced by the change. Standards come from root and nested `AGENTS.md`, `.cursor/rules/*.mdc`, `CONTRIBUTING.md` or coding-standard files when present, and the task contract's constraints.

## Smell baseline

These Fowler smells are judgement calls, never hard violations. A documented repository rule always wins.

Mysterious Name · Duplicated Code · Feature Envy · Data Clumps · Primitive Obsession · Repeated Switches · Shotgun Surgery · Divergent Change · Speculative Generality · Message Chains · Middle Man · Refused Bequest

## Interactive coordinator

1. Pin the change. In a Git checkout, use `git diff <base>` (the working tree against the base, so uncommitted milestone edits are included), where `<base>` is a commit fixed point or, for a branch, `$(git merge-base <branch> HEAD)`, plus untracked files from `git status --porcelain`, and confirm the change is non-empty. Without Git, use the implementation report's changed files and the milestone's ownership paths.
2. Find the spec. If none exists, skip the Spec axis and say so.
3. Run the axes as two fresh, read-only reviewers. Inside the iOS milestone workflow, the mandatory reviewers in `.cursor/rules/ios-orchestration.mdc` remain the reviewers; give each both axes for its domain.
4. Present `## Spec` and `## Standards` sections, labelling smells as "possible <smell>". End with the finding count and the worst issue for each axis.

## SDK runner reviewer

- `review-contract` applies the Spec axis. `review-invariants` applies the Standards axis.
- Every finding triggers a repair round, and a milestone allows two. Report only demonstrated defects: a missing or wrong requirement, unrequested behavior change, a documented-rule violation, or a broken invariant. Report a smell only when it causes one of those.
- Keep the required JSON report shape. Cite the contract line or rule in `evidence`.
