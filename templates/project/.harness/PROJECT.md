# Project overlay

<!--
Project-owned. This file states the rules that are specific to THIS project.
Every routine reads it after the harness contract
(.harness/kit/contract/ROUTINES.md). Rules here add to and tighten the
contract; they never relax a harness hard limit (contract §precedence). Replace
every "TODO" below; delete a section only if it genuinely does not apply. The
harness never rewrites this file.
-->

## Project

TODO: one paragraph — what this project is, and the docs that define it (the
contract, schema, route map, design system…). Routines read the docs named here
before they assert a violation.

## Areas

TODO: the areas of the repository and what governs each.

| Area | Paths | Governed by |
|------|-------|-------------|
| TODO | `src/**` | `docs/…` |

## Hard contracts

TODO: the rules no change may break (for example "schema changes only via
migrations", "writes only through these functions"). A PR that breaks one is a
Blocker.

## Trust boundary and owner-only gates

TODO: what counts as the trust boundary here (auth, roles, access policies,
secrets, payments…). Plans touching it are full plans and escalate to the owner
(contract §plan-gate). List any other owner-only gates.

## Docs and changelog

TODO: which doc each kind of change updates, and how changelog entries are
written (for example, fragments in `changelog.d/`).

## Pull requests

TODO: the PR template path, the labels routines may set, and who may ask a
routine to maintain its own PR's branch (rebase, merge the default branch in,
re-run a job).

## Test lanes

TODO: the test lanes that exist, which run on PRs and which only nightly, and
how a new test is tagged so a PR lane runs it.

## Open decisions

TODO: where open decisions are tracked (for example `docs/DECISIONS.md`).
Routines never ship around an open one.
