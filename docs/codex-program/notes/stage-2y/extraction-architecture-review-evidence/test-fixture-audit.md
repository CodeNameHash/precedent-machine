# Test and fixture audit

Date: 2026-08-10

Status: report-only. No model route, Phase B route, pin generator, baseline generator or production writer was run.

## Conclusion

The focused tests are strong at four jobs:

1. exact UTF-8 byte geometry;
2. deterministic replay;
3. fail-closed validation at known seams; and
4. claim-to-row lineage for already resolved claims.

They are not proof that the agreement has been completely represented or completely analysed.

The largest gap is source completeness. The current tests do not require a stable node for every source block. They do not require separate nodes for unnumbered sentences. They do not prove general subject, verb, party, qualification or exception inheritance with source provenance. Several tests expressly preserve a markerless section as one leaf. That is correct for the current implementation, but it conflicts with the proposed target in which separate bare sentences are separate child blocks.

The second gap is end-to-end legal preservation. Most resolution tests begin with a pre-shaped proposal. Most row tests begin with an already resolved claim. A passing result therefore proves that the later module handles its input as expected. It does not prove that the input contains every material fact from the source.

The existing tests should be kept. They protect real byte, identity and fail-closed behaviour. The architecture work needs a new source-to-output acceptance layer above them. It should not replace them with larger, slower tests.

## Terms

- **Focused test** means a test file that exercises one module or one narrow seam.
- **Fixture** means saved input used by a test. A fixture can be synthetic, copied from a real agreement, or recorded from a prior run.
- **Replay** means running deterministic code again against a saved provider response. It does not call a model.
- **Invariant** means a condition that must always hold. An example is: an evidence span must reproduce its exact source bytes.
- **Regression test** means a test that prevents a known defect from returning.
- **Acceptance test** means a test of the user-visible or programme-level result. It crosses several modules and checks the full required outcome.
- **Ground truth** means an answer independently established by a qualified reviewer. A saved machine output is not ground truth merely because it is pinned.

## Verification performed for this audit

One bounded replay-only command covered the principal seams. The exact command was:

```bash
node --test --test-concurrency=4 \
  tests/canonical-v2-source-identity.test.js \
  tests/canonical-v2-admitted-semantic-source.test.js \
  tests/canonical-v2-native-sectionizer.test.js \
  tests/subclauses.test.js \
  tests/canonical-v2-governing-structure.test.js \
  tests/canonical-v2-candidate-governing-context.test.js \
  tests/canonical-v2-limb-components.test.js \
  tests/canonical-v2-qualifier-attachment.test.js \
  tests/canonical-v2-native-producer-evidence-integrity.test.js \
  tests/canonical-v2-native-extraction-run.test.js \
  tests/canonical-v2-citation-constructibility.test.js \
  tests/canonical-v2-native-write-set-adapter.test.js \
  tests/canonical-v2-candidate-resolution.test.js \
  tests/canonical-v2-rendered-row-preview.test.js \
  tests/canonical-v2-claim-scoped-single-row-preview.test.js \
  tests/stage-2y-cd-measurement.test.js \
  tests/stage-2y-cd-known-loss-adjustment.test.js
```

The command ran 17 test files. The raw Node test summary was 230 tests, 230 passed, zero failed, zero cancelled, zero skipped and zero todo. Node reported `duration_ms 7689.432084`. The process exited with status zero. This exact rerun replaces an earlier 242-test timing note whose command could not be reconstructed reliably.

Result:

| Result | Count |
| --- | ---: |
| Passed | 230 |
| Failed | 0 |
| Skipped | 0 |
| Cancelled | 0 |

The command did not include any Phase B test executor. Every provider in the selected tests was a stub or saved response.

Passing this batch proves that the current contracts described below still reproduce. It does not answer the missing acceptance questions.

## Fixture strength

Not all fixtures have the same evidential value.

