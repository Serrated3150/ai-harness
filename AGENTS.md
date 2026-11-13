# AGENTS.md — ai-harness

You are working **in the ai-harness repository**: the generic, versioned
harness that other projects vendor read-only. Read
[docs/BOUNDARIES.md](docs/BOUNDARIES.md) first.

## If you are an agent in a project that uses the harness

Stop: this file is not for you. In your project, the harness is read-only.

- Extend it through your project's own files, using the `harness-extend`
  skill and [docs/EXTENDING.md](docs/EXTENDING.md).
- Report problems as issues here, using the `harness-issue` skill and
  [CONTRIBUTING.md](CONTRIBUTING.md).

## Rules for changes here

1. **Generic only.** No project names, paths or rules in `kit/`, `claude/` or
   `workflows/`. A project-specific need is an extension point (config key,
   overlay behaviour or template) plus its docs, never a special case.
2. **Every customisation has a project-owned home.** If you add behaviour a
   project might want to vary, add the config key with a safe default and
   document it in `docs/CONFIG.md` and `docs/EXTENDING.md`.
3. **Compatibility.** Renaming or removing a config key, a contract anchor
   (`§name`), a script's CLI, or a harness-owned path is a MAJOR change with
   migration notes in `CHANGELOG.md`.
4. **Safety properties stay intact.**
   - Hooks fail open.
   - The snapshot copies no comment text.
   - The review bot can only comment and read, and builds its prompt from the
     base branch.
   - `harness-check` verifies sync PRs against this repository.
   - Lessons only add or tighten.
5. **Tests.** `node --test` (everything under `kit/` and `tools/`) passes, and
   `python3 tools/gen-routines.py --check` passes. Edit base routines in the
   generator only.
6. **Changelog.** Add an entry under `## Unreleased` in `CHANGELOG.md`.

## Layout

- `kit/`: vendored to `.harness/kit/` (contract, base routines, scripts,
  hooks, review prompt, VERSION).
- `claude/`: vendored to `.claude/` (`harness-*` skills and agents).
- `workflows/`: vendored to `.github/workflows/` (`harness-*`).
- `templates/project/`: project-owned starting files, seeded once by
  `--init`.
- `tools/`: maintainer and install tools that are not vendored (`sync.mjs`,
  `gen-routines.py`).
- `docs/`: for adopters and maintainers.
