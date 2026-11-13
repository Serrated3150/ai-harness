import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extract, findHeading, parseHeadings, PROFILES } from "./sections.mjs";

const DOC = `# Title

intro

## 1. One

one body

### 1.1 Sub

sub body

## 2. Two

\`\`\`markdown
## Not a heading
### 2.9 nor this
\`\`\`

two body

### 2.5a Lettered

lettered

## 3. Three

three
`;

test("numbered selectors match their own heading level", () => {
  const { heads } = parseHeadings(DOC);
  assert.equal(findHeading(heads, "§1").title, "1. One");
  assert.equal(findHeading(heads, "§1.1").title, "1.1 Sub");
  assert.equal(findHeading(heads, "§2.5a").title, "2.5a Lettered");
  assert.equal(findHeading(heads, "2"), findHeading(heads, "§2"));
});

test("headings inside fenced code are ignored", () => {
  const { heads } = parseHeadings(DOC);
  assert.ok(!heads.some((h) => h.title === "Not a heading"));
  assert.equal(findHeading(heads, "§2.9"), null);
});

test("a section runs to the next heading of the same or higher level", () => {
  const { body } = extract(DOC, ["§1"]);
  assert.match(body, /one body/);
  assert.match(body, /sub body/);
  assert.doesNotMatch(body, /two body/);
});

test("nested selections collapse and keep document order", () => {
  const { body, missing } = extract(DOC, ["§3", "§1.1", "§1"]);
  assert.deepEqual(missing, []);
  assert.equal(body.match(/sub body/g).length, 1);
  assert.ok(body.indexOf("one body") < body.indexOf("three"));
});

test("text selectors and missing selectors", () => {
  const { body, missing } = extract(DOC, ["lettered", "§9"]);
  assert.match(body, /2.5a Lettered/);
  assert.deepEqual(missing, ["§9"]);
});

test("every profile section exists in the harness contract", () => {
  const text = readFileSync(new URL("../contract/ROUTINES.md", import.meta.url), "utf8");
  for (const [name, sels] of Object.entries(PROFILES)) {
    const { missing } = extract(text, sels);
    assert.deepEqual(missing, [], `profile ${name}`);
  }
});

test("profiles are smaller than the whole contract", () => {
  const text = readFileSync(new URL("../contract/ROUTINES.md", import.meta.url), "utf8");
  for (const [name, sels] of Object.entries(PROFILES)) {
    const { body } = extract(text, sels);
    assert.ok(body.length < text.length, `profile ${name} should not be the whole file`);
  }
});
