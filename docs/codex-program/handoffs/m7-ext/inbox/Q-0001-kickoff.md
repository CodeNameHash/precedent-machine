id: Q-0001
from: ext
to: lead
date: 2026-09-03
re: kickoff
status: OPEN

# Kickoff: pin checks, assumptions, and questions

Read `PROTOCOL.md` and `PINS.md` on `coord/m7-ext`, then the reading list in `PINS.md`. Created three `ext/*` branches from the pinned base and wrote `status/` for each. Work 7 implementation starts now. Answers that do not gate Work 7 are not blockers.

## Pin checks (every PINS.md fact, verified on `origin/codex/recover-m7-20260812` at `b11388ab`)

Commands used: `git rev-parse origin/codex/recover-m7-20260812`, `git cat-file -e`, `python3` SHA-256 of `git show` bytes, and JSON field reads. All held.

| pin | observed |
|---|---|
| Base commit | `b11388ab7c9605b1df872b1c6cd2e927d1a2dbab` `Implement M7 V2 repair Work 4`. Matches `origin/codex/recover-m7-20260812`. |
| Registration ID | `0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e` |
| Registration file | path exists; 27802 bytes; SHA-256 `880e26ee5f6826b8db49b947ef45b3797d0e01324803efa5f508087a0ed414d6` |
| `lifecycle_state` | `CANDIDATE_PENDING_REVIEW` |
| Counts | `code_file_count` 16, `runner_count` 3, `test_count` 8, `semantic_input_count` 6, `subtype_tree_count` 24, `predecessor_receipt_count` 3, `unique_bound_path_count` 53 |
| Unique bound paths | 53 extracted from `path` plus subtype-tree `container_path` (listed below) |
| Work 4 execution manifest ID | `fbe1f1b97cc38f1f5992ae02e7d8fc77f8c3f64145bd5e89aa643fce65d0df44` |
| Work 4 transition authority | file exists at the pinned path |
| Work 4 receipt | `work4_receipt_id` `1a642cd12b2fc0c2dac767c7c1ac5615d6c2d9ad19ec5c3a33e5bde1b9ced02d`; 4311 bytes; SHA-256 `d43912a45c999cd22ee99feedf6adac94f948dc562a957e9d24fadc727f49eb8` |
| Work 4 finaliser and validator | both files exist on the base commit |
| Predecessor receipts | Work 0 evidence-root, activation, Work 1, Work 2, Work 3, Work 4 fixture all present |
| Parent authority | `control/m7-v2-repair-work1-7-authority.json` present and bound |

The WIP note's later amendment (base tip moved off `99d9e952`) is already closed by the Work 4 commit itself. `DECISIONS.md` option (b) for the manifest-validator Git seam is Lead work, not this team.

## 53 candidate-bound paths (read-only for every ext branch)

```
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-structure-disposition-set.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-packet-set.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-antitrust-regulatory.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-appraisal-dissenters-rights-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-closing-conditions.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-consideration-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dividends-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dno-indemnification-item-42-successor-2026-09-01.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-employee-matters.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-financing-covenants-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-general-covenants.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-guaranty-financing-party-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-interim-operating-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-key-defined-terms.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-mae-definition-grouping-successor-2026-09-01B.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-material-contracts.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-merger-structure-closing.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-misc-boilerplate.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-other-reps-fraud.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-no-shop.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-proxy-meeting.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-representations.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-specific-performance-remedies.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-tax-matters.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-termination-fee.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-termination.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json
evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-context-compilation-set.json
evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/v2-view-policy.json
evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json
evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json
evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json
evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json
evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json
lib/canonical-v2/agreement-analysis-consolidation.js
lib/canonical-v2/agreement-projection.js
lib/canonical-v2/m7-v2-contract.js
lib/canonical-v2/m7-v2-deterministic-generator.js
scripts/stage-2y-structure-family-aggregate.mjs
scripts/stage-2y-structure-generalisation-shadow.mjs
scripts/stage-2y-structure-m6-project.mjs
scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs
tests/stage-2y-structure-m7-v2-repair-contract.test.js
tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js
tests/stage-2y-structure-m7-v2-repair-projection-dispatch.test.js
tests/stage-2y-structure-m7-v2-repair-registration.test.js
tests/stage-2y-structure-m7-v2-repair-work2.test.js
tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js
tests/stage-2y-structure-m7-v2-repair-work3.test.js
tests/stage-2y-structure-m7-v2-repair-work4.test.js
```

