# ai-harness

A reusable harness for running Claude agents on a software project: scheduled
routines that triage, plan, build, review, test and learn, plus the hooks,
skills, scripts and workflows that keep them cheap and safe.

It was extracted from The Dial Book, where it runs nine routines around the
clock. It is built so any project can adopt it **without forking it**:

1. A project installs a pinned version.
2. It configures and extends that version through files it owns.
3. It reports problems here as issues.

## The one rule: the harness is read-only in your project

```text
┌──────────────────────── ai-harness (this repo) ────────────────────────┐
│ kit/ claude/ workflows/   →  vendored by `harness sync`, read-only     │
│ templates/project/        →  seeded once by `harness sync --init`      │
└────────────────────────────────────────────────────────────────────────┘
                      │ harness sync (pinned version)
                      ▼
┌──────────────────────────── your project ──────────────────────────────┐
│ HARNESS-OWNED (never edit; listed in .harness/kit/manifest.json)       │
│   .harness/kit/**            contract, routine bases, scripts, hooks   │
│   .claude/skills/harness-*   .claude/agents/harness-*                  │
│   .github/workflows/harness-*                                          │
│ PROJECT-OWNED (yours; this is how you extend)                          │
│   .harness/config.json       protection, linters, gates, review, …     │
│   .harness/PROJECT.md        your project's rules for every routine    │
│   .harness/routines/<slug>.md  additions to, or replacements of, a     │
│                                routine                                 │
│   .harness/lessons/          what your routines learn                  │
│   .harness/review-checklist.md  what the review bot checks for you     │
│   .claude/ (anything not harness-*)  your own skills, agents, hooks    │
└────────────────────────────────────────────────────────────────────────┘
```

- **Harness-owned files are refused by the harness hook**, and the
  `harness-check` workflow fails a PR that changes them outside a sync.
- **Everything a project needs to customise has a project-owned home.** See
  [docs/EXTENDING.md](docs/EXTENDING.md).
- **When the harness is wrong, open an issue here.** Don't patch your copy.
  See [CONTRIBUTING.md](CONTRIBUTING.md).

The full delineation is in [docs/BOUNDARIES.md](docs/BOUNDARIES.md).

## What you get

| Piece | What it does |
|-------|--------------|
| **Routine contract** (`kit/contract/ROUTINES.md`) | The rules every routine follows: hard limits, markers, claims, the plan gate, status and type labels, order of work and dependencies, the state snapshot, the self-learning loop. Every section has an anchor (`§order`), so routines load only what they need. |
| **Nine base routines** (`kit/routines/`) | Issue intake, plan review, PR follow-through, PR review, test coverage, issue tracker, daily suite, weekly test strategy and weekly security audit. Each starts by loading the contract by section, your overlay, its lessons and the state snapshot. |
| **Hook engine** (`kit/hooks/`) | Refuses edits to harness-owned files and to paths your config protects. Stops commits that gut a file and pushes to the default branch, lints what was just edited, and reminds about changelog fragments. Fails open. |
| **Scripts** (`kit/scripts/`) | `sections.mjs` loads a doc by section, `lessons.mjs` builds a lessons digest, `state.mjs` writes the issue/PR state snapshot, `gates.mjs` runs local gates and prints only failures, `verify.mjs` checks vendored files, `review-prompt.mjs` builds the review bot's prompt. |
| **Skills and agents** (`claude/`) | `harness-gates`, `harness-pr`, `harness-review`, `harness-extend`, `harness-issue`, and the `harness-reviewer` subagent. |
| **Workflows** (`workflows/`) | `harness-review` (review bot), `harness-state` (state snapshot every 20 min), `harness-check` (drift, config and snapshot dry run on every PR). |

Why vendored and not a Claude Code plugin? Cloud and scheduled sessions,
which is where routines run, don't install plugins declared in a repo's
settings. Files in the repository always reach them. The manifest plus the
check workflow gives vendored files the same "don't touch" guarantee a
plugin would.

## Quick start

```bash
git clone --depth 1 --branch v1.0.0 https://github.com/Serrated3150/ai-harness /tmp/ai-harness
cd your-project
node /tmp/ai-harness/tools/sync.mjs --target . --init
# fill in .harness/config.json and .harness/PROJECT.md
HARNESS_SYNC=1 git commit -am "chore(harness): install ai-harness v1.0.0"
```

Then create the scheduled routines from `.harness/kit/routines/LOADER.md`.
The full walkthrough is in [docs/ADOPTING.md](docs/ADOPTING.md).

## Documentation

- [docs/BOUNDARIES.md](docs/BOUNDARIES.md): what the harness owns, what your
  project owns, and how changes flow.
- [docs/ADOPTING.md](docs/ADOPTING.md): installing the harness in a project.
- [docs/EXTENDING.md](docs/EXTENDING.md): every extension point, with
  examples.
- [docs/CONFIG.md](docs/CONFIG.md): the `.harness/config.json` reference.
- [docs/VERSIONING.md](docs/VERSIONING.md): releases, pinning and upgrading.
- [CONTRIBUTING.md](CONTRIBUTING.md): reporting problems, and how the harness
  itself changes.
