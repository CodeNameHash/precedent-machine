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
| PM milestone branch | `codex/pilot-freeze-milestone-v1` at `b095d1e6070cfc1038f2246c85e1d1c5251c654c` before this ledger commit |
| PI Stage 1 branch | `codex/process-exclusivity-predicate-runtime-v2` at `639e1d0c3604273315ee914e7d61374518d9b1f9` |
| Ready integration receipts | None yet. PI Stage 1 is submitted, but Stage 2/3 and the combined test receipt are not complete. |

All 24 Phase 9 gates in the signed status remain `OPEN`.

The machine-generated active branch set is:
`codex/process-phrasebook-product-result-set-adapter-contract-v1`,
`codex/pilot-freeze-milestone-v1`,
`codex/pilot-freeze-shared-consumer-v2`,
`codex/pm-integration-window-spark-review-v1`,
`codex/process-bidder-track-event-membership-v1`,
`codex/process-controlled-code-registry-contract-v1`,
`codex/process-event-slot-binding-contract-v1`,
`codex/process-exclusivity-challenge-validation-v1`,
`codex/process-exclusivity-pilot-v1`,
`codex/process-exclusivity-predicate-catalogue-v2`,
`codex/process-exclusivity-predicate-runtime-v2`,
`codex/process-navigation-catalogue-v2`,
`codex/process-phrasebook-product-result-set-bridge-v1`, and
`codex/process-predicate-witness-v2`.
The exact reserved-path set is machine-generated in
`.github/pm-integration/current-state.json`.

## 2. Work underway now

| Unit | Phase | Outcome and owner | Branch and boundary | Class; dependency; evidence | Status; next; Ben |
| --- | --- | --- | --- | --- | --- |
| `PM-LEDGER-01` | control | This ledger. PM controller. | `codex/pilot-freeze-milestone-v1`; this file plus `wp-pm-execution-ledger-v1.json`. | `canonical_work_start`; Generation 44; path, state and line-count checks. | `ACTIVE`; commit to current milestone; no Ben. |
| `PM-FREEZE-ROOT-01` | P1/P8 | Exact bundle compiler, required-kind registry, freeze candidate and pre-review package. PM implementation. | `codex/pilot-freeze-milestone-v1`; boundaries are the `wp-canonical-*`, `wp-contract-*` and `wp-pilot-freeze-*` allowlists. | `canonical_work_start`; final PI bytes; focused bundle and gate tests. | `ACTIVE`; integrate PI, regenerate roots, compile twice; no Ben until exact root approval. |
| `PI-PILOT-BATCH-01` | P1/P3/P4/P5 | Metsera Process contracts and pure runtime. Process Intelligence. | `codex/process-exclusivity-predicate-runtime-v2` at `639e1d0c3604273315ee914e7d61374518d9b1f9`; exact union of its 11 `wp-process-*` allowlists. | `canonical_work_start`; Generation 44; Stage 1 reports 220/225, with five PM manifest failures. | `INTEGRATION`; PM runs Stage 2 then integrates ordered commits; no Ben. |
| `PM-METSERA-GOLD-01` | PE1/P8 | Sealed source-only Metsera gold. PM implementation. | Current milestone, commit `9bff4690a67018ecf8bb5f582bc51dc0b5c68336`; `evidence/process-intelligence/metsera-gold/**`. | `canonical_work_start`; independent source evidence; 8/8 focused pass. | `COMPLETE`; keep sealed until Stage 4 comparison; no Ben. |
| `PM-PREFLIGHT-01` | control | Read-only nine-stage integration preflight. PM controller. | Current milestone through `b095d1e6070cfc1038f2246c85e1d1c5251c654c`; `pilot-integration-preflight.*`. | `canonical_work_start`; 20/20 focused pass; independent exact-bound review pass. | `COMPLETE`; run after combined candidate exists; no Ben. |

Current machine blockers are
`DEPLOYMENT_METADATA_REQUIRED`, `FORMAL_FREEZE_COMPILATION_REQUIRED`,
`REQUIRED_KIND_REGISTRY_REQUIRED`, `SIGNER_PATH_COVERAGE_REQUIRED`,
`SUCCESSOR_MANIFEST_STALE` and `TEST_RECEIPTS_REQUIRED`.
Current PM focused evidence also includes 49/49 predecessor-source-anchor tests
and 8/8 sealed-Metsera-gold tests. These are not Stage 4 or freeze evidence.

## 3. Ordered queue for the next 48 hours

1. `Stage 1`: accept PI head `639e1d0` and record its 21 ordered commits.
2. `Stage 2`: run Spark medium once for each exact PI bounded unit without a
   valid supplied Spark review.
3. `Stage 3`: disposition every finding. Escalate only the required finding
   classes to Sol high or xhigh.
