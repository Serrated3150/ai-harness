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

Globs support `*`, `**`, `?` and `{a,b}`, and match repo-relative paths with
`/`.
