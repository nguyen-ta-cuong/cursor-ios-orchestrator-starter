---
name: diagnosing-bugs
description: Feedback-loop-first diagnosis for hard bugs, failing gates, flaky tests, and performance regressions. Use when something is broken, throwing, failing, flaky, or slow, or when repairing a build-gate failure.
---

# Diagnosing bugs

Distilled from Matt Pocock's `diagnosing-bugs` skill for this repository's iOS harness. Provenance is in `docs/skills.md`.

The leading word is a **tight, red loop**: one signal that goes red on this bug and green once it is fixed. With one, bisection and hypothesis testing are mechanical. Without one, reading code produces guesses.

Phases 1–6 are for the interactive coordinator, which can run commands. Writers that cannot run commands, SDK runner writers and the Cursor `ios-implementer`, follow only the writer section at the end. SDK runner reviewers do not apply this skill; under `tdd`, a missing regression test is a finding only when it leaves an acceptance criterion unprotected.

Redact secrets in every command, log, and artifact you show: write `<REDACTED>`. Quote only the lines that carry the signal.

## 1. Build the loop (interactive coordinator)

Find one command or signal that drives the actual bug path, asserts the user's exact symptom, gives the same verdict each run, finishes in seconds, and runs unattended. Try, roughly in order:

1. A failing test at the seam that reaches the bug.
2. One test through XcodeBuildMCP `test_sim` with `extraArgs: ["-only-testing:<Target>/<Suite>/<test>"]`, as bound in `.cursor/rules/xcode-build-run.mdc`. The gate itself runs whole unit-test bundles.
3. A command-line or fixture replay with output compared to a known-good result.
4. A captured crash report, log, or payload replayed through the code path.
5. A stress loop for flaky bugs. Raise the reproduction rate until it is debuggable; add `-test-iterations` and `-run-tests-until-failure` to the `test_sim` `extraArgs`.
6. A differential run: the same input through the old and new version or configuration.
7. A scripted Simulator session (UI automation needs XcodeBuildMCP 2.7.0 or later on Xcode 27): `build_run_sim`, then `tap`, `swipe`, and `type_text` to reach the bug, with `screenshot`, `snapshot_ui`, and `launch_app_logs_sim` as the signal.
8. A human-driven checklist, only when a physical device or an untouchable system flow is involved. Give the user numbered steps and ask for the observed result.

The phase is done when you can name that command, have already run it, and can show its redacted output. If you cannot build a loop, stop. List what you tried, then ask for environment access, a redacted artifact (crash log, console excerpt, screen recording with timestamps), or permission for temporary instrumentation.

## 2. Reproduce and minimise

Confirm the loop shows the symptom the user described, not a nearby failure. Then cut inputs, steps, and configuration one at a time, rerunning after each cut, until every remaining element is load-bearing.

## 3. Hypothesise

Write three to five ranked, falsifiable hypotheses before testing any: "If X is the cause, changing Y makes the bug disappear." Show the list to the user; they may rule some out instantly. Proceed with your ranking if they are away.

## 4. Instrument

Each probe tests one prediction and changes one variable. Prefer LLDB to logging; XcodeBuildMCP's `debug_attach_sim`, `debug_breakpoint_add`, `debug_stack`, and `debug_variables` drive it in the Simulator. Tag temporary logs with a unique prefix such as `[DEBUG-a4f2]` so one search removes them. For performance, record a baseline (Instruments, `XCTest` metrics, signposts) before changing anything.

## 5. Fix with a regression test

Turn the minimised repro into a failing test at a correct seam: one where the test exercises the real bug pattern as callers trigger it. Watch it fail, fix, watch it pass, then rerun the original loop. If no correct seam exists, report that as a finding about the architecture.

## 6. Clean up

Finish when the original loop is green, the regression test passes or the missing seam is documented, no tagged debug output remains, throwaway harnesses are deleted, and the confirmed hypothesis is stated in the report. Propose a durable root cause to the coordinator as a memory entry.

## Writers without command access (implement and fix)

You cannot run commands, so the available evidence is the loop: the symptom described in the task contract for an `implement` round, and the gate log and review findings for a `fix` round. Missing a runnable loop is expected here; continue with the evidence.

- Identify the exact symptom: the failing compile error or test in the gate log named in the gate evidence, or the behavior the contract describes.
- Rank hypotheses against that evidence, fix the best-supported cause, and record the ranking and the chosen cause in the report summary.
- Write the regression test before the fix when a correct seam exists inside your ownership.
- Leave instrumentation out; no later turn will read it.
- Repair only failures this milestone caused. Put environment or harness failures, such as a missing simulator, signing, or toolchain problem, in `openIssues`.
