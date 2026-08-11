# Module disposition audit

Date: 2026-08-10
Checkout: `853b9e83b1bf067eabb5b2c86a10918e47a7d7e6`
Scope: static code and test inspection only. No test, generator, model route, write or publication path was run.

## 1. Decision terms

A **module** is a unit of code with one caller-facing responsibility. An **interface** is the input and output that callers can use. An **implementation** is the code hidden behind that interface. A **seam** is the place where one representation passes to another. An **adapter** converts one interface to another. **Depth** is the useful behaviour hidden behind a small interface. **Leverage** is the amount of system behaviour improved by one local change. **Locality** means that one defect can be fixed in one place.

The dispositions mean:

- **KEEP**: keep the responsibility and its present interface. Additive validation fields can be added without changing its role.
- **CHANGE**: keep the responsibility, but change its interface, output or position in the pipeline.
- **REPLACE**: remove the caller-facing responsibility from the target path because it sits at the wrong seam. This does not mean delete all of its implementation. Proven internal algorithms should move behind the replacement interface.

This audit applies the disposition to the public responsibility. It does not treat a large file as one indivisible implementation.

## 2. Executive finding

The system should be restructured. It should not be rewritten.

The exact-source, identity, legal-vocabulary, deterministic parsing, projection and publication implementations contain substantial reusable work. The caller-facing responsibilities that reconstruct source context from a candidate or attach structure after resolution are at the wrong seam. The all-family resolver also exposes the wrong public interface. Those responsibilities should be replaced by one agreement analysis interface. Their proven family algorithms should be migrated, not re-created.

Four present caller-facing responsibilities should leave the target path:

1. `candidate-governing-context.js`: replace candidate-first context discovery with parent-to-child context facts from the source tree.
2. `structure-placement.js`: replace post-resolution structure annotation with source-node and context links present before claim resolution.
3. `candidate-resolution.js`: replace its all-family public interface with `analyseAgreement(index, options)`. Reuse its deterministic legal handlers behind that interface.
4. `native-extraction-run-citation-followup.js`: replace family-specific extra extraction calls with a general cross-reference graph and deterministic analysis scheduling. Reuse its receipt-merging checks during migration.

Everything else in the active path should be kept or changed incrementally.

## 3. Actual current path

```text
SEC response bytes
  -> intake receipt
  -> deterministic HTML-to-text conversion and source map
  -> independent conversion verification
  -> admitted semantic source
  -> article/section/subsection sectionizer
  -> family section selection and classification
  -> family prompt and provider proposal
  -> compiled candidate with section-local evidence
  -> all-family candidate resolver
       -> family-specific context recovery
       -> semantic limb paths
       -> claim, review or open-world result
       -> post-resolution structure annotation
  -> write-set adapter converts coordinates and remints identities
  -> write-set validation and canonical writer
  -> family product projection
  -> review-row route and headless renderer
  -> publication disposition
  -> serving filter, which still rejects REQUIRE_PUBLISHED
```

There is no single source-tree interface across this path. There are three lower-level structures:

1. `deterministic-sectionizer.js` supplies `ROOT`, `ARTICLE`, `SECTION` and generic `SUBSECTION` nodes.
2. `governing-structure.js` derives leaves and chapeau strings after an evidence span exists.
3. `limb-components.js` derives semantic path nodes from model-authored `limb_path` values.

The overlap causes weak locality. A source-structure defect can require edits in the sectionizer, the all-family resolver, a family projection and a review route.

## 4. Source intake and exact source

