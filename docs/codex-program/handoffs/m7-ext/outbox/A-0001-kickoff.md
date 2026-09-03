id: A-0001
from: lead
to: ext
date: 2026-09-03
re: kickoff (answers Q-0001)
status: ANSWERED

# Answers

## First, a change to the pins you verified

The registration `0e46052b…` is being superseded. Its bound test
`tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js` cannot pass
on any tree containing Work4's outputs, so Ben authorised a candidate
correction before Work 5 (`docs/codex-program/notes/WORK4-CANDIDATE-CORRECTION-2026-09-03.md`
and DECISIONS.md #25 on `codex/recover-m7-20260812` from commit `d98ddf4c`).
What this means for you:

- The four committed Work4 outputs stay byte-identical and are never
  deleted. A **successor** manifest, transition authority, registration and
  receipt will be added by the next Lead commit (B). The successor
  registration has a **new ID**; the candidate root will then hold two
  files, the superseded one and the successor.
- The manifest of record becomes
  `control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json`,
  which carries `work4_candidate_correction_authority_binding` and binds the
  successor registration under `candidate_registration_binding`.
- The receipt of record becomes
  `receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json`,
  schema `STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V2`: the V1 members plus
  `work4_candidate_correction_authority_binding` and
  `superseded_work4_receipt_binding`.
- The 53 bound paths are unchanged as a set; two of them change bytes
  (`…execution-manifest.test.js`, `…work4.test.js`), which is why the ID
  changes. Your branches stay based on `b11388ab`; rebase is not needed.
  `PINS.md` is updated when commit B lands and I will write an `A` naming
  the new ID.

## Q1, Work 6 sealed sources: confirmed

Bind exactly the three ledgers you found under
`shadow/m7-comparison-entry-correction/`, at the digests you recorded
(`521dfec7…`, `66f17146…`, `cd4cca76…`). They are the sets the adversarial
review reconciled (its item 8). Ignore
`evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json`; it is an
earlier Stage 2Y-CD artefact, not the M7 ledger. The one
`RESIDUAL_QUOTE_UNVERIFIED` member of the 69 is reported as such, never
resolved by you. Work 6 may start.

## Q2, assumption 4: accepted

Recompute means extract from sealed containers and rebuild sets from sealed
member records. Do not re-run the Work 2 compiler or the Work 3 producers.
`NO_INDEPENDENT_SOURCE` is the honest label for a set envelope whose only
source is itself, provided the nested members it names are re-hashed.

## Q3, result schema: accepted

`STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1`. Nothing else is reserved.

## Q4, registration selection: explicit, never discovered, never defaulted

Because the root will hold two registrations, the verifier must not discover
"the single file" and must not carry a default ID. Required contract:

- `--registration <path>` selects the registration explicitly; or
- `--manifest <path>` selects a manifest of record and the verifier reads
  its `candidate_registration_binding.registration_binding.path`, checks
  that binding's bytes, and verifies that registration.
- No argument: refuse with a finding, exit non-zero.
- A superseded registration present beside the selected one is reported
  in the result (`superseded_registrations: [...]`) and is never verified
  as the candidate.

Assumptions 1, 2, 3, 5, 8, 9, 10 accepted. On 5: also accept the V2 Work4
receipt above; the receipt-of-record path is a parameter of the manifest,
not a constant.

The delivery review for `Q-0002` follows separately as `A-0002`.
