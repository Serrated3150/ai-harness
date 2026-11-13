import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOOK, MANIFEST, mergeSettings, sync } from "./sync.mjs";
import { check } from "../kit/scripts/verify.mjs";

const quiet = () => {};
const project = () => mkdtempSync(join(tmpdir(), "harness-proj-"));

test("sync writes harness-owned files with a manifest that verifies", () => {
  const t = project();
  const r = sync({ target: t, log: quiet });
  assert.ok(Object.keys(r.files).length > 5);
  const m = JSON.parse(readFileSync(join(t, MANIFEST), "utf8"));
  assert.match(m.version, /^v\d+\.\d+\.\d+$/);
  // harness-check fetches ai-harness by this exact commit, so it must be the full SHA.
  if (m.commit !== null) assert.match(m.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(check(t, m), { missing: [], changed: [] });
  assert.ok(Object.keys(m.files).every((p) => /^(\.harness\/kit\/|\.claude\/skills\/harness-|\.claude\/agents\/harness-|\.github\/workflows\/harness-)/.test(p)), "every owned file is under a harness-owned path");
  assert.ok(!Object.keys(m.files).some((p) => p.endsWith(".test.mjs")), "tests are not vendored");
});

test("verify catches an edited or deleted harness file", () => {
  const t = project();
  sync({ target: t, log: quiet });
  const m = JSON.parse(readFileSync(join(t, MANIFEST), "utf8"));
  writeFileSync(join(t, HOOK), "// edited\n");
  assert.deepEqual(check(t, m).changed, [HOOK]);
});

test("--init seeds project-owned files once and never overwrites them", () => {
  const t = project();
  mkdirSync(join(t, ".harness"), { recursive: true });
  writeFileSync(join(t, ".harness/config.json"), '{"markerPrefix":"mine"}');
  const r = sync({ target: t, init: true, log: quiet });
  assert.ok(r.seeded.includes(".harness/PROJECT.md"));
  assert.ok(!r.seeded.includes(".harness/config.json"));
  assert.equal(readFileSync(join(t, ".harness/config.json"), "utf8"), '{"markerPrefix":"mine"}');
  const again = sync({ target: t, init: true, log: quiet });
  assert.deepEqual(again.seeded, []);
  const m = JSON.parse(readFileSync(join(t, MANIFEST), "utf8"));
  assert.ok(!(".harness/PROJECT.md" in m.files), "seeded files are project-owned, not in the manifest");
});

test("settings merge keeps project keys and hooks, and replaces earlier harness hooks", () => {
  const before = {
    permissions: { allow: ["Bash(ls:*)"] },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node mine.mjs" }, { type: "command", command: `node "$CLAUDE_PROJECT_DIR/${HOOK}" pre-bash` }] }] },
  };
  const after = mergeSettings(before);
  assert.deepEqual(after.permissions, before.permissions);
  const cmds = after.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(cmds.includes("node mine.mjs"));
  assert.equal(cmds.filter((c) => c.includes(HOOK) && c.endsWith("pre-bash")).length, 1);
  assert.deepEqual(mergeSettings(after), after, "idempotent");
});

test("files a newer version stops shipping are removed", () => {
  const t = project();
  sync({ target: t, log: quiet });
  const m = JSON.parse(readFileSync(join(t, MANIFEST), "utf8"));
  m.files[".harness/kit/old.mjs"] = "x";
  writeFileSync(join(t, ".harness/kit/old.mjs"), "old");
  writeFileSync(join(t, MANIFEST), JSON.stringify(m));
  const r = sync({ target: t, log: quiet });
  assert.deepEqual(r.removed, [".harness/kit/old.mjs"]);
  assert.ok(!existsSync(join(t, ".harness/kit/old.mjs")));
});

test("verify --kit: a manifest edited to cover a hand-changed file is caught", async () => {
  const { checkAgainstKit } = await import("../kit/scripts/verify.mjs");
  const kitRoot = new URL("..", import.meta.url).pathname;
  const t = project();
  sync({ target: t, log: quiet });
  const m = JSON.parse(readFileSync(join(t, MANIFEST), "utf8"));
  assert.deepEqual(checkAgainstKit(kitRoot, m), []);
  // Someone edits a harness file and rewrites its hash to match.
  writeFileSync(join(t, HOOK), "// tampered\n");
  const { sha256 } = await import("../kit/scripts/verify.mjs");
  m.files[HOOK] = sha256(Buffer.from("// tampered\n"));
  assert.deepEqual(checkAgainstKit(kitRoot, m), [HOOK]);
});