| Fixture class | Main examples | What it can prove | What it cannot prove |
| --- | --- | --- | --- |
| Full real agreement | `__fixtures__/demo-deal/landos-abbvie-agreement.txt`; raw SEC HTML for Modiv, TopBuild and Skechers | Real heading, nesting and byte-boundary regressions for those agreements | Correct structure for every agreement or every drafting style |
| Exact real provision | QXO Sections 3.1(b) and 5.2; Redfin 2.10; six Step 2X-A mis-nest sections; three termination sections | Exact local spans and expected list shapes | Whole-document hierarchy, external ancestors, cross-references or corpus completeness |
| Recorded provider response | `tests/fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json` and committed run recordings | Deterministic replay of what the provider returned | That the provider returned all or only correct legal facts |
| Recorded resolution output | 130 runs in `stage-2y-cd-baseline-manifest.json` | Regression of current claim identities, routes and counts | Independent legal truth or source recall |
| Synthetic source and proposal | Most provider, resolver, party and publication unit tests | Hostile cases, error handling and precise branch behaviour | Frequency or correctness on real drafting |
| Human review packet | 96-card blind floor and human-anchor files in `evidence/blind-review/2026-08-10` | Sealed sample membership, review workflow and decided answers where completed | Complete agreement structure or complete corpus recall |
| Optional database fixture | Excerpt identity and SQL writer tests guarded by `LOCAL_CANONICAL_V2_DB_URL` | Real local database constraints when the database is available | Portable CI coverage when the environment variable is absent |

The strongest current pattern combines a real source excerpt, its original source digest, a saved response and a deterministic replay. Even that pattern proves only the selected provision and selected assertions.

## Stage-by-stage audit

### 1. Source admission and byte geometry

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-source-identity.test.js` | One changed byte rekeys source, text, excerpt and provision identities. Semantic spans use half-open UTF-8 byte intervals. Invalid code-point boundaries fail. | A semantic span is the right legal evidence, or that every source block has a structural node. |
| `tests/canonical-v2-admitted-semantic-source.test.js` | The runtime source object binds verified admission, conversion lineage, source map and canonical text. Drift and incomplete coverage fail. | The structural parser covers or correctly classifies the admitted text. |
| `tests/parser-hierarchy.test.js` | The older parser-v2 region model covers a synthetic cleaned document, recognises frontmatter, articles, sections, definitions and backmatter, and avoids named false headings. | That the native extraction runner uses this complete region hierarchy. It does not create the target stable node tree. |
| `tests/parser-boundaries.test.js` | Text-layer cleanup, body boundaries and several sentence/list cut repairs behave as expected on synthetic cases. | Complete sentence boundaries or correct parent-child structure on real agreements. |

These tests establish a reliable source coordinate system. That is necessary and should be retained unchanged.

### 2. Contract structure parsing

#### `tests/canonical-v2-native-sectionizer.test.js`

This is the strongest current structure test.

It proves:

- deterministic tree output and section identifiers for identical input;
- every emitted node slices back to its own exact bytes;
- parent spans contain child spans;
- real Landos, Modiv, TopBuild and Skechers headings and deep references survive named regressions;
- sibling runs past `(z)` remain siblings;
- genuine nested roman lists remain nested when an outer letter sequence resumes;
- missing references do not approximate to a nearby node;
- over-long or swallowed headings produce a residual or named regression failure; and
- several real sibling sets tile their parent without gaps.

It does not prove:

- that every admitted byte belongs to a non-root structural leaf;
- that every emitted node has the correct structural kind;
- that every paragraph or sentence exists as a node;
- that a chapeau, proviso, exception or trailing qualification is a stable source node;
- that headings and outline markers are distinguished for the complete corpus;
- that each unnumbered sentence under one section is a separate child; or
- that the agreements outside the small fixture set have the same quality.

The helper named `assertRoundTripsExactly` checks each node that exists. It does not prove that all required nodes exist. A document with no recognised structure deliberately passes with one `ROOT` node. That is honest current behaviour, but it is not a complete written hierarchy.

#### `tests/subclauses.test.js`

It proves:

- exact list-marker shapes for real QXO, Redfin, Concho and Metsera provisions;
- nesting to five marker levels;
- protection against common cross-reference false positives; and
- local leaf order and non-overlap.

It does not prove exact byte partition. The helper permits dropped material up to 5 percent of JavaScript character length. Its comment says only markers and whitespace should be dropped, but the assertion does not inspect that the gaps contain only markers and whitespace.

The test `markerless prose section yields a single chapeau span covering the whole text` fixes the present contract at one leaf. It does not split three separate sentences into three children.

#### Other structural tests

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-limb-enumeration-scan.test.js` | Marker tokens and proposed model paths can be compared. Missing or extra paths and ambiguous marker families are reported. | That either the marker scan or the model path is the authoritative source tree. |
| `tests/canonical-v2-citation-constructibility.test.js` | A citation can be derived from a containing tree node. Repeated quote occurrences can be resolved using citation context or rejected as ambiguous. | That evidence creation itself chose the correct occurrence before citation repair. |
| `tests/canonical-v2-native-extraction-run-citation-followup.test.js` | Bare cited sections can be found, deduplicated and dispatched for one bounded extra hop. Unresolved references become residuals. | A general cross-reference graph, transitive legal dependencies, or definition-use closure. |

