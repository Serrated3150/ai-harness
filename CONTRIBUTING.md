# Contributing to ai-harness

## If you use the harness in a project

**Report problems as issues here. Don't patch your copy.** Your copy is
read-only by design ([docs/BOUNDARIES.md](docs/BOUNDARIES.md)).

Open an issue with the matching template:

- **Bug**: a harness script, hook, workflow or base routine does something
  wrong.
- **Enhancement**: a rule that doesn't generalise, or something new the
  harness should do.
- **Extension point**: something your project needs to customise that no
  project-owned file can express.

Include:

- the version from `.harness/kit/manifest.json`;
- the file and line;
- what happened, and what you expected;
- a minimal reproduction.

Never include secrets or private project data. Agents can draft the issue
with the `harness-issue` skill.

While you wait for a release, work around the problem in your project-owned
files, and link the workaround to the issue.

## If you work on the harness itself

- **Keep it generic.** Anything that only makes sense for one project belongs
  in that project's overlay, not here. A behaviour a project might want to
  vary needs an extension point: a config key, overlay behaviour or template,
  documented in [docs/EXTENDING.md](docs/EXTENDING.md) and
  [docs/CONFIG.md](docs/CONFIG.md).
- **Never break a project silently.** Changing a config key, an extension
  point, a contract anchor or a harness-owned path is a MAJOR release with
  migration notes.
- **Tests travel with the change.** `node --test` must pass. Generated
  routines must be current (`python3 tools/gen-routines.py --check`).
- **Base routines are generated** from `tools/gen-routines.py`. Edit the
  generator, not `kit/routines/*.md`.
- **One PR per change**, with a `CHANGELOG.md` entry under `## Unreleased`.
  Releases move Unreleased to a version and tag it.
