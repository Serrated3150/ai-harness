# Versions, pinning and upgrading

- ai-harness is released as **semver tags** (`v1.0.0`). `kit/VERSION` holds
  the version. Each release has a `CHANGELOG.md` entry.
- **MAJOR** releases are breaking for projects: a renamed config key, a
  removed extension point, a contract rule that a project's overlay may now
  violate, or a moved harness-owned path. **MINOR** releases add, and
  **PATCH** releases fix.
- A project is pinned by its manifest (`.harness/kit/manifest.json`:
  `version` and `commit`). Nothing updates by itself.

## Upgrading a project

```bash
git clone --depth 1 --branch vX.Y.Z https://github.com/Serrated3150/ai-harness /tmp/ai-harness
git checkout -b chore/harness-vX.Y.Z
node /tmp/ai-harness/tools/sync.mjs --target .
node .harness/kit/scripts/gates.mjs
HARNESS_SYNC=1 git add -A && HARNESS_SYNC=1 git commit -m "chore(harness): sync ai-harness vX.Y.Z"
```

Read the release notes between your version and the new one. A MAJOR release
lists what to change in your project-owned files. `harness-check` verifies
the sync PR against ai-harness at the recorded commit.

Project-owned files are never touched by an upgrade. When a release adds a
template you want, copy it yourself or re-run with `--init`, which only
writes files that don't exist yet.
