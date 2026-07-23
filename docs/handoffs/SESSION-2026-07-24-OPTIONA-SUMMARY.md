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
  `00-read-lineage.sql`, deterministic F2 authority genesis (head
  `614bb1f8…`) dry-run/apply, step-1 release-declared-fingerprint widening
  block, and `scripts/canonical-v2-staging-qxo-termination-optionA.mjs`
  (generates the import SQL from the paste-back; every pinned identity
  re-proven; import INACTIVE only).
- Status artifact generation 4 records the Option A runbook adaptation.
- Tests: `tests/canonical-v2-qxo-termination-fee-admitted-slice.test.js`
  (6 tests). Full battery 2,805/2,805 + build green. Downstream release
  path rehearsed offline: partitions 9 observations / 2 exclusions /
  10 shared rows / 1 incomplete / 10 packages; import plan ~398 KB;
  DEAL_SCOPE_RUN write validated through the canonical writer
  (30 publishable objects).

## Next session (after Ben runs step-1 + genesis + Block 00)

1. Receive Ben's Block 00 JSON; save to a file; run the generator; commit
   the printed attestation (pins the termination mapping id, closure id,
   F2 corpus release id, namespace, manifest and import-plan ids).
2. Walk Ben through generated/01…06 per the runbook.
3. Later packets: Parent/reverse fee (§6.5(c) — text admitted, untouched);
   dimension backfill for sibling QXO rows (spec R5 flag); composition
   exact-detail under a future contract version if Ben wants the trigger
   composition in the detail drawer.

## Routing note (CLAUDE.md watchdog)

Deviation from "producer-built": the slice module is canonical-provision
encoding (Fable-end-to-end lane); a producer-grade spec would have equaled
the implementation. Everything else (SQL blocks, generator scaffolding)
followed existing script patterns closely enough that a delegation
round-trip would have cost more than it saved this session. Logged for Ben.
