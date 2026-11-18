#!/usr/bin/env node
// Tag a release (maintainer tool, not vendored; run by .github/workflows/release-tag.yml).
//
// The release commit is the newest commit on the default branch's first-parent
// line that changed kit/VERSION: the merge of the PR that bumped the version.
// It is tagged `v<kit/VERSION>`.
//
//   node tools/release-tag.mjs            print what would happen
//   node tools/release-tag.mjs --apply    create the tag and push it to origin
//
// A tag never moves. If `v<version>` already exists on another commit, this
// fails: bump kit/VERSION for a new release instead. If it already points at
// the release commit, there is nothing to do.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (args, cwd) => {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
};

/** What to do for one release. Pure, for tests. */
export function decide({ version, releaseCommit, existingTagCommit }) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) return { action: "error", message: `kit/VERSION is not X.Y.Z: ${JSON.stringify(version)}` };
  if (!/^[0-9a-f]{40}$/.test(releaseCommit ?? "")) return { action: "error", message: "no commit on the first-parent line changes kit/VERSION" };
  const tag = `v${version}`;
  if (!existingTagCommit) return { action: "create", tag, commit: releaseCommit };
  if (existingTagCommit === releaseCommit) return { action: "none", tag, commit: releaseCommit };
  return {
    action: "error",
    tag,
    message: `${tag} already points at ${existingTagCommit.slice(0, 7)}, but the release commit is ${releaseCommit.slice(0, 7)}. Tags never move: bump kit/VERSION for a new release.`,
  };
}

export function inspect(cwd = process.cwd()) {
  const version = tryGit(["show", "HEAD:kit/VERSION"], cwd);
  const releaseCommit = tryGit(["log", "--first-parent", "-1", "--format=%H", "HEAD", "--", "kit/VERSION"], cwd) || null;
  const existingTagCommit = version ? tryGit(["rev-parse", "-q", "--verify", `refs/tags/v${version}^{commit}`], cwd) : null;
  return decide({ version, releaseCommit, existingTagCommit });
}

function main() {
  const apply = process.argv.includes("--apply");
  const d = inspect();
  if (d.action === "error") {
    console.error(`release-tag: ${d.message}`);
    process.exitCode = 1;
    return;
  }
  if (d.action === "none") {
    console.log(`release-tag: ${d.tag} already points at ${d.commit.slice(0, 7)}; nothing to do.`);
    return;
  }
  if (!apply) {
    console.log(`release-tag: would tag ${d.commit.slice(0, 7)} as ${d.tag} (pass --apply).`);
    return;
  }
  git(["tag", d.tag, d.commit]);
  git(["push", "origin", `refs/tags/${d.tag}`]);
  console.log(`release-tag: tagged ${d.commit.slice(0, 7)} as ${d.tag} and pushed it.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
