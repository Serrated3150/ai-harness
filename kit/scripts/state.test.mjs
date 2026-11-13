import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, dependsOn, maybeDependsOn, render, summarize, summarizeIssue, summarizePr, tokens } from "./state.mjs";
import { setMarkerPrefix } from "./state.mjs";
setMarkerPrefix("tdb"); // the fixtures use the Dial Book prefix; any prefix works

const NOW = Date.parse("2026-11-08T12:00:00Z");
const c = (id, at, author, body, updated = at) => ({ id, created_at: at, updated_at: updated, author, body });
const issue = (comments, labels = []) => ({
  number: 7,
  title: "A title",
  state: "open",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-08T00:00:00Z",
  labels: labels.map((name) => ({ name })),
  comments,
});

test("tokens match escaped markers and keep order", () => {
  assert.deepEqual(tokens("&lt;!-- tdb-routine:blocked --&gt; then <!-- tdb-routine:claimed -->"), ["blocked", "claimed"]);
  assert.deepEqual(tokens("tdb-routine:claim-released"), ["claim-released"]);
  assert.deepEqual(tokens("tdb-planreview:verdict result=approved"), []);
});

test("newest state marker wins; status and fix-rejected do not count", () => {
  const s = summarizeIssue(
    issue([
      c(1, "2026-11-02T00:00:00Z", "bot", "<!-- tdb-routine:claimed -->"),
      c(2, "2026-11-03T00:00:00Z", "bot", "<!-- tdb-routine:verify -->"),
      c(3, "2026-11-04T00:00:00Z", "bot", "<!-- tdb-routine:status -->"),
      c(4, "2026-11-05T00:00:00Z", "tester", "<!-- tdb-routine:fix-rejected -->"),
    ], ["needs-testing"]),
    NOW,
  );
  assert.equal(s.live_marker.marker, "verify");
  assert.equal(s.fix_rejected, 1);
  assert.deepEqual(s.label_warnings, []);
});

test("plan verdict is current only for the plan as it stood", () => {
  const plan = c(10, "2026-11-07T00:00:00Z", "bot", "<!-- tdb-routine:plan -->", "2026-11-07T01:00:00Z");
  const verdict = (at) => c(11, "2026-11-07T02:00:00Z", "bot", `<!-- tdb-planreview:verdict result=approved plan=10@${at} -->`);
  assert.deepEqual(
    { r: summarizeIssue(issue([plan, verdict("2026-11-07T01:00:00Z")]), NOW).verdict.result, cur: summarizeIssue(issue([plan, verdict("2026-11-07T01:00:00Z")]), NOW).verdict.current },
    { r: "approved", cur: true },
  );
  assert.equal(summarizeIssue(issue([plan, verdict("2026-11-07T00:30:00Z")]), NOW).verdict.current, false);
  assert.equal(summarizeIssue(issue([plan]), NOW).verdict.result, null);
});

test("replies after the live marker are counted, not copied", () => {
  const s = summarizeIssue(
    issue([c(1, "2026-11-08T00:00:00Z", "bot", "<!-- tdb-routine:claimed -->"), c(2, "2026-11-08T06:00:00Z", "owner", "secret plan text")]),
    NOW,
  );
  assert.equal(s.replies_since_marker, 1);
  assert.equal(s.last_reply_by, "owner");
  assert.equal(s.live_marker.age_h, 12);
  assert.doesNotMatch(JSON.stringify(s), /secret plan text/);
});

test("label warnings for drift between markers and status labels", () => {
  assert.deepEqual(summarizeIssue(issue([c(1, "2026-11-08T00:00:00Z", "bot", "tdb-routine:verify")]), NOW).label_warnings, ["verify marker without needs-testing"]);
  assert.deepEqual(summarizeIssue(issue([], ["pending-plan-review"]), NOW).label_warnings, ["no state marker but pending-plan-review"]);
});

