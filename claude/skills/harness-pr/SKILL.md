---
name: harness-pr
description: Open or update a pull request the way the ai-harness contract requires — branch, gates, changelog, the project's PR template, draft until CI is green, labels. Use whenever you are about to push a branch and open or hand off a PR in a harness project.
---

# Opening a PR (ai-harness)

The rules are in the harness contract §implementation. The project's own
rules are in `.harness/PROJECT.md`. Load just what you need:

```bash
node .harness/kit/scripts/sections.mjs §implementation §status-labels §order
```

1. **Branch**: use the branch your environment designates, otherwise
   `claude/issue-<n>-<slug>` from the default branch. Never push to the
   default branch; the harness hook refuses it.
2. **Check the stat before each commit**: `git diff --cached --stat` must
   match what you meant to change.
3. **Gates**: run the `harness-gates` skill. Report SKIPPED gates honestly.
4. **Docs and changelog**: as `.harness/PROJECT.md` says. If the project uses
   changelog fragments (`changelog.fragmentsDir`), add a fragment; never edit
   the folded changelog.
5. **Body**: use the project's PR template, with every section filled.
   - `Refs #N`, never a closing keyword.
   - Link the approved plan, and list deviations from it.
   - Put "Not yet verified" items in a plain list, never as unchecked boxes.
6. **Draft, then wait for CI**: mark it ready only when CI is green on the
   head, then request review and set `pending-review`. Setting labels
   replaces the whole set. Never touch the owner's labels.
7. **Waits on nothing**: before handing it off, check that its issue doesn't
   depend on anything still open, and check the sequencing its approved plan
   settles (§order).
