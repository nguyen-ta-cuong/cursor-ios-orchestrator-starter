---
name: handoff
description: Compact the current session into a handoff document for another agent.
disable-model-invocation: true
---

# Handoff

Distilled from Matt Pocock's `handoff` skill. Provenance is in `docs/skills.md`.

Write `.orchestrator/handoffs/<UTC timestamp>-<slug>.md`. `.orchestrator/` holds transient state and stays out of Git. If the user supplied an argument, treat it as the next session's focus and tailor the document to it.

Include:

- **Goal:** the user's request in their words, plus constraints they set.
- **State:** what is done and verified, with the commands and results; what is done but unverified; what has not started.
- **Next steps:** ordered, each ending on a checkable condition.
- **Open decisions:** questions only the user can answer.
- **Suggested skills:** the repository skills the next agent should read first.

Reference existing artifacts by path instead of copying them: the task contract, run reports under `.orchestrator/runs/`, memory IDs, plans, and changed files. Redact credentials and personal data.

Durable knowledge belongs in project memory through the coordinator, not in the handoff. Finish by printing the handoff path.
