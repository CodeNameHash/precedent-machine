# Session 2026-07-24 — QXO termination candidate (F2) + Option A packet

Continuation of HANDOFF-SESSION-2026-07-23-EOD.md. Governing spec (binding,
read first): `SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md`.

## Shipped

- **Finding (supersedes the prior producer):** no new source admission is
  needed — the admitted agreement source `f31cad8c…` is TopBuild's filing
  of the same merger agreement (`bld-20260418xex2d1.htm`), byte-fetched and
  hash-verified this session, and its canonical text contains §§6.2/6.4/
  6.5(b) verbatim (with page-break/U+200E artifacts, quoted as-is per the
  material-slice precedent). Offline conversion is byte-identical to the
  staged intervals.
- `lib/canonical-v2/qxo-termination-fee-admitted-slice.js` — admitted
  two-source COMPLETE slice: fee 3.52941176 % of deal value, six
  TRIGGERED_BY relationships whose typed effects equal the Ben-reviewed
  fixture's as a multiset (test-proven), F2-only concepts enforced.
- `buildAdmittedClaimEvidenceDetailPackage` + additive dispatch branch —
  admitted rows can serve the frozen RESULT_COMPONENT_CLAIM_EVIDENCE
  action (composition detail cannot fit the frozen 16KB bound; spec R8).
- F2 seed builder (`QXO_TERMINATION_COMBINED_CANDIDATE_SEED/V1`,
  parameterized; pins land after the Block 00 paste-back per spec R9).
- Option A artifacts: `sql/optionA/README.md` (runbook),
  contract-partition authority migration/replacement/verification blocks,
  `00-read-lineage.sql`, deterministic F2 authority genesis (head
  `614bb1f8…`) dry-run/apply, step-1 release-declared-fingerprint widening
  block, and `scripts/canonical-v2-staging-qxo-termination-optionA.mjs`
  (generates the import SQL from the paste-back; every pinned identity
  re-proven; semantic-write receipt mechanically required; blocking pointer
  and count assertions; import INACTIVE only).
- Read-only Block 00 was executed against staging on 2026-07-24. Both SEC
  sources re-fetched and hash-verified, the generator completed, and the final
  attestation plus generated 01–07 paste blocks are committed. No staging
  write or activation occurred.
- Status artifact generation 4 records the Option A runbook adaptation.
- Tests: `tests/canonical-v2-qxo-termination-fee-admitted-slice.test.js`
  plus authority-partition and fail-closed packet tests. Full battery
  2,808/2,808 + programme check + build green. Downstream release
  path rehearsed offline: partitions 9 observations / 2 exclusions /
  10 shared rows / 1 incomplete / 10 packages; import plan ~398 KB;
  DEAL_SCOPE_RUN write validated through the canonical writer
  (30 publishable objects).
- Merged to `main` in PR #338 at `bc73368`; deployed by the `deal-corpus`
  Vercel project. Production smoke: `/` 200, `/api/market-stats` contained
  503, `/api/canonical-v2/query` feature-disabled 503. PR #339 restored
  byte-for-byte content parity on `codex/canonical-corpus-v2`. The untracked
  `docs/codex-program/engine-build-map.md` in that worktree was preserved.

## Next authorised action: Ben-run staging paste sequence

The generator and attestation are complete. Do not regenerate them unless a
fail-closed assertion reports source or staging drift. Do not run these writes
for Ben: programme governance still requires local, dry-run-first Ben execution
in the staging SQL Editor. No production database step is authorised.

1. Ben pastes `step0a` through `step0e` in order from `sql/optionA/`.
2. Ben pastes `step1-active-query-page-release-declared-fingerprint.sql`.
3. Ben pastes `01-f2-authority-genesis-dry-run.sql`, checks the rollback
   result, then pastes `01-f2-authority-genesis-apply.sql`.
4. Ben reruns `00-read-lineage.sql`. Stop on any mismatch with the pinned
   preconditions in `generated/01-verify-before.sql`.
5. Ben pastes `generated/01` through `generated/06` in order. Dry-run blocks
   must precede their apply blocks. This imports an INACTIVE release only.
6. Do not activate the candidate release. `generated/07-rollback-rehearsal.sql`
   is a separate rehearsal, not part of the import sequence.
7. Later packets: Parent/reverse fee (§6.5(c), text admitted and untouched);
   dimension backfill for sibling QXO rows (spec R5 flag); composition
   exact-detail under a future contract version if Ben wants the trigger
   composition in the detail drawer.

## Routing note (CLAUDE.md watchdog)

Deviation from "producer-built": the slice module is canonical-provision
encoding (Fable-end-to-end lane); a producer-grade spec would have equaled
the implementation. Everything else (SQL blocks, generator scaffolding)
followed existing script patterns closely enough that a delegation
round-trip would have cost more than it saved this session. Logged for Ben.
