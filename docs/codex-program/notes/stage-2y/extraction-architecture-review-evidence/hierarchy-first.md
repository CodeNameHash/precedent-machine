# Hierarchy-first architecture

Date: 2026-08-10
Authority: architecture evidence only
Implementation authority: none
Publication authority: none

## Decision

Adopt a hierarchy-first source module, with a cross-reference graph beside it. Restructure the source-to-semantic seam. Do not replace the full extraction system.

A **source node** is an addressed block of the agreement with an exact UTF-8 byte range. A **containment tree** records the one written parent of each source node. A **cross-reference graph** records links that are not containment, such as “Section 6.8(b)” or a defined-term reference. A **context frame** is the set of governing words and facts available to an analysed node. Each value in a context frame identifies the source node and exact span from which it came.

The current system preserves admitted source bytes and has a useful article, section and numbered-marker tree. It does not have a complete source structure. It has three partial structures:

1. `deterministic-sectionizer.js` creates exact root, article, section and numbered `SUBSECTION` nodes.
2. `subclauses.js` creates an in-memory list of leaf spans and chapeau spans, but no stable source-node identities.
3. `limb-components.js` creates a semantic tree from model-supplied paths after claims exist. Its path nodes have no source span.

These structures do not share one authority. Claim resolution often reconstructs governing context with family-specific regular expressions. The general structure annotation is applied after resolution. Persistence then drops some governing-context fields. This places responsibility at the wrong seam. The remedy is a staged restructure that makes one deterministic source tree authoritative before semantic analysis. Existing intake, source-map, evidence, vocabulary, resolution and projection work can migrate around that tree.

## Evidence base and limits

The findings below use:

- `lib/canonical-v2/native-producer/deterministic-sectionizer.js:1-35,740-830,835-1071`.
- `lib/parser-v2/subclauses.js:1-30,262-443`.
- `lib/canonical-v2/native-producer/governing-structure.js:1-41,166-257,294-365`.
- `lib/canonical-v2/native-producer/structure-placement.js:1-24,68-79,118-230,264-327`.
- `lib/canonical-v2/native-producer/candidate-governing-context.js:57-178`.
- `lib/canonical-v2/native-producer/candidate-resolution.js:20-65,1561-1587,1631-1855,4501-4625,5161-5258,5861-5973,6199-6228,10384-10612,11808-11818`.
- `lib/canonical-v2/native-producer/limb-components.js:1-86,208-400,407-549`.
- `lib/canonical-v2/local-staging-deal-reader.js:45-145,307-348`.
- The committed source references, section scans and resolution files for Concho, TopBuild and Red Hat.
- `docs/codex-program/notes/step-2x-l1-limb-disposition.md`.
- `evidence/review-feedback/2026-08-10/README.md`, read before `ben-row-feedback.json`.
- Decision 17 and its addenda at `docs/core/DECISIONS.md:1697-1765`.

A focused check ran once:

```text
CI=true node --test \
  tests/canonical-v2-native-sectionizer.test.js \
  tests/subclauses.test.js \
  tests/canonical-v2-governing-structure.test.js \
  tests/canonical-v2-candidate-governing-context.test.js \
  tests/canonical-v2-termination-limb-grant-context.test.js \
  tests/canonical-v2-ioc-parent-child-resolution.test.js
```

Result: 88 passed and 0 failed in about seven seconds. These tests prove their stated local contracts. They do not prove that every written source block has a node, that two parsers agree on parentage, or that inherited context reaches a claim and rendered row.

## Test of Ben's structural hypothesis

The corpus supports the hypothesis, with one correction. The written containment hierarchy should be a tree. Cross-references, defined terms and reciprocal-party relationships require graphs beside the tree.

| Hypothesis | Finding from current code and corpus |
|---|---|
| Parse the complete agreement | Correct target. Current root covers the admitted canonical text, but complete byte coverage is not complete structural interpretation. |
| Agreement, article, section | Supported. The sectionizer mints exact nodes for these kinds and tests exact round trips at `tests/canonical-v2-native-sectionizer.test.js:44-70,112-143`. |
| Subsections and nested markers | Supported, but current recovery is partial. The persistent parser only reads line-start markers through `MARKER_PATTERN` at `deterministic-sectionizer.js:117`. |
| Paragraphs and sentences | Required. Current persistent tree has neither kind. Concho sections 6.11 and 6.16 prove that markerless sections can contain several independent obligations. |
| Chapeaux, limbs and sub-limbs | Required. Current `segmentSubClauses` can expose leaf and chapeau spans, but it does not mint stable source nodes. |
| Parent-child relationships | Required. Current parentage is not authoritative because two independent marker algorithms can disagree. |
| Analyse from highest relevant node down | Correct. “Highest relevant” means the smallest node that contains the whole governing grammar. It does not mean sending the whole agreement to every family. |
| Explicit inheritance | Required. Current general context service is mainly report-only, while live inheritance is family-specific. |
| Collapse and expansion | Supported directly by the same source tree. A separate navigation hierarchy should not be created. |
| Unnumbered sentence children | Required. A sentence does not cease to be a separate source block because the drafter omitted a number. |