4. Integrate the PI commits once in the supplied order. Collapse
   patch-equivalent PM evidence commits. Do not duplicate them.
5. Regenerate the required-kind registry, successor manifest, compiler
   registrations and exact count assertions.
6. Run the P1 to P7 mechanical closure checks below. Implement only blocking
   gaps.
7. Compile the complete Agreement, shared and Process inputs twice without
   cache. Require identical canonical bytes and fingerprint.
8. Run the affected-chain tests. Then run the complete suite and build once.
9. Run the nine-stage preflight. Close signer coverage, test receipt and exact
   deployment metadata gaps.
10. Move `main` once, deploy the exact commit once to production and isolated
    Preview, and retain containment.
11. `Stage 4`: run architecture/identity, legal-semantic, and query/release
    reviews concurrently at high reasoning against the same exact root.
12. Prepare the one Ben bundle approval package while Stage 4 runs.

## 4. Remaining bounded units through P11

### P0 to P7 build closure

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P0-BASELINE-01` | P0 | Fixed product and Storylines baselines. PM implementation. | Existing `scripts/process-intelligence-baseline.mjs`, its test and two baseline inventories. | `canonical_work_start`; content IDs and disposition completeness. | `COMPLETE` on signed main; no Ben. |
| `P1-PROCESS-SUCCESSOR-02` | P1 | Active Process v2 contracts, witness, relationship, code and navigation. PI. | PI Stage 1 head and exact allowlists above. | `canonical_work_start`; PM manifest closure; affected contract chain. | `INTEGRATION`; Stage 2 and Stage 3; no Ben. |
| `P1-ROOT-CLOSURE-03` | P1 | One fresh manifest and required-kind registry with no legacy duplicates. PM controller. | `contracts/canonical-v2/successor/manifest.json`, required-kind registry, generators, compiler registrations and count tests. | `canonical_work_start`; integrated PI tree; manifest check and compiler input tests. | `BLOCKED` by PI integration; regenerate after cherry-picks; no Ben. |
| `P2-SHARED-VERIFY-01` | P2 | One compatible released shared projection for each promised field. PM implementation. | Existing shared contracts, `shared-authority-consumed-contract-manifest.js`, `process-deal-fact-projection.js` and tests. | `canonical_work_start`; P1 root; all P2 hostile tests. | `REVIEW`; run exact field and projection reconciliation on combined tree; no Ben unless scope is removed. |
| `P3-PROCESS-SEMANTICS-02` | P3 | Complete mandatory exclusivity semantics and stable identities. PI. | PI Stage 1 runtime and contract paths. | `canonical_work_start`; P1 v2 inputs; P3 hostile tests and Metsera sidecar fixture. | `INTEGRATION`; Stage 2 and Stage 3; no Ben. |
| `P4-QUERY-NAV-02` | P4 | All 41 predicates have admitted Ask and Browse paths with byte-identical Product Query IR. PI with PM integration. | PI navigation v2 paths; existing Product field, navigation, Ask, Browse and Query modules. | `canonical_work_start`; P1/P2; acceptance tests 1-25 and 54-64. | `INTEGRATION`; update PM catalogue roots and run chain; no Ben. |
| `P5-RESULTS-02` | P5 | Ordered Process results, typed failures, source actions and presentation handoff. PI with PM integration. | `process-phrasebook-product-result-set-bridge.js` and exact tests, plus existing Product result and presentation compilers. | `canonical_work_start`; P3/P4; acceptance tests 26-48, 69, 70, 74-76. | `INTEGRATION`; run combined result/source chain; no Ben. |
| `P6-INTERFACE-01` | P6 | Required fixture-backed PM outputs for Query, Review, Compare, Corpus Context and source reading. PM implementation. | Process plan names `components/process/**`, `pages/index.js`, `components/query/QueryLaunchBox.jsx` and browser tests. | `canonical_work_start`; P4/P5; acceptance tests 49-53 and 65-73. | `BLOCKED`; `NEEDS_MECHANICAL_CHECK`: compare existing Product/QXO cross-view components with every P6 acceptance test before adding any absent component; no Ben. |
| `P7-GENERIC-MACHINERY-01` | P7 | Generic acquisition, completeness, three enumerators, candidate graph and validator. PI. | Exact seven `lib/canonical-v2/process-{source-acquisition,sec-completeness-oracle,scope-enumerator,semantic-enumerator,lexical-enumerator,candidate-graph,candidate-validator}.js` files and focused tests. | `canonical_work_start`; P1/P3; synthetic and hostile-source tests only. | `BLOCKED`; files are absent on signed main. PI must implement without public-deal execution; no Ben. |

### P8 freeze and bounded pilots

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P8-INTEGRATION-01` | P8 | One combined, deployable milestone commit. PM controller. | `codex/pilot-freeze-milestone-v1`; exact union of accepted allowlists. | `canonical_work_start`; P1-P7 closure; Stage 2/3 records, full suite, build and preflight. | `BLOCKED`; complete P6/P7 and root closure; no Ben. |
| `P8-BUNDLE-02` | P8 | Deterministic Agreement, shared and Process root. PM implementation. | Bundle compiler, freeze candidate, pre-review package and required registries. | `canonical_work_start`; P8 integration; two clean identical compiles, zero missing/extra/duplicate/conflict/cycle/unresolved residual. | `BLOCKED`; compile after final manifest; no Ben. |
| `P8-REVIEWS-03` | P8 | Three independent reviews of exact bytes. Independent reviewer. | Immutable review package for exact fingerprint. | `canonical_work_start`; P8 bundle; Stage 4 architecture/identity, legal-semantic and query/release reviews at high. | `BLOCKED`; start concurrently after fingerprint exists; no Ben. |
| `P8-BEN-FREEZE-04` | P8 | Approval of exact bundle and fingerprint. Ben. | Plain-English package plus immutable review evidence. | Reserved Ben decision; P8 reviews all pass. | `BLOCKED`; ask once when package is complete; **Ben required**. |
| `P8-ATTEST-05` | P8 | `P1_CONTRACT_FREEZE_ATTESTED: PASS` and `vertical_slice_execution: PASS`. PM controller. | Freeze evidence, programme gate status and protected publication. | Status publisher authority; exact Ben approval; official verifier. | `BLOCKED`; sign and publish after approval; no further Ben. |
| `P8-QXO-SLICE-06` | P8 | QXO Agreement control slice through all required staging outputs. PM implementation. | Existing QXO F28 staging fixture/runtime plus authorised writer, release and cross-view tests. | `vertical_slice_execution`; P8 attestation; staging only. | `BLOCKED`; execute after verifier passes; no Ben. |
| `P8-METSERA-SLICE-07` | P8 | Metsera Process slice through the same staging outputs and failure isolation. PI with PM controller. | Sealed gold, Process pilot sidecars, canonical writer, candidate release and Product outputs. | `vertical_slice_execution`; QXO control and sealed comparison; exact cross-view tests. | `BLOCKED`; execute after QXO control; no Ben. |
| `P8-VERTICAL-PASS-08` | P8 | `P1_VERTICAL_SLICE_PASS`, `PROCESS_VERTICAL_SLICE_PASS` and `candidate_scope_and_extraction: PASS`. PM controller. | Signed evidence and protected status. | Both slices pass; official verifier. | `BLOCKED`; publish exact successor; no Ben unless a material contract changes. |

### P9 certification

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P9-SCOPE-REGISTRY-01` | P9 | Exact scope and final disposition for all registry, residual and novel-candidate members. PM implementation. | Candidate manifests, scope roots and trace entries. | `candidate_scope_and_extraction`; P8 pass; `P9_SCOPE_EXACT`, `P9_REGISTRY_DISPOSITIONS`. | `BLOCKED`; run staged candidate scope; no Ben for reviewed existing codes. |
| `P9-METSERA-CERT-02` | P9 | One sealed Metsera extraction and product certification. PI. | Staging candidate extractor and sealed PE1 package. | `candidate_scope_and_extraction`; P8 pass; all mandatory predicate/action tests. | `BLOCKED`; compare once to sealed gold; no Ben. |
| `P9-STRATIFIED-03` | P9 | Pre-registered 25-deal tuning and untouched holdout result. PI with reviewer. | Staging-only candidate releases and certification evidence. | `candidate_scope_and_extraction`; Metsera pass; no failed-holdout repair or rerun. | `BLOCKED`; choose passed general claim or exact-corpus claim; Ben only for material taxonomy. |
| `P9-MARKET-NUMERIC-04` | P9 | MKT-1/2/3, canonical numeric backfill and comparable market projection. PM implementation. | Phase 4-6 normalisers, observation projection and staging migration. | `candidate_scope_and_extraction`; certified candidate; `P9_MKT_WORK`, `P9_NUMERIC`. | `BLOCKED`; dry-run staging only; no Ben. |
| `P9-SEMANTIC-QUALITY-05` | P9 | Structured claims, party lint, two shadow runs, third on disagreement, stable identity and zero drift. PM implementation and reviewer. | Extraction receipts, residual roots and certification matrix. | `candidate_scope_and_extraction`; full-corpus staging; `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`, `P9_SHADOW_REEXTRACTION`, `P9_IDENTITY_AND_DRIFT`. | `BLOCKED`; run after stratified certification; no Ben unless taxonomy changes. |
| `P9-RENDER-ACCEPT-06` | P9 | Render parity and full browser, accessibility and performance acceptance. PM implementation. | Shared row consumers and browser suites. | Certified candidate; `P9_RENDER_PARITY`, `P9_BROWSER_A11Y_PERFORMANCE`. | `BLOCKED`; test all five surfaces against one release; no Ben. |
| `P9-TRACE-RUNBOOK-07` | P9 | Complete traceability and every outstanding Ben runbook item. PM controller. | Traceability matrix and non-secret runbook evidence. | All candidate proofs; `P9_BEN_RUNBOOK`, `P9_PREIMPORT_TRACEABILITY`, `P9_TRACEABILITY`. | `BLOCKED`; mechanically reconcile every route and object; Ben only for an expressly reserved runbook act. |

### P10 performance, security and inactive release

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P10-SECURITY-01` | P10 | Action-level auth, client-auth decision, containment and whole-tuple revocation. PM implementation. | Routes, auth matrix, grants and security evidence. | `candidate_scope_and_extraction`; P9 candidate; `P9_SECURITY_AUTH`. | `BLOCKED`; complete security tests in staging; **Ben required only for a material governance decision**. |
| `P10-LOAD-02` | P10 | Fixed latency/capacity, one admission check, at most one bounded serving query and no corpus-proportional calls. PM implementation. | Staging serving projection, RPC, cache and load harness. | Certified projection; `P9_DATABASE_SOAK`; 60-connection Micro soak. | `BLOCKED`; run staging load and soak only; no Ben. |
| `P10-ROLLBACK-03` | P10 | Backup restoration, active-corpus rollback, staging smoke and recovery rehearsals. PM controller. | Isolated staging backup and rollback evidence. | P9 candidate; `P9_STAGING_SMOKE_AND_ROLLBACK`, `P9_BACKUP_RESTORE`. | `BLOCKED`; rehearse without production mutation; no Ben. |
| `P10-INACTIVE-RELEASE-04` | P10 | One inactive whole Agreement and Process release with logical, physical, query, render, export, trace and deployment parity. PM controller. | Release bundle, inactive namespace and deployment manifest. | P9/P10 proofs; `P9_IMPORT_PARITY`, `P9_PROMOTION_ELIGIBILITY`, `P9_DEPLOYMENT_PARITY`. | `BLOCKED`; certify exact tuple; **Ben required for production import or activation where the contract requires it**. |

### P11 import and activation

| Unit | Phase | Outcome and owner | Boundary | Class; dependencies; tests | Status; next action; Ben |
| --- | --- | --- | --- | --- | --- |
| `P11-IMPORT-01` | P11 | Import exact certified bundle into an inactive production namespace. PM controller. | Governed `CERTIFIED_RELEASE_IMPORT_BATCH` path and import attestations. | `production_import`; P10 inactive release; import parity and resumability tests. | `BLOCKED`; obtain any contract-required import approval, then import inactive only; **Ben where required**. |
| `P11-CUTOVER-AUTH-02` | P11 | Exact one-use cutover authorisation. Ben. | Cutover approval and protected status. | `cutover_authorisation_issue`; every Phase 9 pre-cutover gate green. | `BLOCKED`; present exact certified tuple and rollback target; **Ben required**. |
| `P11-ACTIVATE-03` | P11 | Atomic whole-tuple activation with reversible feature flag. PM controller. | Active-release pointer, feature flag and production cutover RPC. | `production_cutover`; P11 authorisation; no partial activation. | `BLOCKED`; activate once; no extra Ben. |
| `P11-SMOKE-04` | P11 | Live production smoke, rollback on mismatch and completion attestation. PM controller and independent reviewer. | Production smoke, rollback and trace evidence. | Exact active tuple; `P9_POSTCUTOVER_SMOKE`, `P9_PROGRAMME_COMPLETION_ATTESTATION`; official verifier. | `BLOCKED`; smoke every surface, roll back on identity/source/evidence/semantic mismatch; no Ben unless rollback requires a reserved act. |

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
| P6 existing components may already satisfy some named Process component duties. | Run the P6 acceptance inventory against `pages/index.js`, `components/query/QueryLaunchBox.jsx`, all canonical result components and tests. Record one PASS or missing-file disposition per acceptance test. | PM implementation |
| P7 generic modules are absent on signed main. | After PI Stage 1 integration, test each exact P7 path with `git cat-file -e HEAD:<path>` and assign every absence to one PI commit. | PM controller |
| Final successor member count and kind count. | Regenerate required-kind registry and manifest from the combined tree, then run both generators with `--check`. | PM controller |
| Final missing, duplicate, conflict, cycle and residual counts. | Run the actual input compiler and bundle compiler twice on the combined tree. Require zero for each count and identical bytes. | PM controller |
| Combined Stage 5 full-suite and build result. | Run `npm test` and `npm run build` once after all accepted units and manifest repairs are present. | PM controller |
| Exact final deployment IDs. | Inspect the two Vercel deployments for the final candidate commit before signed publication. | PM controller |