| Current module | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `lib/canonical-v2/canonical-bytes.js` | Canonical JSON, content-derived identifiers and exact UTF-8 slicing. | `canonical-v2-source-identity.test.js`; many identity tests. | **KEEP** | This is correct low-level implementation. The target tree and semantic records should use it rather than create another identity method. |
| `lib/canonical-v2/sec-edgar-intake-capture.js` | Records exact SEC response bytes and retrieval facts before conversion. It cannot claim admission. | `canonical-v2-sec-edgar-intake-capture.test.js`. | **KEEP** | The responsibility is narrow and fail-closed. It preserves the authoritative input bytes. |
| `lib/canonical-v2/sec-html-canonical-text.js` | Converts admitted HTML bytes to deterministic canonical text and a byte-accounted source map. | `canonical-v2-sec-html-canonical-text.test.js`. | **KEEP** | It preserves conversion lineage and maps multibyte and entity output to source regions. A contract tree should consume this output. |
| `lib/canonical-v2/source-map-payload-store.js` | Validates and stores the compressed source-map payload used by source admission. | `canonical-v2-sec-source-admission.test.js`; `canonical-v2-admitted-source-chain-rebuild.test.js`. | **KEEP** | This is source lineage, not semantic structure. Its role is correctly isolated. |
| `lib/canonical-v2/sec-html-canonical-text-verifier.js` | Independently checks the conversion, input coverage and identities. | `canonical-v2-sec-html-canonical-text-verifier.test.js`. | **KEEP** | Independent verification should remain outside the converter. |
| `lib/canonical-v2/sec-source-admission.js` | Refuses unverified or inconsistent source chains and creates a verified admission. | `canonical-v2-sec-source-admission.test.js`. | **KEEP** | This is the correct trust seam between intake and deterministic parsing. |
| `lib/canonical-v2/admitted-semantic-source.js` | Creates the exact canonical-text geometry and compact reference used downstream. | `canonical-v2-admitted-semantic-source.test.js`. | **KEEP** | The target `indexAgreement` call should accept this object, not a bare string. |
| `lib/canonical-v2/admitted-source-chain-rebuild.js` | Rebuilds an admitted source chain from recorded raw material for replay and import. | `canonical-v2-admitted-source-chain-rebuild.test.js`. | **KEEP** | It is a valid replay adapter. It must not become a way to invent missing source authority. |
| `lib/canonical-v2/source-structure.js` | Builds immutable source identities, exact spans, excerpts, semantic provision occurrences and provision components. | `canonical-v2-source-identity.test.js`; `canonical-v2-semantic-graph.test.js`; `canonical-v2-structural-provision-instance.test.js`. | **KEEP** | Its exact-source and semantic identity primitives are sound. Do not turn its concept-specific `ProvisionInstance` into the written contract tree. Add source-node references to semantic records through the new analysis seam. |

### Source-stage conclusion

No intake module needs replacement. The source admission chain is the strongest part of the architecture. The missing structure starts after admission, not before it.

## 5. Written structure, citations and inherited context

