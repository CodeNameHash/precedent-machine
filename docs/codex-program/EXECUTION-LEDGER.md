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
| Approved M1 review commit | `affa7464ca2cab2b4715ae084e3de6c2d39b673f` |
| Active milestone branch | `codex/p8-combined-pilot-integration-v1`; corrected candidate head `353828e5`, followed only by ledger evidence updates. The P8 work-package tests, complete suite, build and two clean compiles pass. Main remains fixed. |
| Current working-tree successor bundle | 178 authored inputs, 177 substantive contracts, 8 categories. This is a draft, not the freeze candidate. |
| Current working-tree bundle ID | `d222eba830fefad4772e358041e36f8818dbf227e4c7e13c77f4228514a37d8e` |
| Current working-tree contract digest | `a953a215f9ff4cf94a204580b3b9a2b559fa531d1f3be16a3e787032257e87b3` |
| Current working-tree payload digest | `36762abe8f4dd666df0d9aa66760d8c4e41971fab633764108ee54f73d5c8d73` |
| Contract dependency graph | 177 nodes, 315 links, 0 unresolved dependencies, and 0 cycles |
| Clean compile check | PASS on the current working tree. Two uncached compiles produced identical canonical bytes. Run this again on the final clean candidate. |
| Draft generic-envelope successor | Bundle `b37a20b3e343b93ab8d9d223625ef5431d0786f5720f1869572921ab7049ad30`; digest `158ac280eb3bc2b994e4d37281db8045deb48221af81ba84fb7da8a93205f03a`; 172 substantive contracts and 297 links. Two clean compiles are byte-identical. This draft does not replace the acknowledged M1 bundle until its exact bytes pass review and the reserved contract-freeze approval. |
| Draft Product-writer successor | Bundle `dfab1f31bf31b7ce405dc8a5fc0215a07139634ff535f84b1266f754cba2797a`; digest `c8f840e70e8b1c1bac467278665fddc9d837123f9a8c44ae47c0b9630eaec540`; canonical payload `a6608b04e9140cb024089639a3989ae9d45a12df5cd6587f6d2695ea2ffb872f`; 173 substantive contracts and 302 links. Two clean compiles are byte-identical. It adds only an inactive staging candidate-result write through the existing canonical writer. Exact-root review and the reserved contract-freeze approval remain required before this draft replaces M1. |
| Draft Product-serving successor | Bundle `17de909336a20e581ad9c35c107ce821b7a22379970c8923c01c1fa67d615611`; digest `21343532a94fe360c5c016feeb3e076dab7cde3ef1ca15b7f8dfe08e522a8ab3`; canonical payload `9c42b003c74234c33b00d0d991fa7990f65da38f49e63c343bda773d1c8eb94e`; 174 substantive contracts and 303 links. Two clean compiles are byte-identical. It adds one generic Product result serving-record contract for Agreement, Process and later admitted domains. The V7 importer and active query now implement that contract in isolated staging. Exact-root review and reviewed activation remain. |
| Latest complete suite on this branch | PASS on the corrected combined candidate: 4,768 pass, 0 fail, 5 environment-only skips. |
| Latest production build on this branch | PASS on the combined candidate, 29/29 pages. Existing warnings remain: ESLint is absent, offline Supabase variables are absent, and two admin pages exceed the page-data warning threshold. |
| Protected programme status | Generation 44, publication `9552de2185b11d80bd1e2b80757f4f07005c58d1`, binds code commit `a3149cfb6434f3166aac2c3bd9631e637d5df8ae`. Current GitHub main is `7b6bc64157c49832129fa2ca227399850cd983fc`. The official verifier fails closed because the signed status is stale. Its last signed projection had `canonical_work_start: PASS` and `vertical_slice_execution: OPEN`. |
| M1 contract freeze | The prior milestone acknowledgement remains at `docs/acks/M1-CONTRACT-FREEZE-2026-07-30.md`. It cannot authorise the changed P8 bundle. The formal `P1_CONTRACT_FREEZE_ATTESTED` gate remains OPEN. |
| M2 vertical slice | ACTIVE but not complete. QXO F28 has a prior isolated-staging rollback proof. F28 and IOC now pass the same real writer proof. Metsera authority propagation is corrected and locally tested, but the current staging runner correctly refuses to execute until the final exact M1 bundle acknowledgement exists. |
| Isolated-staging access | PASS. Project `sjumbznveyyiizhwvixj` was re-authorised and verified through the Supabase plugin on 2026-07-30. Production was not queried or changed. |
| Generic Agreement writer staging proof | PASS on the corrected working tree. F28 and IOC reached the same SQL-native writer. Valid inserts passed inside rollback transactions. Exact replay was a no-op. Conflicting replay failed closed. Twenty-six coherently rehashed hostile requests failed before DML. Durable candidate rows and receipts remain zero. Production was not accessed. |
| QXO F28 staging proof | PASS. Release `f79d3a9a92567db913da48f84540fa55cdff69d770bf4c9261a72e3428242240`; 14 metric slots; 1 set-based market read; 0 retries; 0 durable writes; active pointer unchanged. |
| Staging pointer check | PASS. The active staging pointer remains generation 10 at corpus release `c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3`. The F28 test release has zero durable release, market or serving rows and is not active. |
| M3 full-corpus certification | OPEN |
| M4 pre-cutover | OPEN |
| Tier A containment | ACTIVE |
| Tier B attacker-model security | DEFERRED_POST_CUTOVER |