### 3. Evidence-span creation

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-native-producer-evidence-integrity.test.js` | Five fixture proposals each carry one evidence span that reproduces the proposal raw value and lies within source bounds. | The proposals selected the complete or legally correct evidence. The fixture already contains the intended offsets. |
| `tests/canonical-v2-native-extraction-run.test.js` | Selected sections resolve before provider work. Out-of-scope evidence is rejected. Candidate citations and per-proposal derived nodes are recorded. Residuals remain visible. | That every legal item receives evidence, or that one section span is the right level for a claim. |
| `tests/canonical-v2-native-provider.test.js` | Response parsing is bounded and deterministic. Malformed output fails. Unverifiable quotes and ambiguous repeated item qualifiers become typed residuals. | Recall, legal accuracy, or correct source hierarchy. General quote anchoring still begins from provider-selected text. |
| `tests/canonical-v2-native-write-set-adapter.test.js` | Section-local coordinates shift to document coordinates, byte-slice correctly, carry several evidence roles and fail on source drift. | That upstream evidence roles and attachment are legally correct. |
| `tests/canonical-v2-semantic-graph.test.js` | Semantic spans, definition uses, multi-span evidence and graph identity remain separate when supplied. | That the current native extraction path builds this graph completely from the agreement. |

Current evidence tests are good geometry tests. They are not evidence-sufficiency tests.

A claim can pass because its one quote reproduces exactly while still omitting:

- the subject in a chapeau;
- the governing verb in an ancestor;
- an attached proviso;
- a trailing qualification;
- a defined-term definition; or
- a cross-referenced condition.

No current acceptance test requires the claim to retain all of those source nodes together.

### 4. Governing context and inheritance

#### `tests/canonical-v2-governing-structure.test.js`

It proves:

- a marker outline can return a selected leaf and ancestor chain;
- UTF-8 offsets remain correct;
- same-style mis-nests and cross-leaf evidence fail closed;
- six pinned real mis-nest sections remain `UNDETERMINED`;
- a markerless section receives a section-only result; and
- annotation does not change claim identity.

It does not prove that legal context is inherited. The returned chain contains text blocks. It does not create typed, provenance-bearing links for subject, verb, modal, party, condition, qualification or exception.

#### `tests/canonical-v2-candidate-governing-context.test.js`

It proves:

- an already supplied single operative evidence span selects the correct leaf, including a repeated quote;
- the caller can receive chapeau, item, sibling and same-leaf trailing text;
- missing, conflicting, multiple, wrong-section and byte-mismatched evidence fail; and
- source and candidate inputs are not mutated.

It does not prove:

- that analysis starts high enough to find context before a claim exists;
- that the selected chapeau actually supplies a subject or verb to the item;
- that inherited values carry the source node and source span;
- that context can use more than one operative source edge; or
- that separate markerless sentences are distinct.

This module starts from candidate evidence. It therefore cannot recover source blocks for legal facts that the candidate never proposed.

#### Limb and qualifier tests

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-limb-components.test.js` | Model-supplied limb paths mint deterministic path and assertion identities. Missing ancestors are added. Ambiguous assertion attachment fails closed. | That the paths match the written document. Path nodes carry `span: null`, so they are not source nodes. |
| `tests/canonical-v2-derived-limb-identity.test.js` | The current derived-limb identity stub remains stable. | A source-backed limb identity or complete limb tree. |
| `tests/canonical-v2-qualifier-attachment.test.js` | Given `CHAPEAU`, `ITEM` or `TRAILING`, deterministic marker rules produce the expected scope or ambiguity. Model-supplied resolved scope cannot override the rule. | That `position` was correctly derived from source. `CHAPEAU always implies ALL_ITEMS` tests a supplied label, not the source grammar. `PROVISO` is currently rejected as an input position. |
| `tests/canonical-v2-p2-qualifier-kinds.test.js` | Approved qualifier kinds and selected family behaviour remain deterministic. | Complete qualification and exception flow through a source hierarchy. |
| `tests/canonical-v2-termination-limb-chapeau-structure-swap.test.js` | Three real termination fixtures preserve exact chapeau spans after an adapter swap. | General chapeau inheritance outside termination rights. |
| `tests/canonical-v2-termination-limb-grant-context.test.js` | A targeted termination grammar recovers and checks terminating party direction for real Modiv limbs, including hostile party swaps. | A family-neutral subject, party, control or verb inheritance model. |