| Current module | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `lib/parser-v2/structural.js` | Shared article and section heading detection. It also counts some lower markers. | `parser-hierarchy.test.js`; `parser-boundaries.test.js`; `canonical-v2-native-sectionizer.test.js`. | **KEEP** | Keep it as an internal detector shared with V1. It is not a complete agreement representation and must not be exposed as one. Reuse its proven heading and boundary rules. |
| `lib/canonical-v2/native-producer/deterministic-sectionizer.js` | Builds a stable flat list of `ROOT`, `ARTICLE`, `SECTION` and `SUBSECTION` nodes with parent identifiers and exact UTF-8 spans. | `canonical-v2-native-sectionizer.test.js`; `canonical-v2-inline-decimal-headings.test.js`; `canonical-v2-citation-constructibility.test.js`. | **CHANGE** | Make this the main implementation seed for `indexAgreement`. Extend it to complete source blocks, explicit children, typed markers, headings, sentences, chapeaux, limbs, sub-limbs, provisos and trailing qualifications. Preserve current marker and offset algorithms. |
| `lib/canonical-v2/native-producer/family-section-ref-generator.js` | Re-parses source and proposes section references for each family. It does not pin truth. | `canonical-v2-family-section-ref-generator.test.js`. | **CHANGE** | It should query the complete agreement index. It may propose analysis roots, but it must not define containment or recreate structure. |
| `lib/canonical-v2/native-producer/citation-constructibility.js` | Parses a citation and checks whether the current sectionizer can construct it from node references. | `canonical-v2-citation-constructibility.test.js`; extraction-run tests. | **CHANGE** | Keep its strict citation grammar and fail-closed checks. Resolve citations to stable nodes in the cross-reference graph instead of searching a partial section list. |
| `lib/canonical-v2/native-producer/bare-citation-trigger-parser.js` | Conservatively recognises a termination-fee quote that contains only a bare section reference. | `canonical-v2-bare-citation-trigger-parser.test.js`; Modiv citation replay. | **KEEP** | This is a useful family-specific lexical rule. It can signal that a cross-reference is operative. It must not own traversal. |
| `lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js` | Makes one extra family-specific extraction pass for a cited termination-fee section and merges receipts. | `canonical-v2-native-extraction-run-citation-followup.test.js`; Modiv citation replay. | **REPLACE** | Cross-reference traversal belongs in the agreement graph and analysis scheduler. Do not pay for another model call merely to retrieve already indexed source context. Reuse its document-identity checks, typed residuals and receipt merge during side-by-side migration. |
| `lib/canonical-v2/native-producer/governing-structure.js` | Builds a section-local marker outline after an evidence span is known, then selects one leaf and chapeau chain. | `canonical-v2-governing-structure.test.js`; termination chapeau structure-swap test. | **CHANGE** | Move its marker and chapeau heuristics inside `indexAgreement` and the deterministic context engine. It must return stable source-node links, not a second temporary hierarchy. |
| `lib/canonical-v2/native-producer/candidate-governing-context.js` | Builds a report-only context ladder around one candidate and exactly one operative evidence edge. | `canonical-v2-candidate-governing-context.test.js`. | **REPLACE** | Context cannot start with a candidate. It excludes multi-span claims and arrives too late. Replace it with provenance-bearing `ContextFact` records propagated from ancestors to descendants. Reuse its byte checks and exact context-window records only as a migration adapter. |
| `lib/canonical-v2/native-producer/structure-placement.js` | Adds `structure_context` after resolved, review and open-world outputs exist, then offers a function that removes it. | `canonical-v2-governing-structure.test.js`. | **REPLACE** | This responsibility is at the wrong seam. Source-node and inherited-context links must exist before claim formation and must not be stripped before output. Its current serialisation can support an old-result adapter only. |
| `lib/canonical-v2/native-producer/limb-enumeration-scan.js` | Compares source marker scans with proposed limb paths as a non-blocking diagnostic. | `canonical-v2-limb-enumeration-scan.test.js`; extraction-run tests. | **CHANGE** | Keep the diagnostic role, but obtain source limbs from the agreement index. A proposal disagreement should compare against stable nodes, not cause another independent source scan. |
| `lib/canonical-v2/derived-limb-identity.js` | Defines a proposed derived limb identity, but it is not wired into the measured extraction path. | Direct module tests and static call-site search. | **KEEP OUT OF TARGET PATH** | Do not promote this semantic identity into source authority. Stable source-node identity must come from exact bytes and parentage before claims exist. |

### Structure-stage conclusion

The complete written hierarchy is the missing deep module. It should have one main indexing call. The existing detector and sectionizer supply useful implementation, but neither currently owns every source block. The candidate-first and post-resolution interfaces should not survive.

## 6. Family routing and proposal production