The signed status fails closed. Routine branch work continues under the
approved integration rule. A new protected publication is required when the
completed milestone moves main.

## Plain-English stage

The programme is in P8. P8 means that one real Agreement provision and one
real Process provision must travel from source evidence to every required
product view.

P1-P7 supplied the contracts and pure processing modules. QXO F28 has a prior
real source-to-product rollback proof. The current P8 correction adds the
second Agreement family through a parameterised envelope and a shared Product
domain-result adapter. It also removes synthetic Product authority from the
Metsera path. The shared JavaScript writer passes for F28 and IOC. Stage 2 and
Stage 3 found three blocking writer gaps. The committed correction closes
copied-row drift, membership drift, stale SQL function digests and the Process
SQL authority bypass. Three exact-bound Stage 2 correction reviews now pass.
The corrected Agreement proof passes in isolated staging with 26 hostile
calls. The Metsera runner carries the full transient authority pair, but its
staging run still stops at the required M1 acknowledgement check. The first
Stage 4 review round found four real defects: stale SQL root pins, no governed
Product query cache, mismatched IOC citation evidence, and lost
`APPROXIMATE` denominator precision. Commits `4207bee0`, `dd119359` and
`7c47f1d7` close those defects. Their focused tests and exact-bound Stage 2
reviews pass. The affected chain passes 67 tests. The complete suite passes
4,768 tests with no failure. The build produces all 29 pages. Two uncached
compiles produce identical bytes with 177 contracts, 315 links and zero
structural defect. The current task is the corrected isolated-staging proof,
then the three Stage 4 reviews against the same exact bytes. One reserved
bundle approval follows.

## 2. Work underway