### Why a tree alone is insufficient

Concho section 6.20 says that Parent shall cause Merger Sub and the Surviving Corporation to perform their obligations. The section is one source node and the sentence is its child. The `CAUSES_TO_PERFORM` relationships between Parent and the two performance entities are not containment relationships. They belong in a semantic relationship graph. This source does not by itself prove corporate control.

Concho section 6.7 refers to section 6.7 itself, section 8.1, and the Confidentiality Agreement. Red Hat section 3.02(b)(i) uses defined terms and refers to the Parent Letter. These links can point outside the source parent. They belong in the cross-reference graph.

The recommended shape is therefore:

```text
immutable source bytes
        |
        v
written containment tree ---- typed cross-reference graph
        |
        v
context frames with exact provenance
        |
        v
claims and semantic relationship graph
        |
        v
rendered views -> inactive publication control
```

## What the current representation contains and misses

`deterministic-sectionizer.js` states that it creates a stable ordered tree with exact UTF-8 offsets. Its new marker parser is separate from `structural.js` (`deterministic-sectionizer.js:27-35`). It emits only `ROOT`, `ARTICLE`, `SECTION` and `SUBSECTION` nodes. It stores a flat node array and `parent_section_id`. A node identifier includes its kind, reference, depth, parent, span and text digest (`deterministic-sectionizer.js:740-779`). This is valuable, but it omits paragraphs, sentences, chapeaux, provisos, exceptions and trailing qualifications.

`segmentSubClauses` returns leaves that partition the non-whitespace text. A null marker means chapeau text (`subclauses.js:4-13,391-443`). These leaves are temporary records. They have no source-node identifier and no durable parent. `governing-structure.js` reconstructs a chapeau chain by splitting path strings and looking up leaves (`governing-structure.js:211-257`). It expressly says this derived structure is annotation-only and must not affect identity or model input (`governing-structure.js:25-32`).

The persistent parser and the governing-context parser also use different marker rules. The first accepts line-start parenthesised tokens. The second accepts permissive inline list openings after syntactic signals. Corroboration checks marker existence, not parentage (`governing-structure.js:25-28`). There is no one structure to which claims, navigation and output can all refer.

Claim resolution starts from flat candidates. It groups them by governing section, concept and party, then mints a provision that spans the whole section (`candidate-resolution.js:23-29`). General structure is attached only after the resolved, review and open-world lists have been assembled (`candidate-resolution.js:11808-11818`). The context ladder is report-only (`candidate-resolution.js:5861-5912`). Even `sourceParagraphForCandidate` calls the governing-structure resolver, then discards its chain and returns only the newline-bounded source line (`candidate-resolution.js:5914-5957`).

The resolver contains useful but bespoke compensations. Interim-operating-covenant claims locate the nearest preceding “party shall/will not” chapeau and put its party on a whole-section provision (`candidate-resolution.js:1561-1587,5161-5258`). Termination claims have separate chapeau, direction and section-fallback grammars (`candidate-resolution.js:1631-1855,10384-10612`). These repairs show that parent context is necessary. They also show that the general source-to-semantic seam does not provide it.

Persistence confirms the loss. `local-staging-deal-reader.js` records that `party_source_span`, `citation_context`, `governing_context_quote` and top-level `source_citation` cannot round-trip because they are absent from the write set (`local-staging-deal-reader.js:119-140,307-348`). A source-derived party may exist during resolution and disappear before a later projection reads the claim.

## Real traces

### Trace 1: Concho section 6.9(a), chapeau composition gap and period stopped at resolution

The admitted source is pinned by `evidence/canonical-v2/concho-employee-matters-20260809-2xk-final/source-reference.json`. Its raw-byte SHA-256 is `3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6`. The section scan places section 6.9 at canonical bytes 227443 to 234134.

The chapeau sets a 31 December end date, makes Parent responsible, and supplies the governing obligation for the four employee-benefit limbs.

The written hierarchy is:

```text
Section 6.9 Employee Matters
└── subsection (a)
    └── one list-bearing sentence
        ├── chapeau: period + Parent + “shall cause ... to be provided with”
        ├── limb (i): cash compensation opportunity
        │   └── proviso: base compensation shall not be reduced
        ├── limb (ii): equity compensation
        │   └── proviso: anti-duplication adjustment
        ├── limb (iii): employee benefits
        └── limb (iv): severance eligibility
```

Current persistent structure:

- Section 6.9 is node `9bb88eaf...`, bytes 227443 to 234134.
- Its direct children are 6.9(a) through 6.9(g).
- Section 6.9(a) has no persistent child nodes. Its inline `(i)` through `(iv)` list is not recovered by the line-start marker parser.

Current semantic result:

- Claim revision `21ed619a3633dcd6356f284abfcb8aa0c3f6b59de6c7f2eccca39be98a882170` is `EMPLOYEE_COMP_ITEM_STANDARD`.
- Its exact evidence is section-local bytes 392 to 634. The evidence contains only limb `(i)`'s compensation phrase.
- Its attributes identify `BASE_SALARY`, `NO_LESS_FAVORABLE`, `ITEM_BY_ITEM` and `BUYER_SIMILARLY_SITUATED`.
- It has no party, period or governing verb attribute.
- The provider separately proposed the period. Resolution retained that proposal for review with `MONTH_COUNT_UNRESOLVED`; it was never composed with the compensation claim.
- Its `structure_context` is marked resolved, but its leaf is all of 6.9(a), bytes 25 to 1590. The annotation has the period and Parent obligation in its text. It is applied after claim resolution and is not converted into provenance-bearing inherited fields.
- The provision instance spans the whole of section 6.9, not the sentence, chapeau or limb.

Current output:

The record for `(concho, EMPLOYEE_MATTERS, EMPLOYEE_COMP_ITEM_STANDARD)` in `evidence/canonical-v2/stage-2y-n-rendered-rows.json` renders:

```text
Benefit: Base salary
Reference Group: Similarly-situated buyer employees
Standard: No less favourable
Period: Not specified
```

Ben independently identified the same loss. Feedback card 14 says that the period was likely in the introduction and was dropped (`evidence/review-feedback/2026-08-10/ben-row-feedback.json:23`). The README confirms that dropped-chapeau observations survive the first artefact's presentation caveat (`evidence/review-feedback/2026-08-10/README.md:12-21`).

Target result:

- Analysis begins at the list-bearing sentence, not at limb `(i)` alone.
- The claim's direct operative evidence remains the exact limb `(i)` span.
- `obligor = Parent`, `modal = shall`, `governing_verb = cause ... to be provided with`, and `period = Until December 31 ...` flow from the chapeau.
- Each inherited field points to the chapeau node and its exact source span.
- The local proviso under limb `(i)` is attached to that limb. It is not broadcast to limbs `(ii)` through `(iv)`.
- A rendered row can show the period and obligor without pretending that those words occur inside the limb quote.

This is direct evidence of a missing context-composition seam. The absent party and governing verb expose the inheritance and producer-schema gap. The period was extracted separately and then stopped at `MONTH_COUNT_UNRESOLVED`, so defective inheritance was not the sole cause of its output loss.

### Trace 2: TopBuild section 6.2, chapeau party and limb proviso

The source section says that the agreement may be terminated by either Parent or the Company if one of four lettered grounds occurs. Limb `(a)` contains the outside-date ground and a proviso that removes the right from a party whose failure caused the missed date. Limb `(d)` contains the permanent, final and non-appealable restraint ground and another causation proviso.

The persistent sectionizer correctly creates section 6.2 and children 6.2(a) through 6.2(d). The claim for the outside-date limb has one `OPERATIVE_TEXT` edge over section-local bytes 178 to 267. Its raw value is only the trigger. The resolver separately derives the mutual grant and stores:

- `termination_grant_context.grant_quote` from the chapeau;
- `party_source_span` over document bytes 364438 to 364547;
- two party-specific claims, one for Parent and one for the Company;
- a whole-section provision instance over document bytes 364374 to 365781.

This is good local repair. It is not a general inheritance model. `party_source_span` is later one of the fields that cannot round-trip through staging. The exact proviso is in the structural leaf but is not a separate claim-evidence edge on the right-grant claim. A projection therefore has to omit it or rediscover it.

Target structure:

```text
section 6.2
├── heading
└── list-bearing sentence
    ├── chapeau: termination right + mutual holders + pre-Effective-Time limit
    ├── limb (a): outside-date ground
    │   └── proviso: causation exception to availability
    ├── limb (b): Parent vote ground
    ├── limb (c): Company vote ground
    └── limb (d): permanent final restraint ground
        └── proviso: causation exception to availability
```

The right-grant claim should cite the chapeau and trigger limb. Its exception edge should cite the proviso. The claim may resolve to two party-scoped semantic assertions, but both assertions should retain the same chapeau origin rather than copying the party names into the limb's quote.

### Trace 3: Concho markerless sections have independent child blocks

The Concho section scan shows no current children for sections 6.11, 6.16, 6.19 or 6.20.

Section 6.11 contains two independent sentences:

1. Each applicable party must notify the other party of transaction litigation and keep it informed.
2. The Company must let Parent participate, consult, and consider advice, subject to a proviso that limits settlement without Parent consent.

Section 6.16 contains three independent sentences:

1. Parent must cause listing before the Effective Time.
2. The Company must assist delisting and deregistration, with a ten-day outside limit after the Effective Time.
3. The Company must provide draft reports at least ten business days before Closing in the stated case.

These are not one undifferentiated source block. They have different parties, verbs, objects, timing and qualifications. Each sentence needs a stable child node even though no sentence has an authored number. Section 6.19 also shows why a semantic graph is needed: “None of the Parties” and “each of them” create reciprocal-party obligations inside one sentence.

### Trace 4: Red Hat sections 3.01 and 3.02, the 69 limb cases

The 69 cases are fully accounted for as pipeline dispositions. They are not fully represented as source structure.

