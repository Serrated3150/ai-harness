---
name: harness-issue
description: Report a problem with ai-harness itself (a bug in a harness script, hook, workflow or base routine; a rule that does not generalise; a missing extension point) as an issue on the ai-harness repository, instead of editing harness-owned files. Use when a harness file seems wrong or something cannot be expressed through the project's extension points.
---

# Reporting a harness problem

Projects never patch the harness; they report problems upstream. Write the
report so a maintainer can act on it without your session:

1. **Check it really is the harness.** Ask whether the project's own files
   could express what you need: `.harness/config.json`, `.harness/PROJECT.md`,
   `.harness/routines/<slug>.md`, or a project skill or hook (the
   `harness-extend` skill). If they can, do that instead.
2. **Collect evidence**:
   - the version, from `.harness/kit/manifest.json` (`version`, `commit`);
   - the file and line;
   - what happened, and what you expected;
   - a minimal reproduction (a config snippet, an input, the command and its
     output).
   Never include secrets or private data from the project.
3. **Pick the type**:
   - `bug`: the harness does something wrong;
   - `enhancement`: a rule that doesn't generalise, or something new;
   - `extension-point`: something a project needs to customise but can't.
4. **File it** on `Serrated3150/ai-harness` using its issue template, if you
   have access to that repository. If you don't, put the drafted issue text
   in your summary or reply under "Harness issue to raise", so the owner can
   file it.
5. **Work around it in project-owned files**, and link the issue from the
   workaround so it can be removed when a fixed version is synced.
