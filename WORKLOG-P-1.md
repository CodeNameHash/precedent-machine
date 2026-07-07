# WP-MASTER-V1 Phase -1 Worklog

## Files added
- .github/phase-allowlists/phase-0.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-0-A.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-0.5.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-1.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-2.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-3.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-4.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-4.5.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-4.6.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-5.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-6.json: downstream phase allowlist from Appendix F.
- .github/phase-allowlists/phase-7.json: downstream phase allowlist from Appendix F.
- docs/acks/ACK-MASTER-V1.reference.md: reference ACK block with pinned straitjacket SHA256.
- scripts/audit/ioc-scope-mismatch.js: invariant 2 harness.
- scripts/lint/closing-condition-scope.js: invariant 3 harness.
- scripts/lint/forbidden-patterns.sh: invariant 4 grep harness.
- scripts/lint/market-registry-completeness.js: invariant 5 harness.
- scripts/lint/component-reuse.js: invariant 6 harness.
- scripts/lint/party-scope-audit.js: invariant 7 harness.
- scripts/registry/dedupe.js: Phase 0-A dedupe skeleton.
- scripts/registry/detect-duplicates.js: invariant 8 harness.
- scripts/registry/orphan-detector.js: invariant 9 harness.
- scripts/registry/coverage-detector.js: invariant 10 harness.
- scripts/registry/provenance-log.js: invariant 11 harness.
- scripts/ci/detect-phase.js: CI phase detector.
- scripts/ci/check-allowlist.js: CI diff allowlist checker.
- scripts/ci/run-all-invariants.sh: local invariant runner.
- tests/lint/phase-minus-one.spec.js: Phase -1 blocking tests.
- tests/ci/detect-phase.spec.js: phase detector tests.
- tests/ci/check-allowlist.spec.js: allowlist checker tests.

## Files modified
- .github/workflows/ci.yml: added invariant and phase-allowlist jobs.
- package.json: expanded test script to include nested test/spec files.

## Files deleted
- NONE

## Deviations from brief
- NONE

## Model check
CODEX_MODEL_UNCHANGED: TRUE

## Test check
TESTS_ADDED: 3
TESTS_SKIPPED: 0
TESTS_ONLY: 0

## Files touched
FILES_TOUCHED:
.github/workflows/ci.yml
.github/phase-allowlists/phase-0.json
.github/phase-allowlists/phase-0-A.json
.github/phase-allowlists/phase-0.5.json
.github/phase-allowlists/phase-1.json
.github/phase-allowlists/phase-2.json
.github/phase-allowlists/phase-3.json
.github/phase-allowlists/phase-4.json
.github/phase-allowlists/phase-4.5.json
.github/phase-allowlists/phase-4.6.json
.github/phase-allowlists/phase-5.json
.github/phase-allowlists/phase-6.json
.github/phase-allowlists/phase-7.json
docs/acks/ACK-MASTER-V1.reference.md
scripts/audit/ioc-scope-mismatch.js
scripts/lint/closing-condition-scope.js
scripts/lint/forbidden-patterns.sh
scripts/lint/market-registry-completeness.js
scripts/lint/component-reuse.js
scripts/lint/party-scope-audit.js
scripts/registry/dedupe.js
scripts/registry/detect-duplicates.js
scripts/registry/orphan-detector.js
scripts/registry/coverage-detector.js
scripts/registry/provenance-log.js
scripts/ci/detect-phase.js
scripts/ci/check-allowlist.js
scripts/ci/run-all-invariants.sh
tests/lint/phase-minus-one.spec.js
tests/ci/detect-phase.spec.js
tests/ci/check-allowlist.spec.js
WORKLOG-P-1.md
package.json
FILES_OUTSIDE_ALLOWLIST:

## Cross-cutting invariants (Appendix E)
CROSS_CUTTING_INVARIANTS_PASS:
1. npm run test: PASS
2. ioc-scope-mismatch.js: PASS
3. closing-condition-scope.js: PASS
4. forbidden-patterns.sh: PASS
5. market-registry-completeness.js: PASS
6. component-reuse.js: PASS
7. party-scope-audit.js: PASS
8. detect-duplicates.js: PASS
9. orphan-detector.js: PASS
10. coverage-detector.js: PASS
11. provenance-log.js: PASS

## ACK
ACK_MASTER_V1_SHA256: 6087c7a6eb6c4457fc4e516f4e9635e9f278799a5db7e261d1f6fb1f599c0b16
PM_MASTER_STRAITJACKET_SHA256: b4c43943482402143c51a6225d92d3a70164e13976b98a9aa4cd345d1942f329

## Reprocess (if applicable to this phase)
REPROCESS_LOG: NONE

## Reviewer TODO
- Enable required-status-check on main for test-and-build, invariants, and phase-allowlist after this phase merges.
