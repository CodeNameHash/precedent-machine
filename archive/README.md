# Archive

Forty documents that are no longer in use, moved here on 2026-08-06 so the
repository root is readable. Nothing in this folder is current. For live
guidance, read `docs/core/` instead.

Everything below was moved with `git mv`, never deleted: full history is
still available with `git log --follow` against any file here.

## Superseded plans, handoffs and worklogs (27)

Root-level documents from earlier stages of the programme: old plans
(`PLAN.md`, `PLAN-CANONICAL-LAYER.md`, `PLAN-CLAIMS-LAYER.md`,
`PLAN-EXTRACTION-GAPS.md`, `PLAN-M1-review-queue.md`, `PLAN-M4-query.md`,
`PLAN-M5-ui-homogenized.md`), handoffs (`HANDOFF-CANONICAL-CORPUS.md`,
`HANDOFF-REEXTRACT.md`, `PARSER_HIERARCHY_HANDOFF.md`), worklogs
(`WORKLOG-P0-A.md`, `WORKLOG-P0-B-TAIL-3.md`, `WORKLOG-P0.md`,
`WORKLOG-WP-ALL-DEALS-CARD-BACKED-AUDIT.md`,
`WORKLOG-WP-M2-04-LEGACY-VOCAB-DELETION.md`,
`WORKLOG-WP-SCHEMA-PARITY-AUDIT.md`), an old top-level roadmap
(`precedent-machine-roadmap-v5.md`), old Codex work-package prompts
(`pm-schema-first-migration.codex.md`, `pm-wp-m1-01-review-queue-backend.codex.md`,
`pm-wp-m1-02-review-queue-page.codex.md`, `pm-wp-m1-03-codex-helpers.codex.md`,
`pm-wp-m1-04-documentation.codex.md`), and a handful of one-off records
(`ACK-MASTER-V1.md`, `BLOCKED-P0-C-PR140-PATH-A.md`, `RUBRIC.md`, `SETUP.md`,
`WP-REVIEW-STRICT-V1-REPORT.md`). Verified unread by any application, script
or test before moving.

## Superseded or withdrawn programme documents (5)

Formerly under `docs/codex-program/`, each declaring its own superseded or
withdrawn status in its first line: `MASTER-PLAN.md`,
`ROADMAP-TO-PUBLICATION.md`, `CANONICAL-V2-ACTIVATION-PACKAGE.md`,
`ADR-001-dark-bridge-flattening-is-scaffolding.md` and
`P9-ACCEPTANCE-DEFINITIONS.md` (a withdrawn proposal, status
`WITHDRAWN_NON_AUTHORITY`). Kept as stubs because commit messages and past
sessions reference them by name.

## Still read by tests (8)

These are not in current use, but a handful of tests read them as fixed,
historical fixtures rather than live guidance: they check that content
stayed byte-identical (a pinned SHA256), or assert a fact about the past
(what a plan said before it closed). `HANDOFF.md`, `pm-master-straitjacket.codex.md`,
`PLAN-M2-schema-deploy.md`, `PLAN-M3-ingest-seamless.md`,
`PLAN-TAXONOMY-GAPS.md`, `WORKLOG-P-1.md` and `WORKLOG-P0-C.md` are read
directly by name from their new `archive/` path; the readers were updated in
the same change that moved them. `WORKLOG-P0-D.md` is not one of these: the
test that mentions it writes its own temporary fixture of the same name and
never touches the real file.