| Current module or group | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `family-detection-profiles.js` | Supplies closed, content-derived heading and lexical term profiles for every registered family. | `canonical-v2-full-corpus-execution-manifest-planner.test.js`; classifier tests. | **KEEP** | The profile data is useful deterministic routing evidence. It does not define source structure. |
| `section-family-classifier.js` | Applies deterministic title, article-context and text rules, then permits an optional classifier result. | `canonical-v2-section-family-classifier-quarantine.test.js`; family seam tests. | **CHANGE** | Accept stable source nodes and return route evidence plus uncertainty. It must not define a section's structural extent. Keep the deterministic rules. |
| `producer-prompt-registry.js` | Maps each of 25 family identifiers to one prompt builder and fails closed for an unknown family. | `canonical-v2-producer-prompt-registry.test.js`; provider family-dispatch tests. | **KEEP** | This is a narrow, deterministic lookup with good locality. It remains inactive while Phase B is locked. |
| All 25 `*-producer-prompt.js` modules | Instruct the model to propose family-specific claims from one flat selected section. Some prompts also request semantic `limb_path` or qualifier fields. | Prompt-specific and family-seam tests, including capitalisation, termination-fee, financing, IOC and recorded replay tests. | **CHANGE** | Preserve the legal instructions and closed response shapes. If Phase B resumes, pass the selected source subtree, inherited context facts with provenance, definition and cross-reference links, and residual source blocks. A prompt must never author the source hierarchy. |
| `native-prompt-binding.js` | Binds one prompt to one governed scope and records its digest. | Native producer determinism, dispatch and prompt-budget tests. | **CHANGE** | Bind to a versioned subtree analysis packet rather than flat section text. Keep content-derived prompt and scope receipts. |
| `provider-interface.js` | Injects a model or recorded fixture behind one function and records provider, model, prompt and scope identities. It does not itself call a model. | `canonical-v2-native-producer-provider-boundary.test.js`; provider determinism, schema closure and evidence integrity tests. | **CHANGE** | The external-provider seam is correct, but `governed_scope` must become a complete read-only analysis packet. The receipt and dependency injection should remain. Phase B stays locked. |
| `anthropic-provider.js` | Builds provider requests, parses model proposals, creates semantic limb paths and locates returned evidence quotes. | `canonical-v2-native-provider.test.js`; output-ceiling and recorded replay tests. | **CHANGE** | Keep transport and closed response parsing. Remove source-structure authority. Replace first-occurrence quote anchoring with stable node/span references or an explicit ambiguity residual. |
| `codex-cli-provider.js` | Implements the alternative model transport behind the same provider seam. | `canonical-v2-native-codex-cli-provider.test.js`. | **KEEP** | Its transport responsibility is separate and can remain locked. It must not be called during Stage 2Y. Adapt it only after the new Phase B input contract is approved. |
| `provider-record-replay.js` and `recorded-provider-response-replay.js` | Record and replay provider output without a live model call. | `canonical-v2-provider-record-replay.test.js`; `canonical-v2-recorded-provider-response-replay.test.js`. | **KEEP** | These adapters are required for deterministic migration comparison and rollback. |
| `native-extraction-run.js` | Sectionizes raw source, resolves caller-supplied references, classifies, dispatches providers, compiles proposals and records residuals and diagnostics. | `canonical-v2-native-extraction-run.test.js`; citation-follow-up and family seam tests. | **CHANGE** | Keep deterministic orchestration, receipts and failure isolation. Its input should be `AgreementIndex` plus an analysis selection. It should not create a competing source tree or send context-free flat sections. |
| `candidate-proposal-compiler.js` | Validates proposal shape and provider receipt, then converts a proposal into a claim-shaped candidate before final subject resolution. | Producer boundary, schema closure, determinism and evidence-integrity tests. | **CHANGE** | Keep schema closure, evidence checks and receipt binding. Preserve proposal identity until source nodes, subject and context dependencies are resolved. Do not mint a near-final claim too early. |
| `coverage-proxies.js` | Reports heuristic expected-versus-observed items for a section. It cannot fail extraction. | Native extraction-run tests and dedicated coverage tests. | **KEEP** | Keep it as a diagnostic only. It is not a completeness measure. Add a separate exact source-node ownership measure at the deep interface. |

## 7. Semantic analysis and claim resolution

