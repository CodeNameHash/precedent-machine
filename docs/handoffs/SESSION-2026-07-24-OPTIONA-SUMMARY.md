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
- Block 00 and the authority bootstrap were executed against the isolated
  staging project on 2026-07-24. Steps 0a–0e, step 1, the F2 authority
  genesis dry-run and its apply all passed. The active pointer remained on
  generation 8 / release `c9c19d…`.
- The first generated termination dry-run failed closed and rolled back with
  `canonical deal identity conflict`. The existing semantic deal is the
  immutable tuple `(deal_key, deal_admission_id, document_hash)`; the packet
  had incorrectly added query dimensions to that semantic identity.
- The approved correction keeps that exact tuple in the authoritative
  semantic write and keeps buyer, sector, merger form, advisers, lawyers,
  announce year and deal value on the serving projection.
- The next dry-run passed the deal boundary and failed closed on one
  `canonical excerpt identity conflict`. The $17 billion deal-value excerpt
  already exists under the material-contracts closure; its complete payload
  was identical except for the proposed termination `closure_id`.
- The approved shared-evidence correction reuses that exact immutable
  material-contracts excerpt. The termination closure owns eight new
  excerpts and references the shared ninth. The packet was regenerated with
  semantic input digest `4bc0b3b0…`. All serving and release identities
  remained unchanged.
- The first shared-evidence dry-run also failed closed and rolled back on
  `shared deal-value excerpt mismatch`. The stored JSON was exact, but the
  guard compared PostgreSQL's generated `jsonb::text` digest with the
  application's canonical-JSON digest. PR #346 corrected the guard so
  PostgreSQL digests the exact expected JSON and still requires full payload
  equality.
- The corrected staging sequence completed on 2026-07-24:
  - `generated/01` re-proved generation 8 / release `c9c19d…`, both
    authority heads, the prior graphs, candidate absence and termination
    write absence.
  - `generated/02` passed and rolled back with exact receipt
    `49ee9df84fc7a7c1e8e7a9b551a185c4fd6db9e2d848c1c432d17f050806e5ef`,
    30 publishable objects, zero residuals and zero quarantines.
  - `generated/03` committed that exact semantic write.
  - `generated/04` passed and rolled back the complete candidate import.
  - `generated/05` committed candidate release `1b70bbc8…` with import state
    `IMPORTED_COMPLETE`.
  - `generated/06` passed with 10 shared rows, 9 query rows, 9 observations,
    2 exclusions, 1 incomplete row, 10 exact-detail packages, 1 deal
    directory row, 1 complete receipt, 7 termination provisions and 6
    termination relationships.
  - An independent read-only audit confirmed the candidate is not active,
    the active pointer is still generation 8 / release `c9c19d…`, the
    termination closure owns 8 excerpts, and the single shared deal-value
    excerpt remains owned by the material-contracts closure.
  - No activation occurred. `generated/07` was not executed.
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
- The deal-boundary correction merged in PR #342 at `6e40e63`, deployed
  READY to `deal-corpus`, and passed contained production smoke. PR #343
  restored integration parity at `63a9a8d` before the shared-excerpt
  correction was generated.
- The shared-excerpt correction merged in PR #344 at `0e080b2`; PR #345
  restored integration parity. The PostgreSQL-native digest guard merged in
  PR #346 at `6d43e2f`; PR #347 restored integration parity. Production is
  READY at `deal-corpus`, `/` returns 200, `/api/market-stats` remains
  contained at 503 and `/api/canonical-v2/query` remains feature-disabled at
  503.

## Current boundary and next non-activation slices

Candidate activation remains a separate cutover decision and is not
authorised by this packet. Continue with non-activation work:

1. Parent/reverse fee (§6.5(c), text admitted and untouched).
2. Dimension backfill for sibling QXO rows under the spec R5 flag.
3. Composition exact-detail under a future contract version if Ben wants the
   trigger composition in the detail drawer.

## Routing note (CLAUDE.md watchdog)

Deviation from "producer-built": the slice module is canonical-provision
encoding (Fable-end-to-end lane); a producer-grade spec would have equaled
the implementation. Everything else (SQL blocks, generator scaffolding)
followed existing script patterns closely enough that a delegation
round-trip would have cost more than it saved this session. Logged for Ben.