#### Downstream party tests

The Antitrust, Closing Conditions, General Covenants and Proxy party-slice tests prove that an already resolved canonical party is retained or rejected on conflict. They do not prove that extraction found the right party. They use hand-built resolved entries.

The targeted termination replay is the only strong current source-to-inherited-party proof. It supports the conclusion that chapeau loss caused real party failures. It does not show that the same repair exists across all families.

### 5. Claim production

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-native-provider.test.js` | Strict response parsing, retries, output limits, receipt determinism, quote verification and typed residuals. | That a real model finds every source fact or uses a correct structural packet. |
| `tests/canonical-v2-native-producer-schema-closure.test.js` | Required producer output lists and schema closure remain explicit. | Legal completeness outside those lists. |
| `tests/canonical-v2-native-family-adapter-contract.test.js` | Each family adapter consumes its declared response lists and preserves named follow-on output. | A common source-semantic interface or cross-family consistency. |
| Family producer tests such as `canonical-v2-financing-producer-prompt.test.js` | Each prompt and shaper retains its expected family fields. | Whether the family prompt sees enough ancestor, definition and exception context. |

Almost all production tests use a stubbed or recorded response. This is correct for deterministic testing. It means the tests begin after the main recall risk.

### 6. Claim resolution

#### `tests/canonical-v2-candidate-resolution.test.js`

It proves:

- known proposal shapes map to governed claim definitions or remain open-world;
- unknown concepts are not forced to a near neighbour;
- unresolved parties and ambiguous item attachment route to review;
- `ABSENT` from a producer is rejected;
- allowed values, lexicon decisions, ruling precedence and review reasons are deterministic;
- a repeated evidence quote can bind inside the selected section;
- identical inputs produce an identical resolution receipt; and
- resolved output can pass the write-set validator.

It does not prove:

- source recall;
- correctness of a pre-shaped proposal;
- correctness of model-supplied limb position;
- complete evidence for inherited context;
- that all source blocks have been attempted; or
- that every resolved value is legally right across the corpus.

Two current behaviours are important architecture evidence:

1. The context ladder is default-off and report-only. Its tests expressly require that it does not change claims or the resolution receipt.
2. A citation that cannot be validated can still mint a resolved claim, provided the claim routes to review with `CITATION_NOT_VALIDATED`.

These are honest current contracts. They show that resolution can retain a semantic result after structural proof has failed. The target migration should not silently tighten them. It should compare old and new resolution sets and stop on unexpected changes.

#### Family resolution tests

No Shop, Interim Operating, Termination, Closing Conditions, Financing, Employee Matters and other family tests give valuable regression protection for named values and known real runs. They do not form one source-completeness test. Each family defines a different local input shape and local recovery logic.

### 7. Family routing

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-producer-prompt-registry.test.js` | The registered family list, prompt module selection, deterministic title rules, manifest assignments and unknown-family fail-closed path work. | Correct family coverage for every source node. |
| `tests/canonical-v2-section-family-classifier-quarantine.test.js` | Named false-positive titles remain unresolved, body-polluted headings do not reach a provider, and five missing deterministic routes exist. | Corpus-wide precision and recall. |
| `tests/canonical-v2-family-section-ref-generator.test.js` | Every registered family receives a visible list, Modiv routing is deterministic, two human-found sections remain found, and nested descendants are not independently dispatched. | Correct routing on other deals or on newly introduced child node kinds. |
| `tests/canonical-v2-full-corpus-routing-prompt-cost-audit.test.js` | Audit identity, occurrence preservation, work-item uniqueness and no-execution authority work. | Real full-corpus routing. Its 41-record helper uses synthetic canonical text for all records. |
| `tests/canonical-v2-native-provider-family-dispatch.test.js` | A response shaped for the wrong family fails, and the legacy Capitalisation default remains compatible. | That the selected family itself was correct. |