The reproducible disposition is (`step-2x-l1-limb-disposition.md:64-84,99-132`):

| Disposition | Count |
|---|---:|
| `RESIDUAL_QUOTE_UNVERIFIED` | 1 |
| `OPEN_WORLD_ONLY` | 62 |
| `OPEN_WORLD_AND_ASSERTION_NODE` | 6 |
| Total | 69 |

Path hygiene is 66 `MARKER`, 3 `DESCRIPTIVE`, and 0 `MIXED`. This proves that every model-emitted item has a transport disposition. It does not prove that each item is bound to the correct written parent.

Two concrete defects remain:

1. Red Hat section 3.01 has a top-level `(h) Contracts.` followed by a roman child `(i)`. The current section scan creates a 15-byte `3.01(h)` node and then a top-level `3.01(i)` node. The model path records this content as `[(h),(i)]`. This is a parentage disagreement on real source.
2. The current `LIMB_COMPONENT_TREE/V1` for section 3.02 creates three spanless path nodes named “Corporate power and authority”, “Due authorization” and “Due execution and enforceability”. Those words are model summaries. They are not authored headings or outline markers in section 3.02(b)(i). The actual source contains three unnumbered sentences. Each sentence should be a source node. The three summaries may remain semantic proposition labels, but they must not masquerade as source structure.

The six existing assertion nodes have useful exact spans. Keep them as semantic assertion nodes, but replace `limb_path` as their structural authority with source-node links. The remaining 62 open-world claims should also bind to a source node or receive a typed `SOURCE_NODE_UNBOUND` status. Their taxonomy disposition is a separate question.

## Proposed modules and interfaces

A **module** is a part of the system that hides a body of behaviour behind an interface. An **interface** is the small set of operations available to callers. A **seam** is the boundary between two modules.

### 1. Immutable source module

Responsibility: preserve original raw bytes, admitted canonical bytes and the raw-to-canonical source map.

Interface:

```text
admit(rawCapture) -> AdmittedSource
slice(canonicalTextId, byteSpan) -> exact UTF-8 bytes
mapToRaw(canonicalTextId, byteSpan) -> one or more raw-source spans
```

Keep the current admission and exact-span machinery. It already validates byte ownership in `source-structure.js:148-166,285-299`.

### 2. Contract tree module

Responsibility: parse one authoritative written hierarchy and account for every source byte.

Interface:

```text
parse(admittedSource) -> ContractDocument
getNode(document, nodeId) -> SourceNode
walk(document, startNodeId, order) -> SourceNode iterator
```

`ContractDocument` contains the containment tree, exact source coverage ledger, parser version, typed parse issues and legacy identifier aliases. Callers do not run marker regular expressions themselves.

### 3. Source link module

Responsibility: add non-containment links without changing the tree.

Interface:

```text
link(document) -> SourceLinkGraph
resolveReference(graph, occurrenceId) -> target node ids or typed uncertainty
```

Link kinds include `CITES_NODE`, `USES_DEFINED_TERM`, `DEFINED_BY`, and `REFERS_TO_DISCLOSURE_SCHEDULE`. A link retains the source occurrence span. An unresolved or ambiguous citation stays typed and visible.

### 4. Context engine

Responsibility: compute the governing context for a source node from the tree and explicit scope edges.

Interface:

```text
compileContext(document, linkGraph, nodeId) -> ContextFrame
```

The engine hides ancestor traversal, syntactic scope, override rules, exception scope and provenance composition. It never creates a claim.

### 5. Semantic analysis coordinator

Responsibility: select the highest relevant source node, traverse its descendants, and invoke deterministic family logic or an approved later model route.

Interface:

```text
analyse({document, linkGraph, targets, familyPlan, recordedInputs}) -> CandidateSet
```

`recordedInputs` may contain immutable saved provider responses for deterministic replay. That replay is not a live Phase B call. No live inference adapter or Phase B route may be enabled until Phase B is expressly resumed. The structural module must work without either replay data or a model call.

### 6. Claim ledger and resolver

Responsibility: validate candidates, assign governed claim keys, bind one or more source nodes, preserve evidence and produce resolved, review and open-world states.

Interface:

```text
resolve(candidateSet, vocabulary, rulings) -> AnalysisSet
diff(oldAnalysisSet, newAnalysisSet) -> ResolutionSetDiff
```

The existing vocabulary and much of `candidate-resolution.js` remain useful. Family-specific source reconstruction moves into the contract tree and context engine.

### 7. Projection module

Responsibility: render views from resolved semantic facts.

Interface:

```text
render(analysisSet, projectionKey) -> RenderSet
```

A projection may format a value and retrieve an exact excerpt by node identifier. It must not infer a missing party, period, verb, exception or parent from raw source text.

### 8. Publication control

Responsibility: decide whether an already-rendered set may be served.

Interface:

```text
evaluate(renderSet, releaseAuthority) -> PublicationDecision
```

The migration keeps this decision inactive.

## Source node types and identifiers

Use these source-node kinds:

