#!/usr/bin/env node
// Print only the sections of a Markdown doc that a reader needs, instead of the
// whole file. Built for routine contracts, which run to 100+ KB and used to be
// read in full at the start of every routine run (harness contract §learning,
// "Loading by section").
//
//   node .harness/kit/scripts/sections.mjs --toc                    # headings + sizes
//   node .harness/kit/scripts/sections.mjs §2 §3.1 §snapshot        # by number or anchor
//   node .harness/kit/scripts/sections.mjs "Quality gates"          # by heading text
//   node .harness/kit/scripts/sections.mjs --profile plan-review    # a routine's set
//   node .harness/kit/scripts/sections.mjs --file docs/X.md --toc   # any other doc
//   node .harness/kit/scripts/sections.mjs --ref origin/main §2     # from a git ref
//
// `§N` matches the `## N. …` heading and `§N.M` the `### N.M …` one. Anything
// else (including anchors such as `§snapshot`) is matched, case-insensitively,
// against heading text. A section runs to the next heading of the same or a
// higher level; headings in fenced code are not headings. Every selector must
// match, or the script exits 1.
//
// Default file and extra profiles come from .harness/config.json (`contract`).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";

export const DEFAULT_FILE = ".harness/kit/contract/ROUTINES.md";

// Section profiles for the HARNESS contract (.harness/kit/contract/ROUTINES.md):
// what each base routine loads at the start of a run. A project adds profiles
// for its own docs, or extends these, in .harness/config.json
// (`contract.profiles`); a project profile with the same name replaces this one.
export const CORE = ["§hard-limits", "§markers", "§status-labels", "§type-labels", "§order", "§snapshot", "§learning"];
export const PROFILES = {
  core: CORE,
  "issue-intake": [...CORE, "§claims", "§picking-work", "§triage", "§plan-gate", "§implementation", "§templates", "§run-summary"],
  "plan-review": [...CORE, "§picking-work", "§triage", "§plan-gate", "§templates", "§run-summary"],
  "pr-follow-through": [...CORE, "§claims", "§implementation", "§templates", "§follow-through", "§run-summary"],
  "pr-review": [...CORE, "§plan-gate", "§implementation", "§templates", "§run-summary"],
  "issue-tracker": [...CORE, "§run-summary"],
  "test-coverage": [...CORE, "§implementation", "§run-summary"],
  "daily-full-suite": [...CORE, "§run-summary"],
  "weekly-test-strategy": [...CORE, "§run-summary"],
  "weekly-security-audit": [...CORE, "§run-summary"],
};

/** Parse headings, skipping fenced code blocks. */
export function parseHeadings(text) {
  const lines = text.split("\n");
  const heads = [];
  let fence = null;
  lines.forEach((line, i) => {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) return;
    const title = m[2].trim();
    const num = title.match(/^(\d+(?:\.\d+)*[a-z]?)\.?\s/);
    heads.push({ line: i, level: m[1].length, title, num: num ? num[1] : null });
  });
  // Each section ends where the next heading of the same or higher level starts.
  heads.forEach((h, idx) => {
    const next = heads.slice(idx + 1).find((n) => n.level <= h.level);
    h.end = next ? next.line : lines.length;
  });
  return { lines, heads };
}

/** Find the heading a selector names, or null. */
export function findHeading(heads, selector) {
  const sel = selector.trim();
  const num = sel.match(/^§?(\d+(?:\.\d+)*[a-z]?)$/);
  if (num) return heads.find((h) => h.num === num[1]) ?? null;
  const needle = sel.toLowerCase();
  return heads.find((h) => h.title.toLowerCase().includes(needle)) ?? null;
}

/**
 * Return the text of the selected sections, in document order, with nested
 * selections (e.g. §6 and §6.5) collapsed into their parent.
 */
export function extract(text, selectors) {
  const { lines, heads } = parseHeadings(text);
  const missing = [];
  const ranges = [];
  for (const s of selectors) {
    const h = findHeading(heads, s);
    if (!h) missing.push(s);
    else ranges.push([h.line, h.end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const body = merged.map(([a, b]) => lines.slice(a, b).join("\n").trimEnd()).join("\n\n");
  return { body, missing };
}

/** One line per heading: indent, title, size in bytes. */
export function toc(text) {
  const { lines, heads } = parseHeadings(text);
  return heads
    .map((h) => {
      const bytes = lines.slice(h.line, h.end).join("\n").length;
      return `${"  ".repeat(Math.max(0, h.level - 2))}${h.title}  (${(bytes / 1024).toFixed(1)} KB, line ${h.line + 1})`;
    })
    .join("\n");
}

export function readDoc(file, ref) {
  if (!ref) return readFileSync(file, "utf8");
  return execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main(argv) {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(`sections.mjs: ${e.message}`);
    return 1;
  }
  const profiles = { ...PROFILES, ...cfg.contract.profiles };
  let file = cfg.contract.file || DEFAULT_FILE;
  let ref = null;
  let showToc = false;
  const selectors = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") file = argv[++i];
    else if (a === "--ref") ref = argv[++i];
    else if (a === "--toc") showToc = true;
    else if (a === "--profile") {
      const p = argv[++i];
      if (!profiles[p]) {
        console.error(`unknown profile "${p}"; known: ${Object.keys(profiles).join(", ")}`);
        return 1;
      }
      selectors.push(...profiles[p]);
    } else if (a === "-h" || a === "--help") {
      console.log("usage: sections.mjs [--file F] [--ref R] (--toc | --profile P | SELECTOR...)");
      return 0;
    } else selectors.push(a);
  }
  const text = readDoc(file, ref);
  if (showToc) {
    console.log(toc(text));
    return 0;
  }
  if (!selectors.length) {
    console.error("nothing selected: pass --toc, --profile <name> or one or more selectors");
    return 1;
  }
  const { body, missing } = extract(text, selectors);
  console.log(`<!-- ${file}${ref ? ` @ ${ref}` : ""}: ${selectors.join(" ")} -->\n`);
  console.log(body);
  if (missing.length) {
    console.error(`\nsections.mjs: no heading matched ${missing.join(", ")} in ${file}`);
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2));
}
