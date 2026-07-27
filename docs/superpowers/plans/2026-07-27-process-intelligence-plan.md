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

## Programme sequence

Three lanes may proceed in parallel without sharing authority:

### Contract lane

Work packages 1 through 3 define the extension seam, shared facts and
exclusivity semantics. This is the critical path for canonical admission.

### Evidence lane

Work packages 0 and 5 prepare independent Metsera source inventories, gold
spans, negatives and Storylines discrepancy fixtures. Gold sealing does not
wait for extractor implementation.

### Product lane

Work packages 7 and 8 may build against immutable generated fixtures after work
package 1 freezes the logical contracts. Fixture UI cannot connect to candidate
or production data.

The lanes converge at Metsera certification. Corpus certification, candidate
release and activation remain sequential. Work package numbers express gates,
not a requirement to leave independent evidence or fixture work idle.

Heavy work package 4 implementation begins only after a consumed-contract freeze
manifest fixes the exact writer, shared-row, release, exact-detail, Query IR and
field-registry contracts Process uses.

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

### Gate

The design has no unresolved contradiction with the canonical writer, source,
release, serving-row, exact-detail or query contracts.

## Work package 1: define the domain extension seam

### Deliverables

1. Define the generated domain registry entry for Process.
2. Define process concept, question, result, dimension, operator, source-role,
   exact-detail and Browse schemas.
3. Define how Process `CANONICAL_RESULT` rows inhabit `SharedServingRow` without
   a new generic variant.
4. Define process residual and open-world candidate handling.
5. Define process admission identities at predicate granularity.
6. Create contract fixtures for development before the host contracts land.
7. Prove that fixture and generated adapters expose byte-equivalent logical
   shapes.
8. Create the consumed-contract freeze manifest.
9. Regenerate fixtures and run a divergence gate after any merge touching a
   consumed contract and at every downstream work-package gate.
10. Stop dependent implementation on an unadjudicated divergence.

### Negative tests

- A process domain cannot write a deal fact.
- A runtime plugin cannot add a predicate or field.
- An unknown event, field, operator or Browse item fails compilation.
- A candidate or failed process row cannot enter `SharedServingRow`.
- A Storylines ID cannot become a canonical identity.
- An additive Process definition cannot change an existing Agreement contract,
  row, query or release identity.

### Gate

The extension seam compiles from the canonical bundle and grants no source,
writer, release or serving authority of its own. Existing Agreement fixtures
remain byte-identical.

## Work package 2: build the shared fact projection

### Deliverables

1. Generate the read-only process deal-fact projection.
2. Include canonical entities, dates, sector, jurisdiction, structure,
   consideration, price, stated value, normalised equity value and advisers.
3. Bind every projected fact to state, source and derivation.
4. Resolve adviser roles to named entities and dated tracks where required.
5. Add a candidate-fact proposal route to the canonical writer for genuinely
   missing facts.
6. Prohibit cached `pm_*` copies and direct PM service-role access from a
   process module.
7. Build the release-compatible participant-to-deal traversal as a governed
   Process relationship projection. Bind its schema, executor semantics and
   live-versus-pinned equivalence proof.
8. Define adviser states including `UNDISCLOSED`, `NOT_EXAMINED` and
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
5. Define exact predicates for request, decline, grant, extension, amendment,
   waiver and ending.
6. Define date, duration, rationale, condition and bidder-track dimensions.
7. Define event granularity and continuation rules.
8. Define the source-local identity and entity-unification evidence contract,
   including permitted bridge witnesses, conflict checks, identity states and
   serving rules.
9. Obtain legal-semantic approval for the frozen contract.

### Negative tests

- A request cannot satisfy a grant predicate.
- Silence cannot satisfy an outright refusal without its own governed
  predicate.
- A grant beneficiary cannot be inferred from generic acquirer side.
- A same-day paragraph cannot inherit a date by proximity alone.
- A later retelling cannot create a second market event automatically.
- An unknown exclusivity variation cannot be forced into the nearest type.
- Matching date and economics alone cannot silently unify `Party 1` with a
  named bidder.
- A `SOURCE_LOCAL_ONLY` track remains useful without entering a named-party
  cohort.

### Gate

Every enabled exclusivity question has a complete, independently reconciled
semantic contract.

## Work package 4: build source discovery and extraction

### Deliverables

1. Reuse canonical immutable source and source-map intake.
2. Build a structural scope and coverage pass without counting it as an event
   enumerator.
3. Build one semantic exclusivity-question enumerator over the complete
   governed source scope.
4. Build one independent deterministic lexical and pattern enumerator over the
   same scope. It cannot consume the semantic enumerator's model response or
   candidates.
5. Reconcile the two event inventories and retain their disagreement rate.
6. Retain complete candidate, rejected and residual inventories.
7. Add bounded model proposal attempts only where useful.
8. Build deterministic normalisation into candidate process graphs.
9. Create a versioned canonical paragraph-segmentation projection with exact
   source-map lineage for context expansion.
10. Validate exact spans, event boundaries, entities, chronology, roles,
   tracks, positions, economics and relationships.
11. Route disagreement and unknown semantics to the governed review queue.
12. Record run, contract, source and extractor identities.

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

### Gate

Every Metsera exclusivity predicate passes its separate certification. A
failure disables only the affected predicate and dependent filters.

## Work package 6: stratified corpus certification

### Corpus

Select at least 25 deals spanning:

