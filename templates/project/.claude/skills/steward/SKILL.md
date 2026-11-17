---
name: steward
description: Watch a pull request you own in this project until it is done. Follows the harness-steward skill, plus this project's conventions below. Use right after opening a PR, when woken by a PR event or check-in, or when asked to babysit or watch a PR.
---

# Stewarding a PR in this project

<!--
Project-owned (seeded once by ai-harness; the harness never rewrites it).
Claude Code reads .claude/skills/steward/SKILL.md from a PR's head branch
before acting on that PR's CI and review events, so this file is the entry
point. Keep the procedure in harness-steward; put only what is specific to
this project below. It can tighten the harness rules, never relax them.
-->

Follow the `harness-steward` skill
(`.claude/skills/harness-steward/SKILL.md`). Where this file is stricter, it
wins.

## Project conventions

Replace these examples with your project's rules, or delete the ones that
don't apply:

- **Who may ask for branch maintenance**: for example, people with write
  access, and the PR reviewer routine through its marker.
- **CI and review-bot waits**: set the limits and the hand-off gate in
  `.harness/config.json` (`routines.waits`, `review.handoff`,
  `review.fixNits`), not here. Name anything stricter, such as a CI lane
  that is known to be slow.
- **Rebase or merge**: whether this project rebases routine branches or
  merges the default branch in.
- **Owner-only gates**: findings or files that always wait for the owner.
