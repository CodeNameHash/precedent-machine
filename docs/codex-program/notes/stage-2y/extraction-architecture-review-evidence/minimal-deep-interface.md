# Minimal deep interface design

Date: 2026-08-10

Review base: `853b9e83b1bf067eabb5b2c86a10918e47a7d7e6`

Branch inspected: `origin/claude/codex-handoff-plan-status-77wn7n`

## Scope and decision

This note designs one alternative for the Stage 2Y extraction architecture. It is the minimal deep interface alternative. A **module** is a software area that hides its implementation. An **interface** is the small set of calls and returned data that callers must understand. A **deep module** has a small interface and hides substantial useful behaviour.

The decisive recommendation is to restructure the present extraction path behind one deep module with three public calls. Do not replace the whole system. Keep the exact-source, canonical-claim, output-projection and publication-control implementations that already have the correct purpose. Move structural parsing and inherited context to an earlier seam. A **seam** is the place where one module hands data to another.

The three calls are:

1. `indexAgreement(...)`: create the complete source structure.
2. `analyseAgreement(...)`: create claims and relationships from that structure.
3. `projectAgreement(...)`: create review, product or navigation views from the analysis.

The module must hide marker parsing, sentence segmentation, inheritance, claim routing, family resolution, coordinate conversion and output ownership. Callers should not reconstruct any of those matters. Publication control remains a separate inactive authority boundary that can consume a completed projection.

This design accepts Ben's hierarchy-first hypothesis with one amendment. The written hierarchy is a tree. Written cross-references and semantic relationships form graphs over that tree. The correct representation is therefore a source tree plus explicit graphs, not a tree alone.

## Definitions

- A **source node** is an addressable block written in the agreement. It has exact byte coordinates. An unnumbered sentence is a source node.
- A **source tree** is the ordered parent-child hierarchy of source nodes. For example, an agreement contains an article, the article contains a section, and the section contains sentences or outline items.
- A **cross-reference graph** records links that are not containment. For example, a phrase in section 6.2(d) may refer to section 6.2 or to a defined term in Article I.
- A **semantic claim** is a normalised legal fact derived from one or more source nodes. For example, a claim can state that either Parent or the Company has a termination right after a final non-appealable restraint.
- **Inherited context** is a fact written in one source node that governs another source node. For example, limb `(d)` can inherit `either Parent or the Company may terminate` from the section chapeau.
- **Provenance** is a record of where a value came from and how it reached its present use.
- A **projection** is an output view of semantic analysis. A rendered review row is a projection. It is not the contract structure.
- An **adapter** converts one interface to another. A compatibility adapter can let the old resolver consume the new source index during migration.
- **Leverage** means that one interface supports many useful behaviours. **Locality** means that one change can remain in one module.

## What the code does now

The present system has strong source and claim primitives. It does not have one complete structural representation of the agreement. It has several partial representations that are created at different times.

### Current path

```text
immutable source bytes
  -> article and section parser
  -> sectionizer marker tree
  -> selected section text sent to a family producer
  -> quoted evidence span and model proposal
  -> candidate compiler
  -> family-specific resolver, which reparses local structure
  -> post-resolution structure annotation
  -> family route and product projection
  -> rendered row preview
  -> publication disposition and serving filter
```

The path has three representations of lower-level structure:

1. The sectionizer makes `ROOT`, `ARTICLE`, `SECTION` and generic `SUBSECTION` nodes.
2. The governing-structure module makes section-local leaves and chapeau chains after evidence exists.
3. The limb-component module makes semantic path and assertion nodes from model-authored limb paths.

These representations do not share one stable source-node identity.

### Module inventory

