# Third-party skill notices

The repository includes the following MIT-licensed skills. Full, unmodified license texts are retained under `.cursor/skills/.licenses/` and must accompany redistributed copies. The pinned commits and individual file identities are recorded in [skills-lock.json](skills-lock.json).

| Upstream | Copyright | Source revision | Included material | License |
| --- | --- | --- | --- | --- |
| [t3dotgg/tstack](https://github.com/t3dotgg/tstack) | Copyright (c) 2026 Theo Browne | `1085050f3baed1ac724caa4a8166145fb2ac88af` | Complete `skills/` tree relocated to `.cursor/skills/` | [MIT](.cursor/skills/.licenses/tstack.txt) |
| [cursor/plugins, pstack](https://github.com/cursor/plugins/tree/ae5650febf4320793844c12c4adaa937f417f8da/pstack) | Copyright (c) 2026 Lauren Tan | `ae5650febf4320793844c12c4adaa937f417f8da` | Complete `pstack/skills/unslop/` and `pstack/skills/why/` directories | [MIT](.cursor/skills/.licenses/pstack.txt) |
| [getsentry/XcodeBuildMCP](https://github.com/getsentry/XcodeBuildMCP) | Copyright (c) 2025 Cameron Cooke | `b6f49dd0636846c474334e2949b947ed0ea41aad` (v2.3.2) | `skills/xcodebuildmcp/SKILL.md`, unchanged | [MIT](.cursor/skills/.licenses/xcodebuildmcp.txt) |
| [mattpocock/skills](https://github.com/mattpocock/skills) | Copyright (c) 2026 Matt Pocock | `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d` | Complete `skills/productivity/grill-me/` and `skills/productivity/grilling/` directories; adapted, condensed versions of `engineering/tdd`, `diagnosing-bugs`, `code-review`, `to-spec`, `to-tickets`, `domain-modeling`, and `productivity/writing-for-agents` and `handoff` | [MIT](.cursor/skills/.licenses/mattpocock-skills.txt) |

The tstack, pstack, and `grilling` file contents are unchanged. The `grill-me/SKILL.md` dispatch sentence was adapted to read the sibling `grilling/SKILL.md` without assuming a Skill tool, with a fallback for environments without subagents. Its upstream frontmatter and accompanying `agents/openai.yaml` are preserved. The executable mode of `babysit-pr/scripts/pr-wait` was restored after archive extraction.

`tdd`, `diagnosing-bugs`, `code-review`, `to-milestones`, `domain-modeling`, `writing-for-agents`, and `handoff` are modified works derived from Matt Pocock's skills under the same MIT license. Each states its origin, and `skills-lock.json` records the upstream blobs and the changes.

The `project-memory` skill and [repository usage notes](docs/skills.md) were authored for this starter. The upstream projects do not endorse this integration. Only the requested skill directories and their dependencies are included; this does not install the whole pstack plugin or its integrations.
