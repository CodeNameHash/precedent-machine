# Metric-scoped serving admission F22 implementation plan

## Scope

Implement the non-activating policy seam approved in the F22 design. F22 may
certify the exact V12 copy-delivery metric identity for metric-scoped policy
eligibility. It must not change active validators, a release manifest, a
database, a feature flag or the production release pointer.

## Task 1: phase boundary

Files:

- `.github/phase-allowlists/wp-canonical-metric-serving-admission-f22.json`

Work:

1. Permit only the F22 design, plan, policy module, tests and deterministic
   fixture.
2. Deny active routes, serving validators, database files, release import,
   feature flags and UI files.
3. Add a phase check proving the slice cannot widen accidentally.

## Task 2: immutable admission contract

Files:

- `lib/canonical-v2/metric-serving-admission.js`
- `tests/fixtures/canonical-v2/metric-serving-admission-f22.json`

Work:

1. Define the exact `MetricServingAdmission/V1` field set.
2. Build the sole F22 record from frozen V12, candidate metric-definition,
   F19, F20 and F21 identities.
3. Bind the eight required metric identity fields.
4. Bind certification evidence and explicit non-activation authority.
5. Derive the admission ID and registry ID from canonical bytes.
6. Freeze the complete output.

## Task 3: dual-lane pure validator

File:

- `lib/canonical-v2/metric-serving-admission.js`

Work:

1. Resolve V1 through V5 contracts through the unchanged legacy
   fingerprint-wide lane.
2. Resolve V6 and later contracts only through an exact metric-scoped
   admission.
3. Require the scoped admission ID to be listed in the caller-supplied release
   manifest identity set.
4. Verify the metric definition and required claim exist in the supplied
   contract.
5. Reject unknown fields, wildcards, missing admissions and every identity
   mismatch.
6. Export one pure resolver for later use by Query, projection, release import,
   shared-row and exact-detail validation.
7. Perform no I/O, database work, networking, retries or activation.

## Task 4: adversarial tests

File:

- `tests/canonical-v2-metric-serving-admission-f22.test.js`

Tests:

1. The F22 fixture and IDs are deterministic and immutable.
2. The exact V12 copy-delivery identity resolves through the scoped lane.
3. Every other V12 metric remains denied.
4. V6 through V11 remain denied without their own admission.
5. Contract, metric, version, concept, claim, interpretation, candidate and
   integration substitution each fail.
6. A missing, forged or unlisted admission ID fails.
7. Duplicate or malformed release admission lists fail.
8. The legacy V1 through V5 lane remains unchanged.
9. A legacy contract cannot borrow a scoped admission.
10. The module contains no database, network, retry, release mutation or
    feature-activation path.
11. Current active serving fingerprints remain exactly V1 through V5.
12. Existing active Query and shared-row validators remain byte-identical in
    this slice.

## Task 5: verification and review

1. Run targeted F16 through F22 tests.
2. Run the full test suite.
3. Run the production build.
4. Run the CODEX programme verifier.
5. Run the F22 phase allowlist.
6. Obtain independent architecture and legal-semantic reviews.
7. Fix all blockers and repeat affected checks.

## Task 6: ship

1. Stage only the approved F22 files.
2. Preserve `docs/codex-program/engine-build-map.md` untouched.
3. Commit and push the branch.
4. Open and merge a PR after all CI checks pass.
5. Synchronise local main with origin/main.
6. Verify the Vercel author email and deploy `deal-corpus`.
7. Smoke-test the home page and prove both contained APIs remain disabled.
8. Continue to F23, where active validators and `SharedServingRow/V2` may
   consume the new policy under a separate non-activating release proof.
