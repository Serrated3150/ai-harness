# `.harness/config.json` reference

Project-owned. Every harness script and the hook read it through
`kit/scripts/lib/config.mjs`, merged over the defaults below:

- objects merge key by key;
- arrays replace the default;
- any key starting with `$` is a comment and is ignored.

An invalid file fails the `harness-check` workflow with the reason. The hook
fails open on it.

| Key | Default | Meaning |
|-----|---------|---------|
| `project.name` | `null` | Shown in the review prompt and session banner |
| `project.repo` | `null` | `owner/name` |
| `project.defaultBranch` | `"main"` | What "the default branch" means everywhere |
| `markerPrefix` | `"harness"` | Marker comments are `<!-- <prefix>-routine:<token> -->`. 2–16 lowercase letters/digits, starting with a letter. **Choose once**: changing it orphans existing markers |
| `contract.file` | `.harness/kit/contract/ROUTINES.md` | Default file for `sections.mjs` |
| `contract.overlay` | `.harness/PROJECT.md` | The project overlay |
| `contract.profiles` | `{}` | Extra or replacement section profiles: `{ "<name>": ["§2", "§anchor", "Heading text"] }` |
| `routines.overlays` | `.harness/routines` | Per-routine overlays |
| `routines.lessons` | `.harness/lessons` | Lessons files (`<slug>.md`, `shared.md`) |
| `routines.readme` | `.harness/routines/README.md` | Roster; `lessons.mjs` reads its *Learns from* column |
| `routines.ledger` | `false` | When true, every run keeps a run ledger (`kit/scripts/ledger.mjs`, contract §ledger) and the stop hook sends a run back to work while an item in its scope has no outcome (at most three times per run). No ledger, as in an interactive session, means no check |
| `routines.budget.newWorkMinutes` | `45` | Minutes from the run's start after which it starts no new item or fix cycle. Measured by the ledger's clock |
| `routines.budget.endMinutes` | `60` | Minutes from the run's start by which it is finished. Schedule routines so each slot is longer than this plus the scheduler's late firing |
| `routines.parallel.maxAgents` | `1` | Subagents a run may use at once (contract §parallel). `1` means no subagents |
| `routines.parallel.maxItemsPerRun` | `1` | Work items intake takes per run (§picking-work) |
| `routines.waits.prMinutes` | `40` | Minutes of waiting per PR per run, CI and review bot together |
| `routines.waits.verdictMinutes` | `25` | Minutes to wait for one review-bot verdict before handing off on green CI |
| `routines.waits.fixCycles` | `3` | Fix cycles per PR per run, CI fixes and finding fixes together |
| `protect.immutableOnMain` | `[]` | Globs: a matching file that already exists on the default branch may not be edited |
| `protect.botBranchOnly` | `[]` | `[{ "paths": [glob], "branches": [regex], "why"?: text }]`: matching paths change only on matching branches |
| `protect.appendViaFragments` | `[]` | `[{ "file": path, "fragments": dir }]`: never rewrite the file or add an entry heading (`###`); use fragments |
| `protect.noPushTo` | `["main","master"]` | Branches `git push` may not target |
| `protect.largeWriteLines` | `200` | A Write may not replace a file at least this long with less than half of it |
| `protect.guttedMinDeleted` | `100` | A commit deleting at least this many lines (and most of a file) is stopped |
| `lint` | relative-links on `**/*.md` | `[{ "glob", "cwd"?, "command": [argv with "{file}"], "requires"?: path }]` or `{ "glob", "builtin": "relative-links" }` |
| `gates` | `{}` | `{ "<area>": { "paths": [glob], "steps": [{ "name", "run", "cwd"?, "requires"?: command or path, "skip"?: reason }] } }` |
| `changelog.fragmentsDir` | `null` | When set, the stop hook reminds a branch with changes but no fragment |
| `changelog.exemptBranches` | `[]` | Regexes for branches that need no fragment |
| `review.checklist` | `.harness/review-checklist.md` | Appended to the review prompt (read from the base branch) |
| `review.lessonsOnlyPaths` | `[]` | Regexes: a PR changing only matching files is lessons-only |
| `review.lessonsOnlyTurns` | `25` | Turn budget for a lessons-only PR |
| `review.defaultTurns` | `60` | Turn budget otherwise |
| `review.handoff` | `"ci"` | When a PR may go to the owner: `"ci"` (CI green on the head) or `"clean-approval"` (CI green and the review bot's verdict on that head is APPROVE with no Blocker, Warning or Nit) |
| `review.fixNits` | `false` | When true, Nits are fixed and pushed like any finding instead of answered and carried (pair it with `"clean-approval"`) |

Globs support `*`, `**`, `?` and `{a,b}`, and match repo-relative paths with
`/`.
