# Canonical Process Intelligence implementation plan

## Objective

Add a fast, source-exact Process Intelligence domain to Precedent Machine,
starting with certified exclusivity precedents and Metsera, without creating a
second canonical platform or disturbing the active Canonical V2 programme.

This plan is release-gated. Completing a work package does not activate a
feature, move an active pointer or authorise production corpus writes.

## Fixed decisions

1. Precedent Machine is the only canonical product and data platform.
2. Deal Storylines is prototype evidence, not a production data source.
3. Exclusivity is the first certified process family.
4. Metsera is the anchor deal, followed by a stratified set of at least 25
   deals.
5. Ask and Browse compile to the same governed Query IR.
6. Initial answers are exact precedent passages, not narrative LLM summaries.
7. Every user-facing canonical PM field is available through the shared filter
   registry once separately certified and release-compatible.
8. Process development remains staging-only and feature-disabled until explicit
   activation.
9. The first-release exclusivity predicate set is frozen and non-optional.
10. Process ships only inside one whole PM successor release.

## Programme sequence

After each lane's generated work class opens, three lanes may proceed in
parallel without sharing authority:

### Contract lane

Work packages 1 through 3 define the extension seam, shared facts and
exclusivity semantics. This is the critical path for canonical admission.

### Evidence lane

Work packages 0 and 5 prepare independent Metsera source inventories, gold
spans, negatives and Storylines discrepancy fixtures. Gold sealing does not
wait for extractor implementation.

### Product lane

Work packages 7 and 8 may build against immutable generated fixtures after work
package 1 freezes the logical contracts and only when their generated work class
is open. Fixture UI cannot connect to candidate or production data.

The lanes converge at Metsera certification. Corpus certification, candidate
release and activation remain sequential. Work package numbers express gates,
not a requirement to leave independent evidence or fixture work idle.

Heavy work package 4 implementation begins only after a consumed-contract freeze
manifest fixes the exact writer, shared-row, release, exact-detail, Query IR and
field-registry contracts Process uses.

The consumed-contract manifest is drift detection, not authority. Every work
item records its canonical work class and generated gate dependency. With an
absent, stale or failing programme-status artefact, only specification review
and emergency containment proceed. The bounded vertical slice requires
`canonical_work_start`, the full-bundle `ContractFreezeAttestation` and
`vertical_slice_execution`.

Process changes the complete bundle fingerprint. After WP1-WP3, WP3A compiles
the Agreement-plus-Process successor bundle, obtains a new freeze and runs a
Process-bearing bounded slice for that exact frozen pair. Broad Process source
discovery, extraction, reprocessing and candidate work requires the successor
`candidate_scope_and_extraction` dependency set after both
`P1_VERTICAL_SLICE_PASS` and `PROCESS_VERTICAL_SLICE_PASS`. Phase 9 gates govern
import and activation.

## Work package 0: freeze evidence and attack the design

### Deliverables

1. Pin the Deal Storylines design evidence at `77688ad` and Fable review at
   `383ffee`.
2. Pin the PM base contract and programme versions used by the design.
3. Export a content-addressed Storylines ledger snapshot containing the release
   watermark, required tables, `pipeline_runs`, `l2_revisions`, repair receipts,
   schema identity and checksums.
4. Inventory the Storylines source fixtures, vocabulary, known corrections,
   review notes and failure cases.
5. Create a threat model covering false facts, omissions, cross-bidder
   contamination, source drift, release drift, false zeroes and performance
   collapse.
6. Fix an owner-effort budget for each review gate.
7. Run the design through the adversarial test programme in this plan.
8. Record final accepted, rejected and deferred findings in the design.
9. Pre-register the Process acquisition sampling frame, source cutoff, pilot
   strata, quotas and exclusions.
10. Separate Metsera and tuning deals from an untouched final holdout.

### Gate

The design has no unresolved contradiction with the canonical writer, source,
release, serving-row, exact-detail or query contracts.

## Work package 1: define the domain extension seam

### Deliverables

1. Define the generated domain registry entry for Process.
2. Define process concept, question, result, dimension, operator, source-role,
   exact-detail and Browse schemas.
3. Add a governed `ProcessNarrationOccurrence`, `PROCESS_NARRATION` expected-slot
   variant, occurrence identity, claim-owner and relationship-endpoint support,
   revision, physical carrier, writer disposition, release/import/trace
   treatment and serving access.
