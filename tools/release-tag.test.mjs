import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, inspect } from "./release-tag.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);

test("decide: create, nothing to do, and never move a tag", () => {
  assert.deepEqual(decide({ version: "1.2.2", releaseCommit: A, existingTagCommit: null }), { action: "create", tag: "v1.2.2", commit: A });
  assert.equal(decide({ version: "1.2.2", releaseCommit: A, existingTagCommit: A }).action, "none");
  const moved = decide({ version: "1.2.2", releaseCommit: A, existingTagCommit: B });
  assert.equal(moved.action, "error");
  assert.match(moved.message, /Tags never move/);
});

test("decide: a malformed version or no release commit is an error", () => {
  assert.equal(decide({ version: "1.2", releaseCommit: A }).action, "error");
  assert.equal(decide({ version: "v1.2.2", releaseCommit: A }).action, "error");
  assert.equal(decide({ version: "1.2.2", releaseCommit: null }).action, "error");
});

test("inspect: the release commit is the first-parent merge that changed kit/VERSION", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-tag-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } }).trim();
  g("init", "-q", "-b", "main");
  mkdirSync(join(dir, "kit"));
  writeFileSync(join(dir, "kit/VERSION"), "1.0.0\n");
  g("add", "-A");
  g("commit", "-qm", "init");
  g("tag", "v1.0.0");
  g("checkout", "-qb", "feature");
  writeFileSync(join(dir, "kit/VERSION"), "1.1.0\n");
  g("commit", "-qam", "bump");
  g("checkout", "-q", "main");
  g("merge", "-q", "--no-ff", "-m", "Merge feature", "feature");
  const merge = g("rev-parse", "HEAD");
  writeFileSync(join(dir, "other.txt"), "x\n");
  g("add", "-A");
  g("commit", "-qm", "unrelated change after the release");
  assert.deepEqual(inspect(dir), { action: "create", tag: "v1.1.0", commit: merge });
  g("tag", "v1.1.0", merge);
  assert.equal(inspect(dir).action, "none");
});
