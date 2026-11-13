#!/usr/bin/env node
// Build the review bot's prompt and turn budget for one PR
// (.github/workflows/harness-review.yml). Both inputs are read from the PR's
// BASE branch with `git show`, never from the PR's working tree, so a PR cannot
// change the instructions it is reviewed under:
//   - .harness/kit/review/prompt.md      (harness-owned)
//   - review.checklist from .harness/config.json (project-owned, default .harness/review-checklist.md)
// Writes `prompt` and `turns` to $GITHUB_OUTPUT (or prints them).

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULTS, merge, stripComments } from "./lib/config.mjs";

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
const show = (ref, path) => {
  try {
    return git(["show", `${ref}:${path}`]);
  } catch {
    return null;
  }
};

/** Fill the template. Pure, for tests. */
export function buildPrompt(template, vars) {
  const body = template.includes("\n---\n") ? template.slice(template.indexOf("\n---\n") + 5) : template;
  let out = body;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  if (left) throw new Error(`unfilled placeholder ${left[0]}`);
  return out.trim() + "\n";
}

/** Turn budget: lessons-only PRs get fewer turns. Pure, for tests. */
export function turnsFor(files, review) {
  const res = review.lessonsOnlyPaths.map((p) => new RegExp(p));
  const lessonsOnly = files.length > 0 && res.length > 0 && files.every((f) => res.some((re) => re.test(f)));
  return lessonsOnly ? review.lessonsOnlyTurns : review.defaultTurns;
}

function main() {
  const env = process.env;
  const base = `origin/${env.BASE_REF}`;
  const cfgText = show(base, ".harness/config.json");
  const cfg = merge(structuredClone(DEFAULTS), cfgText ? stripComments(JSON.parse(cfgText)) : {});
  const template = show(base, ".harness/kit/review/prompt.md");
  if (!template) throw new Error(`.harness/kit/review/prompt.md is not on ${env.BASE_REF}; run harness sync and merge it first`);
  const checklist = show(base, cfg.review.checklist) ?? "_The project has no review checklist yet (.harness/review-checklist.md)._";
  const prompt = buildPrompt(template, {
    REPO: env.REPO,
    PR_NUMBER: env.PR_NUMBER,
    BASE_REF: env.BASE_REF,
    HEAD_SHA: env.HEAD_SHA,
    PROJECT_NAME: cfg.project.name ?? env.REPO,
    PROJECT_CHECKLIST: checklist.trim(),
  });
  const files = git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean);
  const turns = turnsFor(files, cfg.review);
  if (env.GITHUB_OUTPUT) {
    const d = `PROMPT_${randomBytes(8).toString("hex")}`;
    appendFileSync(env.GITHUB_OUTPUT, `turns=${turns}\nprompt<<${d}\n${prompt}${d}\n`);
  } else process.stdout.write(prompt);
  console.error(`review prompt: ${prompt.length} bytes, max-turns ${turns}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