| Current module or group | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `contract-bundle.js` and bundle compiler modules | Define the closed, versioned legal concept, claim and relationship vocabulary. | `canonical-v2-contract-bundle-versions.test.js`; semantic and resolver tests. | **KEEP** | This is the correct deterministic authority for what can resolve. It must remain separate from source parsing. |
| `definition-graph.js` | Validates definition cues and uses with exact source spans and relationship identity. | `canonical-v2-semantic-graph.test.js`; reviewed definition graph tests. | **KEEP** | A definition graph is the right non-tree representation. Attach it to stable source nodes and retain its existing exact-span rules. |
| `entity-subject.js` and `deal-participant-relationship.js` | Define typed entity subjects and deal-participant relationships. | `canonical-v2-entity-subject.test.js`; `canonical-v2-deal-participant-relationship.test.js`; transaction contract tests. | **KEEP** | These are suitable semantic graph primitives. Static import inspection confirms the measured `candidate-resolution.js` path does not use them. Do not credit the current pipeline with an agreement-wide party or control graph until they are integrated. |
| `transaction-structure-resolution.js` | Builds transaction-structure revisions using participant relationships. | Transaction-structure tests. | **KEEP** | Keep it as a semantic graph producer. Integrate it through `analyseAgreement`; do not use it as source hierarchy. |
| `claims-relationships.js` | Builds stable claim and relationship identities and exact evidence edges with five evidence roles. | `canonical-v2-semantic-graph.test.js`; writer and correction tests. | **CHANGE** | Preserve identity and role rules. Add stable source-node references and explicit derivation dependencies for inherited facts. Existing claim identifiers should not churn unless their governed value or evidence truly changes. |
| `party-capacity-registry.js` and `party-role-aliases.js` | Supply the actual party resolution vocabulary used by the current resolver. | Candidate-resolution and family tests. | **KEEP** | They are useful deterministic vocabularies. The new context engine should use them with provenance instead of treating a regex match as an agreement-wide party graph. |
| Deterministic parse modules, including `measurement-date-parse.js`, `cure-period-parse.js`, `termination-deadline-parse.js`, `termination-fee-parse.js`, `no-shop-period-parse.js`, `financing-day-count-parse.js`, `exchange-ratio-parse.js`, `share-count-parse.js`, `per-share-cash-parse.js`, `defined-term-threshold-parse.js` and `antitrust-regulatory-parse.js` | Convert supported legal text forms into closed canonical values. | Direct parser tests and resolver family tests. | **KEEP** | These are proven family or value algorithms. Give them source-node text plus explicit context. Do not rewrite them because the public resolver changes. |
| Family corroboration modules, including `general-covenant-corroboration.js`, `guaranty-corroboration.js`, `ioc-corroboration.js`, `tax-cooperation-corroboration.js`, `sole-remedy-resolution.js` and `mae-clause-label-parse.js` | Check that a proposed legal category is supported by its own source text or permitted adjacent context. | Direct corroboration tests, collision tests and family replay tests. | **KEEP** | The legal vocabularies are family-specific and useful. Keep them behind small family adapters. Replace ad hoc source searches with node and context queries. |
| `qualifier-attachment.js` and `qualifier-kind-lexicon.js` | Classify semantic qualifiers and choose their semantic target. | Qualifier attachment, limb component and resolver tests. | **KEEP** | Keep the semantic algorithms. Feed them source-node relations and provenance-bearing qualification facts. |
| `limb-components.js` | Mints semantic path and assertion nodes from model `limb_path` values and exact assertion evidence. It can invent missing path ancestors without source spans. | `canonical-v2-limb-components.test.js`; semantic safety and write-adapter tests. | **CHANGE** | Keep assertion and qualifier graph logic. Replace path strings with stable source-node references. A spanless semantic path must never claim to be the contract as written. |
| `ioc-mechanic-resolution.js` | Performs IOC-specific parent, sibling, party and chapeau recovery and creates restricted-action relationships. | `canonical-v2-ioc-mechanic-resolution.test.js`; IOC replay tests. | **CHANGE** | Keep IOC legal mapping and relationship rules. Remove its independent inheritance model. It should consume general context facts with source provenance. |
| `duplicate-suppression.js`, `known-defect-registry.js` and `lexical-disagreement-net.js` | Apply deterministic duplicate, known-defect and lexical-disagreement controls. | Direct control tests and resolver tests. | **KEEP** | These are semantic quality controls. They do not need to own source structure. |
| `candidate-resolution.js` | Groups candidates, resolves concept and party, runs every family's parsing and corroboration, recovers governing context, constructs provisions and claims, and assigns resolved, review or open-world state. It accepts more than 20 control inputs. | `canonical-v2-candidate-resolution.test.js`; more than 70 family, replay, correction and control tests. | **REPLACE** | Replace the public responsibility with `analyseAgreement(index, options)`. The file mixes source recovery, general semantics, family law and triage. Migrate its deterministic handlers one family at a time behind family adapters. Preserve old output through a compatibility adapter until side-by-side diffs pass. |

