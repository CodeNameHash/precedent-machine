# M2 acknowledgement: vertical slice complete

- milestone_id: `M2_VERTICAL_SLICE`
- date: `2026-07-31`
- controller: `Claude (Fable), PM controller`
- result: `PASS`

## QXO Agreement control slice

- proof_schema: `QXO_CAPITALISATION_STAGING_PROOF_F28/V1`
- executed: `2026-07-31`, Ben's linked workstation, code commit `8a3fbd44054dbcc8b863c75ddb43efd3752a9c2d`
- vertical_slice_execution: `PASS`
- release_id: `e9980bd083e30784b38d6ca2323570e5dbf83ef93eb63ad476efa279cccac59a`
- writer_receipt_id: `aa3cb663adb86013d5ea0ee367a4a98e6e822ebe1ebad5c71b057d1844d3d520`
- product_query_result_identity: `b65c59e2645e5456e4b82e471fc1571634337c8f5e1f4214844ba3deb509bf8f`
- m1_bundle_id: `901d45871b90d0677dd3fdfa6b718cba1795c5393cbbe91412e05e9ea3f7bd76`
- 14 metric slots, one set-based market read, subject membership verified,
  probe rolled back, zero durable writes, active pointer unchanged.

## Metsera source-only Process slice

- proof_schema: `METSERA_EXCLUSIVITY_P8_CANDIDATE_PROOF/V2`
- executed: `2026-07-31`, GitHub Actions run `30645667105`, code commit
  `a5500f0ab703de04c44fc9dc79e871d25033a814`
- product_candidate_result_id: `939094701b5ac3a4eeaf15dd76b5bc1f4c38a2ec9f0aba4fe17c4f206db6c110`
- candidate_write_receipt_id: `134275832ba3057f57d536bddf6cae40602b27ba11850ec79a392edaefeac8f0`
- candidate_release_import_plan_id: `ec1ddfe6fdeae02f32e710f06323dfa059834eba5bab266e2f0936922ef0ae18`
- serving_record_id: `cf748cacc791683c49a0a3246b55ca8437ca4642026c417efda26c92df036ab5`
- import: `IMPORTED_COMPLETE` on `CANDIDATE_RELEASE_IMPORT_RECEIPT/V7`; exact
  replay no-op; changed-body and tampered-serving-record imports rejected.
- fail-closed: inactive query `INACTIVE_FAIL_CLOSED` (typed 02000 refusal);
  source reader `RELEASE_NOT_ACTIVE` / `NOT_EXECUTED`, original result
  preserved; three hostile authority calls rejected before DML.
- containment: candidate counts 0 before and after; active pointer unchanged
  at generation 10 (`4db4e0c9...`); all authority limits `NONE`.
- cohort rule: `compare_market_state: SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS`
  per the approved reviewed-deal inclusion rule.
- inputs: four deterministic files generated on the runner from the nine
  sealed EDGAR filings, each verified against the sealed manifest SHA-256s;
  input digests match the reviewed reference run exactly
  (materialisation-input `39c56b59...`, receipt `981046db...`, cohort-request
  `9597b5b9...`, cohort-execution-input `7c092d37...`).

## Commit-range note

The two proofs bind different code commits. The diff between them is the M2
execution tooling and the alignment fixes it surfaced (transport for CI
runners, SQL pin rebinds to the M1-approved fingerprint, the surfaces
receipt-hash family alignment, the candidate-record identity-source fix, and
proof-expectation updates) — all covered by focused tests and the 43-predicate
local simulation, none altering the M1-approved contract bundle, whose
fingerprint `901d4587...` compiles identically at both commits.

M2 permits: full-corpus certification work (M3 queue) in isolated staging.
Production authority remains `NONE`.
