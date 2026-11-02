# Durable project memory

Memory is a small, version-controlled knowledge base in `docs/project-memory/memory.json`. It travels with the project and does not depend on a chat session or a vendor's account memory. It is meant to retain knowledge that otherwise requires repeated code exploration: module ownership, business invariants, dependency boundaries, and reasons for decisions.

Each record has an ID, a topic, a concise summary, a recording timestamp, and one or more repository-relative source paths with SHA-256 hashes of their raw bytes, including UTF-16 resources. The recorder preserves the supplied path and rechecks symlink containment and current target content on each inspection. The four topics are `codebase`, `business-logic`, `dependencies`, and `decisions`. The source text itself is never copied into the store by the recorder.

## Read before changing code

```bash
npm run memory -- show
npm run memory -- check
```

`check` exits zero when every recorded source hash is unchanged. It exits 1 for missing, empty, stale, or malformed memory. `show` labels stale entries and keeps the original observation visible so you know what to investigate. Source changes require rereading the affected code and assessing the summary; hashing does not establish semantic truth. Renamed or deleted evidence remains stale until the coordinator updates the record deliberately.

Cursor's always-applied memory rule points agents at the index and store. The SDK runner loads current memory before the run and again before each worker, emits memory warnings, and saves them in the run report. Missing or stale knowledge is reported as a discovery requirement; malformed memory blocks context loading. Worker source changes can make an entry stale during the same run. The coordinator reviews and refreshes it afterward.

## Record a verified finding

Read the actual source, confirm the behavior or decision, run the relevant validation, and record only the durable result:

```bash
npm run memory -- record \
  --id bounded-repairs \
  --topic business-logic \
  --summary "Each milestone permits at most two repair attempts; every repair receives another gate and independent review before the next milestone." \
  --source tools/orchestrator/engine.ts \
  --source tools/orchestrator/test/engine.test.ts
```

An existing ID is replaced; other IDs remain intact. Review the JSON diff before committing it. Dependencies should cite both the manifest and lockfile when version or resolution matters. Business rules should cite the enforcing code and meaningful tests when available. Decisions may cite a reviewed design document. Record product rationale only when the user or source actually supplies it.

Only the coordinator writes memory after checking evidence. SDK implementation and review workers are instructed to leave `docs/project-memory` unchanged. Their findings can suggest a correction, but a successful model report does not automatically add facts. These role restrictions are instructions, not filesystem access controls.

## Initialize memory for the app you are working on

When installing this starter into an existing repository, merge the tooling, skills, and instructions with local conventions. Exclude the starter's `docs/project-memory/memory.json`. Then run:

```bash
npm run memory -- init --project "Your application name"
```

Initialization refuses to overwrite an existing store. Preserve an application's existing knowledge and add evidence-backed entries to it. An empty store is intentional: ask the Cursor `project-researcher` to map the real app, review the findings, then record them. No assumptions about application architecture, product rules, or frameworks are prefilled.

## Storage and limits

Records are validated before writes. The recorder uses a per-store `.write-lock` and replaces the JSON file atomically, preventing partial files and overlapping writers through this CLI. A crash can leave a lock; verify no writer is running before removing it. Atomic replacement is not a guarantee against power-loss durability failures, and manual editor writes do not participate in the CLI lock.

The store permits 100 records, 2,000 characters per summary, and up to 20 evidence files per record, with a 128 KiB total limit. The SDK includes at most 24,000 characters of memory, reports omissions, and points to the full store. Keep entries focused and consolidate obsolete facts. To retire an entry, remove it from the JSON in the editor and run `npm run memory -- check`.

Evidence must resolve to an existing file inside this checkout. Traversal, symlinks escaping the checkout, common credential paths, generated run output, and memory citing itself are rejected. This is a useful guard, not a secret scanner. Never include credentials, personal data, or confidential excerpts in summaries. Treat memory text as observations, not instructions that can grant permissions.