- `AGREEMENT`
- `ARTICLE`
- `SECTION`
- `SUBSECTION`
- `PARAGRAPH`
- `SENTENCE`
- `CHAPEAU`
- `LIMB`
- `SUB_LIMB`
- `PROVISO`
- `EXCEPTION`
- `TRAILING_QUALIFICATION`
- `HEADING`
- `SOURCE_ARTEFACT`

`SOURCE_ARTEFACT` accounts for a page number or extraction residue. It can never supply semantic context.

An outline marker is not a heading. Store an authored number or marker as a typed label on its node:

```text
label.kind = SECTION_NUMBER | OUTLINE_MARKER
label.text = exact source text
label.span = exact byte span
```

A heading is an authored text block, such as “Contracts” after `(h)`. It receives a `HEADING` node and an exact span. A model-generated phrase such as “Due authorization” is neither a heading nor an outline marker unless those exact words occur as such in the source.

Each node has:

```text
node_id
canonical_text_id
kind
parent_node_id
ordinal_under_parent
extent_span
owned_spans
label
parse_status
legacy_ids
```

`extent_span` is the full range represented when a node is collapsed. It may contain descendant ranges. `owned_spans` are the exact ranges not owned by a child. Across the tree, owned spans plus typed source artefacts account for every canonical byte. This separates navigation containment from exact byte ownership.

Derive the stable occurrence identifier from the canonical text identity, node kind, and exact start byte or authored-marker start byte. Put the end byte, exact-byte digest, parent, roles, authored label and parser version in a separate structure-revision identifier. A parentage, end-boundary or heading correction should not change an occurrence whose kind and start anchor remain the same. If kind or start changes, publish an explicit alias. Preserve current `section_id` values as `legacy_ids` where they still identify the same source occurrence. Publish the alias map before any consumer migration.

## Parent-child and cross-reference handling

Every source node has one containment parent, except the agreement root. Child order follows source byte order. Parent extent must contain child extent. Siblings may not overlap. No node may be its own ancestor.

Sentences are children of the paragraph, section or subsection that contains them, even when unnumbered. A sentence that introduces a list can contain a `CHAPEAU` and ordered `LIMB` children. A limb can contain its own sentence, chapeau, sub-limbs, proviso and trailing qualification.

Cross-references never change containment parentage. A source occurrence such as “Section 6.8(b)” creates a `CITES_NODE` edge. If two source nodes share the same printed reference, the link is `AMBIGUOUS` until document position and drafting context determine one target. `findSectionByReference` currently returns the first match (`deterministic-sectionizer.js:1074-1079`); the target must return all candidates or a typed ambiguity.

Defined terms work the same way. A defined-term occurrence links to the definition node. The definition is not copied into the occurrence or inherited as local operative text.

Party and action relationships belong in the semantic graph. For example, Parent causing Merger Sub and the Surviving Corporation to perform produces `CAUSES_TO_PERFORM` relationships. It does not produce a corporate-control relationship without separate source support. These relationships do not change the source tree.

## Inheritance rules

Inheritance is allowed only when written syntax proves that an ancestor governs the child.

Context that may pass down:

- grammatical subject and party;
- modal, such as `shall`, `may` or `will not`;
- polarity;
- governing verb and an incomplete object frame;
- temporal period and its anchor event;
- conditions and prerequisites;
- qualifications, provisos and exceptions within proven scope;
- list-level connective, such as `and` or `or`;
- a defined-term binding as a link, not copied definition text.

Precedence rules:

1. Explicit local text overrides an inherited value of the same kind.
2. The closest governing ancestor wins only if its scope edge reaches the child.
3. Content never flows from a sibling merely because it is adjacent. A sibling can govern another node only through an explicit, source-proved scope edge.
4. A chapeau flows only to its direct list descendants, unless a nested chapeau creates a narrower rule.
5. A proviso attached inside one limb stays in that limb unless the source expressly names a wider set.
6. A trailing qualification that names limbs applies only to those limbs.
7. “In each case” or equivalent language may apply to all listed items, but the grammar rule and exact words must be recorded.
8. Ambiguous scope produces `AMBIGUOUS`, not a broadcast.

Context that must never be inherited:

- heading text as though it were operative grammar;
- an outline marker as semantic content;
- a party name found merely nearby;
- source artefacts, page numbers or running headers;
- a sibling's subject, verb, date, exception or materiality standard;
- the full content of a cross-referenced provision without an explicit analysis step;
- a defined term's definition as though its words occurred locally;
- model-generated summaries or descriptive paths;
- a review or output label.

The 19 representation limbs with contradictory materiality codes are evidence against unrestricted broadcast. Decision 17 records that chapeau qualifiers currently broadcast to every limb (`docs/core/DECISIONS.md:1737-1742`). The context engine must represent scope before a qualifier reaches a claim.

## Provenance rules

**Provenance** means the record of where a value came from and how it was derived.

Each context value has this shape:

```text
ContextValue<T> {
  value: T
  status: DIRECT | INHERITED | OVERRIDDEN | AMBIGUOUS | ABSENT
  origin_node_id: source node that contains the words
  origin_span_id: exact semantic span
  target_node_id: node receiving the value
  inheritance_path: ordered ancestor node ids
  rule_id: deterministic rule and version
  confidence: VERIFIED | UNDETERMINED
}
```

