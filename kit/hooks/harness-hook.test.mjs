import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEFAULTS, merge } from "../scripts/lib/config.mjs";
import { addsEntryHeading, brokenLinks, commitAll, editVerdict, guttedFiles, isCommit, parseNumstat, pushesTo } from "./harness-hook.mjs";

const cfg = merge(structuredClone(DEFAULTS), {
  protect: {
    immutableOnMain: ["db/migrations/*.sql"],
    botBranchOnly: [{ paths: ["e2e/snapshots/**"], branches: ["^visual/rebaseline-"] }],
    appendViaFragments: [{ file: "CHANGELOG.md", fragments: "changelog.d/" }],
  },
});
const base = { tool: "Edit", input: { old_string: "a", new_string: "b" }, branch: "feature", cfg, owned: new Set([".harness/kit/contract/ROUTINES.md", ".claude/skills/harness-gates/SKILL.md"]), existsOnMain: () => false, currentText: null };

test("harness-owned files are read-only and point to extension points and issues", () => {
  const r = editVerdict({ ...base, path: ".harness/kit/contract/ROUTINES.md" });
  assert.match(r, /harness-owned/);
  assert.match(r, /EXTENDING\.md/);
  assert.match(r, /issues/);
  assert.match(editVerdict({ ...base, path: ".claude/skills/harness-gates/SKILL.md" }), /harness-owned/);
  // Project-owned harness files stay editable.
  assert.equal(editVerdict({ ...base, path: ".harness/config.json" }), null);
  assert.equal(editVerdict({ ...base, path: ".harness/routines/issue-intake.md" }), null);
});

test("immutableOnMain: only files already on the default branch", () => {
  assert.match(editVerdict({ ...base, path: "db/migrations/0001_x.sql", existsOnMain: () => true }), /immutable/);
  assert.equal(editVerdict({ ...base, path: "db/migrations/0002_new.sql" }), null);
});

test("botBranchOnly", () => {
  assert.match(editVerdict({ ...base, path: "e2e/snapshots/a/home.png" }), /only change on a branch/);
  assert.equal(editVerdict({ ...base, path: "e2e/snapshots/home.png", branch: "visual/rebaseline-3" }), null);
});

test("appendViaFragments: no rewrite, no new entry, corrections allowed", () => {
  assert.match(editVerdict({ ...base, path: "CHANGELOG.md", tool: "Write", input: { content: "x" } }), /never rewritten/);
  assert.match(editVerdict({ ...base, path: "CHANGELOG.md", input: { old_string: "", new_string: "### Added\n- y" } }), /new file under changelog\.d/);
  assert.equal(editVerdict({ ...base, path: "CHANGELOG.md", input: { old_string: "teh", new_string: "the" } }), null);
  assert.ok(addsEntryHeading("a", "### b"));
});

test("Write may not gut a large file", () => {
  const big = Array.from({ length: 400 }, (_, i) => `l${i}`).join("\n");
  assert.match(editVerdict({ ...base, path: "docs/X.md", tool: "Write", input: { content: "x" }, currentText: big }), /Edit the parts/);
  assert.equal(editVerdict({ ...base, path: "docs/X.md", tool: "Write", input: { content: big + "\n+" }, currentText: big }), null);
});

test("an empty config protects nothing beyond harness-owned files and pushes", () => {
  const empty = structuredClone(DEFAULTS);
  assert.equal(editVerdict({ ...base, cfg: empty, path: "db/migrations/0001_x.sql", existsOnMain: () => true }), null);
  assert.equal(editVerdict({ ...base, cfg: empty, path: "CHANGELOG.md", tool: "Write", input: { content: "x" } }), null);
});

test("numstat and gutted detection", () => {
  const ns = parseNumstat("1\t887\tdocs/A.md\n-\t-\timg.png\n10\t12\tx.ts\n");
  assert.equal(ns.length, 2);
  assert.deepEqual(guttedFiles(ns, (p) => (p === "docs/A.md" ? 900 : 300)).map((f) => f.path), ["docs/A.md"]);
  assert.deepEqual(guttedFiles(parseNumstat("700\t800\tdocs/A.md"), () => 900), []);
});

test("commit and push detection", () => {
  assert.ok(isCommit('git commit -m "x"'));
  assert.ok(isCommit("git add . && git commit -m x"));
  assert.ok(!isCommit("git commit-tree abc"));
  assert.ok(commitAll("git commit -am x"));
  assert.ok(!commitAll("git commit -m x"));
  const prot = ["main", "master"];
  assert.ok(pushesTo("git push origin main", "f", prot));
  assert.ok(pushesTo("git push origin HEAD:main", "f", prot));
  assert.ok(pushesTo("git push -f origin +refs/heads/main", "f", prot));
  assert.ok(pushesTo("git push", "main", prot));
  assert.ok(!pushesTo("git push -u origin claude/x", "claude/x", prot));
  assert.ok(!pushesTo("git push origin maintenance", "x", prot));
  assert.ok(pushesTo("git push origin trunk", "x", ["trunk"]));
});

test("broken relative links", () => {
  const md = "[a](./ok.md) [b](./missing.md#x) [c](https://e.com) [d](#f)\n`[e](./no.md)`\n```\n[f](./no.md)\n```\n";
  assert.deepEqual(brokenLinks(md, "/r", (p) => p === "/r/ok.md").map((b) => b.target), ["./missing.md#x"]);
});

test("the hook fails open on bad input and unknown events", () => {
  const script = fileURLToPath(new URL("./harness-hook.mjs", import.meta.url));
  for (const [arg, stdin] of [["pre-edit", "not json"], ["nope", "{}"], ["pre-bash", "{}"]]) {
    const r = spawnSync(process.execPath, [script, arg], { input: stdin, encoding: "utf8" });
    assert.equal(r.status, 0, `${arg}: ${r.stderr}`);
    assert.equal(r.stdout, "");
  }
});