### Resolver replacement does not mean a resolver rewrite

The migration unit is one family handler, not the 10,000-line file. Each moved handler should receive:

```text
source node or selected subtree
+ inherited ContextFacts, each with source node and span
+ definition, cross-reference and party graph links
+ contract bundle
-> proposed semantic facts
-> resolved claims, review records and open-world records
```

The old `resolveCandidates` interface should remain available only to the old side of the shadow comparison. A compatibility adapter can convert new analysis records into the old output shape. Delete no proven family rule until its old and new resolution sets agree or an approved legal ruling explains the difference.

## 8. Persistence and write validation

| Current module | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `native-write-set-adapter.js` | Converts section-local evidence offsets to document-absolute offsets, verifies bytes, rebuilds excerpts and remints affected identities. | `canonical-v2-native-write-set-adapter.test.js`; recorded replays. | **CHANGE** | Keep it as a migration adapter. The target path should use one document-absolute coordinate system from `AgreementIndex`, so the persistence seam no longer repairs ambiguous coordinates or changes identity. |
| `evidence-to-write-set-bridge.js` | Reads several saved run files, reconstructs omitted provisions from `resolution.json`, revalidates and hands the result to the writer. | Evidence bridge and source-chain rebuild tests. | **CHANGE** | It currently repairs a split artefact contract and can succeed while dropping claims if the reconstruction is wrong. Make it consume one sealed `AgreementAnalysis` write package. Preserve the old reader for historical replay. |
| `validate-write-set.js` | Validates exact identity and references, then partitions publishable, quarantined and residual records. | `canonical-v2-canonical-writer.test.js`; incomplete writer, resolution-publication split and write-adapter tests. | **CHANGE** | Keep the validation role. Add source-node existence, byte ownership, inherited-context provenance and derivation-dependency checks. It must not reconstruct hierarchy. |
| `canonical-write-envelope.js` | Computes the exact persistence input digest after checking SQL-compatible canonical values. | `canonical-v2-write-envelope.test.js`; excerpt identity guard. | **KEEP** | This is a narrow, correct persistence envelope. |
| `canonical-writer.js` | Enforces allowed operations, write order, idempotency and repository transactions. | `canonical-v2-canonical-writer.test.js`; source admission writer and write-envelope tests. | **KEEP** | Persistence is a separate and correct responsibility. Extend accepted record types only after the new analysis records stabilise. |

## 9. Output projections and rendered rows

An **output projection** is a view built from semantic analysis for one reader or product surface. It must not define source structure.

