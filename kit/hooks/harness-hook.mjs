#!/usr/bin/env node
// ai-harness Claude Code hooks (harness-owned; vendored to .harness/kit/hooks/).
// Wired in the project's .claude/settings.json by `harness sync`. Every rule
// comes from the project's .harness/config.json (docs/CONFIG.md), so a project
// extends behaviour by editing its config, never this file.
//
//   pre-edit   (PreToolUse: Edit|Write|MultiEdit|NotebookEdit)
//     - harness-owned files (listed in .harness/kit/manifest.json) are read-only;
//     - protect.immutableOnMain: a file already on origin/<defaultBranch> is never edited;
//     - protect.botBranchOnly: some paths change only on bot branches;
//     - protect.appendViaFragments: a file is never rewritten and never gains a
//       new entry heading — entries go in fragments;
//     - Write may not replace most of an existing large file (protect.largeWriteLines).
//   pre-bash   (PreToolUse: Bash)
//     - `git push` to protect.noPushTo is refused;
//     - `git commit` re-applies the edit rules to what is staged, and stops a
//       commit that guts a file (override: HARNESS_ALLOW_LARGE_DELETION=1).
//       `harness sync` commits with HARNESS_SYNC=1, the one way harness-owned
//       files change.
//   post-edit  (PostToolUse: Edit|Write|MultiEdit)
//     - runs the config's `lint` entries for the changed file; reports only errors.
//   stop       (Stop)
//     - a branch with changes and no changelog fragment gets one reminder
//       (only when changelog.fragmentsDir is set).
//   session    (SessionStart)
//     - prints a short orientation: harness version, branch, where to extend.
//
// Every check fails OPEN when it cannot decide (no git, no config, a tool
// missing): a hook can stop a mistake but must never wedge a session.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../scripts/lib/config.mjs";
import { globToRegExp, matchesAny } from "../scripts/lib/glob.mjs";

export const MANIFEST = ".harness/kit/manifest.json";
export const KIT_ISSUES = "https://github.com/Serrated3150/ai-harness/issues";

// ---------------------------------------------------------------------------
// git helpers (null when git cannot answer — callers fail open)

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return null;
  }
}
const hasRef = (ref, cwd) => git(["rev-parse", "--verify", "--quiet", ref], cwd) !== null;
const branchOf = (cwd) => (git(["rev-parse", "--abbrev-ref", "HEAD"], cwd) ?? "").trim();
const repoRoot = (cwd) => (git(["rev-parse", "--show-toplevel"], cwd) ?? "").trim() || cwd;

export function readManifest(root) {
  try {
    const m = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"));
    return { version: m.version ?? null, files: new Set(Object.keys(m.files ?? {})) };
  } catch {
    return { version: null, files: new Set() };
  }
}

// ---------------------------------------------------------------------------
// Pure rules (exported for tests)