If limb `(ii)` inherits “Parent shall” from a chapeau, the claim may contain the normalised values `Parent` and `shall`. Its evidence must still show that the subject and modal originate in the chapeau. The limb quote remains only the limb quote. A synthesised reading may join the fragments for a reviewer, but it must be labelled `ASSEMBLED_READING`, not presented as an exact quotation.

A claim can point to one or more source nodes. Evidence roles should include at least:

- `OPERATIVE_TEXT`
- `INHERITED_SUBJECT`
- `INHERITED_MODAL`
- `INHERITED_GOVERNING_VERB`
- `TEMPORAL_SCOPE`
- `QUALIFICATION`
- `EXCEPTION`
- `DEFINED_TERM_SOURCE`
- `CROSS_REFERENCE_SOURCE`

Do not combine disjoint evidence spans into a single minimum-to-maximum envelope. `structure-placement.js:68-79` currently does this for multiple edges. The envelope can include unrelated bytes and cross structural leaves. Keep each edge separate.

## Qualification and exception flow

A qualification is language that narrows or alters a statement. An exception removes stated cases from a rule. A proviso is a drafting form, often introduced by “provided that”, that may act as a condition, qualification or exception.

The source tree records each such block where it is written. A deterministic scope edge records what it modifies:

```text
modifier node --MODIFIES--> host node or named target nodes
modifier node --EXCEPTS--> right or obligation node
modifier node --CONDITIONS--> right or obligation node
```

The context engine follows these edges when it compiles a child frame. It does not copy the modifier text into each descendant. A claim that depends on the modifier adds a separate evidence edge. If punctuation and reference wording do not produce one target, return a typed `MODIFIER_SCOPE_AMBIGUOUS` issue and require review.

This handles both source order and legal scope. A trailing qualification can appear after all limbs in source order but target only limbs `(i)` and `(iii)`. It stays a child at its written position and uses graph edges for its semantic targets.

## Error and uncertainty handling

Do not fail an entire agreement because one outline is ambiguous. Produce the largest safe tree and quarantine the affected subtree.

Typed issues should include:

- `SECTION_BOUNDARY_AMBIGUOUS`
- `MARKER_KIND_AMBIGUOUS`
- `PARENTAGE_AMBIGUOUS`
- `SENTENCE_BOUNDARY_AMBIGUOUS`
- `HEADING_ROLE_AMBIGUOUS`
- `MODIFIER_SCOPE_AMBIGUOUS`
- `CROSS_REFERENCE_UNRESOLVED`
- `CROSS_REFERENCE_AMBIGUOUS`
- `SOURCE_NODE_UNBOUND`
- `INHERITANCE_AMBIGUOUS`
- `SOURCE_BYTE_GAP`
- `SOURCE_BYTE_OVERLAP`

Each issue identifies exact bytes, candidate parents or targets, parser version and severity. Semantic analysis may continue on unaffected nodes. It must fail closed for the affected inherited value. No missing child, evidence edge or rendered row may appear as an empty success.

Models must not decide byte boundaries, parentage, marker kind, evidence spans or inheritance provenance. If deterministic parsing cannot decide, the model may later propose a semantic interpretation against already-addressed source nodes. The result remains reviewable and cannot mutate the source tree.

## Semantic and output seams

### Source structure to semantic analysis

The input to a family is an `AnalysisEnvelope`:

```text
analysis_target_node_id
ordered source subtree
compiled context frame
relevant definition and cross-reference edges
typed parse and inheritance issues
exact source slices by node id
```

The family returns candidates that cite source-node identifiers and exact evidence spans. It cannot create a source path from a model string.

If Phase B resumes, it should receive this envelope. It should not receive a flat quote plus a request to recover missing hierarchy. Phase B stays deferred and model routes stay locked during the migration.

### Semantic analysis to output

The projection input contains resolved claims, semantic relationships and all provenance edges. A renderer may choose which details to show, but it cannot reconstruct a lost party or exception from the agreement. A projected omission must be deliberate and measurable through an approved output-owner rule.

This keeps output as a view. The row catalogue does not determine the source tree, node identities or claim identity.

## Worked target example

For Concho section 6.9(a)(i), the target records could be represented as:

```text
Source nodes
  S6.9       SECTION
  S6.9.a     SUBSECTION, parent S6.9
  SEN.a.1    SENTENCE, parent S6.9.a
  CHAP.a.1   CHAPEAU, parent SEN.a.1
  LIMB.a.i   LIMB, parent SEN.a.1
  PROV.a.i   PROVISO, parent LIMB.a.i

Context for LIMB.a.i
  obligor = Parent
    origin CHAP.a.1, status INHERITED
  modal = shall
    origin CHAP.a.1, status INHERITED
  governing verb = cause ... to be provided with
    origin CHAP.a.1, status INHERITED
  period = until December 31 of the calendar year in which Effective Time occurs
    origin CHAP.a.1, status INHERITED
  local item = total target cash compensation opportunity
    origin LIMB.a.i, status DIRECT
  floor exception = base compensation shall not be reduced below the pre-Closing level
    origin PROV.a.i, status DIRECT modifier of LIMB.a.i

Resolved semantic assertion
  subject nodes = [LIMB.a.i]
  source support nodes = [CHAP.a.1, LIMB.a.i, PROV.a.i]
  direct quote = exact LIMB.a.i bytes
  inherited evidence = separate CHAP.a.1 edges
  qualification evidence = separate PROV.a.i edge

Rendered row
  obligor: Parent
  benefit: total target cash compensation opportunity
  standard: no less favourable than similarly situated Parent employees
  period: until December 31 of the calendar year of the Effective Time
  floor: base compensation cannot fall below the pre-Closing level
```

The renderer does not parse the source. It formats fields already present in the semantic assertion.

## Migration risk

The main risks are:

1. **Identifier churn.** Current section identifiers include parent and span. A corrected parent or boundary can change them. Mitigation: immutable location-based target identifiers plus a legacy alias table.
2. **Double extraction.** Analysing both a parent and each child can produce duplicate claims. Mitigation: assign each family one highest relevant analysis host and track descendant coverage.
3. **Boundary overconfidence.** Sentence and modifier boundaries can be difficult around semicolons, page artefacts and nested parentheses. Mitigation: typed uncertainty and subtree quarantine.
4. **Parser disagreement.** The current line-start tree and permissive leaf parser can disagree. Mitigation: one parser produces the tree; alternative heuristics become evidence used by that parser, not a second structure.
5. **Consumer assumptions.** Existing evidence fields called `absolute_start` are sometimes section-local (`structure-placement.js:168-179`). Mitigation: explicit coordinate system in every span and adapters during migration.
6. **Resolution drift.** Better context may change a previously resolved claim. Some changes will be corrections, but none should be silent. Mitigation: mandatory resolution-set diff and adjudication before pin changes.
7. **Projection dependency.** Some rows may depend on current flattening or duplicate collapse. Mitigation: run old and new projections side by side from the same claim set first.
8. **Semantic path loss.** `limb-components.js` has useful qualifier scope and multiple-assertion logic. Mitigation: keep its semantic assertion-node idea, then bind path nodes to source node ids rather than discard the module wholesale.

## Test strategy

Use three levels of checks. Run each level once per meaningful artefact revision. Do not repeat full gates after an unchanged result.

### Level 1: deterministic structure invariants

- Every exact node span round-trips to admitted canonical bytes.
- Every node except the agreement has one present parent.
- Parent extent contains child extent.
- Siblings are ordered and non-overlapping.
- Owned spans plus typed source artefacts cover 100% of canonical bytes.
- Repeating a parse over identical bytes produces identical node ids and issues.
- Correcting parentage does not change a node id when its kind and exact span stay unchanged.
- Heading text and outline-marker tokens never share a type.
- Cross-reference tokens do not open list nodes.
- Unnumbered independent sentences receive distinct node ids.

### Level 2: real source-to-context goldens

- Concho 6.9(a): four inline limb nodes; period, Parent, modal and governing verb inherit to each; each inherited value cites the chapeau; each local proviso stays local.
- Concho 6.11: two sentence nodes with separate party, verb and proviso scope.
- Concho 6.16: three sentence nodes with three distinct timing rules.
- TopBuild 6.2: one mutual termination chapeau, four limbs, and two causation provisos with narrow scope.
- Red Hat 3.01(h): `(i)` is a child of `(h)`, not a top-level sibling.
- Red Hat 3.02(b)(i): three unnumbered sentence nodes; the model's three descriptive labels remain semantic labels only.
- All 69 Red Hat inputs bind to an exact source node or a typed unbound status. The existing 1, 62 and 6 disposition totals remain separately reported.

### Level 3: claim and output diffs

- Replay existing recorded inputs. Make zero model calls.
- Compare old and new resolved, review and open-world sets by claim identity and semantic value.
- Stop on any unexpected change in a previously resolved claim's value or state.
- Stop if open-world increases in any family.
- Verify that every inherited field round-trips through staging with the same origin node and exact span.
- Compare source to claim to rendered row for each prototype provision. A passing projection test is not enough.
- Keep publication inactive.

The focused unit set used in this review remains a good local gate. The full suite is justified only when a migration stage changes shared integration code or is ready to merge.

## Smallest useful prototype

Build one read-only shadow artefact over these real sections:

1. Concho 6.9, inline list, chapeau duration and failed claim composition.
2. Concho 6.11, separate unnumbered sentences and a proviso.
3. TopBuild 6.2, chapeau, mutual party inheritance, limbs and exceptions.
4. Red Hat 3.01(h) and 3.02(b)(i), deep parentage and descriptive-path separation.

The prototype should emit:

- source nodes and legacy aliases;
- byte-coverage and tree-invariant results;
- cross-reference edges;
- context frames for every target limb or sentence;
- source-node bindings for the existing recorded candidates;
- a resolution-set diff against the current committed runs;
- a source-to-rendered-row comparison for Concho 6.9 and TopBuild 6.2.

