# Routines in this project

<!--
Project-owned. The roster of scheduled routines this project runs, their
overlays and lessons. `lessons.mjs` reads the *Learns from* column, so keep the
table's columns as they are. Remove rows for routines you do not run; add rows
for routines of your own.
-->

| Routine | Scheduled task | Cadence (UTC) | Overlay | Base | Lessons | Learns from | Model |
|---------|----------------|---------------|---------|------|---------|-------------|-------|
| Issue intake | TODO | TODO | [`issue-intake.md`](./issue-intake.md) | [base](../kit/routines/issue-intake.md) | [`issue-intake.md`](../lessons/issue-intake.md) | plan-review, pr-review, pr-follow-through, test-coverage, issue-tracker | TODO |
| Plan review | TODO | TODO | [`plan-review.md`](./plan-review.md) | [base](../kit/routines/plan-review.md) | [`plan-review.md`](../lessons/plan-review.md) | pr-review, issue-intake | TODO |
| PR follow-through | TODO | TODO | [`pr-follow-through.md`](./pr-follow-through.md) | [base](../kit/routines/pr-follow-through.md) | [`pr-follow-through.md`](../lessons/pr-follow-through.md) | pr-review, issue-intake, test-coverage | TODO |
| PR review | TODO | TODO | [`pr-review.md`](./pr-review.md) | [base](../kit/routines/pr-review.md) | [`pr-review.md`](../lessons/pr-review.md) | issue-tracker, test-coverage, weekly-security-audit | TODO |
| Test coverage | TODO | TODO | [`test-coverage.md`](./test-coverage.md) | [base](../kit/routines/test-coverage.md) | [`test-coverage.md`](../lessons/test-coverage.md) | issue-tracker, pr-review, weekly-test-strategy | TODO |
| Issue tracker | TODO | TODO | [`issue-tracker.md`](./issue-tracker.md) | [base](../kit/routines/issue-tracker.md) | [`issue-tracker.md`](../lessons/issue-tracker.md) | test-coverage, pr-review | TODO |
| Daily full suite | TODO | TODO | [`daily-full-suite.md`](./daily-full-suite.md) | [base](../kit/routines/daily-full-suite.md) | [`daily-full-suite.md`](../lessons/daily-full-suite.md) | test-coverage, issue-tracker | TODO |
| Weekly test strategy | TODO | TODO | [`weekly-test-strategy.md`](./weekly-test-strategy.md) | [base](../kit/routines/weekly-test-strategy.md) | [`weekly-test-strategy.md`](../lessons/weekly-test-strategy.md) | daily-full-suite, test-coverage, issue-tracker | TODO |
| Weekly security audit | TODO | TODO | [`weekly-security-audit.md`](./weekly-security-audit.md) | [base](../kit/routines/weekly-security-audit.md) | [`weekly-security-audit.md`](../lessons/weekly-security-audit.md) | pr-review, issue-intake | TODO |

Each scheduled task's prompt is the loader in
[`.harness/kit/routines/LOADER.md`](../kit/routines/LOADER.md). Changes to an
overlay, to `shared.md` or to the *Learns from* column bind routines, so they
wait for the owner (contract §learning).
