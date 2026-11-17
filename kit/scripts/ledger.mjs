#!/usr/bin/env node
// Run ledger for scheduled routines (harness-owned; contract §ledger).
// Enabled per project by `routines.ledger: true` in .harness/config.json.
//
// A run lists everything in its scope at the start (every PR, issue or plan it
// is responsible for this run) and records an outcome for each as it goes. The
// harness stop hook calls `hookDecision` and refuses to let the run end while
// any item has no outcome, so a run cannot quietly stop part-way and
// summarise. The ledger also owns the run clock (`routines.budget`), so "the
// budget ran out" is measured, not guessed.
//
//   node .harness/kit/scripts/ledger.mjs start <routine>     begin the run (records the start time)
//   node .harness/kit/scripts/ledger.mjs add <ref>... [--note <text>]
//   node .harness/kit/scripts/ledger.mjs none <reason>       nothing is in scope this run
//   node .harness/kit/scripts/ledger.mjs set <ref> <status> [reason]
//   node .harness/kit/scripts/ledger.mjs clock               elapsed time and what may still start
//   node .harness/kit/scripts/ledger.mjs check               exit 1 and list what is unaccounted for
//   node .harness/kit/scripts/ledger.mjs show                print the ledger as a table
//
// Statuses: todo and working are open. done closes an item. budget, ci-cap,
// blocked, waiting, skipped and error close it too but need a reason, and
// budget is accepted only once routines.budget.newWorkMinutes has passed.
//
// The ledger lives in the repository's git common dir, so every worktree of
// the checkout sees the same file and it is never committed. Only the run's
// main agent writes it; subagents report back and the main agent records.
// HARNESS_RUN_LEDGER overrides the path (tests).
//
// The hook side fails open: no ledger (an interactive session), an unreadable
// one or any error lets the session end, and it blocks at most MAX_BLOCKS
// times per run, so it can never wedge a session.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULTS, loadConfig } from "./lib/config.mjs";

export const MAX_BLOCKS = 3;
export const STALE_HOURS = 12; // a ledger older than this belongs to another run

export const OPEN = new Set(["todo", "working"]);
export const CLOSED_WITH_REASON = new Set(["budget", "ci-cap", "blocked", "waiting", "skipped", "error"]);
export const STATUSES = new Set([...OPEN, "done", ...CLOSED_WITH_REASON]);

export function ledgerPath(cwd = process.cwd(), env = process.env) {
  if (env.HARNESS_RUN_LEDGER) return resolve(env.HARNESS_RUN_LEDGER);
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  return join(resolve(cwd, common), "harness-run-ledger.json");
}

export function load(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function save(path, ledger) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + "\n");
  renameSync(tmp, path);
}

export function minutesSince(iso, now = Date.now()) {
  return (now - Date.parse(iso)) / 60000;
}

export function normaliseRef(ref) {
  const r = String(ref).trim();
  return /^\d+$/.test(r) ? `#${r}` : r;
}

function budgetOf(ledger) {
  return { ...DEFAULTS.routines.budget, ...(ledger.budget ?? {}) };
}

// Items with no acceptable outcome yet, each with why.
export function unaccounted(ledger) {
  const NEW_WORK_MIN = budgetOf(ledger).newWorkMinutes;
  const out = [];
  if (!ledger.listed) out.push({ ref: "(scope)", why: "no scope listed: run `add <ref>...` or `none <reason>`" });
  for (const item of ledger.items) {
    if (OPEN.has(item.status)) {
      out.push({ ref: item.ref, why: `still ${item.status}` });
    } else if (item.status === "budget" && minutesSince(ledger.startedAt, Date.parse(item.at)) < NEW_WORK_MIN) {
      out.push({
        ref: item.ref,
        why: `marked budget at ${Math.floor(minutesSince(ledger.startedAt, Date.parse(item.at)))} min, before the ${NEW_WORK_MIN}-minute cutoff`,
      });
    }
  }
  return out;
}

export function clockLine(ledger, now = Date.now()) {
  const { newWorkMinutes: NEW_WORK_MIN, endMinutes: END_MIN } = budgetOf(ledger);
  const m = Math.floor(minutesSince(ledger.startedAt, now));
  if (m >= END_MIN) return `elapsed ${m} min: past the ${END_MIN}-minute end. Record outcomes and end the run now.`;
  if (m >= NEW_WORK_MIN)
    return `elapsed ${m} min: past the ${NEW_WORK_MIN}-minute cutoff. Start nothing new; finish what is in flight and end by ${END_MIN} min.`;
  return `elapsed ${m} min: new work may start for ${NEW_WORK_MIN - m} more min; the run ends by ${END_MIN} min.`;
}

export function table(ledger) {
  const rows = ledger.items.map((i) => `| ${i.ref} | ${i.status} | ${(i.reason || i.note || "").replace(/\|/g, "\\|")} |`);
  return [`Run ledger: ${ledger.routine}, started ${ledger.startedAt}`, "| item | outcome | reason |", "|---|---|---|", ...rows].join("\n");
}