## Assumptions I am proceeding on

1. The Work 7 deliverable is a new script, `scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs`. It is not a rewrite of the already-bound `scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs`. That bound file stays read-only and is re-hashed, not imported.
2. The only shared import allowed from the thing being verified is `lib/canonical-v2/canonical-bytes.js` (`canonicalJson`, `sha256Hex`, `contentId`). Small helpers such as Git blob OID (`sha1("blob {n}\\0" + bytes)`) and path safety will be copied into the Work 7 script and named as copies in the header.
3. The six semantic input sets are the six `semantic_input_bindings` in the registration: base analysis, agreement index, context compilation, approved family packet set, approved family profile set, approved structure disposition set.
4. "Recompute from their sources where a source exists" means: extract a member from a sealed container (for example a subtype tree from its family-profile package) or rebuild a set from sealed member records. It does not mean re-running the Work 2 compiler or Work 3 authoring producers. Where no independent source exists outside the bound file itself, the result records `NO_INDEPENDENT_SOURCE` and still checks the bound file's path / length / SHA-256 / Git blob OID against the registration.
5. The predecessor chain is Work 0 evidence-root → activation → Work 1 → Work 2 → Work 3 → Work 4. The Work 4 receipt is checked even though it is not one of the 53 candidate-bound paths. Identity is `contentId(schema, unsigned_record)` as in `scripts/stage-2y-structure-m7-v2-repair-work4-validate.mjs` lines 172–177.
6. Result schema version will be `STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1`. Tell me if Lead already reserved a different name.
7. Work 6 sealed sets are the three comparison-entry-correction ledgers named in the 2026-08-14 adversarial review (see question 1). I will bind those digests and will not invent a set.
8. Work 6 output root is `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6/`. Work 5 output root is `…/m7-v2-repair/work5/`.
9. Draft PR CI will be red on phase-allowlist and phase-1 inventory until Lead integrates. I will not edit those files.
10. I will not wait for this Q to start the Work 7 verifier. I will wait for question 1 before writing Work 6 scripts.

## Questions

1. Confirm the Work 6 sealed sources. I found, on the pinned base:

   - 244: `evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/known-loss-244-ledger.json` (231047 bytes, SHA-256 `521dfec7073a5d0b3d86d239a4b92906ec4836f0fd1b29f4e0606d1dd9e390be`, 244/244 verified-fixed)
   - 69: `…/red-hat-69-ledger.json` (72309 bytes, SHA-256 `66f171464f154d6d7ac9126e85914c819a70d71fb7cd673db8c94ee958fd8a2d`, 69 members, one still `RESIDUAL_QUOTE_UNVERIFIED`)
   - 23: `…/m2-inline-23-ledger.json` (19265 bytes, SHA-256 `cd4cca768ffe4f371d8b68824cb3f179b38ca727f7a75694e6c2690b81348793`, 23 members, `dependent_propositions_blocked: 0`)

   Are these the sets to bind? A second 244-count file exists (`evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json`) and I will ignore it unless you say otherwise.

2. Assumption 4 on independent recomputation: accept, or do you want the Work 7 verifier to re-execute a named producer for any of the six sets?

3. Assumption 6 on the Work 7 result schema name: accept `STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1`?

4. Should the Work 7 verifier take the registration ID as a CLI argument, or discover the single registration file under `control/m7-v2-repair-candidate-registrations/` and refuse if more than one is present?
