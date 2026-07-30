# PM execution ledger

This is the operational control record. It does not amend the architecture.
The governing PM source is [CODEX-PROGRAM.md](../CODEX-PROGRAM.md), with exact
contracts in [canonical-contracts.md](canonical-contracts.md). Process-owned
dependencies follow the approved Process Intelligence execution plan at
`precedent-machine-process-design/docs/superpowers/plans/2026-07-29-process-intelligence-execution-plan.md`,
SHA-256 `a255661cd51ee121b2d66b9691bd7e55dd2bda44d22c074efe8856973f1d49b0`.

`P1` to `P9` below use the PM phases. `P10` and `P11` use the Process plan's
operational labels. PM production authority remains governed by
[PM Phase 9](../CODEX-PROGRAM.md#phase-9-candidate-certification-and-production-release).

## Control rules

- The PM controller owns `main`, the integration queue, deployments and signed
  successor publication.
- Routine branch work, integration, deployment and signed successor
  publication do not require Ben.
- Main stays fixed during a work package. It moves once for the tested batch.
- Commit tests are focused. Work-package tests cover the affected chain. The
  complete suite and build run once on the combined candidate.
- PI handoffs use Stages 1 to 9. Stage 2 is exact-bound Spark review. Stage 3
  disposes findings and escalates legal, security, identity, cross-contract or
  uncertain findings to Sol high or xhigh. Stage 4 is the independent exact-root
  review and never relies on Stage 2.
- Production containment stays active. No extraction, replay, backfill or load
  test runs against production.
- The PM controller updates this file after every signed generation.

Status meanings: `READY` can start; `ACTIVE` is being built; `BLOCKED` lacks a
required input; `REVIEW` awaits a required check; `INTEGRATION` is complete on
a branch and queued; `COMPLETE` has passed its stated completion evidence.

## 1. Current signed state

Checked on 2026-07-30 against the protected ref and a clean detached copy of
exact `origin/main`.

| Item | Exact state |
| --- | --- |
| Signed main | `a3149cfb6434f3166aac2c3bd9631e637d5df8ae` |
| Protected publication | `9552de2185b11d80bd1e2b80757f4f07005c58d1` |
| Generation | `44` |
| Status artefact ID | `864ec7b5ffbc46be61bcf4547b103d747fdb82bb5ac963beaf61bd3ec7a80de9` |
| Official verifier | `PASS` on exact signed main |
| Work classes `PASS` | `specification_review`, `emergency_containment`, `implementation_planning`, `isolation_boundary_setup`, `snapshot_restore_and_preview`, `canonical_work_start` |
| Work classes `OPEN` | `gate_status_bootstrap`, `vertical_slice_execution`, `candidate_scope_and_extraction`, `production_import`, `cutover_authorisation_issue`, `production_cutover`, `programme_complete` |
| Pilot gates | `P1_CONTRACT_FREEZE_ATTESTED: OPEN`; `P1_VERTICAL_SLICE_PASS: OPEN` |
| CI | Run `30528559666`: 4,425 tests, 4,418 pass, 0 fail, 7 skip; build 29/29 pages; 11 invariants pass |
| Signed successor run | `30529231084`: success |
| Production deployment | `dpl_7U2N1eu98tEVmcRQJV2L5FSrWX27`, accepted by Generation 44 signer |
| Isolated Preview deployment | `dpl_2xUyH1Bzx1oX4iPvNNCtWV6KZTze`, accepted by Generation 44 isolation check |
| Active PM work package | `PILOT_FREEZE_AND_VERTICAL_SLICE` |
| Fixed integration basis | Generation 44 tuple above |
| PM milestone branch | `codex/pilot-freeze-milestone-v1` at `7310238` before this ledger update |
| PI Stage 1 branch | `codex/process-exclusivity-predicate-runtime-v2` at `639e1d0c3604273315ee914e7d61374518d9b1f9` |
| Ready integration receipts | PI Stage 1 and P7 are patch-equivalent on the milestone candidate. P7 Stage 2 is bound to PI head `b27368711157982aadff8a5653e66676002a1119`; all Stage 3 findings are closed through `b8606d8`. |

All 24 Phase 9 gates in the signed status remain `OPEN`.

The machine-generated active branch set is:
`codex/process-phrasebook-product-result-set-adapter-contract-v1`,
`codex/pilot-freeze-milestone-v1`,
`codex/pilot-freeze-shared-consumer-v2`,
`codex/pm-integration-window-spark-review-v1`,
`codex/process-bidder-track-event-membership-v1`,
`codex/process-exclusivity-predicate-runtime-v2`,
`codex/process-navigation-catalogue-v2`,
`codex/process-predicate-witness-v2`.
The exact reserved-path set is machine-generated in
`.github/pm-integration/current-state.json`.

## 2. Work underway now

| Unit | Phase | Outcome and owner | Branch and boundary | Class; dependency; evidence | Status; next; Ben |
| --- | --- | --- | --- | --- | --- |
| `PM-LEDGER-01` | control | This ledger. PM controller. | `codex/pilot-freeze-milestone-v1`; this file plus `wp-pm-execution-ledger-v1.json`. | `canonical_work_start`; Generation 44; path, state and line-count checks. | `ACTIVE`; commit to current milestone; no Ben. |
| `PM-FREEZE-ROOT-01` | P1/P8 | Exact bundle compiler, required-kind registry, freeze candidate and pre-review package. PM implementation. | `codex/pilot-freeze-milestone-v1`; exact `canonical-contract-bundle-*` modules, `contracts/canonical-v2/successor/manifest.json`, required-kind registry and focused tests. | `canonical_work_start`; final candidate bytes; two uncached compiles and focused bundle/gate tests. | `ACTIVE`; finish P7 dispositions and P8 controller hardening, then compile twice; no Ben until exact root approval. |
| `PI-PILOT-BATCH-01` | P1/P3/P4/P5 | Metsera Process contracts and pure runtime. Process Intelligence. | PI head `639e1d0c3604273315ee914e7d61374518d9b1f9`; patch-equivalent PM commits are already on the milestone candidate. | `canonical_work_start`; Generation 44; affected Process/Product chain passed after PM manifest reconciliation. | `COMPLETE` on the milestone candidate; retain exact Stage 1 handoff; no Ben. |
| `PI-P7-GENERIC-01` | P7 | Seven generic source, scope, enumeration, graph and validation modules. PI with PM review. | PI head `b27368711157982aadff8a5653e66676002a1119`; patch-equivalent files and accepted corrections are on the milestone candidate through `b8606d8`. | `canonical_work_start`; Stage 2 exact-bound review, Stage 3 disposition and P7 affected chain. | `COMPLETE`; 18/18 combined outcome-interface tests pass; no Ben. |
| `PM-P6-ACCEPTANCE-01` | P6 | Fixture-backed Process research surface and source actions. PM implementation. | `components/process/**`, `pages/query/process/pilot.js`, Process result/filter helpers and focused browser/runtime tests. | `canonical_work_start`; P4/P5; 28 focused/runtime tests and local browser acceptance pass. | `REVIEW`; repeat smoke on exact deployed Preview during Stage 5; no Ben. |
| `PM-P8-REVIEW-CONTROLLER-01` | P8 | Exact-root review-task controller that fails closed without trusted registration. PM controller. | `contract-freeze-review-tasks.js`, its runner, test and exact allowlist. | `canonical_work_start`; final package bytes; focused hostile tests and Stage 3 review. | `COMPLETE` at `19f4c21`; 11 focused hostile tests pass; no Ben. |
| `PM-P8-REVIEW-REGISTRATION-01` | P8 | Protected signed registration for the exact package, three reviewers and authenticated result digests. PM implementation. | Closed registration schema/carrier, trusted key domains, review-task integration and focused tests. | `canonical_work_start`; hardened P8 controller; hostile substitution and signature tests. | `COMPLETE` at `7310238`; 18/18 focused tests pass; no Ben. |
| `PM-METSERA-GOLD-01` | PE1/P8 | Sealed source-only Metsera gold. PM implementation. | Current milestone, commit `9bff4690a67018ecf8bb5f582bc51dc0b5c68336`; `evidence/process-intelligence/metsera-gold/**`. | `canonical_work_start`; independent source evidence; 8/8 focused pass. | `COMPLETE`; keep sealed until Stage 4 comparison; no Ben. |
| `PM-PREFLIGHT-01` | control | Read-only nine-stage integration preflight. PM controller. | Current milestone through `b095d1e6070cfc1038f2246c85e1d1c5251c654c`; `pilot-integration-preflight.*`. | `canonical_work_start`; 20/20 focused pass; independent exact-bound review pass. | `COMPLETE`; run after combined candidate exists; no Ben. |

Current machine blockers are `DEPLOYMENT_METADATA_REQUIRED`,
`FORMAL_FREEZE_COMPILATION_REQUIRED`, `SIGNER_PATH_COVERAGE_REQUIRED` and
`TEST_RECEIPTS_REQUIRED`.
Current PM focused evidence also includes 49/49 predecessor-source-anchor tests
and 8/8 sealed-Metsera-gold tests. These are not Stage 4 or freeze evidence.

## 3. Ordered queue for the next 48 hours

1. Update this ledger and the machine current-state record to the exact
   candidate head.
2. Run the P1 to P7 mechanical closure checks below. Implement only blocking
   gaps.
3. Regenerate the required-kind registry, successor manifest, compiler
   registrations and exact count assertions only if the checks require it.
4. Compile the complete Agreement, shared and Process inputs twice without
   cache. Require identical canonical bytes and fingerprint.
5. Run the affected-chain tests. Then run the complete suite and build once.
6. Run the nine-stage preflight. Close signer coverage, test receipt and exact
   deployment metadata gaps.
7. Move `main` once, deploy the exact commit once to production and isolated
    Preview, and retain containment.
8. `Stage 4`: run architecture/identity, legal-semantic, and query/release
    reviews concurrently at high reasoning against the same exact root.
9. Prepare the one Ben bundle approval package while Stage 4 runs.

## 4. Remaining bounded units through P11

### P0 to P7 build closure

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P0-BASELINE-01` | P0 | Fixed product and Storylines baselines. PM implementation. | Existing `scripts/process-intelligence-baseline.mjs`, its test and two baseline inventories. | `canonical_work_start`; content IDs and disposition completeness. | `COMPLETE` on signed main; no Ben. |
| `P1-PROCESS-SUCCESSOR-02` | P1 | Active Process v2 contracts, witness, relationship, code and navigation. PI. | PI head `639e1d0`; exact Process v2 contracts, validators and 11 allowlists are patch-equivalent on the milestone. | `canonical_work_start`; reconciled manifest and affected contract chain. | `COMPLETE` on the milestone candidate; retain exact Stage 1 evidence; no Ben. |
| `P1-ROOT-CLOSURE-03` | P1 | One fresh manifest and required-kind registry with no legacy duplicates. PM controller. | `contracts/canonical-v2/successor/manifest.json`, `canonical-bundle-input-required-kind-registry.v1.json`, their generators, compiler and tests. | `canonical_work_start`; integrated PI tree; manifest and compiler input checks. | `COMPLETE` on current candidate; rerun uncached at final head; no Ben. |
| `P2-SHARED-VERIFY-01` | P2 | One compatible released shared projection for each promised field. PM implementation. | `shared-authority-consumed-contract-manifest.js`, `process-deal-fact-projection.js`, shared contract inputs and tests. | `canonical_work_start`; P1 root; P2 hostile tests. | `COMPLETE` on current candidate; repeat affected chain at Stage 5; no Ben unless scope is removed. |
| `P3-PROCESS-SEMANTICS-02` | P3 | Complete mandatory exclusivity semantics and stable identities. PI. | Process predicate v2, witness v2, relationship v2, controlled-code v2, pilot and phrasebook modules/tests. | `canonical_work_start`; P1 v2 inputs; P3 hostile tests and Metsera sidecar fixture. | `COMPLETE` on current candidate; repeat affected chain at Stage 5; no Ben. |
| `P4-QUERY-NAV-02` | P4 | All 41 predicates have admitted Ask and Browse paths with byte-identical Product Query IR. PI with PM integration. | Process navigation v2 and existing Product field, navigation, Ask, Browse and Query modules/tests. | `canonical_work_start`; P1/P2; acceptance tests 1-25 and 54-64. | `COMPLETE` on current candidate; repeat affected chain at Stage 5; no Ben. |
| `P5-RESULTS-02` | P5 | Ordered Process results, typed failures, source actions and presentation handoff. PI with PM integration. | `process-phrasebook-product-result-set-bridge.js`, Product result/presentation/source modules and exact tests. | `canonical_work_start`; P3/P4; acceptance tests 26-48, 69, 70 and 74-76. | `COMPLETE` on current candidate; repeat affected chain at Stage 5; no Ben. |
| `P6-INTERFACE-01` | P6 | Fixture-backed Query, Review, Compare, Corpus Context and source reading. PM implementation. | `components/process/**`, `pages/query/process/pilot.js`, Process research helpers and browser/runtime tests. | `canonical_work_start`; P4/P5; 28 focused/runtime tests and local desktop/mobile browser acceptance pass. | `REVIEW`; run exact deployed-Preview smoke at Stage 5; no Ben. |
| `P7-GENERIC-MACHINERY-01` | P7 | Generic acquisition, completeness, three enumerators, candidate graph and validator. PI with PM review. | Exact seven `process-{source-acquisition,sec-completeness-oracle,scope-enumerator,semantic-enumerator,lexical-enumerator,candidate-graph,candidate-validator}.js` modules, allowlists and tests. | `canonical_work_start`; P1/P3; Stage 2 bound to `b273687`; synthetic and hostile-source tests only. | `COMPLETE` through `08e3158`; the semantic-outcome and empty lexical-observation findings are closed; no Ben. |

### P8 freeze and bounded pilots

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P8-INTEGRATION-01` | P8 | One combined, deployable milestone commit. PM controller. | `codex/pilot-freeze-milestone-v1`; exact union of accepted allowlists in `.github/phase-allowlists/`. | `canonical_work_start`; P1-P7 closure; Stage 2/3 records, full suite, build and preflight. | `ACTIVE`; close P7/P8 findings and Stage 5 evidence; no Ben. |
| `P8-BUNDLE-02` | P8 | Deterministic Agreement, shared and Process root. PM implementation. | `canonical-contract-bundle-{compiler,freeze-candidate-assembler,pre-review-package-assembler}.js`, required-kind registry, manifest and tests. | `canonical_work_start`; P8 candidate; two identical uncached compiles and zero structural defects. | `ACTIVE`; compile at final clean head; no Ben. |
| `P8-REVIEWS-03` | P8 | Three independent reviews of exact bytes. Independent reviewer. | `contract-freeze-review-tasks.js`, `run-p1-contract-freeze-reviews.mjs`, immutable external result files and exact package fingerprint. | `canonical_work_start`; P8 bundle; Stage 4 architecture/identity, legal-semantic and query/release reviews at high. | `ACTIVE`; harden controller, then run concurrently after fingerprint exists; no Ben. |
| `P8-BEN-FREEZE-04` | P8 | Approval of exact bundle and fingerprint. Ben. | External approval record bound to the pre-review package, review results and exact Git commit. | Reserved Ben decision; P8 reviews all pass. | `BLOCKED`; ask once when package is complete; **Ben required**. |
| `P8-ATTEST-05` | P8 | `P1_CONTRACT_FREEZE_ATTESTED: PASS` and `vertical_slice_execution: PASS`. PM controller. | `contract-freeze-contracts.js`, gate registry/predicates, `sign-g0-evidence.mjs` and protected publication. | Status publisher authority; exact Ben approval; official verifier. | `BLOCKED`; sign and publish after approval; no further Ben. |
| `P8-QXO-SLICE-06` | P8 | QXO Agreement control slice through all required staging outputs. PM implementation. | `canonical-v2-staging-qxo-capitalisation-f28.mjs`, QXO F28 fixture/runtime and cross-view tests. | `vertical_slice_execution`; P8 attestation; isolated staging only. | `BLOCKED`; execute after verifier passes; no Ben. |
| `P8-METSERA-SLICE-07` | P8 | Metsera Process slice through the same staging outputs and failure isolation. PI with PM controller. | `evidence/process-intelligence/metsera-gold/**`, Process pilot/result sidecars, canonical writer, candidate release and Product tests. | `vertical_slice_execution`; QXO control and sealed comparison; isolated staging only. | `BLOCKED`; execute after QXO control; no Ben. |
| `P8-VERTICAL-PASS-08` | P8 | `P1_VERTICAL_SLICE_PASS`, `PROCESS_VERTICAL_SLICE_PASS` and `candidate_scope_and_extraction: PASS`. PM controller. | Signed evidence and protected status. | Both slices pass; official verifier. | `BLOCKED`; publish exact successor; no Ben unless a material contract changes. |

### P9 certification

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P9-SCOPE-REGISTRY-01` | P9 | Exact scope and final disposition for all registry, residual and novel-candidate members. PM implementation. | Existing candidate manifest/compiler modules; new staging evidence paths are `NEEDS_MECHANICAL_CHECK` before this phase starts. | `candidate_scope_and_extraction`; P8 pass; `P9_SCOPE_EXACT`, `P9_REGISTRY_DISPOSITIONS`. | `BLOCKED`; reserve exact future allowlist before staged scope; no Ben for reviewed existing codes. |
| `P9-METSERA-CERT-02` | P9 | One sealed Metsera extraction and product certification. PI. | `evidence/process-intelligence/metsera-gold/**`; future staging receipts are external and content-addressed. | `candidate_scope_and_extraction`; P8 pass; all mandatory predicate/action tests. | `BLOCKED`; compare once to sealed gold; no Ben. |
| `P9-STRATIFIED-03` | P9 | Pre-registered 25-deal tuning and untouched holdout result. PI with reviewer. | Future staging-only release and certification paths are `NEEDS_MECHANICAL_CHECK`; no production path is allowed. | `candidate_scope_and_extraction`; Metsera pass; no failed-holdout repair or rerun. | `BLOCKED`; reserve exact future allowlist before cohort selection; Ben only for material taxonomy. |
| `P9-MARKET-NUMERIC-04` | P9 | MKT-1/2/3, canonical numeric backfill and comparable market projection. PM implementation. | Existing normalisers and market projection modules; staging migration path is `NEEDS_MECHANICAL_CHECK`. | `candidate_scope_and_extraction`; certified candidate; `P9_MKT_WORK`, `P9_NUMERIC`. | `BLOCKED`; reserve exact staging-only migration boundary; no Ben. |
| `P9-SEMANTIC-QUALITY-05` | P9 | Structured claims, party lint, shadow runs, stable identity and zero drift. PM implementation and reviewer. | Future extraction receipts, residual roots and certification matrix are external or `NEEDS_MECHANICAL_CHECK`. | `candidate_scope_and_extraction`; full-corpus staging; four named P9 gates. | `BLOCKED`; reserve exact future evidence paths before execution; no Ben unless taxonomy changes. |
| `P9-RENDER-ACCEPT-06` | P9 | Render parity and full browser, accessibility and performance acceptance. PM implementation. | Existing shared row consumers, `components/process/**`, Product components and browser suites. | Certified candidate; `P9_RENDER_PARITY`, `P9_BROWSER_A11Y_PERFORMANCE`. | `BLOCKED`; test all five surfaces against one release; no Ben. |
| `P9-TRACE-RUNBOOK-07` | P9 | Complete traceability and every outstanding Ben runbook item. PM controller. | Traceability output and non-secret runbook evidence paths are `NEEDS_MECHANICAL_CHECK`; signed evidence is external. | All candidate proofs; `P9_BEN_RUNBOOK`, `P9_PREIMPORT_TRACEABILITY`, `P9_TRACEABILITY`. | `BLOCKED`; reserve exact future output paths; Ben only for an expressly reserved runbook act. |

### P10 performance, security and inactive release

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P10-SECURITY-01` | P10 | Action-level auth, client-auth decision, containment and whole-tuple revocation. PM implementation. | Existing routes, `security-disposition-*`, auth tests and future exact auth-matrix evidence. | `candidate_scope_and_extraction`; P9 candidate; `P9_SECURITY_AUTH`. | `BLOCKED`; reserve exact auth evidence path and test in staging; **Ben only for a material governance decision**. |
| `P10-LOAD-02` | P10 | Fixed latency/capacity, one admission check, one bounded serving query and no corpus-proportional calls. PM implementation. | Future staging projection/RPC/cache/load harness paths are `NEEDS_MECHANICAL_CHECK`. | Certified projection; `P9_DATABASE_SOAK`; 60-connection Micro soak. | `BLOCKED`; reserve exact staging-only load boundary; no Ben. |
| `P10-ROLLBACK-03` | P10 | Backup restoration, active-corpus rollback, staging smoke and recovery rehearsals. PM controller. | Existing `candidate-release-import.js` and rollback SQL patterns; rehearsal evidence is external. | P9 candidate; `P9_STAGING_SMOKE_AND_ROLLBACK`, `P9_BACKUP_RESTORE`. | `BLOCKED`; reserve exact staging scripts and receipts; no Ben. |
| `P10-INACTIVE-RELEASE-04` | P10 | One inactive whole Agreement and Process release with complete parity. PM controller. | `candidate-release.js`, `candidate-release-import.js`, inactive namespace SQL and external deployment manifest. | P9/P10 proofs; three named parity gates. | `BLOCKED`; reserve exact inactive-import boundary and certify tuple; **Ben where the contract requires it**. |

### P11 import and activation

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P11-IMPORT-01` | P11 | Import exact certified bundle into an inactive production namespace. PM controller. | `candidate-release-import.js`, governed import SQL and external import attestation; final exact paths require the P10 manifest. | `production_import`; P10 inactive release; import parity and resumability tests. | `BLOCKED`; obtain any required approval, then import inactive only; **Ben where required**. |
| `P11-CUTOVER-AUTH-02` | P11 | Exact one-use cutover authorisation. Ben. | External cutover approval bound to protected status, certified tuple and rollback target. | `cutover_authorisation_issue`; every Phase 9 pre-cutover gate green. | `BLOCKED`; present exact tuple and rollback target; **Ben required**. |
| `P11-ACTIVATE-03` | P11 | Atomic whole-tuple activation with reversible feature flag. PM controller. | Existing active-release fingerprint runner; final pointer/RPC path is `NEEDS_MECHANICAL_CHECK` from the certified manifest. | `production_cutover`; P11 authorisation; no partial activation. | `BLOCKED`; reserve exact activation boundary, then activate once; no extra Ben. |
| `P11-SMOKE-04` | P11 | Live production smoke, rollback on mismatch and completion attestation. PM controller and independent reviewer. | Production smoke and rollback receipts are external; exact test paths come from the certified deployment manifest. | Exact active tuple; two named P9 gates; official verifier. | `BLOCKED`; smoke every surface and roll back on mismatch; no Ben unless rollback requires a reserved act. |

## 5. Critical path

Generation 44 fixed basis → PI Stage 2/3 → one combined integration candidate →
P1 root closure → P2-P7 mechanical closure → two identical bundle compiles →
Stage 4 exact-root reviews → one Ben bundle approval → freeze attestation and
`vertical_slice_execution: PASS` → QXO control slice → Metsera Process slice →
`candidate_scope_and_extraction: PASS` → Metsera and stratified certification →
full-corpus certification → security, soak and rollback proofs → inactive
production import → one-use Ben cutover authorisation → atomic activation →
post-cutover smoke → programme completion.

## 6. Exact P1-P7 closure before P8

1. **P1:** the complete Process input set, Agreement inputs and shared inputs
   compile without deal data. Two clean compiles match. Missing, extra,
   duplicate, reordered or unknown members fail. Frozen V1-V12 fixture
   fingerprints do not drift.
2. **P2:** every promised shared field has one compatible released projection
   or is expressly removed before freeze. Shared roles, structures, legs,
   control, consideration and professional assignments pass hostile
   cross-component tests.
3. **P3:** every mandatory exclusivity question has one complete semantic
   contract. Identity excludes extracted values. Requests, refusals,
   counterproposals, conditional responses, grants and endings cannot collapse.
4. **P4:** one PM-wide field catalogue, navigation catalogue and Product Query
   IR pass acceptance tests 1-25 and 54-64 against one catalogue digest and
   approved data version. Ask and Browse are byte-equivalent for the same legal
   meaning.
5. **P5:** exact passages, citations, ordering, context, related drafting,
   failures and coverage pass acceptance tests 26-48, 69, 70, 74, 75 and 76.
6. **P6:** the live PM entry point and all required desktop/mobile outputs pass
   acceptance tests 49-53 and 65-73. Query, Review, Compare, Corpus Context and
   source reading use the same facts and actions.
7. **P7:** all seven generic acquisition and extraction modules pass synthetic
   and hostile-source tests. No public-deal extraction runs while
   `candidate_scope_and_extraction` is `OPEN`.

P8 cannot start its freeze review until every item above is mechanically green.

## 7. Ben approval points

Ben is asked only for:

1. approval of the exact material contract bundle and its fingerprint;
2. a material governance, taxonomy or codebook change;
3. production import or activation where the governing contract requires Ben;
4. the exact one-use production cutover authorisation.

No routine branch, test, integration, deployment, status refresh or signed
successor needs Ben.

## 8. Mechanical uncertainty register

| Fact not yet proved | Required exact check | Owner |
| --- | --- | --- |
| P6 exact deployed Preview behaviour. | After the final candidate deployment, repeat the desktop/mobile/reflow, filter, source, context and related-drafting smoke on that exact deployment ID. | PM implementation |
| P7 rejection and residual interfaces. | `b8606d8` closes the interfaces; retain the 18/18 affected-chain receipt for final Stage 5 evidence. | PM controller |
| Final successor member count and kind count. | Regenerate required-kind registry and manifest from the combined tree, then run both generators with `--check`. | PM controller |
| Final missing, duplicate, conflict, cycle and residual counts. | Run the actual input compiler and bundle compiler twice on the combined tree. Require zero for each count and identical bytes. | PM controller |
| Final P8 protected review registration. | Validate one signed registration and three signed controller/result records against the exact package, reviewers, sessions, ancestry and result digests. | PM controller |
| Combined Stage 5 full-suite and build result. | Run `npm test` and `npm run build` once after all accepted units and manifest repairs are present. | PM controller |
| Exact final deployment IDs. | Inspect the two Vercel deployments for the final candidate commit before signed publication. | PM controller |
