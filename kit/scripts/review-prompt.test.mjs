import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPrompt, turnsFor } from "./review-prompt.mjs";
import { DEFAULTS } from "./lib/config.mjs";

const template = readFileSync(new URL("../review/prompt.md", import.meta.url), "utf8");
const vars = { REPO: "o/r", PR_NUMBER: "5", BASE_REF: "main", HEAD_SHA: "abc123", PROJECT_NAME: "Acme", PROJECT_CHECKLIST: "- check RLS" };

test("the shipped prompt fills every placeholder and drops the maintainer header", () => {
  const p = buildPrompt(template, vars);
  assert.match(p, /^REPO: o\/r/);
  assert.match(p, /sha=abc123 -->/);
  assert.match(p, /- check RLS/);
  assert.match(p, /Do NOT merge/);
  assert.doesNotMatch(p, /Harness-owned review bot prompt/);
});

test("a missing variable is an error, not a silent hole", () => {
  const { HEAD_SHA, ...rest } = vars;
  assert.throws(() => buildPrompt(template, rest), /HEAD_SHA/);
});

test("turn budget tiers", () => {
  const review = { ...DEFAULTS.review, lessonsOnlyPaths: ["^\\.harness/lessons/[a-z0-9-]+\\.md$", "^changelog\\.d/"] };
  assert.equal(turnsFor([".harness/lessons/pr-review.md", "changelog.d/x.md"], review), 25);
  assert.equal(turnsFor([".harness/lessons/pr-review.md", "src/a.ts"], review), 60);
  assert.equal(turnsFor([], review), 60);
  assert.equal(turnsFor(["a.md"], DEFAULTS.review), 60);
});