| Current module | True responsibility in code | Decision | Seam finding |
|---|---|---|---|
| `lib/canonical-v2/source-structure.js` | Builds immutable source records, exact semantic spans, excerpts, provision instances and one-level provision components (`:54`, `:148`, `:308`, `:344`, `:377`). | Keep. | The exact-byte foundation is sound. It does not represent the complete written hierarchy. |
| `lib/parser-v2/structural.js` | Detects article and section regions. `countSubItems` counts lowercase markers for complexity, but does not make child nodes (`:2171`, `:2544`). | Keep as a low-level parser. | It should not be treated as a complete agreement tree. |
| `lib/canonical-v2/native-producer/deterministic-sectionizer.js` | Builds an ordered tree and generic marker nodes (`buildMarkerTree` at `:233`; `makeNode` at `:740`; `appendMarkerNodes` at `:790`; main call at `:835`). | Change. | Extend it into the single complete source index. It now lacks typed sentence, chapeau, qualification and sub-clause nodes. Its node identity also includes change-prone placement data. |
| `lib/canonical-v2/native-producer/governing-structure.js` | Re-parses a section into leaves and derives a chapeau chain after an evidence span exists (`:166`, `:225`, `:294`). | Change, then internalise. | It creates a second structure without stable source-node identifiers. It should query the source index. |
| `lib/canonical-v2/native-producer/candidate-governing-context.js` | Creates exact section-local chapeau, item, sibling and trailing records for one claim. It requires one operative evidence edge (`forCandidate` at `:68`). | Change into a compatibility adapter. | Context is claim-driven. Multi-span and cross-reference claims cannot use this path. |
| `lib/canonical-v2/native-producer/structure-placement.js` | Adds structure metadata after resolution, then strips it at the projection bridge (`annotateEntryStructureContext` at `:118`; `withoutStructureContext` at `:225`). | Replace after shadow migration. | This is the wrong seam. Structure should exist before analysis and remain available to projections. |
| `lib/canonical-v2/native-producer/anthropic-provider.js` | Locates model quotes and builds evidence. The default path takes the first occurrence even though an all-occurrence helper exists (`:589`, `:597`, `:623`). | Keep the provider. Change quote anchoring. | A repeated quote can be attached to the wrong occurrence. The provider should return proposals against source-node identifiers, not author structure. |
| `lib/canonical-v2/native-producer/limb-components.js` | Mints semantic path nodes and assertion nodes from compiled or model limb paths (`mintLimbComponentTree` at `:227`). | Keep only as a semantic tree, then simplify. | Its path nodes are not the written source tree. Missing ancestors can be inferred from a model path. The name currently invites the wrong use. |
| `lib/canonical-v2/native-producer/limb-enumeration-scan.js` | Compares marker tokens in source text with proposed limb paths. It types marker and cross-reference ambiguity. | Keep as a diagnostic adapter. | It should compare semantic proposals with the source index. It should not mint source nodes. |
| `lib/canonical-v2/native-producer/candidate-proposal-compiler.js` | Converts a provider proposal into a claim-shaped candidate (`compileCandidateProposal` at `:222`). | Change. | It builds canonical claim identity before the canonical subject is known. Keep a proposal as a proposal until context resolution ends. |
| `lib/canonical-v2/claims-relationships.js` | Defines canonical claims, relationships and evidence roles. Evidence roles include operative text, definition, exception, cross-reference and derivation input (`:5`; claim revision at `:290`). | Keep and extend compatibly. | Evidence has exact excerpt identity but no first-class source-node reference or inherited-fact dependency. |
| `lib/canonical-v2/native-producer/candidate-resolution.js` | Resolves claims, re-parses source text, derives parties and chapeaux, applies family rules, builds provision identity and adds review metadata. The public call begins at `:4418`; local source reconstruction begins at `:4556`; finalisation begins at `:6079`. | Replace as a public interface. Migrate its algorithms. | This module has too many responsibilities and too many configuration arguments. It is the main source of poor locality. A fix for context often requires family-specific edits here. |
| `lib/canonical-v2/native-producer/native-extraction-run.js` | Selects sections, sends exact section text to producers, compiles candidates and resolves them (`runNativeExtraction` at `:570`). | Change orchestration. | Analysis begins at selected sections but lower structure is not an input. Section selection can become an accidental content gate. |
| `lib/canonical-v2/native-producer/section-family-classifier.js` and `family-section-ref-generator.js` | Classify section families and generate proposed section references (`:458`; generator at `:102`). | Keep and change inputs. | Family routing should choose analysis adapters. It must not define or remove source structure. |
| `lib/canonical-v2/native-producer/native-write-set-adapter.js` | Converts section-local spans to document coordinates and remints excerpt and claim identities (`buildNativeWriteSet` at `:768`). | Keep during migration. Simplify later. | Its churn is a symptom of more than one coordinate system and more than one identity round. |
| `lib/canonical-v2/termination-product-projection.js` | Maps resolved termination claims to product fields and rows. `rightFeatures` selects a narrow feature set (`:426`; projection at `:913`). | Keep the projection rules. Change the input seam. | It does not receive the complete source context, including a distinct trailing proviso. It cannot restore lost facts. |
| `lib/review-parity/rendered-row-preview.js` and `rendered-row-preview-contract.js` | Route one resolved claim, project it and require a matching row (`previewClaimSection` at `:398`). | Keep. | The fail-closed row check is sound. It checks row existence, not preservation of all important detail. |
| `lib/canonical-v2/publication-disposition.js` | Evaluates whether an item can be published (`evaluatePublicationDisposition` at `:556`). | Keep. | Publication remains separate from resolution, as required. |
| `lib/canonical-v2/publication-serving-filter.js` | Filters product output by publication authority. `REQUIRE_PUBLISHED` cannot serve because there is no receipt-consuming adapter (`:10`). | Keep behind separate publication control. | The historical no-filter path returns all internal results. Internal projections must request an explicit non-serving view. |

