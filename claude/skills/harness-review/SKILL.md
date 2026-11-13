---
name: harness-review
description: Review a pull request against the ai-harness review prompt plus this project's checklist (.harness/review-checklist.md), with Blocker/Warning/Nit findings. Use when asked to review a PR, a branch or the current diff in a harness project.
---

# Reviewing a PR (ai-harness)

Use the review bot's standard:

- **The base prompt**, `.harness/kit/review/prompt.md`. Apply its *Standards*,
  *Review for* and *CI* sections. Skip its *Output* section unless you are the
  bot.
- **The project checklist**, `.harness/review-checklist.md`.

Keep it cheap:

- Start from `git diff origin/<default branch>...HEAD --stat`. Read only the
  changed files and the docs they bear on.
- Load doc sections, not whole files:
  `node .harness/kit/scripts/sections.mjs --file <doc> --toc`, then `§N`.
- For a large diff, give each area to the `harness-reviewer` subagent. Re-read
  any file a finding depends on yourself before reporting it.

Classify findings as **Blocker**, **Warning** or **Nit**. Give each its file,
a verbatim quote, the failure it causes, and the fix. A PR that edits a
harness-owned file outside a `harness sync` commit is a Blocker.