4. Map narration attributes to claims and evidence, participants and retellings
   to relationships, and composed events to frozen
   `ResultDefinition`, expected occurrence slots, revisions and
   `ResultInputLineage`.
5. Define how event and `ProcessPhrasebookPassageResult` `CANONICAL_RESULT` rows
   inhabit `SharedServingRow` at `RESULT_ROW` grain without a new generic
   variant.
6. Define the bounded inline exact-passage preview, child collections and
   successor parent-bound paragraph-context exact-detail action.
7. Define process residual and open-world candidate handling.
8. Define process admission identities at predicate granularity.
9. Create contract fixtures for development before the host contracts land.
10. Prove that fixture and generated adapters expose byte-equivalent logical
   shapes.
11. Create the consumed-contract freeze manifest.
12. Regenerate fixtures and run a divergence gate after any merge touching a
   consumed contract and at every downstream work-package gate.
13. Stop dependent implementation on an unadjudicated divergence.

### Negative tests

- A process domain cannot write a deal fact.
- A runtime plugin cannot add a predicate or field.
- An unknown event, field, operator or Browse item fails compilation.
- A candidate or failed process row cannot enter `SharedServingRow`.
- A Storylines ID cannot become a canonical identity.
- A candidate value, selected revision or model output cannot define an
  occurrence ID or ordinal.
- A process row without expected slots, lineage and a valid output grain cannot
  compile.
- A narration claim without a registered `PROCESS_NARRATION` owner cannot
  compile.
- A phrasebook card that is not an exact-detail-capable `RESULT_ROW` parent
  cannot compile.
- A caller-selected byte offset cannot drive paragraph context.
- An additive Process definition cannot change a frozen Agreement definition,
  historical release object or saved query definition. New release-bound
  serving identities are generated only by the whole successor release.

### Gate

The extension seam compiles from the canonical bundle and grants no source,
writer, release or serving authority of its own. Existing Agreement fixtures
remain byte-identical.

## Work package 2: build the shared fact authority and projection

### Deliverables

1. Inventory every legacy deal, entity, value and adviser input and classify it
   as candidate evidence, not canonical truth.
2. Add upstream PM definitions for entity-name occurrences, aliases and
   identity bridges, source-backed deal facts, and adviser and lawyer
   assignment relationships.
3. Add a stable `EntitySubject` identity based on a governed external ID or
   Ben-approved immutable import seed, plus entity revisions, conflict and
   supersession rules.
4. Register entity expected slots, logical and physical carriers, writer
   actions, relationship endpoints, release/import/trace treatment and serving
   projections.
5. Admit them through claims, relationships, results, evidence, revisions and
   the canonical writer.
6. Generate the read-only process deal-fact projection.
7. Include canonical entities, dates, sector, jurisdiction, structure,
   consideration, price, stated value, normalised equity value and advisers.
8. Bind every projected field to state, source and derivation.
9. Resolve adviser roles to named entities and dated tracks where required.
10. Add a candidate-fact proposal route to the canonical writer for genuinely
   missing facts.
11. Prohibit cached `pm_*` copies and direct PM service-role access from a
   process module.
12. Build the release-compatible participant-to-deal traversal as a governed
   Process relationship projection. Bind its schema, executor semantics and
   live-versus-pinned equivalence proof.
13. Define adviser states including `UNDISCLOSED`, `NOT_EXAMINED` and
   `NO_ADVISER`.

### Required proofs

- A press-release headline value retains its stated basis.
- Enterprise value cannot silently become equity value.
- A target-paid dividend cannot become offer consideration.
- Buyer and target counsel do not swap.
- Pfizer advisers do not attach to Novo in Metsera.
- Conflicting source facts remain visible and versioned.
- A positive named multi-bidder fixture proves per-track adviser attribution
  actually works.
- Negative fixtures prove undisclosed losing-bidder advisers remain undisclosed
  rather than inheriting a side-level firm.
- Participant filters return identical rows live and under the pinned release.
- Legacy strings or read-time name maps cannot satisfy a canonical entity or
  adviser filter.
- Entity names cannot supply entity identity or silently merge two subjects.
- Every displayed bridge and adviser assignment reaches its own source witness.

### Gate

Process extraction can resolve every required shared fact or produce a typed
missing or conflicting state without creating parallel truth.

