# Project knowledge

The durable store is [memory.json](memory.json). It records short observations about the codebase, business logic, dependencies, and decisions, with source paths and SHA-256 hashes. It currently describes **this starter**, not an iOS application's domain.

Before substantial work, read the relevant entries and inspect their evidence. `npm run memory -- check` detects changed or missing source files. `npm run memory -- show` prints all entries with freshness labels. An unchanged hash establishes only that the cited file is unchanged; it does not verify a summary's truth or completeness.

After verification, use the [project-memory workflow](../memory.md) to record durable findings. The coordinator owns updates so workers cannot make their own reports into trusted project knowledge. Record unresolved questions in the task contract rather than stating them as facts.

When copying this tooling into another project, keep this index and the workflow instructions but initialize a new memory store for that project. Do not copy this starter's memory.json into your application's knowledge store.