It succeeds only if:

- canonical source bytes and source maps do not change;
- all selected source blocks have stable nodes;
- every inherited value has exact origin provenance;
- Concho's period reaches the compensation assertions;
- TopBuild's party and proviso remain available after persistence;
- Red Hat `(h)/(i)` parentage is correct;
- all 69 Red Hat inputs are accounted for without treating the three descriptive labels as source headings;
- no previously resolved claim changes value or state without an explicit expected-diff entry;
- open-world does not increase in any family.

A Terra-level agent can implement and run the deterministic parser, artefact and diff work from these binary criteria. Escalate to a high-reasoning agent when two plausible written parentages remain after deterministic evidence. Escalate to Ben when the dispute is legal scope, such as whether a trailing qualification applies to every limb or only named limbs.

## Safe migration sequence

1. Freeze the current source hashes, resolved set and four extraction-state measurements. Do not add the states together.
2. Build the prototype as a new shadow artefact. Do not change current pins, runtime readers or publication.
3. Add the authoritative source tree beside the current sectionizer result. Produce legacy-id aliases. Keep all existing consumers on the old path.
4. Add source links and context frames. Compare them to current `structure_context`, `party_source_span` and family-specific inheritance. Do not change claims.
5. Extend staging shadow records so source-node links and inherited provenance round-trip. Keep production writes unchanged.
6. Feed recorded candidates through a resolver adapter that reads context frames. Produce the mandatory resolution-set diff.
7. Migrate one family at a time in shadow mode. Start with employee matters and termination because the real traces expose success or failure clearly.
8. Feed old and new analysis sets to projections side by side. The projection may format, but it may not parse source.
9. Require Ben's legal rulings for ambiguous modifier scope. Record each ruling as data, not a one-off regular expression.
10. Do not change a pin during Stage 2Y. Any later pin selection requires separate post-certification authority, after all stop conditions clear and expected differences are adjudicated. Publication remains inactive and Phase B remains deferred.

Each Stage 2Y stage is additive and shadow-only. Rollback means selecting the prior artefact or adapter. No stage deletes old results.

## What this design hides from callers

The contract tree module hides:

- UTF-8 and UTF-16 offset conversion;
- HTML-to-canonical source mapping;
- article and section boundary detection;
- marker-style ambiguity and nested-list recovery;
- sentence segmentation around abbreviations, definitions and page artefacts;
- heading versus outline-marker classification;
- exact byte ownership and collapsed extents;
- stable identifier derivation and legacy aliases;
- citation and defined-term resolution;
- ancestor traversal;
- proviso, exception and qualification scope;
- provenance composition;
- typed uncertainty propagation.

A family caller asks for a source subtree and context frame. A projection caller asks for resolved semantic facts. Neither caller needs to reconstruct the agreement.

## Module disposition

| Current module or responsibility | Decision | Reason |
|---|---|---|
| SEC intake, admitted canonical source and source maps | Keep | Exact bytes and provenance are sound foundations. |
| `deterministic-sectionizer.js` | Change and deepen | Keep article, section, byte and id work. Extend and unify it into the authoritative contract tree. |
| `subclauses.js` | Replace as an independent structure | Reuse tested heuristics inside the contract-tree parser. Do not keep a second leaf hierarchy. |
| `governing-structure.js` | Replace with the context engine | Keep fail-closed reasons and test cases. Move structure before resolution and give every record stable node provenance. |
| `candidate-governing-context.js` | Change | Accept source nodes and multiple evidence edges. Do not require exactly one operative edge. |
| `structure-placement.js` | Retire after migration | Post-resolution annotation is the wrong seam. Its diff output is useful during migration. |
| `source-structure.js` exact span, excerpt and provision primitives | Keep and extend | Exact byte validation is correct. Add source-node anchors and multi-node support. |
| `limb-components.js` | Change, do not discard | Keep semantic assertion and qualifier-scope concepts. Bind paths to source nodes and separate model labels from authored structure. |
| `candidate-resolution.js` | Change incrementally | Keep governed mappings, gates and resolved claim identities where possible. Remove family-specific structural reconstruction after the context engine proves parity. |
| staging write/read seam | Change | Persist source-node bindings and inherited provenance. Current allowlisted gaps include material context. |
| family routing and rendered-row projections | Keep behind a stricter input contract | They should format semantic facts, not recover missing source structure. |
| publication control | Keep inactive | No architecture migration authorises serving. |

## Final assessment

The hierarchy-first hypothesis is substantially correct. The present architecture should be restructured, not repaired only at individual family call sites and not fully replaced. The source bytes, section recovery, evidence primitives, claim vocabulary and much of resolution can be preserved. The decisive change is to create one complete, deterministic, collapsible source tree before semantic analysis, add cross-reference and semantic graphs beside it, and make inherited context a provenance-bearing input to claims. This moves structural responsibility out of family resolvers and rendered-row modules. It also provides the same nodes for analysis, citation and contract navigation.
