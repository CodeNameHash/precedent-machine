# Copy-delivery release-manifest binding F23 implementation plan

## Scope

Bind the exact F22 copy-delivery metric admission to one content-addressed
candidate release and every serving carrier in that release. Prove the bound
release in the isolated Supabase staging project using a transaction that
always rolls back.

F23 does not activate Canonical Query, change the active release pointer,
admit another metric, persist staging data, alter production or add a
production database path.

## Task 1: preserve historical attestations

1. Leave F19, F20, F21 and F22 artifacts and identities immutable.
2. Do not modify the two live-validator files whose source bytes are frozen in
   F21.
3. Build the F23 successor contract in a separate module.
4. Reconstruct and validate every predecessor V2 object before accepting its
   release-bound successor.

## Task 2: release-bound carriers

Create one exact release-bound copy-delivery bundle.

1. Add `metric_serving_admission_id` to the existing
   `SharedServingRow/V2` payload and remint its payload digest.
2. Carry the same admission ID through the exact-detail row.
3. Create successor internal cohort request, cohort result and Query
   projection records carrying the same admission ID.
4. Include the admission ID in the cohort and release-aware cache identities.
5. Preserve the source-backed value, governed ambiguity class, lawyer warning,
   party, concept, claim, metric and release identities byte-for-byte.
6. Keep every carrier offline and non-activating.

## Task 3: content-addressed candidate manifest

Create `METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST/V1`.

1. Bind the exact F19 predecessor manifest and F22 admission.
2. List the unique sorted metric admission IDs used by the release.
3. Bind one row, exact-detail package, cohort request, cohort result and Query
   projection through content-derived roots.
4. Require exact set equality between manifest admissions and carrier
   admissions.
5. Resolve the admission through the central F22 validator using the manifest
   list.
6. Report release-manifest validation as passed only after the complete
   manifest and bundle close.
7. Retain `NONE` for active release, Query, pointer, corpus-write and
   production authority.

## Task 4: adversarial tests

Prove:

1. the exact bundle and all identities are deterministic;
2. the F22 admission, row, detail, request, result, Query record and manifest
   all carry the same admission ID;
3. omission, forgery, duplication or an extra manifest admission fails;
4. cross-metric, cross-contract, cross-release, cross-interpretation and
   predecessor substitution fail;
5. a re-signed carrier cannot escape its exact predecessor or manifest;
6. another V12 metric remains denied;
7. a malformed sibling carrier is isolated and cannot suppress the valid
   copy-delivery row;
8. legacy V1 through V5 behaviour and the explicit V3 rejection remain
   unchanged;
9. F19 through F22 historical fixtures and IDs remain unchanged; and
10. no active route, flag, pointer or production authority is introduced.

## Task 5: rollback-only staging proof

Use the linked `deal-corpus-canonical-v2-staging` project only.

1. Validate the complete bundle locally before opening a database transaction.
2. Read the active staging pointer once.
3. Open one short transaction with a statement timeout, lock timeout and
   transaction-scoped advisory lock.
4. Create one isolated probe table, revoke public access, enable RLS and insert
   the manifest and its bound carriers in one set-based statement.
5. Prove exact admission equality and bounded counts inside the transaction.
6. Roll back unconditionally.
7. Verify the probe table left no residue and the active pointer is
   byte-identical to the initial pointer.
8. Store only the content-addressed proof fixture, never credentials or
   connection material.

## Task 6: verification and shipment

1. Run the F16 through F23 tests.
2. Run the complete test suite and production build.
3. Run the programme verifier and F23 phase allowlist.
4. Obtain independent architecture and legal-semantic reviews.
5. Commit only F23 files, preserving
   `docs/codex-program/engine-build-map.md` untouched.
6. Push, merge after all checks, deploy `deal-corpus` and smoke-test both
   disabled APIs.
7. Continue directly into F24 no-shop notice and match-period certification.