One current regression test requires this legacy behaviour:

```text
no classifier supplied -> every section dispatches CAPITALISATION
```

It also requires that this unclassified default carries no family blocking condition. This proves compatibility, not architectural correctness. Any restructuring must version and remove this fallback through a side-by-side migration, not assume that the existing test demonstrates a sound family decision.

Routing also works at a section-oriented dispatch seam. The tests exclude nested descendants of a `SECTION` node to avoid duplicate calls. They do not show how a single source subtree with several legal families should route its individual children.

### 8. Rendered-row production

#### Core preview tests

`tests/canonical-v2-rendered-row-preview.test.js` proves that the preview uses the real family projection and real Review V2 table configuration. It checks exact row selection, party banding, content and unsupported-family failure.

It does not prove that the row contains every material fact from the source. Its input is a card or resolved claim.

`tests/canonical-v2-claim-scoped-single-row-preview.test.js` proves that four single-row families project each pinned claim alone. The current pin is:

| Family | Resolved claims checked | Content rows | Explicit failures |
| --- | ---: | ---: | ---: |
| D&O | 31 | 31 | 0 |
| General Covenants | 54 | 54 | 0 |
| No Shop | 365 | 365 | 0 |
| Specific Performance | 8 | 8 | 0 |

This proves row ownership and isolation. It does not prove detail preservation. The known-loss audit separately identifies 25 D&O claims and 75 No Shop claims whose rendered rows lose important detail.

#### Family preview tests

| Test group | What it proves | What it does not prove |
| --- | --- | --- |
| Antitrust | Supported definitions have exact feature routes. Seventy pinned claims either own a row or fail with typed merged-lineage loss. | Secondary relationship detail or legal completeness. Seven known claims fail the row gate. |
| MAE | Atomic feature lineage fails closed on grouped rows. | A useful row for most claims. Of 108 claims, only eight currently produce content rows under the exact lineage check; 100 fail. |
| Employee Matters | Supported definitions and relief kinds select exact rows or fail. | Complete employee covenant detail. |
| Proxy and Meeting | Thirty-one pinned claims reach lineage-bearing rows and legal-person parties remain distinct. | Correct upstream party extraction. |
| No Other Reps / Fraud | Thirty-six claims reach one atomic row. | The party detail omitted by the row, which the known-loss audit counts for all 36. |
| Merger Structure | 103 pinned claims reach one content-bearing row. | That every source step or condition was extracted. |
| Material Contracts and Miscellaneous | Each existing claim selects a bucket or mechanic row. | Whether bucket labels preserve all source detail. |

#### Measurement tests

`tests/stage-2y-cd-measurement.test.js` proves that:

- the four extraction states are counted separately;
- a content row must be the one exact matched claim row;
- full output signatures include all rows and cells;
- duplicate excess arithmetic is correct;
- the baseline has 130 unique deal-family runs; and
- committed baseline and report artefacts are internally fresh.