| Unit | Phase | Outcome | Owner | Branch and files | Required checks | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PM-P8-IOC-PREDICATE-02` | P8 Stage 3 | Keep IOC capex under interim operating covenants, not representations. | PM implementation | Active branch; commits `32642f54`; Agreement predicate, navigation, validators and tests. | 63 affected tests PASS. | COMPLETE | Preserve in final exact-root compile. | No |
| `PM-P8-PRODUCT-AUTHORITY-02` | P8 Stage 3 | Derive Product authority from the exact contract root and candidate release. | PM implementation | Active branch; commit `b1ab88fc`; Product authority context and field catalogue. | 6 focused tests PASS. | COMPLETE | Use this context in Metsera, F28 and IOC Product compilers. | No |
| `PM-P8-AGREEMENT-DOMAIN-RESULT-02` | P8 Stage 3 | Convert F28 and IOC envelopes through one profile-driven Product domain-result adapter. | PM implementation | Active branch; commit `512b9fae`; one adapter and focused tests. | 4 focused tests PASS. | COMPLETE | Feed the output to the real Product query-result compiler. | No |
| `PM-P8-SURFACE-BINDING-02` | P8 Stage 3 | Bind Review, Query, Compare and Corpus Context to one Product result and source action. | PM implementation | Active branch; commit `871c2ed2`; one contract, runtime and focused tests. | 7 focused tests PASS. | COMPLETE | Register in the final manifest and use it after presentation. | No |
| `PM-P8-METSERA-AUTHORITY-02` | P8 Stage 4 | Preserve the exact Product authority context through Metsera row, result-set, surfaces and candidate-writer revalidation. | PM implementation | Active branch; commit `a603c9e9`; Product writer contract, Process carrier, SQL validator, staging runner and hostile tests. | The carrier retains the exact context and source inputs. JavaScript and SQL reject missing or re-signed substituted authority before DML. Three Stage 2 reviews and the complete suite pass. The staging runner correctly requires the final M1 acknowledgement. | REVIEW | Include the exact Process authority chain in all three Stage 4 reviews. Execute the real Metsera staging call only after the exact bundle acknowledgement. | No |
| `PM-P8-AGREEMENT-MATERIALISATION-03` | P8 Stage 3 | Compile F28 and IOC through one generic Agreement envelope, Product Query IR, result, ordering, result set, presentation and four shared surfaces. | PM implementation | Active branch; generic materialisation contract/runtime, profile action bindings, reusable fixtures and focused tests. | 17 focused profile, navigation and domain-result tests PASS. Both families reach all four surfaces. A correctly rehashed cross-family query fails closed. | COMPLETE | Preserve this exact output as the only Agreement input to the candidate writer. | No |
| `PM-P8-GENERIC-WRITER-02` | P8 Stage 4 | Make F28 and IOC reach one immutable candidate-result insert through the existing canonical writer. | PM implementation | Active branch; commit `a603c9e9`; candidate writer, governed SQL extracts and focused tests. | The SQL path closes copied provision rows and membership objects. Each governed function comment matches its exact bytes. Three Stage 2 reviews, 131 correction checks and the complete suite pass. | REVIEW | Preserve the validated SQL and 26-call staging proof in the exact-root review candidate. | No |
| `PM-P8-AGREEMENT-WRITER-STAGING-03` | P8 Stage 3 | Prove the generic writer against isolated staging for both Agreement families. | PM controller | Active branch; bounded rollback runner, focused test and exact allowlist. | PASS. Two valid families, exact replay no-op, conflicting replay rejected, 26 hostile requests rejected before DML, zero durable rows or receipts, active pointer unchanged. | COMPLETE | Preserve the proof receipt for the final approval package. | No |
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
| `PM-METSERA-SOURCE-SIDECAR-01` | P8 | Run one real Metsera exclusivity-grant passage from the sealed SEC source universe into the typed Process sidecar. | PM controller | Same branch; commit `627093a3`; four-file staging-pilot boundary. | PASS twice with identical IDs. Nine source documents and eight reviewed passages match exact bytes and hashes. One result materialised. Seven out-of-slice passages remain typed residuals. Current materialisation receipt `67da27a5a1b37256d877fccdb0e99de1f8eb6994fa39f0fe0dc8145836680c97`. Focused chain 79/79 PASS. Staging pointer remains generation 10. | COMPLETE | Preserve the exact sidecar through all Product links. | No |
| `PM-METSERA-PROCESS-ADMISSION-01` | P8 | Admit the exact Metsera grant sidecar under the signed Process phrasebook-result contract. | PM implementation | Same branch; commit `7a7c7263`; Product-admission adapter, staging runner and focused tests. | PASS twice with byte-identical output. Process result `ce2df4541a9137afb85916aaf08befe361186213eec2b913338c0bc63828bf65`; admission receipt `517d3b3c4f02f2b2df2bdf85f5d32af02ebc6fefe37aa649c319d8ae7dac319d`; 36 focused tests PASS. Source remains Process narration and is not relabelled as actual drafting. | COMPLETE | Preserve the complete admission input and receipt in every Product sidecar. | No |
| `PM-METSERA-PRODUCT-ROW-01` | P8 | Compile the admitted Metsera grant through the existing Product Query IR and shared Product result row. | PM implementation | Same branch; commits `2ddf8002`, `7cecbe7e` and `79ae3bdf`; one bounded row adapter plus the existing signed Product compilers. | 50 focused Product and bridge tests PASS. Current real run: query `063ea4a98fc4ae3db1088eba4931b231978e7c0cc4cc6b2a2e5a5e8505baa864`; Product result `7ff6e4d1ddb2baf6a995f66a911ef4b7031ef96bf52af5f0789a4adfeebea754`; exact outcome field `EXCLUSIVITY_GRANTED`; full catalogue has all 27 shared and Process fields. | COMPLETE | Preserve the exact row and Process ordering projection. | No |
| `PM-METSERA-RESULT-SET-01` | P8 | Revalidate the Metsera Product row and preserve the Process-owned order in the existing Product result-set compiler. | PM implementation | Same branch; commit `7cecbe7e`; one bounded result-set adapter. | 33 focused result-set tests PASS. Current receipt `ee7c3a4e2970c936e506b43604bdad48bf2ef4065e7637fd31725d4a233da9db` contains one ordered valid result, zero typed failures and zero exclusions. Product Query is compiled before Process ordering, so both bind the same exact Query ID. | COMPLETE | Preserve the exact slots and execution summary in presentation and source reading. | No |
| `PM-METSERA-PRESENTATION-01` | P8 | Compile the exact Metsera result set into the existing answer-first Product presentation. | PM implementation | Same branch; commit `79ae3bdf`; one checked 27-field catalogue and one narrow presentation handoff. | 26 focused and adjacent tests PASS. The nine-source run passed twice with byte-identical output. Presentation receipt `c0b0c7bec890d4b623b4d28db304e1d7ae183f996717461c53101cf8d088a856`. It retains the same Query, result, order, citation and Process sidecar. | COMPLETE | Feed the same result and source action to the existing source-reader compiler. | No |
| `PM-METSERA-PRODUCT-LINK-01` | P8 | Carry the exact Metsera Product row through result-set, presentation, Review, Compare, Corpus Context and source reading. | PM implementation | Same branch; commits `abf74476` and `d6005906`; existing Process result-set, presentation and source-reader compilers plus narrow bindings. | Four surfaces carry the same result, Query, citation, source action, presentation and complete Process sidecar. Surface receipt `e8b040d349b2e1b7af868772d7443a7d5f0f4f9f6ccfbacb6d326e37ad2f9089`. Compare and Corpus Context retain `SINGLE_PILOT_RESULT_NO_MARKET_COHORT`; the inactive source action returns `RELEASE_NOT_ACTIVE`. | COMPLETE | Preserve the exact bindings through browser acceptance and reviewed activation. | No |
| `PM-METSERA-PERSISTENCE-01` | P8 | Persist the complete Process-backed Product result without converting it into an Agreement metric row. | PM controller | Active milestone branch; `PRODUCT_CANDIDATE_RESULT_WRITER`, the existing `canonical_v2_write` entry point, one immutable staging table and focused tests. | 43 focused and adjacent tests PASS. Isolated staging now has the bounded operation and RLS-protected table. The real nine-source chain wrote candidate record `a13a01c9201dc4748c718646bfd622b336799e5d5af9ce3ab5f965eec31d0d6e` inside a rollback transaction. Exact replay was a no-op. Conflicting replay failed closed. A fresh plugin query confirmed RLS is active, no direct API-role table grants exist, durable candidate rows and receipts remain zero, and the active pointer remains generation 10 at `4db4e0c928420e7082de7aedfbda43f4772d48233dc9ca75c56995686b6c28fe`. Draft root has 173 contracts, 302 links and zero structural defect. | COMPLETE | Preserve the inactive candidate record through source reading and exact-root review. | Reserved exact contract freeze only |
| `PM-METSERA-SOURCE-READER-01` | P8 | Prove that the existing Product source reader refuses an inactive Metsera candidate without changing its result or reading a source. | PM implementation | Active milestone branch; five-file source-reader adapter boundary and existing Product source-reader compiler. | 19 focused and adjacent tests PASS. The real staging run resolved pointer generation 10, returned `RELEASE_NOT_ACTIVE`, preserved Product result `7ff6e4d1ddb2baf6a995f66a911ef4b7031ef96bf52af5f0789a4adfeebea754` and remained `NOT_EXECUTED`. Receipt `2ff7dc4c999ac8e61176b71eb67b21f51ae6f6a27c3e11aaed8f752e2e71cc41`. No durable row or pointer changed. | COMPLETE | Reuse the exact request only after reviewed candidate activation. | No |
| `PM-METSERA-BROWSER-01` | P8 | Render the real Metsera Product result in Query, Review, Compare and Corpus Context with one compact responsive layout. | PM controller | Active milestone branch; generated 19 KB real-result fixture, one preview component, one guarded design route and focused tests. | 13 focused cross-view tests PASS. Production build PASS, 29/29 pages. Browser acceptance PASS at 1440 and 390 pixels with no horizontal overflow. All four views retained Product result `7ff6e4d1ddb2baf6a995f66a911ef4b7031ef96bf52af5f0789a4adfeebea754`. Compare and Corpus Context showed the typed no-cohort state. Source action returned `RELEASE_NOT_ACTIVE`. | COMPLETE | Run exact-root checks and independent reviews. | No |
| `PM-P8-MECHANICAL-BINDINGS-01` | P8 | Update exact authored-file counts, the writer rollback snapshot, the governed staging SQL digest and programme drift manifest after the Product writer was added. | PM controller | Active milestone branch; commit `86e5bc70`; tests and generated control bindings only. | Eleven affected control tests PASS. Clean complete-suite rerun PASS. No product or legal meaning changed. | COMPLETE | Preserve this exact candidate through review. | No |
| `PM-PRODUCT-RELEASE-PARTITION-01` | P8 | Add Product Query results to the existing candidate-release import and active serving path. This is one generic Product partition for Agreement, Process and later admitted domains. | PM implementation | Active milestone branch; contracts and pure partition runtime through `0e158792`; V7 importer, staging tables, active query and rollback proof in `bbc68ad8`. | 26 focused importer, partition, query and client tests PASS. Isolated staging proof `P8_PRODUCT_RELEASE_PARTITION_STAGING_PROOF/V1` PASS. Import plan `76d6e6ac0c09d9170b035d439cad4687bb05ed5c3fecc558a378bfeffc52be22` imported one partition and one Product row inside one rollback transaction. The active query failed closed because the candidate was not active. Durable staging state was unchanged. The query has one indexed set-based call, keyset pagination, no retry and no direct table grant. | COMPLETE | Preserve the generic partition through exact-root review and reviewed activation. | Reserved exact contract freeze only |
| `PM-METSERA-RELEASE-PROOF-01` | P8 | Bind the real Metsera Product row and complete Process sidecar to one actual combined candidate release. | PM controller | Active milestone branch; commit `163a0f95`; three-file rollback-proof boundary. | Real isolated-staging proof PASS. Writer receipt `fb7bf094b14aff56b8b666327640535f5a1db62a86c5e01dd921574c04747be4`; import plan `0f29d38a9ae053a5b9d00b125786ae23aff4fee7ad0c8824e1415ef7798fa16a`; Product partition `e2b0d81341fb1587d514840fa0084fc1c64d7a47fa370feb0fc328dbfe738a9e`; serving record `412ff0e4dd417de9c9a9f2d21015da1a9eb05ee9b403b856ccc222d56259df13`. V7 import returned `IMPORTED_COMPLETE`. The inactive Product query returned no page. Source reading remained `RELEASE_NOT_ACTIVE`. Durable candidate, release, partition, serving and pointer state was unchanged after rollback. Forty-two focused and adjacent checks PASS. | COMPLETE | Run exact-root checks and the three independent reviews. | Reserved exact contract freeze only |

## 3. Next 48 hours

1. Apply the corrected writer and Product cache SQL to isolated staging.
2. Repeat the writer rollback proof and verify cache admission, empty results and no durable residue.
3. Repeat the three Stage 4 reviews against the same exact corrected bytes.
4. Prepare the one reserved exact-bundle approval package.
5. After approval, publish the matching signed permission and run the reviewed staging pilots.

## 4. Bounded units through P11

| Unit | Phase | Outcome | Owner | Dependency | Evidence | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P1-CONTRACT-BUNDLE` | P1 | One complete Agreement, shared and Process contract bundle. | PM controller | None. | Current 171-contract root has 285 dependency links and zero structural defects. Two clean compiles are byte-identical. Complete suite and build PASS. Three exact-byte reviews PASS. M1 acknowledgement records Ben's approval. | COMPLETE | Preserve the exact bundle through both pilots. | No |
| `P2-IDENTITY-WRITER` | P2 | Stable identities and one canonical writer. | PM implementation | P1 bundle. | Identity and transactional writer tests. | COMPLETE | Preserve condition groups and nested definitions in the same deal transaction. | No |
| `P3-SCOPE-EXTRACTION` | P3 | Definitions-first scope and extraction with open-world residuals. | PM and PI | P1 bundle. | PASS for the selected real Metsera grant. Nine sealed sources and eight passages were verified. One typed result and seven residuals were retained. | COMPLETE | Preserve the exact source and residual identities through Product wiring. | No |
| `P4-OBSERVATIONS-QUERY` | P4 | Normalised observations and one Product Query IR. | PM and PI | P3 outputs. | Numeric, unit, field, Ask/Browse and filter tests. | ACTIVE | Connect real release inputs. | No |
| `P5-CORRECTIONS-RELEASE` | P5 | Corrections survive re-extraction and candidate releases are immutable. | PM implementation | P3 and P4. | Correction-head and release tests. | ACTIVE | Connect QXO and Metsera pilot outputs. | No |
| `P6-SERVING` | P6 | Bounded set-based serving and release-aware cache. | PM implementation | P5 candidate release. | Call-budget, cache and query tests. | ACTIVE | Execute fixture-scoped runtime path. | No |
| `P7-SHARED-ROWS` | P7 | Query, Review, Compare and Corpus Context use one row contract. | PM and PI | P6. | F28 and Metsera cross-view byte and browser parity PASS. | COMPLETE | Preserve the same row identities through reviewed activation. | No |
| `P8-VERTICAL-SLICES` | P8 | QXO and Metsera pass source-to-product staging runs. | PM controller | P1-P7 links. | QXO F28 real isolated-staging rollback proof PASS. Metsera passes real source through inactive candidate persistence, all four browser views, an honest inactive-release source-reader refusal and exact generic V7 candidate-release import. | ACTIVE | Review the exact root and request the reserved bundle approval. | Reserved exact contract freeze only |
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
generic second-family envelope → Metsera runtime link and isolated-staging run →
Product-result release partition and active query → M2 → full-corpus
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