### Main seam violations

| Loss or combination | Present location | Effect |
|---|---|---|
| Source hierarchy is inferred from a claim's evidence. | `candidate-governing-context.js` and `governing-structure.js` | A source block that produces no claim may have no lower-level node. Multi-span claims are refused. |
| A model-authored `limb_path` is used to make path nodes. | `anthropic-provider.js` and `limb-components.js` | Semantic output can masquerade as source structure. Descriptive headings and outline markers are mixed. |
| Family resolution reconstructs source context. | `candidate-resolution.js` | Party, subject, verb and chapeau fixes are repeated by family. A later resolver compensates for an earlier structural gap. |
| Structure is attached after resolution and removed before output. | `structure-placement.js` | Claims and rows cannot depend on stable source nodes. A renderer may receive too little detail. |
| Evidence is located before the exact occurrence is disambiguated. | `anthropic-provider.js` | Repeated text can point to the first occurrence rather than the intended occurrence. |
| Section-local evidence is later converted and identities are rebuilt. | `native-write-set-adapter.js` | There are avoidable identity rounds and more places for coordinate errors. |
| Projection uses a family-specific reduced feature set. | Product projections | A row can exist while an exception, party capacity or qualification has disappeared. |

## The deep module

The module can be named `AgreementMachine`. The name is less important than the interface. It exposes three calls and versioned return records.

```text
                        AgreementMachine

 admitted source  ->  indexAgreement  ->  AgreementIndex
                                               |
                                               v
 policy/adapters  -> analyseAgreement  ->  AgreementAnalysis
                                               |
                                               v
 view             -> projectAgreement  ->  AgreementProjection

 Hidden inside: byte validation, structure grammar, source identifiers,
 cross-references, inheritance, evidence anchoring, family routing,
 claim resolution, row lineage and output ownership.
```

A separate `PublicationControl.evaluate(projection, authority)` call remains outside `AgreementMachine` and stays inactive.

### Entry point 1: `indexAgreement`

```ts
indexAgreement({
  admitted_source,
  parser_policy
}) -> AgreementIndex
```

`admitted_source` is the existing immutable source record. `parser_policy` is one versioned policy object. It is not a list of parser switches.

The result contains:

- the immutable bytes and canonical text identity;
- the complete ordered source tree;
- exact byte spans for each node;
- stable node identifiers and legacy aliases;
- written cross-reference edges;
- definition-use edges where deterministic resolution is possible;
- parsing diagnostics and alternative readings;
- a byte-coverage ledger.

The call is deterministic. The same source and policy must return the same bytes, nodes, identifiers, order, diagnostics and digest.

### Entry point 2: `analyseAgreement`

```ts
analyseAgreement({
  index,
  analysis_policy,
  inference_adapter
}) -> AgreementAnalysis
```

`analysis_policy` defines family rules, definitions and fail-closed thresholds in one versioned object. `inference_adapter` is optional. It can later be a Phase B model adapter, but Phase B remains deferred and locked now.

The call performs these internal steps:

1. Build agreement-wide party, defined-term and cross-reference indexes.
2. Select the highest relevant source node for an analysis adapter.
3. Traverse that subtree from parent to child.
4. Create direct and inherited context facts with provenance.
5. Run deterministic extractors first.
6. Ask the optional inference adapter only for semantic proposals that deterministic rules cannot settle.
7. Anchor every proposal to existing source nodes and exact spans.
8. Resolve canonical subject and context.
9. Build each canonical claim once.
10. Return separate resolved, open-world and review records, plus a coverage ledger.

Family routing chooses analysis adapters. It does not decide which bytes or source nodes exist. One source node may route to several families.

If Phase B resumes later, the adapter must receive the complete selected subtree, exact bytes for every node, all unresolved residual bytes, inherited context facts with provenance, and resolved external references. It must also receive the complete raw bytes for the selected subtree. Structural annotations may guide the model, but they must not exclude source text. The model must not repair a defective tree or invent evidence coordinates.

### Entry point 3: `projectAgreement`

```ts
projectAgreement({
  analysis,
  view
}) -> AgreementProjection
```

