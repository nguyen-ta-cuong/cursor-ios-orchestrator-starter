---
name: project-memory
description: Recall codebase, business-logic, and dependency knowledge before substantial work; record verified findings when requested or required by repository instructions.
---

# Project memory

## Recall

1. Read `docs/memory.md` and `docs/project-memory/index.md` from the repository root. If either is missing, report the missing context and continue with available source evidence.
2. Read relevant entries in `docs/project-memory/memory.json`, using `npm run memory -- show` when shell access is available. Use recorded IDs and evidence paths to guide source exploration.
3. Verify facts that may have changed against current code, configuration, or check output before relying on them. Label facts used without verification as historical context.
4. Identify the applicable decision, its source, and any conflict with the current task. Current explicit user instructions govern the task.

## Record

When the user requests recording or repository instructions authorize routine capture after verification, the coordinator uses `npm run memory -- record --id <stable-id> --topic <codebase|business-logic|dependencies|decisions> --summary "<verified finding>" --source <path>`; repeat `--source` for additional evidence. Read and verify the sources first. The CLI captures the date and hashes, preserves other IDs, and replaces the named record atomically. Run `npm run memory -- check` and inspect the resulting diff. If shell access is unavailable, propose the record to the coordinator instead of claiming it was saved.

Include the decision and reason when supported by evidence. Distinguish accepted decisions from proposals and completed checks from planned checks. Put unresolved questions in the task contract rather than recording them as facts. SDK workers and read-only reviewers propose knowledge corrections; only the coordinator persists them after verification.

Store only durable project context in these repository files. Keep credentials, personal account details, and raw private transcripts out of them. User-level memory and global skill folders are outside this skill's scope. A recall request only reads memory.

Finish by naming the memory files read or changed and the evidence still needing verification. The TypeScript orchestrator loads configured skills explicitly; this skill does not change its tool permissions or run checks itself.
