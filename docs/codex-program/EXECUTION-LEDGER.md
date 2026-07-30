# Canonical Corpus V2 execution ledger

This is the human-readable programme status. It is an operational control, not
an architecture document. The governing architecture is
[CODEX-PROGRAM.md](../CODEX-PROGRAM.md).

The PM controller owns the integration queue and updates this ledger after each
main integration.

## 1. Current state

| Item | State |
| --- | --- |
| Main basis | `7b6bc64157c49832129fa2ca227399850cd983fc` |
| Current reviewed branch commit | `affa7464ca2cab2b4715ae084e3de6c2d39b673f` |
| Active milestone branch | `codex/p8-combined-pilot-integration-v1`, head `7a7c7263`; includes the generic Agreement envelope, bounded PI pipeline connector, sealed Metsera source-to-sidecar run and signed Process result admission |
| Contract bundle | 172 authored inputs, 171 substantive contracts, 8 categories |
| Current bundle ID | `8c765d52d3f95ebfc21b28b5bd0e71689a095c482e113a4329d33b0140dbe83d` |
| Current contract bundle digest | `b990bf90f98fd83b9dfcf34912ec4b3cd42c37f3e693bee9796b1c63198edc84` |
| Current canonical payload digest | `73a9023d3ef831e7a544664929385a1aa61af1efed58139d1cd54bf5985d3ab8` |
| Contract dependency graph | 171 nodes, 285 links, 0 missing, duplicate, conflict, unresolved or cyclic links |
| Clean compile check | PASS, two uncached compiles produced identical canonical bytes |
| Draft generic-envelope successor | Bundle `b37a20b3e343b93ab8d9d223625ef5431d0786f5720f1869572921ab7049ad30`; digest `158ac280eb3bc2b994e4d37281db8045deb48221af81ba84fb7da8a93205f03a`; 172 substantive contracts and 297 links. Two clean compiles are byte-identical. This draft does not replace the acknowledged M1 bundle until its exact bytes pass review and the reserved contract-freeze approval. |
| Latest complete suite on this branch | PASS, 4,621 passed, 0 failed, 5 skipped |
| Latest production build on this branch | PASS, 29/29 pages |
| M1 contract freeze | PASS. Exact acknowledgement: `docs/acks/M1-CONTRACT-FREEZE-2026-07-30.md` |
| M2 vertical slice | ACTIVE. QXO F28 passed the real isolated-staging rollback proof. Metsera now passes source acquisition through typed Process sidecar and signed Process phrasebook-result admission. The shared Product row, product views and candidate-release wiring remain. |
| Isolated-staging access | PASS. Project `sjumbznveyyiizhwvixj` was re-authorised and verified through the Supabase plugin on 2026-07-30. Production was not queried or changed. |
| QXO F28 staging proof | PASS. Release `f79d3a9a92567db913da48f84540fa55cdff69d770bf4c9261a72e3428242240`; 14 metric slots; 1 set-based market read; 0 retries; 0 durable writes; active pointer unchanged. |
| Staging pointer check | PASS. The active staging pointer remains generation 10 at corpus release `c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3`. The F28 test release has zero durable release, market or serving rows and is not active. |
| M3 full-corpus certification | OPEN |
| M4 pre-cutover | OPEN |
| Tier A containment | ACTIVE |
| Tier B attacker-model security | DEFERRED_POST_CUTOVER |

No signed status artefact or protected publication is required for
pre-production work. This table is the current state.

## Plain-English stage

The programme is in P8. P8 means that one real Agreement provision and one
real Process provision must travel from source evidence to every required
product view.

P1-P7 supplied the contracts and pure processing modules. M1 confirms the
exact 171-contract bundle and permits the isolated staging pilots. QXO F28 has
now passed its real source-to-product rollback proof. The remaining P8 work is
to parameterise the envelope for a second Agreement family, then run Metsera
against isolated staging. The governance balance unit removes obsolete review
machinery. It does not change extracted facts or legal meaning.

## 2. Work underway