It does not prove human acceptance. It measures the current output set. It cannot count source facts that extraction never created.

`tests/stage-2y-cd-known-loss-adjustment.test.js` proves the 1,097 known-loss-adjusted calculation and the exact 244-claim inventory. It also expressly records `human_acceptance: false` and `NOT_MEASURED`. This is strong measurement hygiene, not legal validation.

### 9. Publication control

| Test file | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/canonical-v2-publication-disposition.test.js` | Missing, expired, mismatched or risky authority is withheld. An explicit valid transition is needed for `PUBLISHED`. Identities and digests are checked. | That a deployment has no alternate unfiltered route. Inputs are synthetic authority records. |
| `tests/canonical-v2-publication-serving-filter.test.js` | Every named projection calls the shared filter. Forged sidecars fail. `REQUIRE_PUBLISHED` currently excludes all results until a validated receipt-consuming adapter exists. | That callers always request a publication filter. With no filter, the exact resolved array passes through. |
| `tests/canonical-v2-resolution-publication-split.test.js` | A claim can resolve for review but remain withheld without calibration. | Legal correctness of the resolved claim or complete public-route closure. |
| `tests/canonical-v2-open-world-write-boundary.test.js` | Governed and open-world rows remain distinguishable at the canonical write-set validator. | External publication. The test uses `publishableWriteSet` to mean validator output, not a served release. |
| `tests/canonical-v2-phase1-authority-boundary.test.js` | Production sources are classified by capability and hostile capability additions fail. | Runtime cloud credentials or deployment configuration not represented in source. |
| `tests/stage-2y-phase-b-live-authority.test.js` | Every named Phase B live route is blocked by the shared deferral. | Any unrelated model route outside the named inventory. |

Publication is cleanly separate from resolution in the tested modules. The main residual risk is caller mode. Private review intentionally permits unfiltered resolved output. A future public adapter must require a validated release receipt instead of relying on callers to choose `REQUIRE_PUBLISHED`.

The optional excerpt identity database test was not part of this audit run. It skips unless `LOCAL_CANONICAL_V2_DB_URL` is set. Its portable absence should be shown as `SKIPPED`, not treated as a pass for the database constraint.

### 10. Human and model evaluation fixtures

`tests/canonical-v2-human-anchor-review.test.js` proves the 96-card packet shape, sample identity, seeded hostile cases, ledger validation and publication lock. It does not turn unreviewed cards into ground truth. The review gate records unanswered and `CANT_JUDGE` separately.

`tests/canonical-v2-20260808-blind-current-rescore.test.js` proves the original 96-card join, twelve strata and the current failed floor without changing output. It is an accuracy sample. It is not a source-tree sample.

`tests/stage-2y-f-terra-adjudication.test.js` uses injected functions to test transcript control and strict model-output schemas. Some unit cases simulate 164 calls, but they do not call a model. These tests prove experiment mechanics, not model accuracy.

## Misleading conclusions to avoid

| Passing evidence | Invalid conclusion |
| --- | --- |
| Every emitted node round-trips | Every required source node exists. |
| Root covers the document | The agreement has a complete hierarchy. |
| Subclause leaves lose less than 5 percent | Every admitted byte is assigned exactly once. |
| A quote slices exactly | The quote contains the complete legal proposition. |
| A candidate has governing context | Subject, verb, party and exceptions were inherited with provenance. |
| Limb component identifiers are deterministic | Limb paths came from the source tree. |
| A resolver output is deterministic | Its value is legally correct. |
| A claim reaches one row | The row preserves all material detail. |
| A baseline validates | The baseline is human truth. |
| A write set is called publishable | The claim is authorised for external publication. |
| A publication filter exists | Every public caller is forced through it. |

## Missing acceptance tests

### Priority 0: required before structural migration

1. **Exact leaf partition.** For each selected real agreement, structural leaves must cover every admitted byte exactly once. No percentage tolerance is permitted. Markers, whitespace, headers and page artefacts need typed nodes or typed excluded intervals.
2. **Stable bare-sentence nodes.** A section with three independent unnumbered sentences must have three child nodes with exact spans, source order and stable identifiers.
3. **Complete written forms.** Real fixtures must cover article, section, nested subsection, paragraph, sentence, chapeau, limb, sub-limb, heading, outline marker, proviso, exception and trailing qualification.
4. **Node identity stability.** Identical bytes and structural-model version must reproduce identical nodes. A parser-version change must preserve the old tree and emit an explicit old-to-new node map.
5. **Heading-marker separation.** A heading must never become an operative limb. An outline marker must never become a heading. Include body-polluted and hard-wrapped real cases.
6. **Typed ambiguity.** Where two parentages are plausible, both alternatives and the affected byte range must remain visible. No semantic stage may receive a silently chosen tree.

### Priority 0: inheritance and evidence

7. **Provenance-bearing inheritance.** For every inherited subject, actor, modal, governing verb, condition, qualification and exception, assert the source node, exact source span, target node and deterministic rule.
8. **No false local provenance.** If limb `(ii)` inherits `Parent shall` from a chapeau, the claim must not say those words occur inside limb `(ii)`.
9. **Sibling isolation.** A subject, exception or trailing phrase attached to one sibling must not flow to another unless a proved parent rule governs both.
10. **Child override.** A child-local subject, modal, negation or exception must override the inherited value while preserving both source records.
11. **Multi-node evidence.** One claim must be able to cite its operative limb, governing chapeau, attached proviso and definition as ordered source evidence.
12. **Repeated quote occurrence.** The same quote in two siblings must require node identity plus occurrence. First-match selection must fail the test.
13. **The 69 historical Red Hat limb proposals.** Freeze their proposal identities, source material and current transport dispositions: one residual, 62 open-world-only, and six open-world plus assertion node. Require every proposal either to bind to an exact source node or to carry typed `SOURCE_NODE_UNBOUND`, without changing its disposition. Only the subset with more than one legally plausible grammatical scope needs Ben's acceptance key. Deterministic source binding must not wait for a legal ruling. The current dispositions are recorded in `docs/codex-program/notes/step-2x-l1-limb-disposition.md:64-132`.

### Priority 0: source-to-output trace

14. **Representative complete traces.** For each required source form, test:

```text
source bytes
-> source node
-> inherited context with provenance
-> evidence spans
-> semantic proposal
-> resolved or review result
-> family route
-> rendered row or typed no-row result
-> publication withheld
```

15. **No-detail-loss oracle.** A lawyer-reviewed fixture must list material facts expected in the semantic result and the row. The test must fail when party, controlling party, action, qualification, exception, timing, threshold or cross-reference detail disappears.
16. **Resolved-no-row case.** Pin the one current routed claim that produces no row. Require an explicit owner or explicit unsupported disposition. A silent absence fails.
17. **Known lossy rows.** Include at least one D&O, No Shop, No Other Reps / Fraud and MAE example from the 244 known-loss claims. The new path must preserve the named lost detail.
18. **Source recall denominator.** Count lawyer-annotated source propositions, not only produced claims. A source proposition with no candidate must fail recall.

### Priority 1: routing and projection

19. **Child-level family routing.** One section with children belonging to different families must route each child without duplicating or dropping source bytes.
20. **No legacy default.** In the new path, an unclassified source node must be an explicit residual. It must not default to Capitalisation.
21. **All-family owner closure.** Every approved claim definition must have exactly one output owner or an approved no-output disposition. The current 175 ownerless claims must be represented in the test input.
22. **Atomic row lineage.** Each rendered fact must name the exact claim and source nodes it represents. Grouped rows must retain all contributing identities and details.
23. **Navigation identity.** Collapse and expand must use the same source node identifiers as extraction. No separate navigation hierarchy is allowed.

### Priority 1: publication and migration

24. **Mandatory public adapter.** A public projection call without a release receipt must fail. Private review must use a different explicit mode.
25. **Structural-risk publication stop.** Missing node coverage, ambiguous inheritance, unverified evidence or unresolved reference closure must force `WITHHELD`.
26. **Old-new resolution diff.** A migration test must stop if a previously resolved claim changes value, evidence or state unexpectedly, or if open-world increases in any family.
27. **Rollback.** Each migration stage must reproduce the prior output after the new adapter is disabled.

### Priority 2: broader confidence

28. Add real agreements from drafting styles not represented by Landos, Modiv, TopBuild, Skechers and the selected excerpts.
29. Add mutation tests that insert, delete or move one heading, marker, proviso or sentence and verify the smallest expected node and claim change.
30. Add a real local database publication test to the release gate, while keeping pure unit tests for ordinary agent work.

## Proportionate verification commands

Do not use the full suite for normal Stage 2Y structure work. Use the smallest group that matches the changed seam.

### A. Structure and inheritance gate

Use this after parser, node, context or inheritance work:

```bash
node --test --test-concurrency=4 \
  tests/canonical-v2-source-identity.test.js \
  tests/canonical-v2-admitted-semantic-source.test.js \
  tests/canonical-v2-native-sectionizer.test.js \
  tests/subclauses.test.js \
  tests/canonical-v2-governing-structure.test.js \
  tests/canonical-v2-candidate-governing-context.test.js \
  tests/canonical-v2-limb-components.test.js \
  tests/canonical-v2-qualifier-attachment.test.js