| Current module or group | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `lib/review-parity/rendered-row-preview-contract.js` | Lists 17 approved family routes, projection exports, Review V2 owners and exact row-matching rules. Seven measured families have no route. | `canonical-v2-routed-family-row-owners.test.js`; all rendered-row preview tests. | **CHANGE** | The routing seam is correct but incomplete. Give every supported claim an explicit owner or a typed `NO_APPROVED_OWNER` result. Bind each route to claim and source-node lineage. |
| Routed family projections: `closing-conditions-product-projection.js`, `termination-product-projection.js`, `material-contracts-product-projection.js`, `antitrust-product-projection.js`, `proxy-meeting-product-projection.js`, `general-covenants-product-projection.js`, `employee-dno-product-projection.js`, `remedies-misc-product-projection.js`, `consideration-wave-a-product-projection.js`, `ioc-wave-a-product-projection.js`, `key-terms-mae-product-projection.js`, `no-shop-product-projection.js`, `merger-structure-closing-product-projection.js`, `no-other-reps-fraud-review-projection.js` | Convert resolved entries into family-specific cards or rows. | Family projection tests and 17 routed-family preview tests. | **CHANGE** | Keep their family mappings and row-building algorithms. Consume `AgreementAnalysis`, retain operative detail, party, exceptions, qualifications and source lineage, and report intentional aggregation. Do not parse source or recover hierarchy. |
| Existing projections without approved routes: `representations-product-projection.js`, `tax-dividends-appraisal-product-projection.js`, `financing-guaranty-product-projection.js` | Produce some product records for families that currently lack Review V2 row owners. | Projection tests and publication-filter coverage test. | **CHANGE** | These implementations prove that absence of a route is not always absence of a projection. Add approved owners and preservation tests. Do not silently route to a nearby table. |
| `consideration-ioc-evidence-product-projection.js` | Builds a specialised evidence view shared by consideration and IOC work. | Projection and product-surface tests. | **KEEP** | Keep it as an internal evidence adapter. It must link back to the source nodes and claims that supplied each value. |
| `lib/review-parity/rendered-row-preview.js` | Loads the real family projection, real Review V2 configuration and real row primitives, then requires one exact lineage-bearing row. It cannot serve or publish. | `canonical-v2-rendered-row-preview.test.js`; family preview tests. | **KEEP** | This is a sound headless review adapter and fails closed. Use it inside `projectAgreement`. Its weak non-empty-cell check is only transport evidence, not proof of legal completeness. |
| `lib/review-parity/views.js` and Review V2 configs and primitives | Load and render the actual review presentation code. | Rendered-row preview and Review V2 tests. | **KEEP** | Presentation remains a projection. It must not become a second navigation or source model. |
| `serving-projection.js` and `serving-projection-contract.js` | Build release-keyed market metric observations and exclude unsupported or incomplete values. | `canonical-v2-serving-projection.test.js`; serving slice tests. | **KEEP** | The serving projection has a distinct, correct role. Later it should consume only an authorised `AgreementProjection`, never raw resolver output. |

### Output-stage conclusion

Rendered-row modules are currently asked to bridge missing semantic detail. They should not reconstruct source hierarchy. The row modules mostly need richer input and stronger preservation tests, not replacement.

## 10. Publication and serving control

| Current module or group | Actual responsibility | Representative tests inspected | Decision | Precise reason and reuse rule |
|---|---|---|---|---|
| `publication-disposition.js` | Evaluates publication eligibility separately from claim state and builds release and rollback receipts. | `canonical-v2-publication-disposition.test.js`; SQL and resolution-publication split tests. | **KEEP** | This is the correct independent publication authority. Resolution must never imply publication. |
| `publication-serving-filter.js` | Preserves historical output when no filter is requested, validates eligibility sidecars, and always refuses `REQUIRE_PUBLISHED`. | `canonical-v2-publication-serving-filter.test.js`. | **CHANGE, BUT NOT NOW** | Keep its fail-closed default. A future authorised stage must add validation of an immutable release receipt before the published branch can return a record. Stage 2Y must not make this change or activate publication. |
| `calibration-harness.js` | Validates human anchors, adjudicator floors, sampling and confidence evidence used by publication authority. | `canonical-v2-calibration-harness.test.js`; publication tests. | **KEEP** | Calibration evidence belongs outside extraction and should remain separately versioned. |
| `human-anchor-review.js` | Builds sealed human-review packets and requires sufficient answered cards without treating inability to judge as truth. | `canonical-v2-human-anchor-review.test.js`; human-anchor calibration seam tests. | **KEEP** | Human judgement is a separate evidence input. It must not mutate source structure or claim identity. |
| `feature-flags.js`, dark bridge gates and staging serving adapters | Keep Canonical V2 out of production and restrict current read/write paths. | Dark integration, resolution-publication and serving tests. | **KEEP** | These controls must remain hard-off during restructuring. They are not a substitute for a publication receipt. |