`view` is explicit. Its kind is one of `NAVIGATION`, `REVIEW` or `PRODUCT_PREVIEW`. The call cannot request serving or create publication authority.

The result contains:

- the requested navigation nodes or rendered rows;
- claim-to-row lineage;
- source-node and evidence-span lineage;
- output ownership results;
- explicit no-row and non-renderable reasons;
- a projection coverage ledger.

The projection module cannot parse source text, add inherited context or create claims. It can select, group and summarise existing semantic facts. If a row format cannot express a material exception, the projection records the omission as known loss or fails closed under its policy.

## Source structure

### Node types

The source tree uses neutral written forms. It does not assign legal meaning merely from layout.

| Node kind | Meaning | Example |
|---|---|---|
| `AGREEMENT` | The complete admitted text. | The TopBuild merger agreement. |
| `ARTICLE` | A labelled article container. | `ARTICLE VI TERMINATION`. |
| `SECTION` | A labelled section container. | `6.2 Termination by Either Parent or the Company`. |
| `HEADING` | Authored descriptive heading text. | `Contracts`. |
| `PARAGRAPH` | A source paragraph or bare text block. | One unnumbered paragraph below section 3.1. |
| `SENTENCE` | One sentence, including an unnumbered sentence. | The second of three independent sentences under section 3.1. |
| `OUTLINE_ITEM` | Text introduced by a written marker. | `(d)` or `(iii)`. The marker span is metadata on this node. |
| `CLAUSE` | A grammatically distinct part within a sentence or item. | A chapeau before a colon, or a proviso after a semicolon. |
| `RESIDUAL` | Exact bytes whose structural role is not resolved. | Text around a page break that the parser cannot classify. |

`CHAPEAU`, `OPERATIVE_TEXT`, `QUALIFICATION`, `EXCEPTION` and `PROVISO` are source roles on nodes or clause spans. They are not substitutes for node kinds. A heading is a node. An outline marker is a token span attached to an `OUTLINE_ITEM`. This distinction prevents a descriptive model label from becoming a marker path.

The tree can contain both containers and children over nested spans. Minimal leaf spans must be ordered and non-overlapping. Together, they must account for every source byte. Whitespace, page artefacts and unclassified text remain exact `RESIDUAL` leaves. Nothing is discarded.

Every independent bare sentence gets a stable child node. If section 3.1 contains three independent unnumbered sentences, the section has three `SENTENCE` descendants even if the source has no `(a)`, `(b)` or `(c)` labels. This is necessary for exact navigation, separate claims and narrow qualification scope.

### Stable identifiers

An identifier is stable when the same source and the same written anchor produce the same value. It must not change merely because a parent path or derived end byte is corrected.

For an outline item, use the accepted start-anchor rule:

```text
SOURCE_OUTLINE_NODE/V1(canonical_text_id, marker_start_byte)
```

The marker token, parent, path, ordinal, heading and end byte are checked attributes. They are not identity inputs. This follows the existing derived-limb identity decision.

For an unnumbered node, use:

```text
SOURCE_TEXT_NODE/V1(canonical_text_id, node_kind, start_byte)
```

The exact end byte and digest are attributes. `node_kind` separates a sentence and a nested clause that begin at the same byte. If a parser correction changes a node kind or start anchor, issue an explicit alias record from the old identifier to the new one. Do not silently reuse an identifier for different bytes.

Existing `ROOT`, `ARTICLE`, `SECTION`, provision and claim identifiers remain legacy aliases during migration. Preserve them where the same source unit still exists. Do not change resolved claim identifiers merely to adopt source-node identifiers.

Each source node records:

- `source_node_id`;
- `canonical_text_id`;
- `kind` and source roles;
- `start_byte` and `end_byte`;
- exact byte digest;
- parent identifier and ordered child identifiers;
- marker and heading spans, where present;
- parser policy version;
- structural state: `RESOLVED`, `AMBIGUOUS` or `RESIDUAL`;
- legacy identifiers and alias reason.

### Parent-child and cross-reference handling

Containment remains a tree. Each node has one structural parent. This is sufficient for collapse and expansion. The same source tree supports agreement, article, section, item and sentence views. A separate navigation hierarchy is not required.

A tree is not sufficient for references and legal relationships. Use graph edges for:

- `REFERS_TO`: a written cross-reference points to another source node;
- `USES_DEFINED_TERM`: a term use points to its definition node;
- `QUALIFIES`: a qualification governs a node or set of nodes;
- `EXCEPTS`: an exception limits a node or set of nodes;
- `PARTY_RELATIONSHIP`: a semantic party or control relationship;
- `CLAIM_DEPENDS_ON`: a claim depends on several source nodes or context facts.

