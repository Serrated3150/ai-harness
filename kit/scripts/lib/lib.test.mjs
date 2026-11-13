import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { globToRegExp, matchesAny } from "./glob.mjs";
import { DEFAULTS, loadConfig, merge, validate } from "./config.mjs";

test("glob: *, **, ?, {a,b}", () => {
  assert.ok(globToRegExp("*.md").test("README.md"));
  assert.ok(!globToRegExp("*.md").test("docs/README.md"));
  assert.ok(globToRegExp("**/*.md").test("README.md"));
  assert.ok(globToRegExp("**/*.md").test("a/b/c.md"));
  assert.ok(globToRegExp("web/**").test("web/a/b.ts"));
  assert.ok(globToRegExp("web/**/*.{ts,tsx}").test("web/app/x.tsx"));
  assert.ok(!globToRegExp("web/**/*.{ts,tsx}").test("web/app/x.js"));
  assert.ok(globToRegExp("db/migrations/00??_*.sql").test("db/migrations/0012_x.sql"));
  assert.ok(globToRegExp("a.b").test("a.b") && !globToRegExp("a.b").test("axb"));
  assert.ok(matchesAny("x/y.png", ["**/*.png"]));
});

test("merge: objects deep, arrays replace", () => {
  const m = merge({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3] }, e: 2 });
  assert.deepEqual(m, { a: { b: 1, c: [3] }, d: 1, e: 2 });
});

test("validate reports actionable errors", () => {
  assert.deepEqual(validate({}), []);
  assert.match(validate({ markerPrefix: "Bad Prefix" })[0], /markerPrefix/);
  assert.match(validate({ gates: { web: { paths: "web/**", steps: [] } } })[0], /paths/);
  assert.match(validate({ lint: [{ glob: "*.ts" }] })[0], /command/);
});

test("loadConfig: defaults without a file, merged with one", () => {
  const dir = mkdtempSync(join(tmpdir(), "harness-"));
  assert.equal(loadConfig(dir).markerPrefix, DEFAULTS.markerPrefix);
  mkdirSync(join(dir, ".harness"));
  writeFileSync(join(dir, ".harness/config.json"), JSON.stringify({ markerPrefix: "acme", protect: { noPushTo: ["trunk"] } }));
  const c = loadConfig(dir);
  assert.equal(c.markerPrefix, "acme");
  assert.deepEqual(c.protect.noPushTo, ["trunk"]);
  assert.equal(c.protect.largeWriteLines, 200);
  writeFileSync(join(dir, ".harness/config.json"), "{ nope");
  assert.throws(() => loadConfig(dir), /invalid JSON/);
});

test("$-prefixed keys are comments at every level", async () => {
  const { stripComments } = await import("./config.mjs");
  assert.deepEqual(stripComments({ $comment: "x", gates: { $comment: "y", web: { paths: [] } } }), { gates: { web: { paths: [] } } });
  const tpl = JSON.parse(readFileSync(new URL("../../../templates/project/.harness/config.json", import.meta.url), "utf8"));
  assert.deepEqual(validate(stripComments(tpl)), [], "the shipped config template is valid");
});
