// Load and validate a project's `.harness/config.json`, the one file through
// which a project configures the harness (docs/CONFIG.md). Every harness script
// reads it through `loadConfig()`, so defaults live in exactly one place.
//
// The config is project-owned: the harness never writes it after `init`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_PATH = ".harness/config.json";

export const DEFAULTS = {
  harness: { version: null },
  project: { name: null, repo: null, defaultBranch: "main" },
  // Marker comments are `<!-- <prefix>-routine:<token> -->` (contract §3).
  markerPrefix: "harness",
  contract: {
    // The project's own contract overlay (project-owned). The harness contract
    // is always .harness/kit/contract/ROUTINES.md.
    overlay: ".harness/PROJECT.md",
    // Section profiles per routine for `sections.mjs --profile`, read from the
    // file named by `file` (default: the harness contract).
    file: ".harness/kit/contract/ROUTINES.md",
    profiles: {},
  },
  routines: {
    // Project-owned: overlays, lessons and the roster table.
    overlays: ".harness/routines",
    lessons: ".harness/lessons",
    readme: ".harness/routines/README.md",
  },
  protect: {
    // Files that are immutable once they exist on the default branch.
    immutableOnMain: [],
    // Files only bot branches may change: [{ paths: [glob], branches: [regex] }].
    botBranchOnly: [],
    // Files that must never gain a new entry heading; new entries go in fragments.
    appendViaFragments: [],
    noPushTo: ["main", "master"],
    largeWriteLines: 200,
    guttedMinDeleted: 100,
  },
  // Post-edit linters: [{ glob, cwd?, command: [argv...] with "{file}", requires? }].
  // `builtin: "relative-links"` checks Markdown relative links with no tool.
  lint: [{ glob: "**/*.md", builtin: "relative-links" }],
  // Local gates: { area: { paths: [glob], steps: [{ name, cwd?, run, requires? }] } }.
  gates: {},
  changelog: { fragmentsDir: null, exemptBranches: [] },
  review: {
    checklist: ".harness/review-checklist.md",
    lessonsOnlyPaths: [],
    lessonsOnlyTurns: 25,
    defaultTurns: 60,
  },
};

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge plain objects; arrays and scalars from `over` replace `base`. */
export function merge(base, over) {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
  return out;
}

/** Drop "$comment"-style keys (any key starting with "$") at every level. */
export function stripComments(v) {
  if (Array.isArray(v)) return v.map(stripComments);
  if (!isObject(v)) return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("$")).map(([k, x]) => [k, stripComments(x)]));
}

/** Validation errors for a raw config object (empty array = valid). */
export function validate(raw) {
  const errors = [];
  if (!isObject(raw)) return ["config must be a JSON object"];
  if (raw.markerPrefix !== undefined && !/^[a-z][a-z0-9]{1,15}$/.test(raw.markerPrefix))
    errors.push("markerPrefix must be 2-16 lowercase letters/digits, starting with a letter");
  for (const [area, g] of Object.entries(raw.gates ?? {})) {
    if (!Array.isArray(g.paths)) errors.push(`gates.${area}.paths must be an array of globs`);
    if (!Array.isArray(g.steps)) errors.push(`gates.${area}.steps must be an array`);
    for (const s of g.steps ?? []) if (!s.name || !s.run) errors.push(`gates.${area}: every step needs name and run`);
  }
  for (const l of raw.lint ?? []) {
    if (!l.glob) errors.push("lint: every entry needs a glob");
    if (!l.builtin && !Array.isArray(l.command)) errors.push(`lint ${l.glob}: needs command (argv array) or builtin`);
  }
  for (const b of raw.protect?.botBranchOnly ?? [])
    if (!Array.isArray(b.paths) || !Array.isArray(b.branches)) errors.push("protect.botBranchOnly entries need paths and branches arrays");
  for (const a of raw.protect?.appendViaFragments ?? [])
    if (!a.file || !a.fragments) errors.push("protect.appendViaFragments entries need file and fragments");
  return errors;
}

/** Read `.harness/config.json` under `root`, merged over defaults. Missing file → defaults. */
export function loadConfig(root = process.cwd(), { strict = false } = {}) {
  const path = join(root, CONFIG_PATH);
  if (!existsSync(path)) {
    if (strict) throw new Error(`${CONFIG_PATH} not found under ${root}`);
    return structuredClone(DEFAULTS);
  }
  let raw;
  try {
    raw = stripComments(JSON.parse(readFileSync(path, "utf8")));
  } catch (e) {
    throw new Error(`${CONFIG_PATH}: invalid JSON (${e.message})`);
  }
  const errors = validate(raw);
  if (errors.length) throw new Error(`${CONFIG_PATH}:\n  - ${errors.join("\n  - ")}`);
  return merge(structuredClone(DEFAULTS), raw);
}
