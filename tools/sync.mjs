#!/usr/bin/env node
// `harness sync`: install or upgrade ai-harness in a project. Run it from a
// checkout of ai-harness at the version you want (a release tag):
//
//   git clone --depth 1 --branch v1.0.0 https://github.com/Serrated3150/ai-harness /tmp/ai-harness
//   node /tmp/ai-harness/tools/sync.mjs --target . --init     # first time: also seeds project-owned files
//   node /tmp/ai-harness/tools/sync.mjs --target .            # upgrade: harness-owned files only
//
// What it writes (docs/BOUNDARIES.md):
//   HARNESS-OWNED, replaced on every sync, listed with sha256 in .harness/kit/manifest.json:
//     kit/**             → .harness/kit/**
//     claude/skills/**   → .claude/skills/**      (every skill is named harness-*)
//     claude/agents/**   → .claude/agents/**      (every agent is named harness-*)
//     workflows/*.yml    → .github/workflows/*    (every workflow is named harness-*)
//   MERGED: .claude/settings.json gets the harness hook entries; every other key
//     and every project hook is kept.
//   PROJECT-OWNED, written only with --init and only if absent, never touched again:
//     templates/project/** → the project root (.harness/config.json, PROJECT.md,
//     routines/, lessons/, review-checklist.md).
//
// Files the previous manifest listed but this version no longer ships are
// removed. Nothing else in the project is touched. Commit the result with
// `HARNESS_SYNC=1 git commit …` — the harness hook only lets harness-owned
// files change in a commit that carries that marker.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const KIT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST = ".harness/kit/manifest.json";
export const HOOK = ".harness/kit/hooks/harness-hook.mjs";

// Source dir in ai-harness → destination dir in the project.
export const OWNED = [
  ["kit", ".harness/kit"],
  ["claude/skills", ".claude/skills"],
  ["claude/agents", ".claude/agents"],
  ["workflows", ".github/workflows"],
];
const SKIP = (p) => /\.test\.mjs$/.test(p) || /(^|\/)node_modules\//.test(p);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function kitVersion(kitRoot = KIT_ROOT) {
  const v = readFileSync(join(kitRoot, "kit/VERSION"), "utf8").trim();
  let sha = null;
  try {
    sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: kitRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {}
  return { version: `v${v}`, commit: sha };
}

/** Harness hook entries for .claude/settings.json. */
export function hookEntries() {
  const cmd = (ev) => ({ type: "command", command: `node "$CLAUDE_PROJECT_DIR/${HOOK}" ${ev}`, timeout: ev === "post-edit" ? 90 : ev === "pre-bash" ? 30 : 15 });
  return {
    SessionStart: [{ hooks: [cmd("session")] }],
    PreToolUse: [
      { matcher: "Edit|Write|MultiEdit|NotebookEdit", hooks: [cmd("pre-edit")] },
      { matcher: "Bash", hooks: [cmd("pre-bash")] },
    ],
    PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [cmd("post-edit")] }],
    Stop: [{ hooks: [cmd("stop")] }],
  };
}

/** Merge harness hooks into a settings object, replacing earlier harness entries and keeping everything else. */
export function mergeSettings(settings = {}) {
  const out = structuredClone(settings);
  out.hooks ??= {};
  const isHarness = (h) => String(h.command ?? "").includes(HOOK);
  for (const ev of Object.keys(out.hooks)) {
    out.hooks[ev] = out.hooks[ev].map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isHarness(h)) })).filter((g) => g.hooks.length);
    if (!out.hooks[ev].length) delete out.hooks[ev];
  }
  for (const [ev, groups] of Object.entries(hookEntries())) out.hooks[ev] = [...(out.hooks[ev] ?? []), ...groups];
  return out;
}

export function sync({ target, init = false, kitRoot = KIT_ROOT, log = console.log }) {
  const { version, commit } = kitVersion(kitRoot);
  const prev = existsSync(join(target, MANIFEST)) ? JSON.parse(readFileSync(join(target, MANIFEST), "utf8")) : { files: {} };
  const files = {};
  for (const [src, dst] of OWNED) {
    for (const abs of walk(join(kitRoot, src))) {
      const r = relative(join(kitRoot, src), abs).split("\\").join("/");
      if (SKIP(r)) continue;
      const out = `${dst}/${r}`;
      mkdirSync(dirname(join(target, out)), { recursive: true });
      const buf = readFileSync(abs);
      writeFileSync(join(target, out), buf);
      files[out] = sha256(buf);
    }
  }
  const removed = Object.keys(prev.files ?? {}).filter((p) => !(p in files) && p !== MANIFEST);
  for (const p of removed) rmSync(join(target, p), { force: true });
  writeFileSync(join(target, MANIFEST), JSON.stringify({ version, commit, synced: new Date().toISOString().slice(0, 10), files }, null, 2) + "\n");

  const settingsPath = join(target, ".claude/settings.json");
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(mergeSettings(settings), null, 2) + "\n");

  const seeded = [];
  if (init) {
    for (const abs of walk(join(kitRoot, "templates/project"))) {
      const r = relative(join(kitRoot, "templates/project"), abs).split("\\").join("/");
      if (existsSync(join(target, r))) continue;
      mkdirSync(dirname(join(target, r)), { recursive: true });
      cpSync(abs, join(target, r));
      seeded.push(r);
    }
  }
  log(`ai-harness ${version}${commit ? ` (${commit})` : ""}: ${Object.keys(files).length} harness-owned files written, ${removed.length} removed${init ? `, ${seeded.length} project files seeded` : ""}.`);
  return { version, files, removed, seeded };
}

function main(argv) {
  const arg = (k) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : null);
  const target = arg("--target");
  if (!target) {
    console.error("usage: sync.mjs --target <project dir> [--init]");
    return 1;
  }
  sync({ target, init: argv.includes("--init") });
  console.log(
    "Next:\n" +
      "  1. Review the diff; harness-owned files are listed in .harness/kit/manifest.json.\n" +
      "  2. Commit with:  HARNESS_SYNC=1 git commit -m \"chore(harness): sync ai-harness <version>\"\n" +
      "  3. First install only: fill in .harness/config.json and .harness/PROJECT.md, then create the\n" +
      "     scheduled routines from .harness/kit/routines/LOADER.md (docs/ADOPTING.md).",
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv.slice(2));
