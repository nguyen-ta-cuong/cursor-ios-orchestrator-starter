# Brief for Claude Code's workflow author

This is a prompt to use in Claude Code inside Cursor after enabling Dynamic Workflows. It is not a Node.js program and is not a preinstalled workflow.

Run `/workflow-authoring`, then provide this brief together with the completed `docs/agent-task.md`:

```text
Create a reusable dynamic workflow named ios-feature for the attached task contract.
Use the current workflow-authoring reference to produce valid runtime JavaScript.

First inspect this repository's applicable instructions and the configured build/test command. Do not reuse paths, branch names, schemes, test selectors, or baseline counts from another project.

Use sequential milestones. For each milestone:
1. Run one implementation worker with explicit file ownership.
2. Run the approved serial build and scoped unit-test gate.
3. Run two independent read-only reviews in parallel: behavior/concurrency/contracts, and UI/assets/accessibility.
4. Keep the reviewer identity paired with its result before checking findings.
5. A missing, malformed, cancelled, failed, stopped, or partial mandatory worker result blocks the workflow. A failed reviewer never means there are no findings.
6. Ask one repair worker to verify findings and fix proven defects. Any rejected finding needs source evidence and independent reviewer acceptance.
7. Rerun the gate and both reviews after every repair. Allow at most two repairs, then stop with unresolved findings. Always review the final repaired state.
8. Advance only after the current milestone is accepted. Do not run a final mutating agent after a halt.

Use structured implementation, review, and gate reports. Gate reports need the command, actual exit code, and artifact paths. A worker's prose claim is not build evidence.
Use the current runtime's documented role/tool controls for reviewers. Tell me explicitly if a requested read-only restriction is only an instruction rather than an enforced tool restriction.
Default to one writer in this checkout. Do not create worktrees or mutate Git state unless separately requested.
Do not attach image generation claims to supplied images; report missing image bytes or unavailable image-generation tools.
Do not change the task contract, checks, or harness to make a run pass.
Show the phase list, scope, and generated script before its first implementation run.
Use the repository's configured gate; for the supplied starter it is bash tools/ios-harness/check.sh.
```

After a successful small run, save it through `/workflows` to `.claude/workflows/`. Its command is `/ios-feature`. When editing saved workflow JavaScript, load `/workflow-authoring` first and use `/reload-skills` afterward.

The workflow runtime supplies `agent`, `parallel`, `pipeline`, `phase`, `log`, and `args`. Do not paste Node imports, filesystem calls, or `process.cwd()` into a saved dynamic workflow. The independent TypeScript SDK runner in `tools/orchestrator/` is a different program with a different runtime.

Official reference: https://code.claude.com/docs/en/workflows
