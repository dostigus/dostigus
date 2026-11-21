# Notice

The skill directories in this folder, except the adaptations named below, are
taken from [mattpocock/skills](https://github.com/mattpocock/skills) at commit
`abeeaf95660ba9e8b7c753eb38f441ca707a8823` (2026-11-19, "Merge pull request
#1455 from mattpocock/ci-frontmatter-check").

Copyright (c) 2026 Matt Pocock. Licensed under the MIT License. The license
text is [`LICENSE`](LICENSE) in this folder. It applies to those vendored
files.

## Adaptation

[`to-tickets/SKILL.md`](to-tickets/SKILL.md) is adapted. Upstream publishes
tracer-bullet tickets to GitHub, Linear, or `.scratch/<feature>/issues/`.
The Dostigus copy writes **Tickets** on the parent **Task** through the MCP
surface and does not open GitHub issues. The vertical-slice rules and the
approval quiz stay upstream. See the banner in that file.

Every other file under the skill directories is unmodified from that commit.

`README.md` in this folder is Dostigus text. It is not upstream.

`eslint.config.mjs` ignores `skills/**`. The repo linter would otherwise
reformat upstream YAML and the code samples inside the Markdown.
`.cursor/skills/design-taste-frontend/**` is ignored for the same reason.