Each written-reference edge records the source phrase span, target candidates and state. The state is `RESOLVED`, `AMBIGUOUS` or `DANGLING`. A cross-reference must not move the target node under the referring node.

## Analysis and inheritance

### Where analysis begins

Analysis starts at the highest node needed to capture the governing grammar. That node is usually a `SECTION`. It can be an `ARTICLE` where an article-level lead-in governs several sections. Agreement-wide analysis begins at `AGREEMENT` for parties, definitions and interpretive rules.

Analysis must not begin with an isolated lowest-level quote. For TopBuild section 6.2(d), the evidence sentence alone does not identify who may terminate. The section chapeau does.

Family routing may prioritise likely sections. It must not remove unselected nodes from the agreement index or declare them legally empty. The coverage ledger records nodes that no family has analysed.

### Inheritance rules

The context engine passes only a fact that grammar or an explicit reference shows governs the child.

It may pass:

- grammatical subject;
- obligor, right holder or represented party;
- modal and governing verb;
- shared object or legal standard;
- time anchor and duration anchor;
- condition that governs the complete list;
- qualification or exception whose scope is structurally resolved;
- party capacity resolved through a written definition or party relationship.

It must never pass:

- a sibling-specific threshold, qualifier or exception;
- a fact across an independent sentence merely because it is nearby;
- an output label, family name, card category or review verdict;
- absence of text as a positive inherited fact;
- one party's capacity to another party;
- a legal effect through an unresolved cross-reference;
- model confidence as a source fact;
- an ambiguous trailing qualification as if one scope were certain.

The narrowest-node rule controls scope. Attach a qualification or exception to the smallest complete source node that it grammatically governs. If it governs a whole list, add explicit `QUALIFIES` or `EXCEPTS` edges to that list node and derive its effect on descendants. If the last-antecedent or series scope is ambiguous, retain the possible readings and send the semantic question to review. Do not copy the text to every child and call the copies direct evidence.

### Provenance contract

Every direct or inherited value is a `ContextFact`:

```json
{
  "context_fact_id": "...",
  "kind": "RIGHT_HOLDER",
  "value": ["Parent", "Company"],
  "source_node_id": "section-6.2-chapeau-node",
  "source_span_id": "exact-chapeau-span",
  "target_node_id": "section-6.2-d-node",
  "inheritance_edge_id": "...",
  "rule_id": "SECTION_CHAPEAU_TO_DIRECT_ITEM/V1",
  "state": "INHERITED"
}
```

Allowed states are `DIRECT`, `INHERITED`, `RESOLVED_REFERENCE`, `OVERRIDDEN`, `AMBIGUOUS` and `UNDETERMINED`. An inherited value always names both its source node and target node. It also names the exact source span and deterministic rule. An override record retains both the inherited source fact and the local replacing fact. If a model proposes the relationship, the record also names the model receipt and remains unverified until an approved rule or human decision accepts it.

The child's raw quote never includes words that exist only in the parent. A review view can display two separate fields:

```text
Direct text: a permanent injunction ... shall have been issued ...
Inherited context: either Parent or the Company may terminate [from §6.2 chapeau]
```

This prevents false provenance.

### Claims and evidence

A claim points to one or more source nodes. It also retains exact evidence edges. These are different facts:

- `source_node_ids` identify the structural units needed to understand the claim.
- Evidence edges identify exact supporting spans and their roles.
- `derivation_dependencies` identify inherited `ContextFact` records and resolved graph edges.

For example, one termination-right claim can use:

- the section chapeau node for right holder and governing verb;
- limb `(d)` for the trigger;
- the proviso clause for an exception;
- section 6.2 itself as the structural host.

The evidence roles already defined in `claims-relationships.js` are useful. Keep `OPERATIVE_TEXT`, `DEFINITION`, `EXCEPTION`, `CROSS_REFERENCE` and `DERIVATION_INPUT`. Extend each edge with `source_node_id`. Do not replace exact spans with whole-provision evidence. A claim can use several narrow spans from several nodes.

Build canonical claim identity only after subject and inherited context are resolved. Keep model output as a proposal until then. This removes the present provisional-claim and rebuilt-claim identity cycle.

## Worked agreement example: TopBuild section 6.2(d)

The recorded source says, in the section lead-in:

> This Agreement may be terminated at any time prior to the Titanium Merger Effective Time by either Parent or the Company if:

Limb `(d)` then says, in substance, that a permanent injunction or other final and non-appealable order has been issued preventing or prohibiting the mergers. It ends with a proviso. The right is unavailable to a party whose own failure to fulfil an obligation caused the relevant event.

The source is recorded in `evidence/canonical-v2/topbuild-termination-20260809-2xk-r3-final/recording.json`. The scan `evidence/canonical-v2/topbuild-termination-20260809-2xk-r3-final/section-location-scan.json` places section 6.2 at document bytes `364374..365781`. The current governing-structure record identifies section-local chapeau bytes `0..174`, a `(d)` leaf, and a trailing qualification. The current operative evidence stops at the semicolon before the proviso.

### Target source structure

```text
SECTION 6.2
  HEADING: Termination by Either Parent or the Company
  CLAUSE [role=CHAPEAU]
    "This Agreement may be terminated ... by either Parent or the Company if:"
  OUTLINE_ITEM (a)
  OUTLINE_ITEM (b)
  OUTLINE_ITEM (c)
  OUTLINE_ITEM (d)
    CLAUSE [role=OPERATIVE_TEXT]
      final and non-appealable restraint prevents or prohibits the mergers
    CLAUSE [role=PROVISO, EXCEPTION]
      right unavailable to a party whose failure caused the event
```

The structural parent of `(d)` is section 6.2. Its structural children are the operative clause and the proviso clause. The section chapeau is a sibling that governs the list through an explicit context edge.

### Target inherited context

Limb `(d)` inherits:

- right holders: Parent and Company;
- modal and governing verb: may terminate;
- temporal limit: before the Titanium Merger Effective Time;
- condition relationship: the limb completes the word `if`.

Each value points to the chapeau node and exact chapeau span. The source does not pretend that `Parent`, `Company` or `may terminate` occurs inside the operative limb.

The proviso does not pass down from the chapeau. It is direct source text under limb `(d)`. It limits the termination right for the party that caused the event.

### Present result and loss

The present resolver successfully derives two party-specific semantic rights and carries a chapeau-derived grant context. This shows that the family-specific termination logic can recover part of the missing structure. It does not show that the general inheritance model is sound.

The current rendered row is effectively:

```text
Mutual / Either Party | Legal restraint / order | See provision | ... final and non-appealable ...
```

The row preserves the mutual nature and the trigger. It does not preserve the causation proviso as a separate structured detail. This is a source-to-output loss. A passing row test would not detect it.

Under the proposed interface, the claim depends on the chapeau, operative clause and proviso nodes. A compact product row may still summarise the right, but its projection record must retain the exception field and lineage. If the approved row schema cannot express it, the projection reports known loss or fails closed under the chosen policy.

## The 69 Red Hat limb proposals

The 69 items are not 69 unresolved source nodes. They are 69 model-emitted limb proposals. The recorded disposition accounts for all of them:

- 1 provider evidence residual;
- 68 open-world proposals with `UNMAPPED_GENERIC_CLAIM_KEY`;
- 6 of those 68 also feed assertion nodes;
- 66 paths are marker-like;
- 3 paths are descriptive: `Corporate power and authority`, `Due authorization`, and `Due execution and enforceability`.

This evidence is at `docs/codex-program/notes/step-2x-l1-limb-disposition.md:64-116`. There is no silent-drop remainder. The open question is their correct mapping and legal treatment, not whether they disappeared.

The target index handles them as follows:

1. Parse source outline items and headings independently of the model.
2. Map each proposal to one or more existing source nodes.
3. Treat zero matches and multiple matches as typed mapping uncertainty.
4. Keep a descriptive heading as a `HEADING` node or semantic label. Never coerce it into an outline marker.
5. Keep `UNMAPPED_GENERIC_CLAIM_KEY` as a semantic open-world state. It is not a structural state.
6. Keep the one unverifiable quote as a residual with exact surrounding source bytes.

The current `limb_components` path representation can remain a semantic assertion grouping during migration. It must not be used as the source tree.

## Error and uncertainty handling

The module fails closed without discarding text.

### Source uncertainty

- Every byte belongs to an ordered minimal leaf.
- Unclassified bytes become a `RESIDUAL` node.
- Ambiguous parentage records the candidate parents and reason.
- An ambiguous node remains addressable, but it cannot author inherited context.
- Repeated quote text requires a unique node and span match. A first-occurrence fallback is not allowed.
- A parser policy change produces an old-to-new node diff and alias table.

### Semantic uncertainty

