# Canonical Corpus V2 execution ledger

This is the human-readable programme status. It is an operational control, not
an architecture document. The governing architecture is
[CODEX-PROGRAM.md](../CODEX-PROGRAM.md).

The PM controller owns the integration queue and updates this ledger after each
main integration.

Independent bounded work uses separate agents when their files and decisions
do not overlap. Each agent receives a compact task packet: exact main basis,
objective, exact files, inputs, output, tests, prohibited authority and
completion condition. The PM controller keeps shared integration, deployment
and milestone acknowledgement work. Mechanical work uses lower-cost agents. Legal,
identity, security and exact-root review uses the stronger governed review
model. Agents do not move main.

Process Intelligence work follows the approved execution plan at
`precedent-machine-process-design/docs/superpowers/plans/2026-07-29-process-intelligence-execution-plan.md`,
SHA-256 `570e19ff0ef8a8a130f18f11833348d25a0d9783eda01b540bfe7320dec6a55d`,
as amended by the FINAL 2026-08-02 amendment (Ben's rulings folded) at
`precedent-machine-process-design/docs/superpowers/plans/2026-08-02-process-intelligence-successor-plan.md`,
committed at `b5f2feae` on `codex/process-intelligence-design`,
SHA-256 `36788a52eb281abdb03ffe42421e3d224dee670f0a5572fd8f0d08d53d631abd`.

## 1. Current state

| Item | State |
| --- | --- |
| Main basis | `484c40a9515366d8efbfdcc72b71aaaa3aafe6e0` |
| Approved M1 review commit | `9cef64ec626a50a78710ee90b08cdc0466b42374` |
| Controller | Claude (Fable) took over as PM controller for M2 onward on 2026-07-31. Working branch `claude/codex-attestations-build-balance-z3xm23`. |
| Prior approved contract bundle | 177 contracts and 315 dependency links. It is immutable. |
| Current amended bundle ID | `901d45871b90d0677dd3fdfa6b718cba1795c5393cbbe91412e05e9ea3f7bd76` |
| Current amended contract digest | `3b24070932af4ed946eb72b41fbaf9d9e77dd0eaa191af4dedbaeb7fe3f8f632` |
| Current amended payload digest | `b8c1d79b6f8e9e7d403246804d52f10c5b6976a8928ce7bb95ae6a3687045a9d` |
| Contract dependency graph | 178 nodes, 324 links, 0 missing members, 0 duplicate identities, 0 conflicts, 0 unresolved dependencies, and 0 cycles |
| Bundle compile reference | Two clean compiles produced identical 1,096,276-byte output with SHA-256 `6cc2247acbcc63f9e0a0c81afc536ba65ab2ddc417abf3cb569c73629125152c`. |
| Latest complete suite on this branch | PASS on exact GitHub main `8bf79ff0`: 4,786 pass, 0 fail, 5 skip. GitHub CI run `30612191260` is green. |
| Latest production build on this branch | PASS on exact GitHub main `8bf79ff0`, 29/29 pages. Existing warnings remain: ESLint is absent, offline Supabase variables are absent, and two admin pages exceed the page-data warning threshold. |
| Latest deployments | Production `dpl_9qwje4q6Tgu9c9gqMJj925yzDRrK` and isolated Preview `dpl_BZfeBxY2zHUXCEeqVHqrnk4VyxGF` are READY and bind exact commit `484c40a9`. Production root returns HTTP 200; Preview is protected. Verified by Ben 2026-07-31. |
| Pre-production approval | The M1 Markdown acknowledgement is the only approval artefact. Signed status publication, signer inventory and protected review workflows are retired. |
| M1 contract freeze | PASS for the exact amended 178-contract bundle. Ben approved it subject to the reviewed-deal cohort condition. `docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md` binds the exact fingerprint and permits isolated-staging pilots only. |
| M1 independent review | PASS. The milestone architecture, legal and query reviews completed. The one high-reasoning fix-diff review passed at `9cef64ec`. No further M1 review is required. |
| Reviewed-deal cohort rule | PASS. An eligible reviewed deal is a real member of the executed selected cohort. A narrower filter or typed non-comparability can exclude it. QXO and Metsera retain content-addressed request, result, membership and execution evidence. Every market surface states `INCLUDED` or `EXCLUDED` and gives the reason. |
| Review and test cadence | One high-reasoning legal-semantic diff review before a milestone. One fix-diff re-review for a review fix. Three review lanes only at M1 to M4. Passing test evidence binds the code tree. Documentation, acknowledgement, ledger and specification-manifest-only commits do not trigger reruns. |
| M2 vertical slice | PASS 2026-07-31. QXO proof `QXO_CAPITALISATION_STAGING_PROOF_F28/V1` (vertical_slice_execution PASS) and Metsera proof `METSERA_EXCLUSIVITY_P8_CANDIDATE_PROOF/V2` (Actions run 30645667105) both green, rollback-only, containment intact. `docs/acks/M2-VERTICAL-SLICE-2026-07-31.md`. |
| Isolated-staging access | PASS. Project `sjumbznveyyiizhwvixj` was re-authorised and verified through the Supabase plugin on 2026-07-30. Production was not queried or changed. |
| Generic Agreement writer staging proof | PASS through exact commit `8a07ca30`. F28 and IOC reached the same SQL-native writer. The Agreement authority now uses one coherent version-3 candidate release manifest instead of a re-keyed version-1 shell. Valid inserts passed inside rollback transactions. Exact replay was a no-op. Conflicting replay failed closed. Twenty-eight coherently rehashed hostile requests failed before DML. Durable candidate rows and receipts remain zero. Production was not accessed. |
| Product query cache staging proof | PASS on exact commit `976de8f6`. One real IOC Product result was written, imported and transaction-locally activated. The first active query returned the result with action `RESULT_COMPONENT_CLAIM_EVIDENCE`. The exact repeat was a cache hit. Two transaction-local cache rows covered the empty and non-empty pages. Forced rollback left zero candidate, partition, serving and cache rows. The active pointer remained generation 10. Production was not accessed. |
| QXO F28 staging proof | PASS. Release `f79d3a9a92567db913da48f84540fa55cdff69d770bf4c9261a72e3428242240`; 14 metric slots; 1 set-based market read; 0 retries; 0 durable writes; active pointer unchanged. |
| Staging pointer check | PASS. The active staging pointer remains generation 10 at corpus release `c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3`. The F28 test release has zero durable release, market or serving rows and is not active. |
| M3 full-corpus certification | OPEN, now unblocked. First units: the mandatory pre-M3 write-set slim-down (sources by digest), the SQL-pin reconciliation test (recompile bundle + authority context and assert every SQL pin matches), and the P9 certification queue. |
| M4 pre-cutover | OPEN |
| Tier A containment | ACTIVE |
| Tier B attacker-model security | DEFERRED_POST_CUTOVER |

Routine branch work, integration, deployment and ledger updates do not require
Ben. Per Ben's 2026-07-31 grant, the controller may push main, execute SQL
against isolated staging, and take any operational action without asking.
Ben is asked only for legal-semantic decisions (taxonomy, codebook, rubric,
extraction meaning), milestone approvals (M2-M4), and production
import/cutover authorisation.

## Plain-English stage

The programme is in P8 Stage 5. P8 means that one real Agreement provision
and one real Process provision must travel from source evidence to every
required product view. M1 is complete. The contract bundle is structurally
clean, Ben approved its exact fingerprint, and all M1 review findings are
closed.

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
reviews pass. The SQL-native IOC validator now preserves the same
`APPROXIMATE` precision and threshold ClaimEvidence citation as JavaScript.
The Agreement rollback proof passes with 28 hostile calls. The active Product
query proof now uses a real IOC result, not only an empty page. It writes and
imports the common Product candidate record, activates only inside the test
transaction, returns the result with the exact claim-evidence action, and
returns the same page from cache. Rollback leaves zero candidate, partition,
serving or cache rows. The active staging pointer remains generation 10.
The latest correction removes the last synthetic market-evidence seam.
Metsera surfaces now consume evidence from a separate bounded cohort executor.
The Product writer rebuilds and preserves the request, selected candidates,
counts, membership, result and receipt. Fabricated or substituted evidence
fails. QXO includes the reviewed subject in the actual denominator and
distribution when it is eligible. The current task is the final complete test
and build, one main movement, two exact deployments, and the two isolated
staging pilots.

## 2. Work underway

| Unit | Phase | Outcome | Owner | Branch and files | Required checks | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PM-P8-IOC-PREDICATE-02` | P8 Stage 3 | Keep IOC capex under interim operating covenants, not representations. | PM implementation | Active branch; commits `32642f54`; Agreement predicate, navigation, validators and tests. | 63 affected tests PASS. | COMPLETE | Preserve in final exact-root compile. | No |
| `PM-P8-PRODUCT-AUTHORITY-02` | P8 Stage 3 | Derive Product authority from the exact contract root and candidate release. | PM implementation | Active branch; commit `b1ab88fc`; Product authority context and field catalogue. | 6 focused tests PASS. | COMPLETE | Use this context in Metsera, F28 and IOC Product compilers. | No |
| `PM-P8-AGREEMENT-DOMAIN-RESULT-02` | P8 Stage 3 | Convert F28 and IOC envelopes through one profile-driven Product domain-result adapter. | PM implementation | Active branch; commit `512b9fae`; one adapter and focused tests. | 4 focused tests PASS. | COMPLETE | Feed the output to the real Product query-result compiler. | No |
| `PM-P8-SURFACE-BINDING-02` | P8 Stage 3 | Bind Review, Query, Compare and Corpus Context to one Product result and source action. | PM implementation | Active branch; commit `871c2ed2`; one contract, runtime and focused tests. | 7 focused tests PASS. | COMPLETE | Register in the final manifest and use it after presentation. | No |
| `PM-P8-METSERA-AUTHORITY-02` | P8 Stage 4 | Preserve the exact Product authority context through Metsera row, result-set, surfaces and candidate-writer revalidation. | PM implementation | Active branch; Product writer contract, Process carrier, SQL validator, staging runner and hostile tests. | The carrier retains the exact context and source inputs. JavaScript and SQL reject missing or substituted authority before DML. The amended M1 acknowledgement now permits only the isolated-staging run. | COMPLETE | Preserve this authority chain in the pilot. | No |
| `PM-P8-AGREEMENT-MATERIALISATION-03` | P8 Stage 3 | Compile F28 and IOC through one generic Agreement envelope, Product Query IR, result, ordering, result set, presentation and four shared surfaces. | PM implementation | Active branch; generic materialisation contract/runtime, profile action bindings, reusable fixtures and focused tests. | 17 focused profile, navigation and domain-result tests PASS. Both families reach all four surfaces. A correctly rehashed cross-family query fails closed. | COMPLETE | Preserve this exact output as the only Agreement input to the candidate writer. | No |
| `PM-P8-GENERIC-WRITER-02` | P8 Stage 4 | Make F28 and IOC reach one immutable candidate-result insert through the existing canonical writer. | PM implementation | Active branch; candidate writer, governed SQL extracts and focused tests. | The SQL path closes copied provision rows and membership objects. Each governed function comment matches its exact bytes. | COMPLETE | Preserve the validated SQL and rollback proof in the pilot. | No |
| `PM-P8-AGREEMENT-WRITER-STAGING-03` | P8 Stage 4 | Prove the generic writer against isolated staging for both Agreement families after the IOC evidence correction. | PM controller | Active branch; exact commit `ea89c591`; bounded rollback runner, focused test and exact allowlist. | PASS. Two valid families, exact replay no-op, conflicting replay rejected, 28 hostile requests rejected before DML, zero durable rows or receipts, active pointer unchanged. | COMPLETE | Preserve the proof receipt for the final approval package. | No |
| `PM-P8-PRODUCT-CACHE-STAGING-01` | P8 Stage 4 | Prove that one active Product query serves and caches a real Agreement result without durable staging change. | PM controller | Active branch; exact commit `976de8f6`; rollback-only writer, importer, active query, cache runner and focused tests. | PASS. The real IOC result preserved `RESULT_COMPONENT_CLAIM_EVIDENCE`; repeat query was a cache hit; 124 affected tests pass; rollback left zero candidate, partition, serving and cache rows; pointer generation 10 unchanged. | COMPLETE | Preserve the proof receipt for the final approval package. | No |
| `PM-P8-SUBJECT-COHORT-01` | P8 Stage 5 | Include the reviewed deal when it meets the selected cohort and comparability rules. Show its exact inclusion state in every view. | PM implementation | Active branch; corrections through `9cef64ec`; QXO cohort receipt, Metsera cohort executor, surface and writer validation. | PASS. QXO contributes the subject to counts and distributions. Metsera requires an external selected-candidate input and preserves the computed request, counts, membership, result and receipt. Narrower and non-comparable exclusions remain typed. The bounded high-reasoning fix-diff review passed. | COMPLETE | Run both isolated-staging pilots on the integrated code. | No |
| `PM-P8-BUNDLE-APPROVAL-01` | P8 Stage 5 | Bind Ben's approval to the exact reviewed bundle and open only isolated-staging pilot execution. | PM controller | `docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md`; commit `b2c7ea31`. | PASS. The acknowledgement binds bundle `901d4587...`, 178 contracts and 324 links. Production authority is `NONE`. | COMPLETE | Use the acknowledgement in both staging runners. | Approval complete |
| `PM-GOV-BALANCE-01` | control | Use milestone acknowledgements and delete retired pre-production signer/status machinery. | PM controller | Commits `b95bd88e` and `508350c4`; governing instructions, workflows, scripts and tests. | PASS, 64 focused checks. Live-route guard tests remain. The M1 Markdown acknowledgement is the only pre-production approval artefact. | COMPLETE | Preserve the rule through main integration. | No |
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
| `PM-METSERA-REAL-ADMISSION-02` | P8 Stage 5 | Derive the phrasebook admission from the real Metsera materialisation input and receipt pair and preserve both through Product persistence. | PM implementation | Active branch; dedicated contract, adapter, Product admission, staging runner, persistence boundary and hostile tests. | PASS. The legacy synthetic path is removed. The bridge calls the official materialisation validator and retains the full input and receipt. Persistence rejects a correctly rehashed substitution. The adapter has no gold import and carries `NOT_GRANTED` with all limits `NONE`. | COMPLETE | Execute the source-only Metsera staging pilot. | Approval complete |
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

### M2 preparation units (2026-07-31, Claude controller)

| Unit | Outcome | Status |
| --- | --- | --- |
| `PM-M2-REGEN-TOOL-01` | `scripts/regenerate-release-identity-chain.mjs` with `--check`/`--write` over an explicit 7-link manifest. F21/F22 are recomputable; F23-F25 are frozen staging attestations declared report-only; F26/F28 pin nothing. Focused tests pass. | COMPLETE |
| `PM-M2-METSERA-INPUTS-01` | `scripts/fetch-metsera-sealed-sources.mjs` (fetch + verify the 9 sealed EDGAR filings against the sealed manifest) and `scripts/canonical-v2-prepare-metsera-pilot-inputs.mjs` (deterministic four-file pilot input generation via the official compilers; cohort files pass the real executor validators; byte-identical across runs). All 9 filings verified byte-exact against sealed SHA-256s. The DEFM14A citation metadata (`issuer_name: Metsera`, `source_location_label: Background of the Merger`) was verified against the real source bytes: heading at offset 307718, selected passage at 337991-338415, no intervening heading. | COMPLETE |
| `PM-M2-SQL-ROOT-REBIND-01` | The three SQL writer files pinned a stale `root_input_manifest` pair and stale bundle identity triple predating the final M1 contract commits; the deployed staging writer would have rejected both pilots. Rebound all pins to the M1-approved identity (`901d4587...`/`3b240709...`/`b8c1d79b...`, manifest `adb9f4f0...`/`27adc0c7...`). The compiled bundle on current main matches the M1-approved fingerprint exactly, so Ben's approval still binds; no re-approval needed. Staging must re-apply the three SQL files before the pilots. | COMPLETE |
| `PM-M2-METSERA-RUNNER-FIX-01` | The Metsera staging runner never set `product_query_definition_id` on its candidate release binding, failing `validateReleaseBinding` before DML. Fixed by binding the compiled row's `product_query_ir.query_definition_id`. Found by prep-agent interop run. | COMPLETE |
| `PM-M2-WRITE-ENVELOPE-01` | TEMPORARY: the canonical writer's persistence-envelope cap was raised from 4 MiB to 16 MiB (repo SQL, pinned digests and staging deployment) because the seam-removal correctly carries the complete real Metsera materialisation input, which embeds the nine sealed source documents (~5.8 MiB). MANDATORY BEFORE M3 CORPUS SCALE: slim the write set to carry sources by digest against sealed or staging-admitted immutable source documents: the sources are public SEC filings pinned by sealed SHA-256s, so per-write byte embedding adds no evidential value and scales the envelope with source size. The Management API request cap (HTTP 413 below 4 MiB) also forced a governed direct `--db-url` transport with a simple-protocol pg executor for oversized staging writes. | COMPLETE (temporary) |

### M3 basis decision (2026-07-31, Ben)

Canonical v2 proves validation, identity, relationships, writing, release and
product behaviour for reviewed inputs. It does NOT prove generic
source-to-candidate extraction: `lib/canonical-v2/` contains zero model calls
and every v2 deal to date is a hand-authored reviewed-slice module.

DECISION: build the native canonical v2 extractor. `lib/parser-v2/` does not
become the v2 extraction engine. Existing v1 claims, cards and provision
records are never canonical facts.

- **Native path**: source document -> deterministic sections and offsets ->
  definitions first -> governed scope -> semantic candidate production ->
  lexical disagreement net -> candidate graph -> validation and quarantine ->
  review and corrections -> canonical writer -> candidate release -> serving.
- **Migration path**: v1 provisions/cards/claims -> legacy-derived candidate
  adapter -> source-evidence rebinding -> the same downstream path. Labelled
  legacy-derived throughout; a migration aid, never an extraction authority.
- One downstream canonical path only. No separate writer, release, query or
  product systems for native and legacy inputs.
- Model output is a proposal. Model calls stay inside a bounded
  extraction-provider layer; identity functions, validators, normalisers,
  writers and release compilers remain deterministic.
- v1's accumulated legal knowledge (`lib/rubric.js`, `lib/taxonomy.js`,
  `lib/parser-v2/` prompts and taxonomy) is source material for the v2
  producer's prompts. That is not treating v1 output as canonical.
- Golden evals (`scripts/eval.js`) gate the producer from its first commit.
  Native extraction must match or beat v1 on the same deals before it
  displaces v1's role anywhere.
- Per-deal cost and wall-clock are measured on the F28 pilot before any
  corpus-scale run. No such telemetry exists today.

Claims discipline: pilots may claim the narrow source-to-product paths work,
that candidates preserve exact source evidence, that validation/review/writer/
serving contracts work, and that one failed candidate does not remove valid
siblings. Pilots may NOT claim generic extraction across the corpus. M3 may
claim the corpus was migrated and reviewed through a labelled legacy-derived
path; it may NOT claim native extraction generality until fresh
source-to-candidate runs pass the required family and corpus tests.

### M3 review protocol (2026-07-31, Ben)

**Auto-pass** requires ALL of: quoted text reproduces byte-identically from
stored source offsets; source document, hash and revision valid; provision
inside the certified complete source scope; v1 and v2 independently agree on
the material legal value under a governed comparator; not in a known-defect
group for that deal, family, attribute or extraction mechanism; lexical
disagreement set holds no unmatched signal that could change the result. A
candidate is never auto-passed when it is novel, an ABSENT/NOT_APPLICABLE
conclusion, multi-span or composed, a nested or cross-referenced definition,
an unresolved residual, a failed or uncertain extraction, or a high-risk
proposition selected for mandatory review. Auto-pass means "eligible subject
to sampling certification"; it does not make v1 canonical authority.

**Technical failure** (returns to engineering, unpublished, NOT to Ben unless
the source itself is ambiguous): quote or offset mismatch, document-hash
mismatch, malformed evidence, invalid code, missing required source,
inconsistent identity, invalid normalisation, schema failure.

**Ben review** when: v1 and v2 materially disagree; v2 asserts a material
proposition with no v1 counterpart; the candidate is in a known-defect group;
the source supports more than one reasonable legal reading; the candidate is
novel or source-specific; the result composes material propositions across
several spans; the lexical net flags a potentially missed proposition; or a
sampled auto-pass proves wrong. Queue ranked by legal materiality:
termination rights, fees, MAE, fiduciary provisions, no-shop exceptions,
consideration and closing conditions ahead of notices and administrative
clauses.

**Sampling**: fixed reproducible seed, ~2% overall, with a minimum sample from
every deal, provision family, candidate state, native-or-legacy input path and
important normalisation type. The reviewer reads the source WITHOUT first
seeing the v1 answer: an anchored sample cannot detect correlated error. A
sampled error fails the affected sample group, triggers review of the complete
deal-family or mechanism group, adds the pattern to the known-defect registry,
reruns the relevant extraction and disagreement sets, and resamples after
correction.

Three implementation notes recorded with the protocol: the governed comparator
for "material legal value" is legal-semantic engineering and is specified and
reviewed explicitly, not improvised; the known-defect registry is a versioned
artefact from day one because three protocol branches depend on it; per-group
minimums dominate the sample size, so expect 300-500 blind reads rather than
the ~260 a flat 2% implies.

### M3 extraction semantics (2026-07-31, Ben agreed)

**1. The producer never asserts a negative.** The model emits only
evidence-backed positives or open-world candidates. It never emits `ABSENT`
or `NOT_APPLICABLE`. `ABSENT` is DERIVED deterministically: the scope-closure
machinery proves the complete governed scope was examined and no positive
candidate was found within it. Where scope completeness is not proven, the
state is `NOT_EXAMINED`. Rationale: `ABSENT` is a positive legal assertion
that enters market-statistic denominators, so a wrong one is invisible and
authoritative-looking; `PRESENT` is self-policing because its quote must
reproduce byte-identically from stored offsets. This removes any need to
calibrate a model-confidence threshold for the dangerous case.

**2. Lexical disagreement vetoes negatives, never creates positives.** When
the lexical net finds a signal the semantic producer missed, that scope
cannot be concluded `ABSENT`: it drops to `NOT_EXAMINED` and enters the
review queue. A lexical hit NEVER becomes a `PRESENT` claim on its own,
because a regex match can sit in a recital or govern something else. Vetoing
only ever moves toward "we do not know"; creating could manufacture a
provision. Most disagreements therefore resolve mechanically.

**3. Taxonomy is the starting vocabulary, not a closed set.** Novel
propositions are preserved as open-world candidates and never forced to the
nearest known concept. Across the corpus an OPEN-WORLD COMMONALITY REPORT
clusters unmapped candidates by similarity and presents grouped patterns
("these 14 deals contain this thing we have no code for") for Ben's
adjudication at the end. The clustering proposes groupings only: it never
silently merges distinct concepts, and nothing is promoted into the taxonomy
without Ben's decision. Note: the lexical net can only match existing codes,
so it is structurally blind to novelty; the open-world path is the only
mechanism that catches genuinely new propositions and is therefore
load-bearing, not a side feature.

### Native extractor build state (2026-07-31)

Merged to main and green (4,866 pass / 0 fail / build OK):

| Piece | File | Property proven |
| --- | --- | --- |
| Provider seam | `native-producer/provider-interface.js` | Injected provider; recorded fixture and live call interchangeable; content-addressed receipt binds proposal AND evidence-residual counts, so a run that lost evidence cannot present as a clean run |
| Compiler | `native-producer/candidate-proposal-compiler.js` | Per-candidate `closure_id` so quarantine cannot take valid siblings; rejects ABSENT/NOT_APPLICABLE and non-provider-minted receipts |
| Prompt | `native-producer/capitalisation-producer-prompt.js` | Never asks for a negative; qualifiers attach where they operate; verbatim quotes byte-verified; novelty preserved as open-world |
| Sectionizer | `native-producer/deterministic-sectionizer.js` | Automatic section discovery reproduces the hand-picked QXO content exactly (`text_sha256` equals `CAPITAL_STRUCTURE_SHA256`; limb starts 22/777/2478/3656/4435 byte-for-byte). 385 nodes round-tripped on a real 394KB agreement |
| Backend | `native-producer/anthropic-provider.js` | Bounded retries; malformed response is a typed failure, never an empty success |
| Run | `native-producer/native-extraction-run.js` | Unresolvable section reference fails closed with zero provider calls; evidence outside governed scope rejected before compilation |

Finding of record: the hardcoded QXO intervals (`CAPITAL_STRUCTURE_INTERVAL`,
`SECTION_5_2_INTERVAL`) are FIXTURE ARTEFACTS, not offsets into a real SEC
filing. No full merger agreement text is committed to this repo. Equivalence
was therefore proven by content digest, not by position.

OPEN INTEGRATION HAZARD, close before wiring the producer to the canonical
writer: evidence `absolute_start`/`absolute_end` on compiled candidates are
SECTION-LOCAL, because the provider is licensed to see only the section slice.
The run receipt carries the document-absolute offsets of each resolved
section, so true position is recoverable as `section.start + evidence.start`,
but any downstream stage that treats evidence offsets as document-absolute
will silently cite the wrong text. The writer integration must either shift
offsets to document-absolute (re-deriving `excerpt_id`) or assert the
coordinate frame explicitly. A test must pin whichever is chosen.

### Converter defect and the faithful/tolerant split (2026-08-01)

The first live F28 run concluded the model had hallucinated citations like
`3.1(b)(i)`. THAT CONCLUSION WAS WRONG and is corrected here. The document
contains `3.1` 104 times; a real cross-reference reads
`Section&nbsp;<B><I>&lrm;</I></B>3.1(b)(i)`. The canonical-v2 lexer decoded
all numeric entities but only ~20 named ones, so `&lrm;` fell through and the
literal string was emitted into canonical text, making "Section 3.1"
unsearchable. The model quoted real bytes correctly; our converter corrupted
them first.

First fix attempt was also wrong: decoding zero-width marks to an empty
string made matching work by DELETING real characters, which makes canonical
text a lie about the document, stops quotes reproducing honestly, and shifts
every later byte offset. The F19 drift check caught it:
`reviewed-qxo-admitted-no-shop-actions-slice.js` anchors on a literal U+200E
between "Article" and "VI", so those marks are load-bearing.

SETTLED DESIGN. Two layers, never collapse them:
- **Canonical text is FAITHFUL.** Entities decode to their real codepoints and
  are KEPT. The literal `&lrm;` never survives, but U+200E does.
- **Matching is TOLERANT.** `lib/canonical-v2/zero-width-normalise.js` strips
  zero-width and bidi marks at COMPARISON time only, returning offsets into
  the untouched original so byte spans stay valid. Never use it to produce
  anything stored, hashed or offset-indexed.

Consequence of record: fixing the converter invalidates every source admitted
under the old one. Content-addressed identity means an upstream correctness
fix propagates to everything derived from it. That propagation is the system
working, not failing.

Method lesson: a verification that derives its own answer can be wrong in the
same breath. `CITATION_DISAGREEMENT` carrying BOTH values, with no assumption
about which side is wrong, is what surfaced this. A strict "not in text =
hallucination" rule would have permanently mislabelled correct extractions.

### DECISION FOR BEN: converter source hash sits inside canonical text identity (2026-08-01)

Re-admitting the QXO source after the entity fix produced a finding that
matters more than the re-admission. Branch `claude/qxo-readmit-after-entity-fix`
is COMPLETE and NOT MERGED, awaiting this decision.

WHAT WAS FOUND. The QXO filing contains none of the newly-decoded entities, so
the corrected converter produces **byte-for-byte identical canonical text**:
`canonical_text_sha256`, byte length, `converter_config_digest` and
`source_map_digest` are all unchanged. Only `converter_digest` moved, and
that is `sha256(the converter's own source file)`. Because `canonical_text_id`
hashes `converter_digest`, the text's identity churned even though the text
did not.

BLAST RADIUS OF THAT ONE CHURN: ~20 lib modules re-pinned across the F6->F22
chain, 71 files changed, and 15 F23/F26 tests broken. Those tests consume
hand-authored "sealed" cohort fixtures that `scripts/regenerate-release-identity-chain.mjs`
already flags as NOT mechanically reproducible ("do not guess"). F19 passes
with the branch; the suite goes from 1 failing test to 15. The agent stopped
rather than re-author sealed legal data, which was correct.

THE QUESTION: should the identity of a canonical text depend on the hash of
the SOURCE CODE that produced it?
- **Keep it (status quo).** Provenance is airtight: the identity proves exactly
  which converter build produced the bytes. Cost: every converter edit,
  including a comment or a rename, churns every downstream identity in the
  corpus, even when output is provably identical. At corpus scale this is a
  standing tax on ever improving the converter.
- **Drop it to metadata.** Identity derives from OUTPUT (text digest, config
  digest, source-map digest); `converter_digest` is recorded alongside as
  provenance but does not enter the identity. A converter fix that changes no
  bytes then changes no identities. Cost: two converter builds producing
  identical output become identity-indistinguishable, so a behavioural
  difference that happens not to alter THIS document is not visible in the id.

Recommendation: drop it to metadata. The evidence chain is carried by the text
digest and the source map, both of which are output-derived and unaffected. We
have just paid a 71-file, 15-test cost for a fix that changed nothing a reader
would ever see, and that tax recurs on every future converter improvement,
which is exactly the work we most want to keep cheap.

Either way the F23/F26 sealed cohort fixtures need re-authoring by someone
with the legal context, or an explicit decision to regenerate them.

### P9 acceptance definitions drafted (2026-08-01)

`docs/codex-program/P9-ACCEPTANCE-DEFINITIONS.md` proposes a mechanical
acceptance definition for all 22 P9 gates. PROPOSAL ONLY:
`programme-gates.yaml` is untouched; adoption is a separate deliberate step.

Sobering summary: 1 HIGH / 8 MEDIUM / 13 LOW confidence, and **11 of 22 need
Ben's ruling** on a genuine judgment call. Six gates (`P9_MKT_WORK`,
`P9_NUMERIC`, `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`,
`P9_SHADOW_REEXTRACTION`, `P9_IDENTITY_AND_DRIFT`) presuppose a canonical-v2
corpus that does not exist and cannot run even in principle until the native
extractor produces a real multi-deal candidate set. `P9_RENDER_PARITY` has a
wrong-but-plausible answer already in the repo (`reports/PARITY-GATE-2026-07-15.md`
is legacy M2 evidence, explicitly NOT P9 evidence). `P9_DEPLOYMENT_PARITY`'s
existing acceptance block is unreachable: its named governing test is prose in
`adversarial-tests.md`, and the only test referencing those IDs checks the
strings exist in the markdown, not that the mechanism works.

LATENT DEFECT FOUND AND VERIFIED, not fixed: `lib/programme-gates/governing-registry.js`
hard-requires `schema: canonical-programme-gates/v1` (line 100) while the live
`programme-gates.yaml` declares `v2`, so loading the real registry through it
throws. Its consumers (`g0-status-readiness.js`,
`containment-status-readiness.js`) belong to the retired signed-status
machinery. No test exercises the path, so the drift is invisible. Candidate
for deletion alongside the rest of the retired publication layer rather than
repair: a decision, not a bug fix.

### P9 registry correction (2026-07-31, mechanically verified)

`docs/codex-program/programme-gates.yaml` contains 22 P9 gates, not 25.
Exactly one (`P9_DEPLOYMENT_PARITY`) carries an acceptance block; the other 21
have an id and state only. Every gate receives a mechanical acceptance
definition before M3 relies on it.

### D3 ratified: live gate-evidence channel built, self-verifying layer deleted, adversarial count corrected (2026-08-05)

`ROADMAP.md` step D3 and `DECISIONS.md` item 10 asked for two things: a way
for a gate with real, finished work to record a genuine pass instead of being
structurally stuck at "open", and deletion of the self-verifying
`p9-acceptance-*` layer whose validator compared its own output to itself.
Commit `2396bf50` (2026-08-05) did both, the same day the decision was
recorded. This entry ratifies that in the ledger; the work itself needed no
further engineering.

**The live channel.** `governing-registry.js` keeps its existing rule that
every gate's *declared* `state` in `programme-gates.yaml` must read `OPEN`;
that is intentional, so the frozen v2 contract stays byte-identical to what
was reviewed, and it did not change. Added alongside it:
`computePreproductionGateStatus()`, a second, computed field that re-derives
evidence live, from primary sources, on every load, for exactly two gates,
`P1_CONTRACT_BUNDLE_COMPLETE` and `P1_VERTICAL_SLICE_PASS`. Verified directly:
both now report `computed_state: PASS`, the first by recompiling the frozen
M1 bundle and checking it against the approved fingerprint and a hash-pinned
acknowledgement file, the second by re-validating the committed
vertical-slice attestation against its own tested predicate. Every other gate
has no verifier registered and can only ever report `computed_state: OPEN`,
by construction. `tests/programme-gates/governing-registry.spec.js` passes 30
of 30, run directly, including hostile cases proving no verifier can launder
an unverified pass and that a verifier disagreeing with pinned evidence falls
back to open rather than throwing.

**The deletion.** The self-verifying layer, `p9-acceptance-definition-authority.js`,
`p9-acceptance-evidence-engineering-queue.js`,
`p9-acceptance-evidence-inventory-writer.js`, `p9-acceptance-evidence-inventory.js`
and a fifth module deleted in the same change, `p9-definition-proposal-layer.js`,
plus their 4 test specs and the 1 script that wrote their evidence, is
confirmed gone from the working tree. 1,001 lines across the 5 modules by
exact line count, matching the figure `DECISIONS.md` item 10 already gives.

**The adversarial-test count.** Of 289 mandatory adversarial tests, 7 are
implemented and 282 throw "not implemented", not 8 and 281 as earlier
figures in `ROADMAP.md` said. Confirmed by loading
`test-executable-registry.js` and counting how many of the 289
`MANDATORY_ADVERSARIAL_TEST_IDS` return `IMPLEMENTED`. The drop from 8 is a
correction: `PREVIEW-AUTH-01`, previously counted as covering authentication,
was deliberately un-registered in the same commit, because it matched
regular expressions against a script's source text and never issued a real
request. Removing a decorative "implemented" label is a point in the
catalogue's favour.

**Reclassification, not a debt.** `adversarial-tests.md`'s own `GATE-01` entry
binds the full 289-member catalogue to `PreCutoverCertification`, the M4
milestone, and only that milestone. `P9-CORPUS-CERTIFICATION` above is
`BLOCKED`, before M3, well before M4. So the 282 unimplemented tests are a
milestone-scoped backlog for M4, not a current shortfall, unless a status
report cites the 289 figure against a pass count outside M4 readiness. A
separate cross-check against the five real defects fixed in the two days
before this entry, card-selection leaks, a money parser taking the first
number in a string, a section-overlap defect in the deterministic
sectionizer, a capability scanner matching text instead of parsing it, and a
quote-offset error, found that none of the five would have been caught by
any of the 289 specs, implemented or not; the catalogue targets
canonical-v2's formal identity, claims, release and import invariants, a
different layer from where defects have actually surfaced recently. Separately,
2 of the 7 implemented tests, `GATE-BOOTSTRAP-01` and `REVIEW-CONTEXT-01`,
are currently bound only to test files a 2026-07-30 commit (`afbf1a43`)
deleted, and 3 more keep half or fewer of their listed files; nothing checks a
bound file list against the filesystem, so this drifted unnoticed. This is
recorded in full in `ROADMAP.md` step D3, including how the 7 was counted,
that finding, and the file-by-file cross-check. The 23 still-open `P9_*` gates
are a separate backlog from the 282 tests; `P9-ACCEPTANCE-DEFINITIONS.md`
stays in the repository, `WITHDRAWN_NON_AUTHORITY` and not adopted into
`programme-gates.yaml`, as a graded starting draft for that work rather than
current authority.

## 3. Next 48 hours

1. DONE 2026-07-31: complete suite and build passed, main moved once to
   `484c40a9`, production and isolated Preview deployed and verified.
2. Run the QXO Agreement control in isolated staging.
3. Prepare and run the external Metsera cohort input and source-only Process
   slice in isolated staging.
4. Verify writer, candidate release, Query, Review, Compare, Corpus Context,
   source reading, corrections and failure isolation.
5. If both pass, record M2 as a markdown acknowledgement and open wider
   candidate extraction (M3 work).
6. Land the release-identity-chain regeneration tool (approved mitigation for
   the F21-F26 fixture-rebind cascade) and delete the two retired
   programme-gate workflow files.

## 4. Bounded units through P11

| Unit | Phase | Outcome | Owner | Dependency | Evidence | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P1-CONTRACT-BUNDLE` | P1 | One complete Agreement, shared and Process contract bundle. | PM controller | None. | Approved 178-contract root, 324 links, zero structural defects, byte-identical compiles, M1 reviews and acknowledgement PASS. | COMPLETE | Preserve exact bytes through the pilots. | No |
| `P2-IDENTITY-WRITER` | P2 | Stable identities and one canonical writer. | PM implementation | P1 bundle. | Identity and transactional writer tests. | COMPLETE | Preserve condition groups and nested definitions in the same deal transaction. | No |
| `P3-SCOPE-EXTRACTION` | P3 | Definitions-first scope and extraction with open-world residuals. | PM and PI | P1 bundle. | The sealed Metsera fixture proves the typed sidecar and residual contract. Nine sources and eight passages were verified. One typed result and seven residuals were retained. This fixture uses reviewed evidence and is not the source-only extractor pilot. | ACTIVE | After signed permission, run the source-only extractor and compare it with the sealed review record. | No |
| `P4-OBSERVATIONS-QUERY` | P4 | Normalised observations and one Product Query IR. | PM and PI | P3 outputs. | Numeric, unit, field, Ask/Browse and filter tests. | ACTIVE | Connect real release inputs. | No |
| `P5-CORRECTIONS-RELEASE` | P5 | Corrections survive re-extraction and candidate releases are immutable. | PM implementation | P3 and P4. | Correction-head and release tests. | ACTIVE | Connect QXO and Metsera pilot outputs. | No |
| `P6-SERVING` | P6 | Bounded set-based serving and release-aware cache. | PM implementation | P5 candidate release. | Call-budget, cache and query tests. | ACTIVE | Execute fixture-scoped runtime path. | No |
| `P7-SHARED-ROWS` | P7 | Query, Review, Compare and Corpus Context use one row contract. | PM and PI | P6. | F28 and Metsera cross-view byte and browser parity PASS. | COMPLETE | Preserve the same row identities through reviewed activation. | No |
| `P8-VERTICAL-SLICES` | P8 | QXO and Metsera pass source-to-product staging runs. | PM controller | P1-P7 links. | QXO F28 rollback proof PASS. The Metsera reviewed fixture passes inactive persistence, four views, source-reader refusal and V7 candidate import. M1 permits the final isolated-staging pilots. | ACTIVE | Integrate and deploy once, then run the QXO control and source-only Metsera pilot. | Approval complete |
| `P9-CORPUS-CERTIFICATION` | P9 | Full corpus passes quality, identity, drift, performance, restore and rollback controls. | PM controller | M2 pass. | M3 acknowledgement and Phase 9 gates. | BLOCKED | Begin after both pilots pass. | No |
| `P10-PRODUCTION-IMPORT` | P10 | Exact inactive production import with member parity and resumable checkpoints. | PM controller | M3 pass. | Replay no-op, conflicting replay fail-closed, complete parity. | BLOCKED | Run only after staging certification. | Where contract requires |
| `P11-CUTOVER` | P11 | Atomic whole-tuple activation, smoke and rollback. | PM controller | M4 pass and Ben authorisation. | Cutover receipt, production smoke and rollback. | BLOCKED | Request one-use authorisation at M4. | Yes |
| `P12-SECURITY-HARDENING` | P12 | Add attacker-model certification for the internal product. | PM implementation | Successful cutover. | Route/action inventories, probes, egress and revocation tests. | BLOCKED | Start after cutover. | No unless governance changes |

The F28 envelope is source-specific pilot code. After F28 passes end to end,
the second Agreement family must use a parameterised generic envelope
contract. The programme must report an inability to parameterise as a design
defect. It must not copy the F28 files.

## 5. Critical path

M1 bundle approval → combined main integration and exact deployments → QXO
isolated-staging control → source-only Metsera isolated-staging run →
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
