---
name: harness-extend
description: Decide where a change to agent behaviour belongs in a project that uses ai-harness — project config, project overlay, routine overlay, the project's own skill/agent/hook, or an issue on ai-harness — and make it there. Use whenever you want to change how routines, hooks, gates, skills or the review bot behave in this project, or are about to edit anything under .harness/kit, .claude/skills/harness-*, .claude/agents/harness-* or .github/workflows/harness-*.
---

# Extending ai-harness in this project

**Harness-owned files are read-only.** These are everything listed in
`.harness/kit/manifest.json`:

- `.harness/kit/**`
- `.claude/skills/harness-*`
- `.claude/agents/harness-*`
- `.github/workflows/harness-*`

The hook refuses edits to them, and the `harness-check` workflow fails on any
drift. They change only through `harness sync`.

Every change you want has a project-owned home:

| You want to… | Change this (project-owned) |
|---|---|
| Protect a path, add a linter, change a gate, tune review turns | `.harness/config.json` (`protect`, `lint`, `gates`, `review`) |
| State a project rule every routine follows (areas, trust boundary, owner-only gates, docs to update, PR template) | `.harness/PROJECT.md` |
| Add steps or rules to one routine | `.harness/routines/<slug>.md` |
| Replace one routine's base entirely | `.harness/routines/<slug>.md` starting with `replace: true` |
| Add a routine the harness doesn't ship | A new `.harness/routines/<new-slug>.md` (with `replace: true`), a new scheduled task using the loader, and a row in `.harness/routines/README.md` |
| Tell the review bot what to check in this project | `.harness/review-checklist.md` |
| Add a skill, subagent or hook | `.claude/skills/<name>/`, `.claude/agents/<name>.md`, or a project hook in `.claude/settings.json`. Never name it `harness-*` |
| Load a routine's sections from your own docs | `contract.profiles` in `.harness/config.json` |
| Teach a routine from evidence | A lesson in `.harness/lessons/<slug>.md`, through the learning loop |

Project files **add and tighten**; they never relax a harness hard limit
(contract §precedence).

**When the harness itself is wrong** (a bug, a rule that doesn't fit, a
missing extension point), don't work around it by editing it. Use the
`harness-issue` skill to report it. Meanwhile, express the workaround in the
project-owned files above.
