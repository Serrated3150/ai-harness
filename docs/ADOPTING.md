# Adopting ai-harness in a project

About an hour for a new project, most of it writing `.harness/PROJECT.md`.

## 1. Install

```bash
git clone --depth 1 --branch v1.0.0 https://github.com/Serrated3150/ai-harness /tmp/ai-harness
cd your-project && git checkout -b chore/install-ai-harness
node /tmp/ai-harness/tools/sync.mjs --target . --init
```

This writes the harness-owned files, merges the hook wiring into
`.claude/settings.json`, and seeds the project-owned files: config, overlay,
routine overlays, lessons, roster and review checklist. Nothing else in the
repository is touched.

## 2. Configure (project-owned)

1. **`.harness/config.json`**: project name, repo, default branch,
   `markerPrefix` (2–16 lowercase letters), protected paths, linters, gates,
   changelog fragments, review tuning. See [CONFIG.md](CONFIG.md).
2. **`.harness/PROJECT.md`**: replace every TODO. This is what your routines
   know about the project.
3. **`.harness/review-checklist.md`**: what the review bot must check here.
4. **`.harness/routines/README.md`**: delete the routines you won't run, and
   set cadence and model for the rest.
5. **`.harness/routines/<slug>.md`**: add project steps where a base routine
   needs them. Empty is fine to start.

## 3. Repository settings

- Secret `CLAUDE_CODE_OAUTH_TOKEN` for the review bot (`claude setup-token`).
- Optional variable `HARNESS_RUNNER`, a JSON runner label such as
  `'["self-hosted","linux"]'`. The default is `ubuntu-latest`.
- If ai-harness is private to you: secret `HARNESS_KIT_TOKEN`, a read token
  for ai-harness, so `harness-check` can verify sync PRs.
- Labels: create the ones in the contract (`§status-labels`,
  `§type-labels`).

## 4. Commit and open the PR

```bash
node .harness/kit/scripts/gates.mjs          # your gates, now configured
HARNESS_SYNC=1 git add -A && HARNESS_SYNC=1 git commit -m "chore(harness): install ai-harness v1.0.0"
```

`HARNESS_SYNC=1` in the commit command is what lets the harness hook accept
commits to harness-owned files. Use it only for sync commits.

On this first install PR, `harness-check` uses the PR's own scripts (and
checks them against ai-harness), and the review bot skips with a notice.
The bot reviews only under the base branch's prompt, and the base branch
has none yet. Review the install PR yourself.

## 5. Create the routines

For each routine in your roster, create one scheduled task whose prompt is
the loader in `.harness/kit/routines/LOADER.md`, with the name, slug and
repository filled in. Use the cadence and staggering in the contract
(`§roster`). Give each task the repository as a source, so it has a
checkout. Start with intake, plan review, PR review and follow-through, and
add the testers once those are steady.

## 6. Verify

- Run the `harness-state` workflow by hand once, then check that
  `routine-state` holds a snapshot.
- Open a small PR: `harness-check` and the review bot should run, and the
  review should include your checklist.
- In a session, try to edit `.harness/kit/contract/ROUTINES.md`. The hook
  should refuse and point you to the extension points.
