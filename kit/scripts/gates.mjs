#!/usr/bin/env node
// Run the project's local quality gates for the areas a branch touches and
// print ONLY what failed (harness contract §implementation). A passing gate
// costs one line of output; a failing one shows its last 60 lines.
//
//   node .harness/kit/scripts/gates.mjs            # areas changed vs origin/<default branch>
//   node .harness/kit/scripts/gates.mjs web docs   # named areas
//   node .harness/kit/scripts/gates.mjs all
//
// Areas and steps come from .harness/config.json `gates` (project-owned):
//   "gates": { "web": { "paths": ["web/**"], "steps": [
//       { "name": "typecheck", "cwd": "web", "run": "npm run --silent typecheck" },
//       { "name": "db tests", "run": "make test-db", "requires": "docker", "skip": "CI is authoritative" } ] } }
// A step whose `requires` (a command on PATH, or a path) is missing is reported
// SKIPPED with its `skip` reason — never counted as a pass. Exit status is the
// number of failed gates.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { matchesAny } from "./lib/glob.mjs";

export function changedAreas(files, gates) {
  return Object.entries(gates)
    .filter(([, g]) => files.some((f) => matchesAny(f, g.paths)))
    .map(([name]) => name);
}

function onPath(bin) {
  return (process.env.PATH ?? "").split(delimiter).some((d) => d && existsSync(join(d, bin)));
}

export function available(requires, root) {
  if (!requires) return true;
  return requires.includes("/") ? existsSync(join(root, requires)) : onPath(requires);
}

function changedFiles(root, base) {
  const out = (args) => {
    try {
      return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return "";
    }
  };
  return [...new Set([...out(["diff", "--name-only", `${base}...HEAD`]).split("\n"), ...out(["status", "--porcelain"]).split("\n").map((l) => l.slice(3))].map((s) => s.trim()).filter(Boolean))];
}

function main(argv) {
  const root = process.cwd();
  let cfg;
  try {
    cfg = loadConfig(root);
  } catch (e) {
    console.error(`gates: ${e.message}`);
    return 1;
  }
  const gates = cfg.gates;
  if (!Object.keys(gates).length) {
    console.log("gates: no gates configured in .harness/config.json — nothing to run.");
    return 0;
  }
  let areas = argv.length ? argv : changedAreas(changedFiles(root, `origin/${cfg.project.defaultBranch}`), gates);
  if (areas.includes("all")) areas = Object.keys(gates);
  const unknown = areas.filter((a) => !gates[a]);
  if (unknown.length) {
    console.error(`gates: unknown area ${unknown.join(", ")} (known: ${Object.keys(gates).join(", ")}, all)`);
    return 64;
  }
  if (!areas.length) {
    console.log("gates: nothing changed in any configured area.");
    return 0;
  }
  const summary = [];
  let failed = 0;
  for (const area of areas) {
    for (const step of gates[area].steps) {
      const label = `${area}: ${step.name}`;
      if (!available(step.requires, root)) {
        summary.push(`SKIPPED  ${label} — ${step.skip ?? `${step.requires} not available`}`);
        continue;
      }
      const r = spawnSync(step.run, { cwd: join(root, step.cwd ?? "."), shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      if (r.status === 0) summary.push(`PASS     ${label}`);
      else {
        failed++;
        summary.push(`FAIL     ${label}`);
        const log = `${r.stdout ?? ""}${r.stderr ?? ""}`.trimEnd().split("\n");
        console.log(`──── ${label} failed (last 60 lines) ────\n${log.slice(-60).join("\n")}`);
      }
    }
  }
  console.log(`──── gates: ${summary.length} run, ${failed} failed ────\n${summary.join("\n")}`);
  return failed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv.slice(2));