| Unit | Phase | Outcome | Owner | Branch and files | Required checks | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PM-GOV-BALANCE-01` | control | Replace pre-production attestation machinery with four milestone reviews and Tier A/Tier B security. | PM controller | `codex/governance-balance-v2`; governing docs, generated manifest and apparatus-only tests; commit `afbf1a4`. | 4,576 pass, 0 fail, 7 skip; production build PASS. | INTEGRATION | Include the committed unit in the next controlled main movement. | No |
| `PM-QXO-F28-LINK-01` | P8 | Bind the F28 graph, all 14 metric slots, correction head and Product result without hiding missing runtime links. | PM implementation | `codex/qxo-f28-runtime-link-v1`; commit `d582705`. | 4 focused tests PASS. | COMPLETE | Preserve the fail-closed runtime plan. | No |
| `PM-QXO-F28-WRITER-01` | P8 | Convert the exact F28 graph into the canonical writer's closed `DEAL_SCOPE_RUN` input. | PM implementation | Same branch; commits `32af4b2`, `53868ba`, `77f4183` and `7be1521`. | 28 writer tests PASS. The F28 write set has zero residuals. | COMPLETE | Execute the exact input against isolated staging. | No |
| `PM-QXO-F28-CONDITION-GROUP-WRITER-01` | P2/P8 | Admit the existing `CAPITALISATION_CONDITION_GROUP/V1` rows to the writer without converting or dropping them. | PM implementation | Same branch; commit `53868ba`; writer and validation files. | 25 writer tests PASS, including identity, persistence, replay and data-loss checks. | COMPLETE | Preserve the first-class condition-group collection. | No |
| `PM-QXO-F28-DEFINITION-WRITER-01` | P2/P8 | Persist the nested `DEFINITION_OCCURRENCE/V1` used by the F28 definition relationship. | PM implementation | Same branch; commits `77f4183` and `7be1521`; writer, validator, F28 link, tests and staging SQL. | Identity, source, nested-span, relationship, transaction and replay checks PASS. | COMPLETE | Preserve the typed definition row in the staging run. | No |
| `PM-QXO-F28-CANDIDATE-01` | P8 | Add one immutable F28 candidate envelope for one row with 14 ordered metric terminals. | PM implementation | Same branch; commits `cec829c`, `a85832d`, `62f2586`, `f053660`, `01b8cd8`, `f8c1dd1` and the active parameterisation correction. | 49 focused envelope, adapter, staging and manifest tests PASS. The contract validates any fully admitted F28 source and derives source-specific identities. | COMPLETE | Preserve the envelope-bound Product result in the real staging run. | No |
| `PM-QXO-F28-SURFACES-01` | P7/P8 | Give Query, Review, Compare and Corpus Context the same F28 row, citation and source action. | PM implementation | Same branch; Product adapter, surface link and staging runner. | Real admitted-source path constructs the same Product row and four surface bindings. Candidate-wide suite and build PASS. | COMPLETE | Preserve the same identities in isolated staging. | No |
| `PM-QXO-F28-PREFLIGHT-01` | P8 | Prove one exact admitted source graph reaches the writer, candidate envelope, Product row and all four product surfaces. | PM implementation | Same branch; preflight and isolated-staging runner. | Pure preflight PASS. Real isolated-staging proof PASS. The runner reused 14 exact stored objects, called the writer once inside a savepoint, read 14 metric slots in one set-based call and rolled back. | COMPLETE | Preserve the exact proof while the generic envelope is built. | No |
| `PM-QXO-F28-STAGING-01` | P8 | Execute the admitted QXO F28 slice without changing the active or candidate corpus. | PM controller | Same branch; commit `56e568c`; staging runner, generic persisted-object resolver and SQL writer parity fixes. | Proof `QXO_CAPITALISATION_STAGING_PROOF_F28/V1` PASS. 43 bounded repository checks, 14 retained references, 30 probe records, 0 retries, 0 durable writes, pointer generation 10 unchanged. Complete suite: 4,621 pass, 0 fail, 5 skip. Production build: 29/29 pages. | COMPLETE | Push this completed slice, then start the generic second-family unit. | No |
| `PM-QXO-F28-IDENTITY-01` | P8 | Bind Product Query IR to the actual validated release manifest and remove two false value-slot dependency links. | PM implementation | Same branch; adapter contract/runtime/tests and current-root resolver/tests. | Adapter chain 33/33 PASS. Exact-root chain 25/25 PASS. Graph has 285 reviewed links. Architecture, legal-semantic and query/serving/release reviews all PASS on `affa7464`. | COMPLETE | Preserve these exact identities in the real staging result. | No |
| `PM-QXO-F28-M1-PERMISSION-01` | P8 | Let the isolated F28 runner consume the exact M1 acknowledgement after pre-production signed-status publication was retired. | PM controller | Same branch; M1 acknowledgement, strict permission validator, runner and focused tests. | Exact bundle and approval binding tests PASS. Complete suite: 4,617 pass, 0 fail, 5 skip. Build: 29/29 pages. Production authority is `NONE`. | COMPLETE | Preserve the exact permission in the isolated-staging proof. | No |
| `PM-GENERIC-ENVELOPE-01` | P8 exit | Prove that the second Agreement family can use one parameterised envelope contract. | PM implementation | `codex/agreement-candidate-envelope-v1`; commit `ab12f40` plus the exact-parity review correction; one generic contract/runtime plus data profiles for capitalisation and IOC capex. QXO and Landos are source-validator bindings, not envelope forks. No copied F28 envelope file. | 392 affected tests PASS. Complete suite: 4,629 pass, 0 fail, 5 skip. Production build: 29/29 pages. Byte-parity tests prove both predecessor rows and every terminal are unchanged. Draft root: 172 contracts, 297 links, zero structural defect. | REVIEW | Complete independent exact-root reviews on the final commit, then prepare the one reserved contract-freeze approval. | Reserved exact contract freeze only |
| `PM-QUERY-FIXTURE-LINK-01` | P8 | Execute fixture-scoped Product Query and Review paths without opening the production route. | PM implementation | Same branch; `qxo-capitalisation-f28-pilot-preflight.js` and Product surface link. | Query, Review, Compare and Corpus Context use one exact row, citation and source action. | COMPLETE | Preserve this parity in isolated staging. | No |
| `PI-METSERA-RUNTIME-01` | P8 | Connect sealed Metsera sources through acquisition, enumeration, graph validation and pilot materialisation. | Process Intelligence and PM controller | PI connector commits integrated on `codex/p8-combined-pilot-integration-v1`; pure runtime and focused tests only. | 68 focused acquisition, scope, semantic, lexical, graph, validation and pilot tests PASS. All trusted receipt and typed failure checks remain active. | COMPLETE | Preserve the connector while Product wiring is added. | No |
| `PM-METSERA-SOURCE-SIDECAR-01` | P8 | Run one real Metsera exclusivity-grant passage from the sealed SEC source universe into the typed Process sidecar. | PM controller | Same branch; commit `627093a3`; four-file staging-pilot boundary. | PASS twice with identical IDs. Nine source documents and eight reviewed passages match exact bytes and hashes. One result materialised. Seven out-of-slice passages remain typed residuals. Materialisation receipt `77fd51973ba0d0873fd3523d7c01a5b442f572615eadffd89e455545bd032c4e`. Focused chain 79/79 PASS. Staging pointer remains generation 10. | COMPLETE | Feed the exact sidecar into the existing Product result adapters. | No |
| `PM-METSERA-PROCESS-ADMISSION-01` | P8 | Admit the exact Metsera grant sidecar under the signed Process phrasebook-result contract. | PM implementation | Same branch; commit `7a7c7263`; Product-admission adapter, staging runner and focused tests. | PASS twice with byte-identical output. Process result `ce2df4541a9137afb85916aaf08befe361186213eec2b913338c0bc63828bf65`; admission receipt `2498ec6a892f100b36d708774039389057315ef484b05ceca34511e559c0eb50`; 36 focused tests PASS. Source remains Process narration and is not relabelled as actual drafting. | COMPLETE | Feed the complete admission input and receipt to the existing shared Product-row compiler. | No |
| `PM-METSERA-PRODUCT-LINK-01` | P8 | Carry the exact Metsera Process sidecar through Product Query, Review, Compare, Corpus Context and source reading. | PM implementation | Same branch; existing Process shared-row, result-set and presentation compilers. Exact new adapter boundary is under mechanical inspection. | Same result, source, release, citation and identities across all surfaces. | READY | Build the narrow Product input adapter without a second source or result architecture. | No |

## 3. Next 48 hours

1. Feed the validated Metsera Process admission into the existing shared Product row, then connect that row through Query, Review, Compare, Corpus Context and source reading.
2. Add the candidate-release and rollback-only writer proof for that same result.
3. Run the exact 172-contract successor-root checks and the reserved exact-bundle approval only after all checks pass.
4. Run cross-view browser acceptance and the indexed serving proof.
5. Close M2 only after QXO and Metsera use the same source, identities, evidence and release across every required view.

## 4. Bounded units through P11

| Unit | Phase | Outcome | Owner | Dependency | Evidence | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P1-CONTRACT-BUNDLE` | P1 | One complete Agreement, shared and Process contract bundle. | PM controller | None. | Current 171-contract root has 285 dependency links and zero structural defects. Two clean compiles are byte-identical. Complete suite and build PASS. Three exact-byte reviews PASS. M1 acknowledgement records Ben's approval. | COMPLETE | Preserve the exact bundle through both pilots. | No |
| `P2-IDENTITY-WRITER` | P2 | Stable identities and one canonical writer. | PM implementation | P1 bundle. | Identity and transactional writer tests. | COMPLETE | Preserve condition groups and nested definitions in the same deal transaction. | No |
| `P3-SCOPE-EXTRACTION` | P3 | Definitions-first scope and extraction with open-world residuals. | PM and PI | P1 bundle. | PASS for the selected real Metsera grant. Nine sealed sources and eight passages were verified. One typed result and seven residuals were retained. | COMPLETE | Preserve the exact source and residual identities through Product wiring. | No |
| `P4-OBSERVATIONS-QUERY` | P4 | Normalised observations and one Product Query IR. | PM and PI | P3 outputs. | Numeric, unit, field, Ask/Browse and filter tests. | ACTIVE | Connect real release inputs. | No |
| `P5-CORRECTIONS-RELEASE` | P5 | Corrections survive re-extraction and candidate releases are immutable. | PM implementation | P3 and P4. | Correction-head and release tests. | ACTIVE | Connect QXO and Metsera pilot outputs. | No |
| `P6-SERVING` | P6 | Bounded set-based serving and release-aware cache. | PM implementation | P5 candidate release. | Call-budget, cache and query tests. | ACTIVE | Execute fixture-scoped runtime path. | No |
| `P7-SHARED-ROWS` | P7 | Query, Review, Compare and Corpus Context use one row contract. | PM and PI | P6. | Cross-view byte and browser parity. | ACTIVE | F28 fixture parity passes. Add the Metsera row and browser checks. | No |
| `P8-VERTICAL-SLICES` | P8 | QXO and Metsera pass source-to-product staging runs. | PM controller | P1-P7 links. | QXO F28 real isolated-staging rollback proof PASS. Metsera, second-family parameterisation and browser evidence remain. | ACTIVE | Complete the generic envelope, then integrate and execute Metsera. | No |
| `P9-CORPUS-CERTIFICATION` | P9 | Full corpus passes quality, identity, drift, performance, restore and rollback controls. | PM controller | M2 pass. | M3 acknowledgement and Phase 9 gates. | BLOCKED | Begin after both pilots pass. | No |
| `P10-PRODUCTION-IMPORT` | P10 | Exact inactive production import with member parity and resumable checkpoints. | PM controller | M3 pass. | Replay no-op, conflicting replay fail-closed, complete parity. | BLOCKED | Run only after staging certification. | Where contract requires |
| `P11-CUTOVER` | P11 | Atomic whole-tuple activation, smoke and rollback. | PM controller | M4 pass and Ben authorisation. | Cutover receipt, production smoke and rollback. | BLOCKED | Request one-use authorisation at M4. | Yes |
| `P12-SECURITY-HARDENING` | P12 | Add attacker-model certification for the internal product. | PM implementation | Successful cutover. | Route/action inventories, probes, egress and revocation tests. | BLOCKED | Start after cutover. | No unless governance changes |