## Work package 3: freeze the exclusivity semantic contract

### Deliverables

1. Author the ordinary exclusivity question and result definitions.
2. Independently author the completeness-challenge question catalogue.
3. Reconcile the full question contracts.
4. Define source roles, positive and negative witnesses, absence-proof rules,
   party roles, temporal scope and event relationships.
5. Freeze the mandatory first-release predicate set and dependency closure.
6. Define distinct predicates and states for express request,
   `EXPRESS_REFUSAL`, `COUNTERPROPOSAL`, `CONDITIONAL_ACCEPTANCE`, grant,
   extension, amendment, waiver and ending.
7. Define a clock-expression AST covering anchors, effectiveness, timezones,
   counting conventions, calendars, boundaries, conditional branches and
   stated versus computed duration.
8. Define rationale, condition and bidder-track dimensions.
9. Define narration and event granularity, composition and continuation rules.
10. Define the source-local identity and entity-unification evidence contract,
   including permitted bridge witnesses, conflict checks, identity states and
   serving rules.
11. Exclude “declined by omission” from release one. Reserve any future
    no-recorded-grant predicate for a complete source universe and governed
    interval.
12. Define exclusivity subject as negotiation or transaction exclusivity,
    exclusive diligence or data access, or another separately governed subject.
13. Permit a generic Browse union only when it preserves the exact subject and
    response state in each result.
14. Obtain legal-semantic approval for the frozen contract.

### Negative tests

- A request cannot satisfy a grant predicate.
- Silence cannot satisfy an outright refusal without its own governed
  predicate.
- A shortened term or conditional response cannot become an outright refusal.
- Exclusive access to clinical data cannot become negotiation exclusivity.
- A mandatory predicate cannot be removed merely because it fails.
- A business-day term cannot become an elapsed-day duration without the
  required calendar and anchors.
- A grant beneficiary cannot be inferred from generic acquirer side.
- A same-day paragraph cannot inherit a date by proximity alone.
- A later retelling cannot create a second market event automatically.
- An unknown exclusivity variation cannot be forced into the nearest type.
- Matching date and economics alone cannot silently unify `Party 1` with a
  named bidder.
- A `SOURCE_LOCAL_ONLY` track remains useful without entering a named-party
  cohort.

### Gate

Every mandatory exclusivity question has a complete, independently reconciled
semantic contract.

## Work package 3A: freeze and prove the successor bundle

### Deliverables

1. Compile one complete Agreement-plus-Process successor
   `CanonicalContractBundle`.
2. Run all required exact-digest cold review lanes and obtain Ben approval for
   that exact root.
3. Issue the new full-bundle `ContractFreezeAttestation` and generated
   programme-status evidence.
4. Add `PROCESS_VERTICAL_SLICE_PASS` and make the successor
   `candidate_scope_and_extraction` dependency set require it.
5. Under `vertical_slice_execution`, run one bounded Process-bearing source
   package through acquisition expectation, intake, canonical text, narration,
   claims, relationships, result, writer, candidate release, serving row,
   phrasebook query and exact detail.
6. Prove authoritative-writer-only DML, bounded database work, exact passage,
   source action and sibling isolation.

### Gate

WP4 remains blocked until the exact successor frozen pair records
`PROCESS_VERTICAL_SLICE_PASS`. Earlier Agreement-only slice evidence cannot
authorise Process extraction.

## Work package 4: build source acquisition, discovery and extraction

### Deliverables

1. Define `ExternalSourceAcquisitionManifest`, frozen external snapshot and
   cutoff identities, expected-source and receipt schemas, terminal
   dispositions, carriers, writer actions and trace edges.
2. Build two implementation-disjoint acquisition enumerators over SEC filing
   history, amendments, supplements, exhibits, incorporated references and
   approved non-SEC sources. The SEC paths use complete issuer submissions
   history including older-file pagination, and daily or full-index accession
   inventory plus recursive filing-package and cross-reference traversal,
   respectively.
3. Reconcile exact expected source sets, fetch receipts, package membership and
   terminal dispositions. Common under-inclusive endpoints do not prove
   independence.
4. Block every unresolved expected fetch or reference.
5. Bind the acquisition manifest through `IntakeCutoffAttestation`,
   `IntakeUniverseManifest`, deal admission, `CorpusScopeManifest`, candidate
   release, coverage and traceability.
