---
name: domain-modeling
description: Sharpen the project's domain language and decisions, then record them in project memory. Use when terminology is fuzzy or conflicting, when a business rule is being defined or changed, or when a hard-to-reverse decision is made.
---

# Domain modeling

Distilled from Matt Pocock's `domain-modeling` skill. Here, repository project memory replaces `GLOSSARY.md` and `docs/adr/`, so terms and decisions live beside the codebase and dependency knowledge the runner already loads. Provenance is in `docs/skills.md`.

This is the active discipline for changing the model. Reading memory for vocabulary is the `project-memory` skill.

## During the conversation

- **Challenge against memory.** When the user's term conflicts with a `business-logic` entry, say so at once: "Memory defines a draft as X, but you seem to mean Y. Which is it?"
- **Sharpen fuzzy language.** When a word is vague or overloaded, propose one canonical term and name the synonyms to avoid.
- **Probe with scenarios.** Invent concrete edge cases that force a boundary between two concepts into the open.
- **Cross-reference the code.** When the user says how something works, check the source. Surface contradictions: "The store deletes the whole thread, but you said partial deletion is possible. Which is right?"

## Record what is resolved

The coordinator records each resolved item through the `project-memory` workflow and its CLI, as soon as it is settled. Workers and reviewers propose entries in their reports.

**Term:** a `business-logic` entry with ID `term-<kebab-name>`. Summary: "<Term>: <one or two sentences on what it is>. Avoid: <rejected synonyms>." Cite the type or module that embodies it. Record only concepts specific to this project, and keep implementation details out of the definition.

**Decision:** a `decisions` entry, only when all three hold:

1. Hard to reverse: changing course later has a meaningful cost.
2. Surprising without context: a future reader would wonder why.
3. A real trade-off: there were genuine alternatives.

Summary: the context, the decision, and the reason, plus a rejected alternative when the rejection is not obvious. Cite the code that enforces it or a reviewed design document. When the reason comes from the user rather than a file, cite the code it governs and say the user stated the reason. Easy-to-reverse or obvious choices stay out of memory.

Finish by listing the memory IDs recorded or proposed and any term still unresolved. Put unresolved questions in the task contract, not memory.