The F28 envelope is source-specific pilot code. After F28 passes end to end,
the second Agreement family must use a parameterised generic envelope
contract. The programme must report an inability to parameterise as a design
defect. It must not copy the F28 files.

## 5. Critical path

`PM-GOV-BALANCE-01` → M1 bundle acknowledgement → QXO isolated-staging PASS →
generic second-family envelope → Metsera runtime link and isolated-staging run → M2 → full-corpus
certification → M3 → inactive production import → M4 → one-use Ben cutover
authorisation → atomic activation → production smoke and rollback.

P1-P7 close when:

- every required contract input has one final identity and dependency;
- two uncached compiles are byte-identical;
- the bundle has no missing member, duplicate identity, conflict, cycle or
  unresolved dependency;
- the canonical writer, corrections, candidate release, bounded serving and
  shared row contracts pass;
- QXO and Metsera have executable real-source links through every required
  product surface.

Production import and cutover retain:

- exact bundle digest and member parity;
- checkpointed resumable import;
- replay no-op and conflicting replay fail-closed;
- atomic whole-tuple activation;
- post-cutover smoke with rollback; and
- one-use Ben cutover authorisation.

## Retired units

- `PM-P8-REVIEW-CONTROLLER-01`: RETIRED. Replaced by milestone
  acknowledgements.
- `PM-P8-REVIEW-REGISTRATION-01`: RETIRED. No signed reviewer registration is
  required.
- `PM-P8-PROTECTED-REVIEW-PRODUCER-01`: RETIRED. No protected review producer is
  required.
- `PM-P8-SIGNED-STATUS-PUBLISHER-01`: RETIRED for pre-production work. The
  ledger is the status source.