```

Add the termination tests only when chapeau or party inheritance changes:

```bash
node --test \
  tests/canonical-v2-termination-limb-chapeau-structure-swap.test.js \
  tests/canonical-v2-termination-limb-grant-context.test.js
```

### B. Evidence and resolution gate

Use this after evidence, proposal or resolver work:

```bash
node --test --test-concurrency=4 \
  tests/canonical-v2-native-producer-evidence-integrity.test.js \
  tests/canonical-v2-native-extraction-run.test.js \
  tests/canonical-v2-citation-constructibility.test.js \
  tests/canonical-v2-native-write-set-adapter.test.js \
  tests/canonical-v2-candidate-resolution.test.js
```

This is replay-only. Do not add a live provider flag.

### C. Routing gate

Use this after family detection, registry or dispatch work:

```bash
node --test --test-concurrency=4 \
  tests/canonical-v2-producer-prompt-registry.test.js \
  tests/canonical-v2-section-family-classifier-quarantine.test.js \
  tests/canonical-v2-family-section-ref-generator.test.js \
  tests/canonical-v2-native-provider-family-dispatch.test.js
```

Do not treat `canonical-v2-full-corpus-routing-prompt-cost-audit.test.js` as a real-corpus accuracy test. Run it only when the audit artefact code changes.

### D. Row and measurement gate

Use the generic preview plus only the affected family preview:

```bash
node --test \
  tests/canonical-v2-rendered-row-preview.test.js \
  tests/canonical-v2-claim-scoped-single-row-preview.test.js \
  tests/stage-2y-cd-measurement.test.js \
  tests/stage-2y-cd-known-loss-adjustment.test.js
```

Then add one family file, for example:

```bash
node --test tests/canonical-v2-antitrust-rendered-row-preview.test.js
```

Do not regenerate the baseline or pin from these commands.

### E. Publication gate

Use this only when publication, serving filters or authority code changes:

```bash
node --test \
  tests/canonical-v2-resolution-publication-split.test.js \
  tests/canonical-v2-publication-disposition.test.js \
  tests/canonical-v2-publication-serving-filter.test.js \
  tests/stage-2y-phase-b-live-authority.test.js
```

Do not run the optional database test unless a database-backed writer change requires it and the local database is already configured.

### F. Architecture prototype gate

The first structural prototype should have one new test file that contains the Priority 0 source-to-output fixtures. During prototype work, run that file plus command A. Run commands B, C, D and E only when the prototype reaches their seam.

This keeps checks proportionate. It also prevents a large green suite from hiding the one question under investigation.

## Final assessment

The current tests support incremental restructuring. They provide useful safety nets for byte identity, deterministic behaviour, existing resolved claims, row lineage and publication withholding.

They do not support a conclusion that the current agreement representation is complete. The new architecture should add exact source-tree and inheritance acceptance tests first. Existing tests should continue to protect the old path during side-by-side migration.