## 11. Diagnostic and migration modules

| Current module or group | Actual responsibility | Decision | Precise reason and reuse rule |
|---|---|---|---|
| `run-comparator.js` | Compares independent runs by limb path, span overlap and qualifier quote. | **CHANGE** | Keep the diff role, but compare stable source-node identifiers and semantic fact identifiers. Path strings alone are not enough. |
| `stage-2y-joint-sweep.js` | Defines deterministic mechanism-control sweeps and sealed measurement records. | **KEEP** | This is measurement infrastructure, not source authority. Use it only after the structure prototype has deterministic inputs. |
| `scripts/stage-2y-cd-measurement.mjs` and `scripts/stage-2y-rendered-rows-artefact.mjs` | Recompute the saved extraction-state and claim-to-row measurements. | **KEEP** | Keep them as evidence harnesses. Extend them with stable failed-member identifiers and source-node loss classes before they are used as migration gates. |
| `scripts/canonical-v2-live-extraction-run.mjs` | Performs the current file-based run, resolution, validation and evidence write orchestration. | **CHANGE** | Keep record/replay and artifact sealing. Route new shadow work through the three deep entry points. Do not use this script to resume Phase B during the architecture migration. |

## 12. Test coverage that exists and what it does not prove

The current tests give strong evidence for local determinism and fail-closed behaviour:

- exact source bytes and conversion lineage;
- deterministic article, section and subsection offsets;
- exact evidence slicing;
- candidate receipt and schema closure;
- family-specific parsing and corroboration;
- claim and relationship identity;
- write-set validation and idempotent writing;
- exact route, card and row matching;
- publication state separated from claim state.

They do not prove the complete architecture properties required for mission readiness:

| Missing interface test | Required assertion |
|---|---|
| Complete byte ownership | Every non-presentation canonical byte belongs to exactly one lowest-level source node. Whitespace and headings have explicit rules. |
| Complete block identity | Every written block, including each separate unnumbered sentence, has one stable node and one parent. |
| Hierarchy preservation | A section can be collapsed and expanded through the same source tree without a second navigation model. |
| Inherited provenance | Every inherited subject, verb, party, control role, qualification or exception names the source node, exact span, target node and inheritance rule. |
| Non-inheritance | Defined meanings, cross-reference targets, negation, alternatives and sibling-specific exceptions do not become inherited words unless an explicit rule permits it. |
| Multi-span claims | One claim may cite several source nodes with ordered evidence roles and derivation dependencies. |
| Cross-reference graph | A reference links to a target node or a typed unresolved or ambiguous result without making an extra model call. |
| Source-to-row preservation | Every material semantic detail is rendered, intentionally aggregated with an explanation, or typed as omitted. A non-empty cell is not enough. |
| Stable failure membership | Every aggregate count keeps the affected claim and source-node identifiers so its cause can be audited. |
| Side-by-side migration | Old and new resolution sets are compared by claim value, state, evidence, subject and provenance. Stage 2Y does not change a pin. Any later request requires separate post-certification authority. |

A passing current test can prove that a local transformation is deterministic. It cannot prove that an omitted source block was ever represented.

## 13. Final disposition

The module-level decision is:

- **Keep** the exact-source admission chain, content identity, contract vocabulary, definition and participant graph primitives, deterministic legal parsers, family corroborators, canonical writer, headless renderer, serving projection, calibration and publication authority.
- **Change** the sectionizer, classifiers, provider input, prompts, proposal compiler, semantic evidence schema, limb representation, IOC inheritance, write adapters, row routes, family projections and future published-serving filter.
- **Replace** the public responsibilities for candidate-first context, post-resolution structure placement, family-specific citation follow-up and the all-family resolver interface.

The correct target has three deep calls: `indexAgreement`, `analyseAgreement` and `projectAgreement`. Those calls should hide the existing algorithms behind stable seams. This increases leverage and locality while preserving the resolved claims, evidence and family knowledge already earned.
