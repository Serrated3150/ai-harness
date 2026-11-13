import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appliesTo, digest, parseLearnsFrom, parseLessons } from "./lessons.mjs";

const LESSONS = `# X — lessons

Preamble mentioning ### L-fake-001 in prose.

## Lessons

### L-a-001 — First (2026-11-01)

- **Seen:** evidence
  continued.
- **Rule:** do the thing,
  carefully.
- **Prevents:** a mess.

### L-a-002 — Scoped (2026-11-02)

- **Seen:** e
- **Rule:** only for b.
- **Prevents:** p
- **Applies to:** \`b\`, c
`;

test("parses entries and multi-line fields", () => {
  const ls = parseLessons(LESSONS);
  assert.equal(ls.length, 2);
  assert.equal(ls[0].id, "L-a-001");
  assert.equal(ls[0].fields.rule, "do the thing,\n  carefully.");
  assert.equal(ls[1].fields["applies to"], "`b`, c");
});

test("Applies to filters cross-routine reads", () => {
  const [, scoped] = parseLessons(LESSONS);
  assert.ok(appliesTo(scoped, "b"));
  assert.ok(appliesTo(scoped, "c"));
  assert.ok(!appliesTo(scoped, "d"));
  assert.ok(appliesTo(parseLessons(LESSONS)[0], "d"));
});

test("a file with no lessons yields none", () => {
  assert.deepEqual(parseLessons("# t\n\n## Lessons\n\n_None yet._\n"), []);
});

test("digest: own in full, others rules only, filtered", () => {
  const files = {
    "docs/routines/README.md":
      "| R | t | c | j | i | [`d.md`](./d.md) | a |\n| R | t | c | j | i | [`a.md`](./a.md) | d |\n",
    "docs/routines/d.md": "## Lessons\n\n### L-d-001 — Mine (2026-11-01)\n\n- **Seen:** S\n- **Rule:** R\n- **Prevents:** P\n",
    "docs/routines/shared.md": "## Lessons\n\n_None yet._\n",
    "docs/routines/a.md": LESSONS,
  };
  const out = digest("d", (p) => files[p], { dir: "docs/routines", readme: "docs/routines/README.md" });
  assert.match(out, /- \*\*Seen:\*\* S/);
  assert.match(out, /L-a-001 — First/);
  assert.match(out, /do the thing/);
  assert.doesNotMatch(out, /evidence/);
  assert.doesNotMatch(out, /L-a-002/);
});

test("the template routines README parses for every base routine", () => {
  const readme = readFileSync(new URL("../../templates/project/.harness/routines/README.md", import.meta.url), "utf8");
  const g = parseLearnsFrom(readme);
  assert.ok(Object.keys(g).length >= 4);
  for (const [slug, from] of Object.entries(g)) for (const f of from) assert.ok(g[f], `${slug} learns from unknown ${f}`);
});
