#!/usr/bin/env node
// Verify that every harness-owned file in this project is exactly what the
// pinned ai-harness version shipped (.harness/kit/manifest.json: path → sha256).
// The `harness-check` workflow runs this on every PR; a mismatch fails the
// check with a pointer to the extension points. Harness files change only
// through `harness sync`.
//
//   node .harness/kit/scripts/verify.mjs                  # exit 1 on any drift
//   node .harness/kit/scripts/verify.mjs --kit <checkout> # also: the manifest is what that ai-harness commit ships

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST = ".harness/kit/manifest.json";
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// Where each harness-owned path comes from in an ai-harness checkout.
export const SOURCES = [
  [".harness/kit/", "kit/"],
  [".claude/skills/", "claude/skills/"],
  [".claude/agents/", "claude/agents/"],
  [".github/workflows/", "workflows/"],
];
export function sourceOf(path) {
  const s = SOURCES.find(([dst]) => path.startsWith(dst));
  return s ? s[1] + path.slice(s[0].length) : null;
}

/** Compare a manifest with an ai-harness checkout: every listed file must be what the kit ships, byte for byte. */
export function checkAgainstKit(kitDir, manifest) {
  const wrong = [];
  for (const [path, hash] of Object.entries(manifest.files ?? {})) {
    const src = sourceOf(path);
    const abs = src && join(kitDir, src);
    if (!abs || !existsSync(abs) || sha256(readFileSync(abs)) !== hash) wrong.push(path);
  }
  return wrong;
}

/** Compare files under `root` with a manifest object; returns { missing, changed }. */
export function check(root, manifest) {
  const missing = [];
  const changed = [];
  for (const [path, hash] of Object.entries(manifest.files ?? {})) {
    const abs = join(root, path);
    if (!existsSync(abs)) missing.push(path);
    else if (sha256(readFileSync(abs)) !== hash) changed.push(path);
  }
  return { missing, changed };
}

function main(argv) {
  const root = process.cwd();
  const kitAt = argv.indexOf("--kit");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));
  } catch (e) {
    console.error(`verify: cannot read ${MANIFEST} (${e.message}). Run \`harness sync\` to install the harness.`);
    return 1;
  }
  if (kitAt >= 0) {
    const wrong = checkAgainstKit(argv[kitAt + 1], manifest);
    if (wrong.length) {
      for (const p of wrong) console.log(`NOT IN KIT  ${p}`);
      console.log(`\nverify: the manifest lists files that ai-harness ${manifest.version} (${manifest.commit}) does not ship as recorded. Harness files change only through \`harness sync\`.`);
      return 1;
    }
    console.log(`verify: manifest matches ai-harness ${manifest.version} (${manifest.commit}).`);
  }
  const { missing, changed } = check(root, manifest);
  const n = Object.keys(manifest.files ?? {}).length;
  if (!missing.length && !changed.length) {
    console.log(`verify: ${n} harness-owned files match ai-harness ${manifest.version}.`);
    return 0;
  }
  for (const p of changed) console.log(`CHANGED  ${p}`);
  for (const p of missing) console.log(`MISSING  ${p}`);
  console.log(
    `\nverify: harness-owned files differ from ai-harness ${manifest.version}. Projects never edit them.\n` +
      "  - To customise behaviour, revert these edits and use an extension point: .harness/config.json,\n" +
      "    .harness/PROJECT.md, .harness/routines/<slug>.md, or your own (non-harness-*) skills, agents and hooks.\n" +
      "  - If the harness itself is wrong, open an issue at https://github.com/Serrated3150/ai-harness/issues.\n" +
      "  - To upgrade, run `harness sync` (docs/VERSIONING.md).",
  );
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv.slice(2));