- `attempted`, `resolved`, `open_world` and `review` remain separate states. Do not add them into one recovery number.
- A cross-reference can remain ambiguous or dangling.
- A multi-span claim is valid. It is not forced into a one-span context call.
- An inference result is a proposal until its source nodes, evidence and subject are resolved.
- An unknown taxonomy entry stays open-world.
- An unresolved inherited value stays `UNDETERMINED`. It is not filled by proximity.

### Projection uncertainty

- Every resolved claim has an output owner or an explicit no-owner reason.
- A routed claim with no row remains a typed failure.
- A grouped claim that cannot select one row fails closed.
- A row that omits a material semantic field records known loss.
- Serving requires publication authority. Review and preview are not publication.

## Test strategy

The three calls are the main test surface. Internal parsers also retain focused unit tests.

### `indexAgreement` tests

- Exact source bytes round-trip.
- Ordered minimal leaves cover 100% of bytes with no gaps or overlaps.
- The same source and policy produce byte-identical output twice.
- Articles, sections, nested outline items and sub-items have correct parents.
- Three unnumbered sentences under one section produce three sentence nodes.
- A chapeau, each limb, each sub-limb and a trailing proviso are separate nodes or clauses.
- Headings and outline markers remain distinct.
- UTF-8 byte coordinates remain exact.
- Repeated text has distinct node and span identities.
- Page-break and OCR artefacts become residuals rather than disappearing.
- Cross-references resolve, remain ambiguous or remain dangling with typed reasons.
- A parser correction preserves marker-start identifiers where the written marker did not move.

The existing sectionizer, governing-structure, candidate-context, limb-enumeration and limb-component tests provide useful fixtures. They do not yet prove complete byte ownership, unnumbered sentence identity or provenance on inherited facts.

### `analyseAgreement` tests

- Analysis starts at the highest governing node and visits children in source order.
- Every inherited fact has source node, source span, target node and rule identifiers.
- No inherited words appear as direct child evidence.
- Subject, modal, verb, party and time context pass only through approved edges.
- A sibling-only exception does not leak to another sibling.
- A whole-list qualification reaches all governed descendants through explicit edges.
- Ambiguous trailing scope produces review, not a guessed result.
- A claim can cite several nodes and several evidence roles.
- Defined-term and cross-reference dependencies retain their own source spans.
- Provider proposals cannot create source nodes.
- A repeated quote without unique node anchoring fails closed.
- The old and new resolution sets are compared by claim definition, subject, value, state and evidence.
- Any unexpected old resolved-claim value or state change stops migration.
- Any family-level open-world increase stops migration.

### `projectAgreement` tests

- Collapse and expansion use the source tree directly.
- Every rendered row traces to claims, context facts, source nodes and evidence spans.
- A resolved claim with no approved owner is explicit.
- A routed claim with no row is explicit.
- Grouped features fail closed when row selection is not unique.
- Important source detail, including exceptions, is either rendered or declared as known loss.
- Review and preview never create publication authority.
- No Phase B call occurs.

Test the separate publication controller with its existing fail-closed publication and serving gates. It must reject a projection without future release authority. That test is not a fourth `AgreementMachine` entry point.

### Source-to-output acceptance tests

Passing unit tests are necessary but not sufficient. Use source-to-output traces as the main evidence. The acceptance fixture for each representative provision records:

```text
source bytes
-> source nodes
-> direct and inherited context facts
-> evidence spans
-> claims and relationships
-> resolution state
-> family route
-> rendered rows or typed no-row result
-> publication result
```

Each trace names where information is intentionally summarised and where it is lost.

## Migration risk

The main risks are:

1. New node identifiers could cause avoidable identity churn.
2. A parser can infer a false hierarchy with high confidence.
3. Family-specific resolver logic can change behaviour when it receives richer context.
4. A complete tree increases record volume and comparison cost.
5. Moving context earlier can expose unresolved conflicts that old regex fallbacks concealed.
6. A projection may appear stable while its lineage changes.

These risks support a shadow migration. They do not justify keeping the current seams. They also do not justify a full replacement. Existing resolved claims, family rules and evidence must remain available as the control result.

### Safe migration sequence