6. Feed the reconciled universe into canonical immutable source, independent
   deal-document membership and source-map intake.
7. Build a structural scope and coverage pass without counting it as an event
   enumerator.
8. Build one semantic exclusivity-question enumerator over the complete
   governed source scope.
9. Build one independent deterministic lexical and pattern enumerator over the
   same scope. It cannot consume the semantic enumerator's model response or
   candidates.
10. Freeze source-local narration and composed-event expected occurrence slots,
   member comparators and ordinals before value extraction.
11. Reconcile the two event inventories and retain their disagreement rate.
12. Retain complete candidate, rejected and residual inventories.
13. Add bounded model proposal attempts only where useful.
14. Build deterministic normalisation into candidate process graphs.
15. Create a versioned canonical paragraph-segmentation projection with exact
   source-map lineage for context expansion.
16. Validate exact spans, event boundaries, entities, chronology, roles,
   tracks, positions, economics and relationships.
17. Route disagreement and unknown semantics to the governed review queue.
18. Record run, contract, source and extractor identities.

### Storylines rule treatment

Evaluate, but do not automatically adopt:

- board-continuation merge rules;
- strong and weak anaphoric date rules;
- intruder-span and embedded-dateline guards;
- event-title composition rules;
- package and dividend accounting rules; and
- context furniture clamps.

Each rule needs a declared safe domain, positive fixtures and constructed
counterexamples.

### Gate

The same admitted source and reviewed proposal reproduce byte-identical
candidate graph output. No graph can write or serve.

## Work package 5: certify the Metsera exclusivity slice

Metsera is the development and anchor set. It is not held-out generalisation
evidence and a pass cannot substitute for work package 6.

### Gold construction

1. Independently read the complete governed source scope.
2. Enumerate every exclusivity occurrence and related discussion.
3. Seal exact source spans before running the candidate extractor.
4. Separately label parties, roles, bidder tracks, dates, outcomes and event
   relationships.
5. Record known negatives and tempting false matches.
6. Reconcile two gold enumerations and resolve disagreements.
7. Label every named, governed-bridge, source-local-only and conflicting bidder
   identity.
8. Freeze field-specific evidence for every displayed identity, role,
   relationship and calculation.

### Acceptance

1. Passage discovery has no gold omissions.
2. Every published positive has exact evidence.
3. Actor, recipient, grantor, beneficiary and bidder track are correct.
4. Pfizer and Novo remain separated.
5. Dates and uncertainty match the source.
6. Retellings and continuations have correct event identities.
7. Related proxy passages are complete.
8. PM deal facts supply equity value, counsel and advisers.
9. Cash, dividend and CVR economics remain distinct.
10. Ask and Browse return identical governed rows.
11. Every enabled filter works against the pinned release.
12. Exact-detail and repeated context expansion reproduce source text.
13. Query and context latency meet the targets.
14. Malformed sibling rows and details fail locally.
15. Source-local labels are unified only through admitted bridge evidence.
16. Phrasebook rows return bounded inline verbatim previews without per-row
    detail requests.

### Gate

Every mandatory Metsera exclusivity predicate passes its separate
certification. A mandatory failure blocks the release. A separately authored
optional predicate failure disables only that predicate and its dependent
filters.

## Work package 6: stratified corpus certification

### Corpus

Pre-register at least 25 deals spanning:

- strategic and financial buyers;
- single-bidder and contested processes;
- public-company mergers and tender offers;
- cash, stock, mixed and CVR consideration;
- different sectors and periods;
- proxy, 14D-9 and supplemental source combinations;
- short and long process narratives; and
- simple and complex exclusivity histories.

Partition them into tuning and untouched holdout sets before extraction.

### Deliverables

1. Seal independent gold inventories.
2. Measure passage discovery, event classification, party attribution, temporal
   resolution and query recall separately.
3. Add adversarial negatives and mutation tests.
4. Classify every mismatch as extractor, contract, source, gold or query error.
5. Revise through new versioned contracts or extractors, never fixture-specific
   exceptions.
6. Create predicate-specific certification attestations.
7. Generate honest coverage and exclusion metadata.
8. Delegate first-pass enumeration to independent readers or bounded model and
   deterministic paths. Reserve Ben's work for semantic-contract approval,
   disagreement adjudication and a stratified source audit.
