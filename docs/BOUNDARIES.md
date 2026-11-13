# Boundaries: what the harness owns, what your project owns

This page is the contract between ai-harness and every project that uses it,
and between the people and agents on each side. Agents working in a project
should read it before changing anything agent-related.

## The three roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Harness** | This repository, its maintainers and the agents working **in this repository** | Generic machinery that works for any project: the routine contract, base routines, hooks, scripts, skills, agents, workflows, and the extension points. Released as versions. |
| **Project** | A repository that has run `harness sync`, its owner, and the agents working **in that repository** | Everything specific to the project: its rules, areas, gates, protected paths, review checklist, routine additions, lessons and schedule. Built on the harness, never by changing it. |
| **Owner** | The person responsible for a project | Decisions no agent makes: approvals at owner-only gates, merges of rule changes, schedules, models, connectors, harness upgrades. |

## What the harness owns

Everything `harness sync` writes and lists in `.harness/kit/manifest.json`:

| Path in a project | Contents |
|-------------------|----------|
| `.harness/kit/contract/ROUTINES.md` | The routine contract |
| `.harness/kit/routines/*.md` | Base routines and the loader prompt |
| `.harness/kit/scripts/**` | `sections`, `lessons`, `state`, `gates`, `verify`, `review-prompt`, `lib/` |
| `.harness/kit/hooks/harness-hook.mjs` | The hook engine |
| `.harness/kit/review/prompt.md` | The review bot's base prompt |
| `.harness/kit/manifest.json`, `VERSION` | What was synced, with hashes |
| `.claude/skills/harness-*/` | Harness skills |
| `.claude/agents/harness-*.md` | Harness subagents |
| `.github/workflows/harness-*.yml` | Review bot, state snapshot, harness check |
| The `harness-hook.mjs` entries in `.claude/settings.json` | Hook wiring (the rest of the file is yours) |

**Projects never edit these.** Three things enforce that:

- the harness hook refuses an edit, naming this page;
- the hook refuses a commit that stages one, unless the commit carries
  `HARNESS_SYNC=1`;
- the `harness-check` workflow fails a PR whose harness files differ from the
  manifest, and re-derives a changed manifest from ai-harness itself.

## What your project owns

Everything else, in particular:

| Path | Purpose |
|------|---------|
| `.harness/config.json` | Protected paths, linters, gates, changelog, review tuning, marker prefix, section profiles |
| `.harness/PROJECT.md` | Rules for every routine in this project: areas, hard contracts, trust boundary, owner-only gates, docs, PR template, test lanes |
| `.harness/routines/<slug>.md` | Per-routine additions, or a full replacement (`replace: true`) |
| `.harness/routines/README.md` | The roster: which routines run, cadence, model, *Learns from* |
| `.harness/lessons/*.md` | What your routines learn (written by them, through PRs) |
| `.harness/review-checklist.md` | What the review bot checks in this project |
| `.claude/skills/*`, `.claude/agents/*` not named `harness-*` | Your own skills and agents |
| Hooks and permissions in `.claude/settings.json` other than the harness entries | Your own hooks and allowlist |
| Your scheduled tasks | Created from the loader, owned by you |

The harness seeds these once (`harness sync --init`) and never writes them
again.

## Precedence

Project files **add and tighten**; they never relax the harness. When a
project rule and a harness rule disagree, the stricter one wins, and the
routine reports the disagreement so the owner can settle it (contract
`§precedence`). No project file can lift a contract hard limit.

## How changes flow

```text
project needs X
   │
   ├─ X fits an extension point ──────────► change the project-owned file (a normal PR in the project)
   │
   └─ X needs the harness to change ──────► issue on ai-harness (bug / enhancement / extension point)
                                               │
                                               ├─ maintainers change ai-harness and release vX.Y.Z
                                               └─ the project runs `harness sync` to vX.Y.Z (a sync PR)
        meanwhile: a workaround in project-owned files, linked to the issue
```

- **Agents working in a project** follow the left branch. Where that isn't
  possible, they draft the issue: the `harness-issue` skill writes it, and
  routines report it under "Harness" in their run summary. They never patch
  harness files.
- **Agents working in this repository** keep changes generic. If a change
  only makes sense for one project, it belongs in that project's overlay.
  Any new behaviour a project might want to vary needs an extension point
  (config key, overlay hook or template), documented in
  [EXTENDING.md](EXTENDING.md).
