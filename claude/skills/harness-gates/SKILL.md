---
name: harness-gates
description: Run this project's local quality gates (from .harness/config.json) for the areas a branch touches, printing only failures. Use before every push, or when asked to check, verify or "run the tests" on a change.
---

# Local gates (ai-harness)

```bash
git fetch -q origin <default branch>
node .harness/kit/scripts/gates.mjs          # areas changed vs the default branch
node .harness/kit/scripts/gates.mjs web db   # or name the areas; `all` runs every area
```

The areas, their paths and their steps are the project's own, in the `gates`
section of `.harness/config.json`. The output is one PASS / FAIL / SKIPPED line
per step, plus the last 60 lines of each failure. The exit status is the
number of failures.

- **FAIL**: fix it, then re-run only that area.
- **SKIPPED**: the step's tool isn't available here. That is not a pass. Say
  so in the PR under "How it was tested", with the skip reason the config
  gives.
- **A gate is missing or wrong for this project**: change `gates` in
  `.harness/config.json`. That file is the project's own (see the
  `harness-extend` skill). Never edit `.harness/kit/`.
