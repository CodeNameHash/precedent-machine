# P1 gate closures — 2026-07-23

## P1_CONTRACT_FREEZE_ATTESTED (ContractFreezeAttestation record)

Acceptance claims, each with its basis:

- `bundle_compiles`: `compileFixtureContract()` compiles and
  `validateContractBundle()` passes, verified live 2026-07-23; fingerprint
  `56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d`.
  The fingerprint is additionally pinned by
  `tests/canonical-v2-no-shop-initial-match-metric.test.js` so any drift
  fails the suite.
- `semantic_and_identity_diff_reviewed`: Fable review, 2026-07-23. Scope:
  the bundle's 14 concepts match `EXPECTED_CONCEPT_KEYS`; the eight
  metric definitions' semantics were exercised against frozen reviewed
  slices throughout this session's Query-surface work (party tuples,
  bases, units all source-cited in `lib/canonical-v2/legacy-query-mapper.js`
  comments); no semantic or identity change has been made to the bundle
  at any point in this session (fingerprint identical at session start
  and now).
- `freeze_gate_approved`: Ben, 2026-07-23, recorded session — chose
  "freeze the current bundle now" explicitly, with QXO termination codes
  deferred to a later freeze-gate amendment (see
  `BRIEFING-QXO-FREEZE-GATE-2026-07-23.md`).
- `status_generation_matches`: status artifact generation 2 accompanies
  this record.

Required adversarial test CONTRACT-01 is declared in
`docs/codex-program/adversarial-tests.md`; the co-wrong-fixture protection
it describes is implemented in the canonical-v2 test suite (contract
fingerprint pins + independent composition fixtures), which passes in
full (2,751 tests) as of this record.

## P1_VERTICAL_SLICE_PASS (VerticalSliceAttestation)

The attestation object at `P1-VERTICAL-SLICE-ATTESTATION.json` (copied
verbatim from `tests/fixtures/canonical-v2/p1-vertical-slice-attestation.json`,
which the suite validates on every run — 3/3 attestation tests passing
2026-07-23):

- correct `required_evidence_object_type` (`VERTICAL_SLICE_ATTESTATION/V1`),
  correct `evidence_contract`
  (`source-to-shared-row-and-bounded-query-vertical-slice/v1`), correct
  `gate_id`;
- all four required acceptance claims present and PASS
  (`all_fixture_cases_pass`, `authoritative_writer_only`,
  `bounded_query_pass`, `sibling_render_isolation_pass`);
- `contract_fingerprint` equals the live compiled bundle fingerprint
  (verified 2026-07-23);
- the 11 fixture cases cover the programme's vertical-slice requirement
  list (representation qualifiers + bring-down, IOC money normalisation,
  no-shop exceptions, multi-span, nested definition, multiple values,
  reviewed unfamiliar proposition, row-level isolation, sealed candidate
  release, bounded single-RPC query, shared row across four surfaces).

## Envelope caveat (both gates)

The `programme-gate-evidence-envelope/v2` cryptographic envelope
(signature, validator key, digest chain) is NOT satisfied — no status
validator exists yet. These closures are owner-approved and
Fable-verified against the registry's acceptance claims, marked
`OWNER_APPROVED_FABLE_VERIFIED` in the status artifact, distinct from
validator-verified PASS. Ben's approvals are recorded in the 2026-07-23
session.

## Effect

`vertical_slice_execution` and `candidate_scope_and_extraction` unlock
(TRANSITIVE_ALL_OF satisfied for both given the G0 owner-deemed set).
All P9 gates remain OPEN. Per the programme: provision-family expansion
may proceed in parallel — bounded work packets, no taxonomy invention,
staging-only, corpus writes dry-run-first and Ben-run local.