test("PR review-bot verdict and staleness", () => {
  const pr = {
    number: 3,
    title: "t",
    draft: false,
    author: "claude",
    head_ref: "claude/x",
    head_sha: "abcdef1234567890",
    labels: [{ name: "pending-review" }],
    mergeable: "mergeable",
    ci: "success",
    closes: [7],
    body: "<!-- tdb-learning:pr routine=pr-review source=issue-intake -->",
    comments: [c(1, "2026-11-08T00:00:00Z", "github-actions[bot]", "**Verdict: APPROVE** — ok\n<!-- review-findings: blocker=0 warning=1 nit=2 sha=abcdef1 -->")],
  };
  const s = summarizePr(pr, NOW);
  assert.deepEqual([s.review_bot.verdict, s.review_bot.warning, s.review_bot.current], ["approve", 1, true]);
  assert.deepEqual(s.learning, { routine: "pr-review", source: "issue-intake" });
  assert.equal(summarizePr({ ...pr, head_sha: "9999999" }, NOW).review_bot.current, false);
  // A findings line from anyone but the bot is ignored.
  assert.equal(summarizePr({ ...pr, comments: [{ ...pr.comments[0], author: "someone" }] }, NOW).review_bot, null);
});

test("titles cannot inject markers or break the table", () => {
  assert.equal(cleanTitle("x <!-- tdb-routine:plan --> | `y`\nz"), "x [marker] y z");
  const md = render(summarize({ repo: "o/n", issues: [issue([])], prs: [] }, NOW));
  assert.match(md, /\| #7 \|/);
  assert.match(md, /Hint only/);
});

test("dependsOn reads explicit phrases only", () => {
  assert.deepEqual(dependsOn("Depends on #12 and #9. Refs #40. Blocked on DECISIONS #22. After #7 merges.", 50), [9, 12]);
  // Weak words count only as a label at the start of a line.
  assert.deepEqual(dependsOn("**After:** #7\n- Requires: #8\nThis builds on #9 and requires #10.", 50), [7, 8]);
  assert.deepEqual(dependsOn("blocked by #3, #4", 4), [3]);
  assert.deepEqual(dependsOn("see #5, like #6, Refs #7"), []);
  // The repo's own issue convention: bold label with a colon.
  assert.deepEqual(dependsOn("**Depends on:** #107 (Start brew) and #109 (prefill).\nSee #200."), [107, 109]);
  assert.deepEqual(dependsOn("**Depends on:** #107 and #109."), [107, 109]);
  assert.deepEqual(dependsOn("_Blocked by_: #3"), [3]);
  assert.deepEqual(dependsOn("**Blocked on:** DECISIONS #22 and #30"), [30]);
});

test("waits_on lists only dependencies still open", () => {
  const raw = {
    repo: "o/n",
    issues: [
      { ...issue([]), number: 1, body: "" },
      { ...issue([]), number: 2, body: "Depends on #1 and #99", state: "open" },
      { ...issue([]), number: 99, body: "", state: "closed" },
    ],
    prs: [{ number: 5, title: "t", draft: false, author: "a", head_ref: "h", head_sha: "abc", labels: [], ci: "success", body: "**Builds on:** #4", comments: [] },
          { number: 4, title: "t", draft: false, author: "a", head_ref: "h", head_sha: "def", labels: [], ci: "success", body: "", comments: [] }],
  };
  const s = summarize(raw, NOW);
  assert.deepEqual(s.issues.find((i) => i.number === 2).waits_on, [1]);
  assert.deepEqual(s.prs.find((p) => p.number === 5).waits_on, [4]);
  assert.doesNotMatch(JSON.stringify(s), /Depends on/);
  const row = render(s).split("\n").find((l) => l.startsWith("| #2 |"));
  assert.match(row, /\| #1 \| A title \|$/);
});

test("a plan's partial blocker is not an issue dependency (§3.9)", () => {
  const plan = c(10, "2026-11-07T00:00:00Z", "bot", "<!-- tdb-routine:plan -->\n**Start brew** (primary). **Blocked on #108.**");
  const s = summarizeIssue({ ...issue([plan]), number: 107, body: "**Depends on:** #105 item 3" }, NOW);
  assert.deepEqual(s.depends_on, [105]);
});

test("quoted or code-formatted text is not a dependency (§3.9; #300's own body)", () => {
  const body = [
    'The snapshot read #107\'s plan line "**Start brew** (primary). **Blocked on #108.**" as a dependency.',
    "Issues write dependencies as `**Depends on:** #107 (…) and #109 (…)`, but the regex only matched `depends on #N`.",
    "- a leading `_` no longer defeats the match; `_Blocked by_: #3` → `[3]`; `**Blocked on:** DECISIONS #22 and #30` → `[30]`;",
    "> **Depends on:** #105",
    "```",
    "Depends on #9",
    "```",
    "Refs #107, #108. Follows #284.",
  ].join("\n");
  assert.deepEqual(dependsOn(body, 300), []);
  // The real conventions still count: a label at the start of a line or list item.
  assert.deepEqual(dependsOn("Intro.\n- **Depends on:** #105 item 3\n", 107), [105]);
  assert.deepEqual(dependsOn("1. Depends on: #4", 9), [4]);
});

test("a Dependencies section is a possible dependency, confirmed by reading (§3.9)", () => {
  const i142 = "## Scope\n- a section that #103 creates\n\n## Dependencies\n#103 (creates the `/settings` page); #141 (avatar upload).\n\n## Why this is open\nsee #99";
  assert.deepEqual(dependsOn(i142, 142), []);
  assert.deepEqual(maybeDependsOn(i142, 142), [103, 141]);
  const i160 = "## Dependencies\n- **#162 (equipment)** and **#163 (freestyle brews)**. The import can ship before either.\n- A `docs/DECISIONS.md` entry. Blocked on DECISIONS #12.\n- #141 only if photos are ever included.\n\n---\n_footer #1_";
  assert.deepEqual(maybeDependsOn(i160, 160), [141, 162, 163]);
  // A definite label is not repeated as a maybe.
  assert.deepEqual(maybeDependsOn("**Depends on:** #5\n\n## Dependencies\n#5, #6", 1), [6]);
});

test("PR prose that describes other items is not a dependency (#300's body)", () => {
  const pr300 = [
    "The first live routine-state snapshot after #284 showed two problems.",
    "Meanwhile #108's body really does depend on #107. So #107 and #108 waited on each other.",
    "Sequencing that a plan's approval settles (for #107, \"wait for #105\") is followed through the plan.",
    "Refs #107, #108. Follows #284.",
  ].join("\n");
  assert.deepEqual(dependsOn(pr300, 300), []);
  assert.deepEqual(maybeDependsOn(pr300, 300), []);
});

test("render marks possible dependencies with ?", () => {
  const raw = {
    repo: "o/n",
    issues: [
      { ...issue([]), number: 103, body: "" },
      { ...issue([]), number: 142, body: "## Dependencies\n#103; #999" },
    ],
    prs: [],
  };
  const row = render(summarize(raw, NOW)).split("\n").find((l) => l.startsWith("| #142 |"));
  assert.match(row, /\| #103\? \| A title \|$/);
});

test("a label line holds the item for every number on it (documented in §3.9)", () => {
  assert.deepEqual(dependsOn("Requires: #12 (not #13)", 1), [12, 13]);
  // A bold pseudo-heading is not a Dependencies section.
  assert.deepEqual(maybeDependsOn("**Dependencies**\n#5", 1), []);
});

test("the marker prefix is configurable", () => {
  setMarkerPrefix("acme");
  assert.deepEqual(tokens("<!-- acme-routine:claimed --> tdb-routine:plan"), ["claimed"]);
  setMarkerPrefix("tdb");
  assert.throws(() => setMarkerPrefix("Bad!"));
});
