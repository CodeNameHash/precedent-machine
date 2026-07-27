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

## Work package 0: freeze evidence and attack the design

### Deliverables

1. Pin the Deal Storylines review branch at `77688ad`.
2. Pin the PM base contract and programme versions used by the design.
3. Inventory the Storylines source fixtures, vocabulary, known corrections,
   review notes and failure cases.
4. Create a threat model covering false facts, omissions, cross-bidder
   contamination, source drift, release drift, false zeroes and performance
   collapse.
5. Run the design through the adversarial test programme in this plan.
6. Record final accepted, rejected and deferred findings in the design.

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

### Required proofs

- A press-release headline value retains its stated basis.
- Enterprise value cannot silently become equity value.
- A target-paid dividend cannot become offer consideration.
- Buyer and target counsel do not swap.
- Pfizer advisers do not attach to Novo in Metsera.
- Conflicting source facts remain visible and versioned.

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
8. Obtain legal-semantic approval for the frozen contract.

### Negative tests

- A request cannot satisfy a grant predicate.
- Silence cannot satisfy an outright refusal without its own governed
  predicate.
- A grant beneficiary cannot be inferred from generic acquirer side.
- A same-day paragraph cannot inherit a date by proximity alone.
- A later retelling cannot create a second market event automatically.
- An unknown exclusivity variation cannot be forced into the nearest type.

### Gate

Every enabled exclusivity question has a complete, independently reconciled
semantic contract.

## Work package 4: build source discovery and extraction

### Deliverables

1. Reuse canonical immutable source and source-map intake.
2. Build one structural Background-section discovery path.
3. Build one independently authored exclusivity-question discovery path over
   the governed source scope.
4. Retain complete candidate, rejected and residual inventories.
5. Add bounded model proposal attempts only where useful.
6. Build deterministic normalisation into candidate process graphs.
7. Validate exact spans, event boundaries, entities, chronology, roles,
   tracks, positions, economics and relationships.
8. Route disagreement and unknown semantics to the governed review queue.
9. Record run, contract, source and extractor identities.

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

### Gold construction

1. Independently read the complete governed source scope.
2. Enumerate every exclusivity occurrence and related discussion.
3. Seal exact source spans before running the candidate extractor.
4. Separately label parties, roles, bidder tracks, dates, outcomes and event
   relationships.
5. Record known negatives and tempting false matches.
6. Reconcile two gold enumerations and resolve disagreements.

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
8. Implement 8 to 12 result diversification by deal, track and drafting
   pattern.
9. Include columns, cohort, exclusions, counts, pagination and source actions in
   the response.
10. Build release-aware cache identities.
11. Preserve existing Agreement Query IR serialisation and results
    byte-identically under the prior query version.

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
10. Add a per-deal Process view using the same released rows, bidder tracks,
    filters and source reader.
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
9. Revoke Storylines service-role integration and dual-serving paths.
10. Prepare rollback and activation evidence.

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
- repeated narration versus a distinct renewed request; and
- a drafting synonym absent from the lexicon.

### Parties and tracks

- two bidders in one passage;
- anonymous source-local bidder labels;
- adviser changes over time;
- target board acting through an adviser;
- bidder consortiums;
- an umbrella proposal involving multiple parties; and
- live versus release-pinned participant joins.

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
- diversity collapse to one deal; and
- zero results represented as market absence.

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
- legacy fallback after canonical failure; and
- future CVR code creating a second query or field system.

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
- [ ] Candidate release and rollback pass.
- [ ] Storylines remains evidence, not authority.
- [ ] Independent reviews pass.
- [ ] Production activation is explicitly authorised.