- strategic and financial buyers;
- single-bidder and contested processes;
- public-company mergers and tender offers;
- cash, stock, mixed and CVR consideration;
- different sectors and periods;
- proxy, 14D-9 and supplemental source combinations;
- short and long process narratives; and
- simple and complex exclusivity histories.

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

### Owner-effort budget

Initial planning budget:

- WP0 design and threat-model adjudication: 2 to 4 hours;
- WP3 exclusivity semantic approval: 6 to 10 hours;
- WP5 Metsera disagreements and audit: 4 to 6 hours;
- WP6 pilot disagreements and stratified audit: 15 to 25 hours; and
- activation review: 2 to 4 hours.

The programme therefore reserves 29 to 49 Ben-hours. If disagreement volume
would exceed that budget, reduce the first-release predicate set or improve the
extractors. Do not lower the evidence standard or ask Ben to perform first-pass
enumeration across the entire pilot.

### Gate

All predicates proposed for the first release pass the sealed pilot. No
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
7. Implement release-pinned, set-based execution and stable cursors.
8. Implement 8 to 12 result diversification by deal and bidder track using
   deterministic round-robin rules. Do not use an embedding or ungoverned
   drafting cluster in release one.
9. Include columns, cohort, exclusions, counts, pagination and source actions in
   the response.
10. Build release-aware cache identities.
11. Preserve existing Agreement Query IR serialisation and results
    byte-identically under the prior query version.
12. Build a release-bound serving projection for counts, coverage and
    diversification. Bind the generator, inputs, diversity keys and output
    digest to the release.

### Required regressions

- Party-side filters return the same result live and pinned.
- A participant hop without release-compatible deal identity fails validation.
- Ask and Browse plans compare byte-equivalent after canonical serialisation.
- Unsupported natural language refuses rather than selecting a close concept.
- Empty results do not claim absence without an absence-proof contract.
- A result from one release, predicate or filter set cannot poison another
  cache entry.
- One query performs one bounded database operation.
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

### Extraction

1. Benchmark ordinary source-to-candidate processing.
2. Add digest-based incremental reprocessing.
3. Bound model attempts, bytes, runtime, memory and temporary storage.
4. Prove crashes retain intake and attempt evidence.
5. Prove a failed deal does not block unrelated candidate work.

### Targets

- warm query under 500 ms;
- cold query under 1.5 seconds;
- local interaction under 200 ms;
- context expansion under 300 ms where cached or range-addressable; and
- ordinary source-to-candidate machine time under ten minutes.

### Gate

Performance passes without weakening evidence, release or certification
invariants.

## Work package 10: candidate release and Storylines retirement

### Deliverables

1. Build an immutable Process candidate release containing only certified
   predicates and rows.
2. Bind exact field and predicate admissions in the release manifest.
3. Validate shared-row, exact-detail, query, cache and export parity.
4. Import into an inactive serving namespace.
5. Prove expected versus physical inventories and semantic parity.
6. Run disabled production smoke tests.
7. Compare canonical results against the frozen Storylines fixtures.
8. Preserve useful discrepancy fixtures.
9. Retire the Storylines Phrasebook after PM precedent-search equivalence.
10. Keep the full Storylines Merger Brief read-only and clearly labelled until
    enough process families support an honest PM replacement, or Ben expressly
    approves removal without replacement.
11. Prohibit any dual-write or Storylines-to-PM service-role connection.
12. Prepare rollback and activation evidence.

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

## Cross-cutting adversarial programme

The plan is not ready for implementation until attacks cover:

### Source and spans

- one-character punctuation drift;
- bad span length and offset;
- page-furniture contamination;
- same text occurring twice;
- filing amendment and source-version substitution;
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
- source-local bidder unification based only on coincident date and economics.

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
- filter with an unavailable release join;
- cross-release cache poisoning;
- cursor drift after release change;
- diversity collapse to one deal;
- zero results represented as market absence; and
- an under-populated predicate padded with repeated passages.

### Serving and UI

- malformed sibling row;
- failed exact-detail action;
- missing source context;
- unknown canonical variant;
- raw machine-key leakage;
- mobile reader overflow;
- repeated context expansion;
- related passage with summary but no drafting; and
- feature disabled after cache population.

### Platform authority

- process code writing a PM fact;
- Storylines service-role credential access;
- candidate graph exposed to serving;
- release manifest missing a field admission;
- active pointer change by a work package;
- legacy fallback after canonical failure;
- future CVR code creating a second query or field system; and
- a consumed Canonical V2 contract changing without fixture regeneration and
  divergence adjudication.

## Final readiness checklist

- [ ] Design survives adversarial review.
- [ ] Domain seam is generated and authority-free.
- [ ] Shared facts have source and derivation.
- [ ] Exclusivity question contracts reconcile.
- [ ] Metsera gold passes.
- [ ] Stratified pilot passes.
- [ ] Ask, Browse and filters share one Query IR.
- [ ] All enabled PM fields are release-compatible.
- [ ] Exact passages and source reader pass.
- [ ] Performance contracts pass.
- [ ] Storylines code and ledger evidence are content-addressed.
- [ ] Owner review stays within the approved budget.
- [ ] Post-activation sampling and recertification triggers are fixed.
- [ ] Candidate release and rollback pass.
- [ ] Storylines remains evidence, not authority.
- [ ] Independent reviews pass.
- [ ] Production activation is explicitly authorised.
