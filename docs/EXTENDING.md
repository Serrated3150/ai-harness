# Extending the harness in your project

Every customisation a project needs has a **project-owned** home. You never
edit harness-owned files ([BOUNDARIES.md](BOUNDARIES.md)). If something you
need has no home below, that is a missing extension point: open an
`extension-point` issue on ai-harness.

Project files add and tighten; they never relax a contract hard limit
(contract `§precedence`).

## 1. Configuration: `.harness/config.json`

Mechanical behaviour: what the hook protects, what is linted, which gates
run, how the review bot is tuned. The full reference is
[CONFIG.md](CONFIG.md).

```json
{
  "protect": {
    "immutableOnMain": ["db/migrations/*.sql"],
    "botBranchOnly": [{ "paths": ["e2e/__snapshots__/**"], "branches": ["^visual/rebaseline-"], "why": "Baselines change after deploy." }],
    "appendViaFragments": [{ "file": "CHANGELOG.md", "fragments": "changelog.d/" }]
  },
  "lint": [
    { "glob": "src/**/*.{ts,tsx}", "cwd": ".", "command": ["node_modules/.bin/eslint", "--no-warn-ignored", "{file}"], "requires": "node_modules/.bin/eslint" }
  ],
  "gates": {
    "web": { "paths": ["src/**"], "steps": [
      { "name": "typecheck", "run": "npm run --silent typecheck" },
      { "name": "unit", "run": "npx vitest run --reporter=dot" }
    ] }
  }
}
```

## 2. Project rules: `.harness/PROJECT.md`

Anything every routine must know about this project: areas, hard contracts,
the trust boundary and owner-only gates, which docs each change updates,
the PR template, test lanes and how tests are tagged, where open decisions
live, who may ask a routine to maintain its PR. Routines read it right after
the contract.

## 3. One routine: `.harness/routines/<slug>.md`

**Add** project-specific steps to a base routine:

```markdown
# PR review — project overlay

- A PR touching `db/migrations/` must say in its body that merging applies the
  migration to production.
- Visual changes: a `major` ledger entry needs the owner's `visual-approved`
  label.
```

**Replace** a base routine when its shape doesn't fit. Make the first line
`replace: true` and write the routine's full job below it. The base still
loads the contract, lessons and snapshot, and the contract's hard limits
still apply.

## 4. A routine of your own

1. Write its whole job in `.harness/routines/<new-slug>.md`.
2. Add `.harness/lessons/<new-slug>.md` and a row in `.harness/routines/README.md`.
3. Create a scheduled task from the loader (`.harness/kit/routines/LOADER.md`),
   with `.harness/kit/routines/custom.md` as the file to read and `<new-slug>`
   as its slug. The custom entry point loads the contract, lessons and
   snapshot, then follows your file.

## 5. The review bot: `.harness/review-checklist.md`

Appended to the harness review prompt, and read from the PR's base branch.
Write per-area instructions: security rules, schema rules, design rules, test
expectations. Tune the turn budget in `config.json` `review`.

## 6. Skills, subagents, hooks, permissions

Add your own under `.claude/` with any name that does **not** start with
`harness-`:

- `.claude/skills/new-migration/SKILL.md`
- `.claude/agents/db-reviewer.md`
- a project hook or permission in `.claude/settings.json`. `harness sync`
  keeps every entry it didn't write.

## 7. Section profiles for your own docs

Let routines load your long docs by section:

```json
{ "contract": { "profiles": { "intake-project": ["§2", "§6.5", "Quality gates"] } } }
```

Then run `node .harness/kit/scripts/sections.mjs --file docs/RULES.md --profile intake-project`.

## 8. Lessons

Routines record lessons in `.harness/lessons/<slug>.md` through reviewed PRs
(contract `§learning`). Lessons are project-owned and travel with the project.
A lesson that would help every project belongs upstream: open an issue
linking it.

## What is not an extension point

- **Editing anything under `.harness/kit/`** or a `harness-*` skill, agent or
  workflow. Open an issue instead.
- **Relaxing a contract hard limit** in any project file.
- **Changing a routine's schedule, model or connectors from a routine.** Those
  belong to the owner, in the scheduler.