export function blockReason(ledger, missing, now = Date.now()) {
  const list = missing.map((m) => `- ${m.ref}: ${m.why}`).join("\n");
  return [
    `This routine run still has items with no outcome (contract §ledger). ${clockLine(ledger, now)}`,
    list,
    "Keep working on them. If one cannot be finished this run, record why with",
    "`node .harness/kit/scripts/ledger.mjs set <ref> <budget|ci-cap|blocked|waiting|skipped|error> \"<reason>\"`.",
    "Running low on attention or context is not a reason: hand the item to a subagent instead (§parallel).",
  ].join("\n");
}

// The Stop hook. Returns the JSON to print, or null to allow the stop.
export function hookDecision(path, now = Date.now()) {
  let ledger;
  try {
    ledger = load(path);
  } catch {
    return null;
  }
  if (!ledger || !ledger.startedAt) return null;
  if (minutesSince(ledger.startedAt, now) > STALE_HOURS * 60) return null;
  const missing = unaccounted(ledger);
  if (missing.length === 0) return null;
  if ((ledger.stopBlocks || 0) >= MAX_BLOCKS) return null;
  ledger.stopBlocks = (ledger.stopBlocks || 0) + 1;
  try {
    save(path, ledger);
  } catch {
    return null;
  }
  return { decision: "block", reason: blockReason(ledger, missing, now) };
}

export class UsageError extends Error {}

function die(msg) {
  throw new UsageError(msg);
}

function configuredBudget(cwd) {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { ...loadConfig(root).routines.budget };
  } catch {
    return { ...DEFAULTS.routines.budget };
  }
}

export function main(argv, { now = Date.now(), cwd = process.cwd(), env = process.env, stdout = process.stdout, budget } = {}) {
  const [cmd, ...args] = argv;
  if (cmd === "hook") {
    try {
      const decision = hookDecision(ledgerPath(cwd, env), now);
      if (decision) stdout.write(JSON.stringify(decision));
    } catch {
      /* fail open */
    }
    return 0;
  }

  const path = ledgerPath(cwd, env);
  const at = new Date(now).toISOString();

  if (cmd === "start") {
    const routine = args[0] || die("usage: start <routine>");
    let existing = null;
    try {
      existing = load(path);
    } catch {
      /* an unreadable ledger is replaced */
    }
    if (existing && !args.includes("--force") && minutesSince(existing.startedAt, now) < STALE_HOURS * 60)
      die(`a ledger for ${existing.routine} started ${existing.startedAt} already exists; a subagent must not start one. Pass --force only from a new run.`);
    const b = budget ?? configuredBudget(cwd);
    save(path, { routine, startedAt: at, budget: b, listed: false, items: [], stopBlocks: 0 });
    stdout.write(`Run ledger started for ${routine} at ${at}. ${clockLine({ startedAt: at, budget: b }, now)}\n`);
    return 0;
  }

  const ledger = load(path);
  if (!ledger) die("no run ledger: run `start <routine>` first");

  switch (cmd) {
    case "add": {
      const noteAt = args.indexOf("--note");
      const refs = (noteAt === -1 ? args : args.slice(0, noteAt)).map(normaliseRef);
      const note = noteAt === -1 ? undefined : args.slice(noteAt + 1).join(" ");
      if (refs.length === 0) die("usage: add <ref>... [--note <text>]");
      for (const ref of refs) {
        if (!ledger.items.some((i) => i.ref === ref)) ledger.items.push({ ref, status: "todo", note, at });
      }
      ledger.listed = true;
      break;
    }
    case "none": {
      const reason = args.join(" ").trim() || die("usage: none <reason>");
      ledger.listed = true;
      ledger.noneReason = reason;
      break;
    }
    case "set": {
      const [rawRef, status, ...rest] = args;
      if (!rawRef || !status) die("usage: set <ref> <status> [reason]");
      if (!STATUSES.has(status)) die(`unknown status ${status}; use one of ${[...STATUSES].join(", ")}`);
      const reason = rest.join(" ").trim();
      if (CLOSED_WITH_REASON.has(status) && !reason) die(`status ${status} needs a reason`);
      if (status === "budget" && minutesSince(ledger.startedAt, now) < budgetOf(ledger).newWorkMinutes)
        die(`${clockLine(ledger, now)} The budget has not run out, so keep working on this item.`);
      const ref = normaliseRef(rawRef);
      let item = ledger.items.find((i) => i.ref === ref);
      if (!item) {
        item = { ref };
        ledger.items.push(item);
        ledger.listed = true;
      }
      Object.assign(item, { status, reason: reason || undefined, at });
      break;
    }
    case "clock":
      stdout.write(clockLine(ledger, now) + "\n");
      return 0;
    case "show":
      stdout.write(table(ledger) + "\n" + clockLine(ledger, now) + "\n");
      return 0;
    case "check": {
      const missing = unaccounted(ledger);
      if (missing.length === 0) {
        stdout.write(`All ${ledger.items.length} item(s) accounted for. ${clockLine(ledger, now)}\n`);
        return 0;
      }
      stdout.write(missing.map((m) => `${m.ref}: ${m.why}`).join("\n") + "\n");
      return 1;
    }
    default:
      die("usage: ledger.mjs start|add|none|set|clock|check|show|hook (see the file header)");
  }
  save(path, ledger);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(e.message + "\n");
    process.exitCode = 2;
  }
}