1. Record the current commit, run receipts, resolution sets and measured output funnel. Do not change pins.
2. Add a read-only `AgreementIndex/V1` shadow artefact. Preserve existing node identifiers as aliases. Do not feed it to resolution.
3. Run byte-coverage and hierarchy checks on real agreements. Compare old section boundaries with the new tree.
4. Derive shadow `ContextFact` records for existing claims. Compare each fact with the context that current family resolvers derived.
5. Add a compatibility adapter that presents the new context to one current family resolver. Run old and new paths side by side. Do not select the new result.
6. Move source reconstruction out of `candidate-resolution.js` one family at a time. Keep each existing family algorithm unless evidence proves that algorithm wrong.
7. Add source-node and derivation references to canonical claims without changing old claim identifiers. Produce a full resolution-set diff. Stage 2Y does not change a pin or current selector.
8. Feed projections from `AgreementAnalysis` side by side. Compare fields, rows, no-row reasons and known loss.
9. Retire `structure-placement.js` from the shadow implementation only after all shadow consumers use the source index and no shadow output depends on its stripped annotation path. Live retirement and any pin or current-selector change require separate post-certification authority.
10. Consider a later Phase B adapter only after the deterministic structure and inheritance gates pass. Phase B is not part of this migration.

Each Stage 2Y stage writes a versioned shadow artefact and has an off switch. The current selector and pins remain unchanged. No stage activates publication.

Stop the migration if:

- any previously resolved claim changes value or state without an approved reason;
- open-world increases in any family;
- byte coverage is below 100%;
- a source node or inherited fact lacks exact provenance;
- marker identity moves when the written marker did not move;
- heading and outline-marker ambiguity is silently resolved;
- the new path drops a qualification, exception, party or cross-reference that the old path retained;
- a serving path becomes reachable without publication authority.

## Smallest useful prototype

Build a read-only, deterministic shadow index and context mapper. Do not call a model. Do not modify claims, rows, pins or publication records.

Use four real provisions:

1. TopBuild section 6.2, for a chapeau, limbs, party inheritance and a trailing proviso.
2. Metsera section 6.04, for an employee-period lead-in and separate child obligations.
3. Red Hat sections 3.01 and 3.02, for nested sub-limbs and the 69 proposal mappings, including descriptive headings.
4. One IOC section with a list-wide chapeau and a nested exception, selected from the existing Skechers or Concho fixtures.

The prototype has five outputs:

1. `AgreementIndex/V1` for the selected source ranges.
2. A byte-coverage ledger.
3. A proposal-to-source-node mapping ledger.
4. Shadow `ContextFact` records for current claims.
5. A source-to-current-row loss report.

It proves the architecture if:

- all bytes are accounted for;
- every independent unnumbered sentence has a node;
- every inherited subject, party, verb, condition and exception has exact provenance;
- the index is deterministic;
- TopBuild's proviso remains available in analysis even though the current row omits it;
- all 69 Red Hat proposals are accounted for and descriptive headings are not markers;
- no current resolved claim or row is changed because the prototype is shadow-only.

It disproves or pauses the architecture if the sample cannot be represented as one containment tree without false parentage, if deterministic rules cannot distinguish headings from markers, or if accurate inheritance requires copying words without a source node and span. In that event, retain the exact source index and use alternative-parent graph edges for ambiguous written structure. Do not fall back to model-authored structure.

## Complexity hidden from callers

The three-call interface hides:

- UTF-8 byte and character conversion;
- article, section, sentence, marker, heading and clause parsing;
- residual-byte ownership;
- stable source-node identity and aliasing;
- cross-reference and defined-term resolution;
- agreement-wide party and control graphs;
- parent-to-child inheritance and provenance;
- repeated-quote disambiguation;
- evidence role and multi-span management;
- family selection and family-specific extraction rules;
- model proposal validation;
- canonical subject and claim identity construction;
- old-to-new resolution-set comparison;
- output ownership, grouping and row matching;
- known-loss reporting;

Callers learn three durable records: `AgreementIndex`, `AgreementAnalysis` and `AgreementProjection`. They do not learn the dozens of switches now exposed by candidate resolution. This gives high leverage. A source grammar fix stays in indexing. An inheritance fix stays in analysis. A row-format fix stays in projection. This gives locality.

The separate publication controller hides publication authority and release-receipt checks from its own callers.

## Final assessment of this alternative

The present architecture should be restructured, not replaced. Exact source bytes are already preserved. Canonical claims, evidence roles, family rules, row projections and publication controls also contain valuable working behaviour. The wrong responsibility sits between these strengths: lower-level source structure is incomplete, context is derived after evidence or inside family resolution, and structure is stripped before output.

The minimal deep interface corrects that seam while preserving current results during migration. It gives every written block a stable node. It treats unnumbered sentences as children. It analyses from the highest governing node down. It records inherited values without false quotation. It uses one source tree for navigation and adds graphs for references and semantic relationships. It allows output rows to remain projections. It also provides a narrow future Phase B input that cannot compensate for defective document structure.
