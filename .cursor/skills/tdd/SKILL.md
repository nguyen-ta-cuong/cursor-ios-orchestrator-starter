---
name: tdd
description: Test-first implementation in red-green vertical slices. Use when implementing or repairing a milestone that changes behavior, fixing a bug test-first, or judging whether a test would catch the defect it claims to prevent.
---

# Test-driven development

Distilled from Matt Pocock's `tdd` skill for this repository's iOS harness. Provenance is in `docs/skills.md`.

## A good test

A test verifies behavior through a public interface and reads like a specification: "an empty inbox shows the empty-state message". It survives refactors because it observes what callers see, not how the code is arranged. Use the framework, target, and folder conventions the project already uses (Swift Testing or XCTest). Take test names and vocabulary from the task contract and the `business-logic` entries in project memory.

Expected values come from an independent source of truth: a literal, a worked example, or the task contract.

## Seams

A **seam** is the public boundary where a test observes behavior: a view model's API, a service protocol, a reducer, a parser. Prefer an existing seam, and the highest one that reaches the behavior. Substitute only at system boundaries: network, persistence, clock, randomness, and system frameworks. Use the project's real types for everything it owns. When a boundary needs substitution, inject it the way the project already injects dependencies.

- **Interactive coordinator:** before writing tests, name each seam with one line on what it catches and what it misses, and confirm the list with the user.
- **SDK runner writer:** the seams come from the task contract's acceptance criteria and ownership paths. If the contract names none, choose the highest existing seam inside your owned paths and list the chosen seams in your report summary. If no test target inside your ownership can hold a required test, put that in `openIssues`.

## The loop

Work in vertical slices: one seam, one failing test, the minimal code that passes it, then the next slice. Each test is a tracer bullet shaped by what the previous slice taught you.

- **Interactive coordinator:** run the new test and watch it go red for the expected reason before implementing. Run the single test with XcodeBuildMCP `test_sim` and `extraArgs: ["-only-testing:<Target>/<Suite>/<test>"]` (see `.cursor/rules/xcode-build-run.mdc`), then let the full gate confirm the milestone.
- **SDK runner writer:** you cannot run tests; the gate after your turn is the red/green signal. For each test, state in the summary which acceptance criterion it covers and why it fails without your change.

Refactor only after green and only inside the milestone's ownership.

## Anti-patterns

- **Implementation-coupled:** substitutes the project's own collaborators, asserts call counts or ordering, inspects internal state instead of observable output, or verifies through a side channel such as reading the store directly. It breaks on refactor while behavior is unchanged.
- **Tautological:** recomputes the expected value the way the code does, or asserts a constant equal to itself. It passes by construction.
- **Mirror:** restates layout constants, copy, or configuration literals from the implementation. The task contract rejects these.
- **Horizontal:** all tests first, then all implementation. Tests written that way describe imagined behavior.

## Reviewers

Apply the anti-patterns as review evidence. In the runner, a weak or missing test is a finding when it leaves an acceptance criterion or a demonstrated defect unprotected. Leave other test-style preferences out of runner findings; each finding costs a repair round.

## Done

Every behavior change in the milestone has a test at a named seam that fails without the change, or the report states why no correct seam exists.