9. Freeze sampling frame, quotas, cutoff and exclusions.
10. After final contract and extractor freeze, run one one-shot untouched
    holdout evaluation for that candidate.
11. Keep case-level failures sealed from the extractor team until the release
    decision. A failure permanently fails that candidate's generalisation
    claim.
12. Require a separately pre-registered evaluation generation and
    repeated-testing policy for any later candidate before prior holdout details
    become tuning evidence.

### Owner-effort budget

Initial planning budget:

- WP0 design and threat-model adjudication: 2 to 4 hours;
- WP2 shared-fact semantic approval: 1 to 2 hours;
- WP3 exclusivity semantic approval: 6 to 10 hours;
- WP3A successor bundle approval: 1 to 2 hours;
- WP5 Metsera disagreements and audit: 4 to 6 hours;
- WP6 holdout disagreements and stratified audit: 11 to 16 hours;
- WP7 query semantics: 0 to 1 hour;
- WP8 product acceptance: 1 to 2 hours;
- WP10 release evidence: 1 to 2 hours; and
- activation review: 2 to 4 hours.

The programme therefore reserves 29 to 49 Ben-hours. If disagreement volume
would exceed that budget, improve the extractors or propose a successor
mandatory-predicate bundle for express legal-semantic and product approval. Do
not silently shrink the predicate set, lower the evidence standard or ask Ben
to perform first-pass enumeration across the entire pilot.

### Gate

All mandatory predicates pass the untouched holdout. No
Metsera-specific rule or unreviewed vocabulary exception remains.

## Work package 7: implement one query and field system

### Deliverables

1. Extend the canonical Query IR with Process domain predicates and dimensions.
2. Compile natural language, Browse, filters and saved searches to identical
   plans.
3. Generate Browse hierarchy from the domain registry.
4. Generate the filter builder from the canonical field registry.
5. Include all current deals-index fields and every admitted Process field.
6. Bind operators and capabilities by field type and release admission.
7. Bind every field to output grain, same-deal, same-event, same-track or
   same-component scope, multiplicity, completeness, quantifier, reducer and
   overflow semantics using the canonical query algebra.
8. Implement release-pinned, set-based execution and stable cursors.
9. Query `ProcessPhrasebookPassageResult` at `RESULT_ROW` grain and return its
   bounded inline preview and existing result-parent exact-detail references.
10. Implement governed passage relevance order, then 8 to 12 result
   diversification by deal and bidder track using
   deterministic round-robin rules. Do not use an embedding or ungoverned
   drafting cluster in release one.
11. Include bounded inline exact-passage previews, columns, cohort, exclusions,
    counts, pagination and source actions in
    the response.
12. Reuse `CanonicalServingCacheIdentity` verbatim.
13. Build a frozen practitioner-utterance suite with positive, negative,
    ambiguous, adjacent-legal-concept and misspelling goldens.
14. Route each global-front-door request to one domain plan. Refuse
    cross-domain Boolean requests until a composite contract is certified.
15. Preserve existing Agreement Query IR semantics and content under the prior
    query version, excluding documented release-bound identities.
16. Build a release-bound serving projection for counts, coverage and
    diversification. Bind the generator, inputs, diversity keys and output
    digest to the release.

### Required regressions

- Party-side filters return the same result live and pinned.
- A participant hop without release-compatible deal identity fails validation.
- Ask and Browse plans compare byte-equivalent after canonical serialisation.
- Unsupported natural language refuses rather than selecting a close concept.
- Legally adjacent phrases and misspellings map or refuse exactly as frozen.
- Same-event and same-track filters cannot be satisfied across unrelated rows.
- Empty and incomplete repeatable sets obey non-vacuous three-valued semantics.
- A cross-domain Boolean request cannot cause client-side answer joining.
- A phrasebook `CLAIM` row cannot masquerade as an exact-detail parent.
- Empty results do not claim absence without an absence-proof contract.
- A result from one release, predicate or filter set cannot poison another
  cache entry.
- One query performs one mandatory admission-token RPC and at most one bounded
  route-specific serving RPC.
- Adding a Process field cannot alter an existing field key, operator or saved
  Agreement query.
- A result set with fewer than eight qualifying passages shows all available
  passages and never pads with repeats.

### Gate

Every visible Browse item, filter and natural-language interpretation compiles
to an admitted executable plan.

