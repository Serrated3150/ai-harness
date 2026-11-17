// node --test kit/scripts/ledger.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, hookDecision, unaccounted, MAX_BLOCKS } from "./ledger.mjs";

const NEW_WORK_MIN = 70;
const BUDGET = { newWorkMinutes: NEW_WORK_MIN, endMinutes: 90 };

const T0 = Date.parse("2026-11-17T12:05:00Z");
const min = (m) => T0 + m * 60000;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const path = join(dir, "ledger.json");
  const env = { HARNESS_RUN_LEDGER: path };
  let out = "";
  const stdout = { write: (s) => (out += s) };
  const run = (argv, m = 0) => {
    out = "";
    return main(argv, { now: min(m), env, stdout, budget: BUDGET });
  };
  return { path, run, out: () => out, read: () => JSON.parse(readFileSync(path, "utf8")) };
}

test("a run with every item done may stop", () => {
  const f = fixture();
  f.run(["start", "pr-follow-through"]);
  f.run(["add", "356", "#218"], 1);
  f.run(["set", "#356", "done"], 10);
  f.run(["set", "218", "done"], 20);
  assert.equal(hookDecision(f.path, min(21)), null);
  assert.equal(f.run(["check"], 21), 0);
});

test("an open item blocks the stop and names the item", () => {
  const f = fixture();
  f.run(["start", "pr-follow-through"]);
  f.run(["add", "356", "218"], 1);
  f.run(["set", "356", "done"], 2);
  const d = hookDecision(f.path, min(3));
  assert.equal(d.decision, "block");
  assert.match(d.reason, /#218: still todo/);
  assert.equal(f.run(["check"], 3), 1);
});

test("a run that never listed its scope is blocked; `none` clears it", () => {
  const f = fixture();
  f.run(["start", "plan-review"]);
  assert.match(hookDecision(f.path, min(1)).reason, /no scope listed/);
  f.run(["none", "no plans awaiting a verdict"], 2);
  assert.equal(hookDecision(f.path, min(2)), null);
});

test("budget is refused before the cutoff and accepted after it", () => {
  const f = fixture();
  f.run(["start", "issue-intake"]);
  f.run(["add", "100"]);
  assert.throws(() => f.run(["set", "100", "budget", "out of time"], 5));
  f.run(["set", "100", "budget", "cutoff reached"], NEW_WORK_MIN + 1);
  assert.equal(hookDecision(f.path, min(NEW_WORK_MIN + 2)), null);
});

test("a budget claim written early by hand still counts as unaccounted", () => {
  const f = fixture();
  f.run(["start", "issue-intake"]);
  f.run(["add", "100"]);
  const l = f.read();
  l.items[0].status = "budget";
  l.items[0].reason = "x";
  l.items[0].at = new Date(min(10)).toISOString();
  writeFileSync(f.path, JSON.stringify(l));
  assert.equal(unaccounted(f.read()).length, 1);
});

test("closing statuses other than done need a reason", () => {
  const f = fixture();
  f.run(["start", "pr-review"]);
  f.run(["add", "360"]);
  assert.throws(() => f.run(["set", "360", "blocked"], 1));
  f.run(["set", "360", "blocked", "waiting on #357"], 1);
  assert.equal(f.read().items[0].reason, "waiting on #357");
});

test("the hook blocks at most MAX_BLOCKS times, then fails open", () => {
  const f = fixture();
  f.run(["start", "pr-follow-through"]);
  f.run(["add", "1"]);
  for (let i = 0; i < MAX_BLOCKS; i++) assert.ok(hookDecision(f.path, min(5)));
  assert.equal(hookDecision(f.path, min(5)), null);
});

test("no ledger, a broken ledger or a stale one lets the session end", () => {
  const f = fixture();
  assert.equal(hookDecision(f.path, min(0)), null);
  writeFileSync(f.path, "{not json");
  assert.equal(hookDecision(f.path, min(0)), null);
  f.run(["start", "pr-review", "--force"]);
  f.run(["add", "1"]);
  assert.equal(hookDecision(f.path, min(13 * 60)), null);
});

test("a second start inside a live run is refused (a subagent must not reset it)", () => {
  const f = fixture();
  f.run(["start", "pr-review"]);
  assert.throws(() => f.run(["start", "pr-review"], 5));
});

test("clock reports the cutoff and the end", () => {
  const f = fixture();
  f.run(["start", "pr-review"]);
  f.run(["clock"], 10);
  assert.match(f.out(), /new work may start for 60 more min/);
  f.run(["clock"], 75);
  assert.match(f.out(), /Start nothing new/);
  f.run(["clock"], 95);
  assert.match(f.out(), /end the run now/);
});

test("the budget comes from the run's start, and defaults to the config defaults", () => {
  const f = fixture();
  main(["start", "pr-review"], { now: min(0), env: { HARNESS_RUN_LEDGER: f.path }, stdout: { write() {} }, budget: { newWorkMinutes: 10, endMinutes: 20 } });
  f.run(["add", "1"]);
  f.run(["set", "1", "budget", "cutoff reached"], 11);
  assert.equal(hookDecision(f.path, min(12)), null);
  const l = f.read();
  delete l.budget;
  writeFileSync(f.path, JSON.stringify(l));
  assert.equal(unaccounted(f.read()).length, 1, "without a stored budget the 45-minute default applies");
});
