#!/usr/bin/env node
// Keep the vendored workflows' action pins in step with the pin source.
//
//   node tools/pins.mjs --check   # CI: fail if workflows/*.yml differ from the source
//   node tools/pins.mjs --write   # copy the source's pins into workflows/*.yml
//
// The pin source is .github/workflows/action-pins.yml, which Dependabot keeps
// current (it does not scan workflows/). Every `uses:` in a vendored workflow
// must be pinned to a full commit SHA with its release as a trailing comment,
// and every action it uses must be listed in the source.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = ".github/workflows/action-pins.yml";
export const VENDORED = "workflows";

const USES = /^(\s*(?:-\s+)?uses:\s+)([\w.-]+\/[\w.\/-]+)@(\S+)(?:\s+#\s*(\S+))?\s*$/;

/** Every `uses:` line in a workflow: { line, action, ref, version }. */
export function parseUses(text) {
  return text.split("\n").flatMap((l, i) => {
    const m = USES.exec(l);
    return m ? [{ line: i, prefix: m[1], action: m[2], ref: m[3], version: m[4] ?? null }] : [];
  });
}

/** Problems in one vendored workflow against the source pins, and its rewritten text. */
export function checkWorkflow(name, text, pins) {
  const problems = [];
  const lines = text.split("\n");
  for (const u of parseUses(text)) {
    const want = pins.get(u.action);
    if (!want) {
      problems.push(`${name}:${u.line + 1}: ${u.action} is not listed in ${SOURCE}`);
      continue;
    }
    if (!/^[0-9a-f]{40}$/.test(u.ref) || !u.version)
      problems.push(`${name}:${u.line + 1}: ${u.action} must be pinned as @<40-hex sha> # <version>`);
    if (u.ref !== want.ref || u.version !== want.version) {
      problems.push(`${name}:${u.line + 1}: ${u.action}@${u.ref.slice(0, 7)} ${u.version ?? ""} differs from ${SOURCE} (${want.ref.slice(0, 7)} ${want.version})`);
      lines[u.line] = `${u.prefix}${u.action}@${want.ref} # ${want.version}`;
    }
  }
  return { problems, text: lines.join("\n") };
}

export function sourcePins(text) {
  const pins = new Map();
  for (const u of parseUses(text)) pins.set(u.action, { ref: u.ref, version: u.version });
  return pins;
}

export function run({ root = ROOT, write = false } = {}) {
  const pins = sourcePins(readFileSync(join(root, SOURCE), "utf8"));
  const problems = [];
  for (const f of readdirSync(join(root, VENDORED)).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const path = join(root, VENDORED, f);
    const before = readFileSync(path, "utf8");
    const r = checkWorkflow(`${VENDORED}/${f}`, before, pins);
    problems.push(...r.problems);
    if (write && r.text !== before) writeFileSync(path, r.text);
  }
  return problems;
}

function main(argv) {
  const write = argv.includes("--write");
  if (!write && !argv.includes("--check")) {
    console.error("usage: pins.mjs --check | --write");
    return 2;
  }
  const problems = run({ write });
  if (write) {
    const left = run({ write: false });
    for (const p of left) console.error(p);
    console.log(left.length ? `pins: ${left.length} problem(s) need a manual fix` : "pins: vendored workflows match the pin source");
    return left.length ? 1 : 0;
  }
  for (const p of problems) console.error(p);
  if (problems.length) {
    console.error(`pins: run \`node tools/pins.mjs --write\` to copy the pins from ${SOURCE}, then bump kit/VERSION (PATCH) and add a CHANGELOG entry.`);
    return 1;
  }
  console.log("pins: vendored workflows match the pin source");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv.slice(2));