## Work package 8: build the PM interface

### Surfaces

1. Add Ask and Browse as equal modes in the PM query surface.
2. Use a quiet topic index and dynamic pattern index.
3. Add the searchable all-field filter builder under `More filters`.
4. Render answer-first passage results with optional dense table mode.
5. Add the persistent desktop source reader and full-screen mobile reader.
6. Implement repeat-click paragraph expansion above and below.
7. Show deterministic related-process labels and verbatim previews.
8. Add copy citation, share link and export actions.
9. Use PM typography, spacing, responsive rules and source-action patterns.
10. Add a per-deal `Exclusivity history` view using the same released rows,
    bidder tracks, filters and source reader. Defer a general Process timeline
    until enough families are certified to make it honest.
11. Add an authorised correction proposal action that enters PM's canonical
    revision workflow.
12. Bind paragraph expansion to the generated parent-bound bidirectional
    context action. Do not accept caller offsets.
13. Bind related passages to a bounded child collection.
14. Make share links exact-manifest-bound and return
    `RELEASE_NOT_ACTIVE` after release change.

### UI invariants

- No raw machine keys in practitioner mode.
- No repeated explanatory copy.
- No forest of pills.
- No separate `Go` buttons for each filter group.
- No summary substitutes for source drafting.
- No page-level failure from one malformed row or detail.
- No field appears usable when its predicate or release join is unavailable.
- No per-deal chart, title or timeline event may infer a fact absent from the
  released row.
- A correction cannot mutate the active row or bypass recertification.
- The first per-deal view cannot imply that exclusivity events form the complete
  transaction chronology.

### Gate

Desktop and mobile browser acceptance, accessibility and visual regression pass
against the generated serving contracts.

## Work package 9: performance and operational hardening

### Serving

1. Benchmark warm, cold and concurrent queries.
2. Remove any full-corpus serverless fetch path.
3. Add indexed, set-based query projections.
4. Prove stable pagination under corpus growth.
5. Add bounded context range reads.
6. Exercise cache invalidation on release change and rollback.
7. Add capacity failure and no-retry tests.
8. Reuse the complete canonical cache, admission, authorisation and revocation
   partition.

### Extraction

1. Benchmark ordinary source-to-candidate processing.
2. Add digest-based incremental reprocessing.
3. Bound model attempts, bytes, runtime, memory and temporary storage.
4. Prove crashes retain intake and attempt evidence.
5. Prove a failed deal does not block unrelated candidate work.

### Targets

- p95 warm query under 500 ms;
- p95 cold query under 1.5 seconds;
- p95 local interaction under 200 ms;
- p95 context expansion under 300 ms where cached or range-addressable;
- frozen p99 ceilings and error budgets; and
- ordinary source-to-candidate machine time under ten minutes.

The benchmark manifest fixes corpus size, ordinary and maximum source-package
sizes, concurrency, cold-cache state, runtime, hardware, database state,
repetitions and percentile method.

### Security and operations

1. Generate Process routes and actions into PM's action-authorisation matrix.
2. Apply default-deny service identities, object predicates, CSRF and origin
   rules.
3. Sandbox hostile filing and archive parsing, including decompression, path,
   markup and prompt-injection attacks.
4. Isolate and protect every data-bearing preview.
5. Separately authorise and rate-limit exports, share links and corrections.

### Gate

Performance passes without weakening evidence, release or certification
invariants.

## Work package 10: whole successor release and Storylines retirement

### Deliverables

1. Build one complete immutable successor `CandidateReleaseManifest` containing
   Agreement and the mandatory certified Process predicates and rows.
2. Bind exact field and predicate admissions in the release manifest.
3. Validate shared-row, exact-detail, query, cache and export parity.
4. Import into an inactive serving namespace.
5. Prove expected versus physical inventories and Agreement semantic and
   content parity, excluding documented release-bound identity fields.
6. Run disabled production smoke tests.
7. Compare canonical results against the frozen Storylines fixtures.
8. Preserve useful discrepancy fixtures.
9. Retire the Storylines Phrasebook after PM precedent-search equivalence.
10. Keep the full Storylines Merger Brief read-only and clearly labelled until
    enough process families support an honest PM replacement, or Ben expressly
    approves removal without replacement.
