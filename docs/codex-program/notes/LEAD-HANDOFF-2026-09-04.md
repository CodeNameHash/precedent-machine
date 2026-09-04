# Lead handoff, 2026-09-04

Written by the Fable lead session for the Opus lead session that takes
over the main loop. Ben's instruction (2026-09-04): Fable usage is too
high; Opus runs the loop, Fable is invoked for adversarial review and
legal-boundary judgement only. CLAUDE.md governs everything below.

## Roles from now

- **Opus (this session)**: the main loop. Specs, dispatch, diff review
  against spec, landing, coordination answers, Ben's decision lists.
- **Fable**: auditor. Invoke as a subagent (`Agent`, model `fable`) for:
  the verdict on each external delivery round (synthesis of lens
  findings, never the lenses themselves), any new authority or correction
  record before it is committed, anything that reads as a legal ruling or
  changes what Ben has to decide. Keep the brief under a page and give it
  the artefacts, not the story.
- **Sonnet**: everything with a writable spec (censuses, mechanical code,
  tests, sweeps, coordination polls, reviews with a checklist).
- **External agent (Cursor, `ext/*` branches)**: builds under specs on
  `coord/m7-ext`; push-only protocol (A-0024). It signals by commenting on
  PR #488. Never answer it on a cadence.
- **Deal Storylines agent** (`coord/deal-terms`): producer-consumer
  contract; read at most every six hours (A-0011).

## State at handoff

- Recovery branch `codex/recover-m7-20260812` tip **fd6f662d**, CI green.
  PR #484 tracks it against `main`. Push only to this branch,
  `coord/m7-ext`, `coord/deal-terms`, `coord/lead-escalation`.
- Phase 0 done: replacement authority (d1b8805d) recognised by the
  validators; historical registrations verify by Git object; import
  closure bound; counts unpinned. Quarantine of the synthetic serving
  path landed (d8eff156, GRAVEYARD 17).
- Phase 1 (external): PR #489 reviewed, A-0022 CHANGES (14 blockers,
  5 changes); A-0023 released the four restricted files; A-0024 set the
  push-only protocol and the queue (T1 Q-0025 resubmission, T2 Phase 2
  real-text fixture packs per profile, T3 Work 3/4 successor spec drafts).
- Deal Terms: contract draft 3 (`package_schema_version 1.2.0`) at
  32b7e8d9 on `coord/deal-terms`; A-0007 to A-0011 answer Q-0003 to
  Q-0005. Nothing after re-plan node 4 has a date.
- Escalation channel: PR #488 (`coord/lead-escalation`, comments only,
  never merged). **Subscribe this session to PR #488** so comments wake it.

## Queue, in order

1. Land #35 when reviewed (the Fable session lands it before handing
   over; if you find it unlanded, it is in the scratch report
   `spec35-report.md` of the old container and must be redone from the
   brief in this note's appendix).
2. #36 follow-up to fd6f662d (Sonnet): hash-verify
   `import_closure_bindings` in the manifest validator and contract;
   historical closure bytes via `boundBytes` in verify-candidate; refuse
   computed import specifiers in the five compiler roles; forbid
   `lib/canonical-v2/m7-deterministic-generalisation.js` from those
   roles' closure; fix the stale registrar header at
   `register-candidate.mjs:2046`.
3. Q-0025 review when the ext agent comments on PR #488: rerun the
   review workflow pattern (six lenses on Sonnet/Opus, adversarial
   refuters, Fable synthesis), scoped to what changed since 5c818926.
   ACCEPT → integrate on the recovery branch (classify the four new
   scripts `LOCAL_ARTIFACT_WRITER`, allowlist, inventory), then create
   interim registration #1 with the #35 mechanism, run the Work 2
   real-text pipeline under it, review the receipt against the
   real-agreement receipt guard.
4. Present Ben with the correction record `…-correction-1.json`
   (PENDING_BEN): three items, one decision.
5. Ben's session 2 preparation: the ext T2 fixture packs, the operator
   table (11 UNDEFINED), party tables, definition classes (ext deliveries
   20 to 22 on `ext/m7-verify-finding`).
6. Keep `pages/admin/programme` (lib/programme/roadmap.js) current when a
   task changes state; it is local-only by Ben's spec.

## Ben's open decisions (put to him in one list, not piecemeal)

1. Approve correction-1 (argv `--registration`, attempt-record member
   names, family-scoped `profile_results`).
2. Ownership of the thirty additional transactions for the shared 50
   (A-0007 §1).
3. Whether the programme extends beyond the shared 50 toward the
   2010-present corpus (A-0010).
4. Whether the programme roadmap page may serve on Vercel previews
   (currently local-only).

## Rules that bit us this week

- Never wait on CI; never poll a channel; a wake comes from PR #488.
- Verify deliveries by artefact (files, diff stat, exit codes), then diff
  review against the spec, looking hardest at what the diff does not do.
- A container restart kills background agents and workflows; agents
  write progress notes incrementally, workflows resume from their journal.
- Two heavy suites (registration, execution-manifest) write ~432 MB per
  subtest under /tmp: never concurrently, clean up after.
- The fixture compiler lesson: read the code, count the cases, run it on
  a real agreement before believing a receipt.

## Appendix: #35 brief (only if it must be redone)

Interim-registration mode (`--authority <replacement>` on the registrar
or bind script, explicit `--supersedes`, refuses `DIRTY_BOUND_ROLE`,
binds `candidate_replacement_authority_binding` and
`import_closure_bindings`, previous registrations byte-identical) and a
content-addressed correction record beside the authority with
`approval.state: PENDING_BEN`, recognised by the validators but applied
only when `BEN_APPROVED`. Behavioural tests for each.
