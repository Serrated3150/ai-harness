import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWorkflow, parseUses, run, sourcePins, SOURCE } from "./pins.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);

test("parseUses reads action, sha and version comment", () => {
  const u = parseUses(`steps:\n  - uses: actions/checkout@${A} # v7.0.1\n      - if: x\n        uses: o/r@${B} # v1.0.2\n`);
  assert.deepEqual(u.map((x) => [x.action, x.ref, x.version]), [["actions/checkout", A, "v7.0.1"], ["o/r", B, "v1.0.2"]]);
});

test("a stale pin is reported and rewritten, keeping indentation", () => {
  const pins = sourcePins(`      - uses: o/r@${B} # v2.0.0\n`);
  const r = checkWorkflow("w.yml", `      - if: c\n        uses: o/r@${A} # v1.0.0\n`, pins);
  assert.equal(r.problems.length, 1);
  assert.equal(r.text, `      - if: c\n        uses: o/r@${B} # v2.0.0\n`);
});

test("an action missing from the source, or unpinned, is a problem", () => {
  const pins = sourcePins(`- uses: o/r@${A} # v1\n`);
  assert.match(checkWorkflow("w.yml", `- uses: x/y@${A} # v1\n`, pins).problems[0], /not listed/);
  assert.match(checkWorkflow("w.yml", `- uses: o/r@v1\n`, pins).problems.join("\n"), /must be pinned/);
});

test("run --write brings the vendored workflows in line", () => {
  const root = mkdtempSync(join(tmpdir(), "pins-"));
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  mkdirSync(join(root, "workflows"));
  writeFileSync(join(root, SOURCE), `      - uses: o/r@${B} # v2\n`);
  writeFileSync(join(root, "workflows/harness-x.yml"), `      - uses: o/r@${A} # v1\n`);
  assert.equal(run({ root }).length, 1);
  run({ root, write: true });
  assert.deepEqual(run({ root }), []);
  assert.equal(readFileSync(join(root, "workflows/harness-x.yml"), "utf8"), `      - uses: o/r@${B} # v2\n`);
});

test("the repository's vendored workflows match the pin source", () => {
  assert.deepEqual(run(), []);
});