11. Prohibit any dual-write or Storylines-to-PM service-role connection.
12. Prepare rollback and activation evidence.
13. Roll back the whole release tuple. Do not activate or revoke only a Process
    namespace.

### Gate

The candidate is complete, independently reviewed, inactive and rollback-safe.
Activation remains a separate explicit decision.

## Work package 11: activation and expansion

### Activation

1. Obtain architecture, legal-semantic, security and product approval.
2. Confirm all production feature flags are closed before the activation event.
3. Activate the exact certified release and namespace.
4. Smoke-test Ask, Browse, filters, source detail and rollback.
5. Monitor latency, failures, refusals, empty-result reasons and source actions.
6. Roll back on any release, evidence or semantic identity mismatch.
7. For each release with new process deals, audit every discovery disagreement,
   fully source-review at least three random new deals and source-walk at least
   20 newly served passages, or all available when below those counts.
8. Reopen affected-predicate certification on any unsupported served fact,
   critical omission, source-map failure, cross-track error or material drift
   beyond the pre-activation disagreement and exception thresholds.
9. Add `SEMANTIC_OR_SOURCE_INTEGRITY` and its typed evidence schema to the
   successor `ActiveReleaseRevocationActionRegistry`.
10. On a credible material false fact, source-map failure or cross-track error,
    disable the Process route within 15 minutes as an operational kill switch,
    then execute the registered whole-tuple revocation or rollback within 60
    minutes. The route switch is not a canonical state transition. Do not wait
    for a successor release.

### Expansion

After exclusivity:

1. choose the next process family from observed practitioner demand and
   certification cost;
2. repeat the predicate-scoped contract and certification sequence;
3. add per-deal process views only from released rows; and
4. introduce CVR as another domain using the same extension seam, field
   registry, Query IR, serving row and source reader.

Narrative LLM synthesis remains out of scope until exact precedent search has
real usage evidence and a separate evidence-safe design.

## Ownership, estimate and replanning

The provisional RACI is:

| Work | Responsible | Accountable / approver |
| --- | --- | --- |
| Canonical integration and gate status | Codex primary implementation lead | Ben |
| Source acquisition and reconciliation | Codex evidence lead | Codex primary implementation lead |
| Legal-semantic gold and holdout custody | Independent evidence reader | Ben |
| Extraction, query and UI | Codex primary implementation lead | Ben for product acceptance |
| Security and hostile-source testing | Codex security review lane | Codex primary implementation lead |
| Whole-release control and rollback | Codex release controller | Ben for activation |
| Post-activation containment | Codex release controller | Ben |

The same agent cannot act as both ordinary and independent enumerator or certify
its own independence. The named task identities and immutable input roots are
recorded at kickoff. If a responsible lane cannot be staffed independently, its
WP is blocked.

Provisional team effort, excluding the existing Canonical V2 programme:

| WP | Team hours | Ben hours | Critical predecessor |
| --- | ---: | ---: | --- |
| 0 | 24-40 | 2-4 | specification-review authority |
| 1 | 80-140 | 0 | full bundle design and gate status |
| 2 | 100-180 | 1-2 | WP1 and canonical entity/fact contract approval |
| 3 | 40-70 | 6-10 | WP1 |
| 3A | 80-140 | 1-2 | WP1-WP3 and new full-bundle freeze |
| 4 | 180-300 | 0 | `candidate_scope_and_extraction` |
| 5 | 60-100 | 4-6 | WP2-WP4 |
| 6 | 180-320 | 11-16 | WP5 and frozen tuning extractor |
| 7 | 120-200 | 0-1 | WP1-WP3 and serving contracts |
| 8 | 100-160 | 1-2 | WP7 generated fixtures |
| 9 | 80-140 | 0 | WP4, WP7 and WP8 |
| 10 | 60-100 | 1-2 | WP6 and WP9 |
| 11 | 40-80 | 2-4 | Phase 9 activation authority |

These are planning ranges, not dates. Each WP receives a frozen scope, response
SLA and named task owner before it opens. A PM gate-date movement,
contract-fingerprint change, holdout contamination, estimate overrun above 25
per cent or Ben-hour budget overrun forces a written replan before dependent
work continues.

## Cross-cutting adversarial programme

The plan is not ready for implementation until attacks cover:

### Source and spans

