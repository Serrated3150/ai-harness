#!/usr/bin/env node
// Compile the lessons a routine loads at the start of a run into one digest
// (harness contract §learning).
//
//   node .harness/kit/scripts/lessons.mjs <slug>                  # working tree
//   node .harness/kit/scripts/lessons.mjs <slug> --ref origin/main
//
// Paths come from .harness/config.json (`routines.lessons`, `routines.readme`).
// The digest holds, in this order:
//   1. the routine's OWN lessons file (<lessons>/<slug>.md), in full;
//   2. <lessons>/shared.md, in full;
//   3. for every routine in its *Learns from* column of the routines README,
//      each merged lesson's title, **Rule** and **Applies to** only. A lesson
//      whose **Applies to:** names other routines (not this one, nor `all`) is
//      left out of every digest but its own.
//
// Pending lessons (a routine's own open learning PR) are NOT included: the
// routine loads those itself, with the provenance checks in §learning.
// The script reads files only; it never reads issue or PR text.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";


export function read(path, ref) {
  if (!ref) return readFileSync(path, "utf8");
  return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

/** Map slug → [slugs it learns from], from the README table. */
export function parseLearnsFrom(readme) {
  const map = {};
  for (const line of readme.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;
    const lessons = cells[5].match(/\[`([a-z0-9-]+)\.md`\]/);
    if (!lessons) continue;
    map[lessons[1]] = cells[6]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9-]+$/.test(s));
  }
  return map;
}

/** Split a lessons file into { id, title, text, fields } entries. */
export function parseLessons(md) {
  const at = md.search(/^## Lessons\s*$/m);
  if (at < 0) return [];
  const body = md.slice(at).replace(/^## Lessons\s*$/m, "");
  const end = body.search(/^## /m);
  const section = end < 0 ? body : body.slice(0, end);
  const parts = section.split(/^(?=### L-)/m).filter((p) => p.startsWith("### L-"));
  return parts.map((text) => {
    const head = text.split("\n")[0];
    const id = (head.match(/^### (L-[a-z0-9-]+-\d+)/) || [])[1] ?? null;
    const fields = {};
    const re = /^- \*\*([A-Za-z ]+):\*\*\s*([\s\S]*?)(?=^- \*\*[A-Za-z ]+:\*\*|(?![\s\S]))/gm;
    let m;
    while ((m = re.exec(text))) fields[m[1].trim().toLowerCase()] = m[2].trim();
    return { id, title: head.replace(/^### /, "").trim(), text: text.trim(), fields };
  });
}

/** Does a lesson apply to `slug` when read from another routine's file? */
export function appliesTo(lesson, slug) {
  const raw = lesson.fields["applies to"];
  if (!raw) return true;
  const names = raw.split(/[,\s]+/).map((s) => s.replace(/[`.]/g, "").trim()).filter(Boolean);
  return names.includes("all") || names.includes(slug);
}

export function digest(slug, readFile, { dir = ".harness/lessons", readme: readmePath = ".harness/routines/README.md" } = {}) {
  const DIR = dir;
  const readme = readFile(readmePath);
  const graph = parseLearnsFrom(readme);
  if (!graph[slug]) throw new Error(`unknown routine "${slug}"; known: ${Object.keys(graph).join(", ")}`);
  const out = [`<!-- lessons digest for ${slug} (harness contract §learning) -->`, ""];

  const own = parseLessons(readFile(`${DIR}/${slug}.md`));
  out.push(`## Own lessons — ${DIR}/${slug}.md (${own.length})`, "");
  out.push(own.length ? own.map((l) => l.text).join("\n\n") : "_None._", "");

  const shared = parseLessons(readFile(`${DIR}/shared.md`));
  out.push(`## Shared lessons — ${DIR}/shared.md (${shared.length})`, "");
  out.push(shared.length ? shared.map((l) => l.text).join("\n\n") : "_None._", "");

  for (const other of graph[slug]) {
    let lessons;
    try {
      lessons = parseLessons(readFile(`${DIR}/${other}.md`));
    } catch {
      out.push(`## From ${other} — ${DIR}/${other}.md could not be read`, "");
      continue;
    }
    const kept = lessons.filter((l) => appliesTo(l, slug));
    out.push(`## From ${other} (${kept.length} of ${lessons.length}; rules only — full entry in ${DIR}/${other}.md)`, "");
    if (!kept.length) out.push("_None._", "");
    for (const l of kept) {
      out.push(`### ${l.title}`, "");
      out.push(`- **Rule:** ${l.fields.rule ?? "(no Rule field — read the full entry)"}`);
      if (l.fields["applies to"]) out.push(`- **Applies to:** ${l.fields["applies to"]}`);
      out.push("");
    }
  }
  return out.join("\n").trimEnd() + "\n";
}

function main(argv) {
  const slug = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--ref");
  const refAt = argv.indexOf("--ref");
  const ref = refAt >= 0 ? argv[refAt + 1] : null;
  if (!slug) {
    console.error("usage: lessons.mjs <slug> [--ref origin/main]");
    return 1;
  }
  try {
    const cfg = loadConfig();
    process.stdout.write(digest(slug, (p) => read(p, ref), { dir: cfg.routines.lessons, readme: cfg.routines.readme }));
    return 0;
  } catch (e) {
    console.error(`lessons.mjs: ${e.message}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2));
}