export const addsEntryHeading = (oldText, newText) => {
  const n = (t) => (String(t ?? "").match(/^### /gm) || []).length;
  return n(newText) > n(oldText);
};

/**
 * Decide an edit. ctx = { path, tool, input, branch, cfg, owned: Set, existsOnMain(path), currentText }.
 * Returns a reason to deny, or null to allow.
 */
export function editVerdict(ctx) {
  const { path, tool, input, cfg } = ctx;
  const p = cfg.protect;
  if (ctx.owned.has(path))
    return `${path} is harness-owned (ai-harness ${ctx.version ?? ""}, listed in ${MANIFEST}). Projects never edit harness files: extend through .harness/config.json, .harness/PROJECT.md, .harness/routines/<slug>.md or your own non-harness skills, agents and hooks (docs/EXTENDING.md in ai-harness). If the harness itself is wrong, open an issue at ${KIT_ISSUES}. Updates arrive only through \`harness sync\`.`;
  if (matchesAny(path, p.immutableOnMain) && ctx.existsOnMain(path))
    return `${path} is already on the default branch and is immutable (protect.immutableOnMain). Add a new file instead.`;
  for (const rule of p.botBranchOnly)
    if (matchesAny(path, rule.paths) && !rule.branches.some((re) => new RegExp(re).test(ctx.branch)))
      return `${path} may only change on a branch matching ${rule.branches.join(" or ")} (protect.botBranchOnly).${rule.why ? ` ${rule.why}` : ""}`;
  for (const rule of p.appendViaFragments) {
    if (path !== rule.file) continue;
    if (tool === "Write") return `${path} is never rewritten. New entries are fragments in ${rule.fragments} (protect.appendViaFragments); to correct an existing entry, Edit just that line.`;
    const edits = input.edits ?? [{ old_string: input.old_string, new_string: input.new_string }];
    if (edits.some((e) => addsEntryHeading(e.old_string, e.new_string)))
      return `New entries go in a new file under ${rule.fragments}, never in ${path} (protect.appendViaFragments).`;
  }
  if (tool === "Write" && ctx.currentText != null) {
    const before = ctx.currentText.split("\n").length;
    const after = String(input.content ?? "").split("\n").length;
    if (before >= p.largeWriteLines && after < before / 2)
      return `Write would replace ${path} (${before} lines) with ${after}. Edit the parts that change instead; whole-file replacement is how large deletions slip in unnoticed.`;
  }
  return null;
}

export function parseNumstat(text) {
  return String(text ?? "")
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((x) => x.length >= 3 && x[0] !== "-")
    .map(([a, d, ...rest]) => ({ added: +a, deleted: +d, path: rest.join("\t") }));
}

export function guttedFiles(numstat, originalLines, minDeleted = 100) {
  return numstat.filter((f) => {
    const before = originalLines(f.path);
    return f.deleted >= minDeleted && f.added < f.deleted / 4 && before > 0 && f.deleted >= before / 2;
  });
}

export const isCommit = (cmd) => /(^|[;&|]\s*|\s)git\s+(-C\s+\S+\s+)?commit(?![-\w])/.test(cmd);
export const commitAll = (cmd) => /git\s+(-C\s+\S+\s+)?commit\b[^;&|]*\s-(a|[a-zA-Z]*a[a-zA-Z]*)\b/.test(cmd) || /\s--all\b/.test(cmd);

export function pushesTo(cmd, current, protectedBranches) {
  const m = cmd.match(/git\s+(-C\s+\S+\s+)?push\b([^;&|]*)/);
  if (!m) return false;
  const args = m[2].trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
  const refspecs = args.slice(1);
  const isProt = (b) => protectedBranches.includes(b);
  if (!refspecs.length) return isProt(current);
  return refspecs.some((r) => {
    const x = r.replace(/^\+/, "");
    const dst = x.includes(":") ? x.split(":").pop() : x;
    const name = dst.replace(/^refs\/heads\//, "");
    return isProt(name) || ((name === "HEAD" || name === "@") && isProt(current));
  });
}

export function brokenLinks(markdown, fileDir, exists) {
  const out = [];
  let fence = false;
  String(markdown)
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return;
      for (const m of line.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const t = m[1];
        if (/^([a-z]+:|#|mailto:|\/)/i.test(t)) continue;
        const f = decodeURIComponent(t.split("#")[0]);
        if (f && !exists(join(fileDir, f))) out.push({ line: i + 1, target: t });
      }
    });
  return out;
}

// ---------------------------------------------------------------------------
// Handlers

const rel = (fp, root) => relative(root, isAbsolute(fp) ? fp : resolve(root, fp)).split("\\").join("/");

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  return 0;
}

function context(input) {
  const root = repoRoot(input.cwd);
  const cfg = loadConfig(root);
  const { version, files } = readManifest(root);
  const main = `origin/${cfg.project.defaultBranch}`;
  const onMain = (p) => hasRef(main, root) && git(["cat-file", "-e", `${main}:${p}`], root) !== null;
  return { root, cfg, version, owned: files, onMain, branch: branchOf(root) };
}

function preEdit(input) {
  const ctx = context(input);
  const ti = input.tool_input ?? {};
  const fp = ti.file_path ?? ti.notebook_path;
  if (!fp) return 0;
  const path = rel(fp, ctx.root);
  if (path.startsWith("..")) return 0;
  let currentText = null;
  try {
    const abs = join(ctx.root, path);
    if (existsSync(abs) && statSync(abs).isFile()) currentText = readFileSync(abs, "utf8");
  } catch {}
  const reason = editVerdict({ path, tool: input.tool_name, input: ti, branch: ctx.branch, cfg: ctx.cfg, owned: ctx.owned, version: ctx.version, existsOnMain: ctx.onMain, currentText });
  return reason ? deny(reason) : 0;
}

function preBash(input) {
  const cmd = String(input.tool_input?.command ?? "");
  const ctx = context(input);
  if (pushesTo(cmd, ctx.branch, ctx.cfg.protect.noPushTo))
    return deny(`Never push to ${ctx.cfg.protect.noPushTo.join("/")} (harness contract §hard-limits). Push a branch and open a pull request.`);
  if (!isCommit(cmd)) return 0;
  const diffArgs = commitAll(cmd) ? ["diff", "HEAD"] : ["diff", "--cached"];
  const numstat = parseNumstat(git([...diffArgs, "--numstat"], ctx.root));
  if (!numstat.length) return 0;
  const syncing = /HARNESS_SYNC=1/.test(cmd);
  for (const f of numstat) {
    if (syncing && ctx.owned.has(f.path)) continue;
    const reason = editVerdict({ path: f.path, tool: "Edit", input: { old_string: "", new_string: "" }, branch: ctx.branch, cfg: ctx.cfg, owned: ctx.owned, version: ctx.version, existsOnMain: ctx.onMain, currentText: null });
    if (reason) return deny(`Commit stages ${f.path}: ${reason}`);
  }
  for (const rule of ctx.cfg.protect.appendViaFragments) {
    if (!numstat.some((f) => f.path === rule.file)) continue;
    const diff = git([...diffArgs, "--unified=0", "--", rule.file], ctx.root) ?? "";
    if (/^\+### /m.test(diff)) return deny(`The commit adds an entry to ${rule.file}. Move it to a fragment in ${rule.fragments}.`);
  }
  if (/HARNESS_ALLOW_LARGE_DELETION=1/.test(cmd) || syncing) return 0;
  const lines = (p) => {
    const t = git(["show", `HEAD:${p}`], ctx.root);
    return t == null ? 0 : t.split("\n").length;
  };
  const gutted = guttedFiles(numstat, lines, ctx.cfg.protect.guttedMinDeleted);
  if (gutted.length)
    return deny(
      `The staged diff removes most of ${gutted.map((f) => `${f.path} (+${f.added} −${f.deleted})`).join(", ")}. Check \`git diff --cached --stat\` against what the change was meant to be. If intended, re-run the commit prefixed with HARNESS_ALLOW_LARGE_DELETION=1 and say why in the message.`,
    );
  return 0;
}

function run(cmd, args, cwd, timeout = 60000) {
  try {
    execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout });
    return null;
  } catch (e) {
    if (e.code === "ENOENT" || e.signal) return null; // tool missing or timed out: fail open
    return `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
  }
}

function postEdit(input) {
  const ctx = context(input);
  const fp = input.tool_input?.file_path;
  if (!fp) return 0;
  const path = rel(fp, ctx.root);
  if (path.startsWith("..") || !existsSync(join(ctx.root, path))) return 0;
  const reports = [];
  for (const l of ctx.cfg.lint) {
    if (!globToRegExp(l.glob).test(path)) continue;
    if (l.builtin === "relative-links") {
      const b = brokenLinks(readFileSync(join(ctx.root, path), "utf8"), dirname(join(ctx.root, path)), existsSync);
      if (b.length) reports.push(b.map((x) => `${path}:${x.line}: relative link target not found: ${x.target}`).join("\n"));
      continue;
    }
    const cwd = join(ctx.root, l.cwd ?? ".");
    if (l.requires && !existsSync(join(ctx.root, l.requires))) continue;
    const fileArg = relative(cwd, join(ctx.root, path));
    const [bin, ...args] = l.command.map((a) => a.replace("{file}", fileArg));
    const r = run(isAbsolute(bin) || !bin.includes("/") ? bin : join(cwd, bin), args, cwd);
    if (r) reports.push(r);
  }
  if (!reports.length) return 0;
  const lines = reports.join("\n").split("\n");
  process.stderr.write(`Lint found problems in ${path} — fix them before moving on:\n${lines.slice(0, 30).join("\n")}${lines.length > 30 ? `\n… ${lines.length - 30} more lines` : ""}\n`);
  return 2;
}

function stop(input) {
  if (input.stop_hook_active) return 0;
  const ctx = context(input);
  const dir = ctx.cfg.changelog.fragmentsDir;
  const main = `origin/${ctx.cfg.project.defaultBranch}`;
  if (!dir || !ctx.branch || ctx.branch === "HEAD" || ctx.cfg.protect.noPushTo.includes(ctx.branch) || !hasRef(main, ctx.root)) return 0;
  if (ctx.cfg.changelog.exemptBranches.some((re) => new RegExp(re).test(ctx.branch))) return 0;
  const committed = (git(["diff", "--name-only", `${main}...HEAD`], ctx.root) ?? "").split("\n");
  const working = (git(["status", "--porcelain"], ctx.root) ?? "").split("\n").map((l) => l.slice(3));
  const changed = [...committed, ...working].map((s) => s.trim()).filter(Boolean);
  if (!changed.length || changed.some((p) => p.startsWith(dir.replace(/\/?$/, "/")) && !/README\.md$/.test(p))) return 0;
  process.stdout.write(
    JSON.stringify({ decision: "block", reason: `This branch changes files but adds no fragment under ${dir}. Add one, or, if this session was only exploring or the change genuinely needs none, say so and stop.` }),
  );
  return 0;
}

function session(input) {
  const ctx = context(input);
  const lines = [`ai-harness ${ctx.version ?? "(not synced)"} — ${ctx.cfg.project.name ?? "project"}, branch ${ctx.branch || "(no git)"}.`];
  lines.push(
    "Harness-owned (read-only): .harness/kit/**, .claude/skills/harness-*, .claude/agents/harness-*, .github/workflows/harness-*. Extend via .harness/config.json, .harness/PROJECT.md and .harness/routines/<slug>.md; report harness bugs as issues on ai-harness.",
    "Token savers: `node .harness/kit/scripts/sections.mjs --toc` / `§N`; `node .harness/kit/scripts/gates.mjs` runs the local gates and prints only failures.",
  );
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

const HANDLERS = { "pre-edit": preEdit, "pre-bash": preBash, "post-edit": postEdit, stop, session };

async function main() {
  const handler = HANDLERS[process.argv[2]];
  if (!handler) return 0;
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = raw ? JSON.parse(raw) : {};
  } catch {
    return 0;
  }
  input.cwd ??= process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  try {
    return handler(input);
  } catch (e) {
    process.stderr.write(`harness-hook ${process.argv[2]}: ${e.message} (ignored)\n`);
    return 0; // fail open
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().then((c) => (process.exitCode = c));