- one-character punctuation drift;
- bad span length and offset;
- page-furniture contamination;
- same text occurring twice;
- filing amendment and source-version substitution;
- missing supplemental filing and unresolved incorporated reference;
- context expansion crossing the governed source boundary; and
- exact-detail substitution across rows or releases.

### Discovery and granularity

- an exclusivity event outside the located Background section;
- two events in one paragraph;
- one event across several paragraphs;
- an intruding event inside a continuation gap;
- an embedded dateline;
- strong and weak anaphora with misleading antecedents;
- repeated narration versus a distinct renewed request;
- narration without a registered owner, expected slot or writer path;
- candidate-value-derived event identity or ordinal;
- a drafting synonym absent from the lexicon; and
- correlated agreement caused by two enumerators consuming the same model
  transcript or candidate list.

### Parties and tracks

- two bidders in one passage;
- anonymous source-local bidder labels;
- adviser changes over time;
- target board acting through an adviser;
- bidder consortiums;
- an umbrella proposal involving multiple parties;
- live versus release-pinned participant joins; and
- source-local bidder unification based only on coincident date and economics;
  and
- two name occurrences merged without a stable entity subject.

### Economics

- enterprise value stated as transaction value;
- equity value derived from an incorrect share count;
- target dividend treated as buyer consideration;
- tiered price components summed;
- contingent maximum represented as guaranteed value;
- CVR amount attached to the wrong bid; and
- press-release and proxy value conflict.

### Query

- ambiguous natural language;
- unsupported predicate;
- close but legally different predicate;
- express refusal confused with counterproposal or conditional acceptance;
- exclusive data access confused with negotiation exclusivity;
- filter with an unavailable release join;
- cross-release cache poisoning;
- cursor drift after release change;
- diversity collapse to one deal;
- zero results represented as market absence; and
- an under-populated predicate padded with repeated passages;
- cross-domain predicates joined in the client;
- same-event predicates accidentally satisfied across different events;
- incomplete or empty repeatable sets passing vacuous `ALL`; and
- a near-neighbour legal phrase mapped to the wrong predicate.

### Serving and UI

- malformed sibling row;
- failed exact-detail action;
- missing source context;
- unknown canonical variant;
- raw machine-key leakage;
- mobile reader overflow;
- repeated context expansion;
- caller-selected paragraph or byte offsets;
- inline passage results that require one detail call per row;
- claim-grain passage rows pretending to be exact-detail parents;
- related passage with summary but no drafting; and
- feature disabled after cache population.

### Platform authority

- process code writing a PM fact;
- Storylines service-role credential access;
- candidate graph exposed to serving;
- release manifest missing a field admission;
- active pointer change by a work package;
- local subset freeze treated as programme authorisation;
- partial Process activation beside an earlier Agreement release;
- Process extraction authorised by an Agreement-only vertical-slice pass;
- acquisition agreement that is absent from release lineage;
- an unregistered data-integrity revocation cause;
- legacy fallback after canonical failure;
- future CVR code creating a second query or field system; and
- a consumed Canonical V2 contract changing without fixture regeneration and
  divergence adjudication.

## Final readiness checklist

- [ ] Design survives adversarial review.
- [ ] Domain seam is generated and authority-free.
- [ ] Generated programme gates authorise the exact work class.
- [ ] Shared facts and entities have canonical authority, source and derivation.
- [ ] Source acquisition and deal-document universes reconcile.
- [ ] Acquisition completeness enters cutoff, scope, release and trace lineage.
- [ ] Narrations, events, claims, relationships, results and lineage map fully.
- [ ] The successor bundle and Process-bearing vertical slice pass.
- [ ] Exclusivity question contracts reconcile.
- [ ] Metsera gold passes.
- [ ] Mandatory predicate floor passes.
- [ ] Untouched stratified holdout passes.
- [ ] Ask, Browse and filters share one Query IR.
- [ ] All enabled PM fields are release-compatible.
- [ ] Exact passages and source reader pass.
- [ ] Performance contracts pass.
- [ ] Storylines code and ledger evidence are content-addressed.
- [ ] Owner review stays within the approved budget.
- [ ] Post-activation sampling and recertification triggers are fixed.
- [ ] Candidate release and rollback pass.
- [ ] Whole Agreement and Process successor release and rollback pass.
- [ ] Security and containment controls pass.
- [ ] Storylines remains evidence, not authority.
- [ ] Independent reviews pass.
- [ ] Production activation is explicitly authorised.
