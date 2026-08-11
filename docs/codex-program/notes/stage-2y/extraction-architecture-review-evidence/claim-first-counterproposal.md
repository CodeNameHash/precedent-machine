# Claim-first counterproposal: source tree plus semantic claim graph

Date: 2026-08-10

Status: independent architecture proposal, report evidence only

Code base: `853b9e83b1bf067eabb5b2c86a10918e47a7d7e6`

## Purpose and decision

This paper gives the strongest reasonable challenge to a hierarchy-first analysis design.

A **source tree** is an ordered set of source blocks in which each block has one structural parent. An article can contain sections. A section can contain sentences and list items. A **semantic graph** is a set of legal facts and typed links. One fact can link to several source blocks, definitions, exceptions and other facts. A **claim** is one governed legal answer, such as an outside date or a prohibited action. A **projection** is a view of claims, such as a review table. **Provenance** is the recorded path back to the exact source bytes and the rule that produced a derived fact.

The counterproposal is not a source-free claim store. That would lose navigation, source order and attachment clues. The counterproposal keeps a complete source tree, but makes a semantic claim graph the primary analysis representation. The tree answers where text is written. The graph answers what the text means and how several provisions interact.

The decisive claim-first challenge is to Ben's hypothesis item 8. Source parsing should run from the agreement down. Semantic analysis should not always start at the highest relevant source node and move only downwards. It should start from an expected claim slot and its anchored proposition, then close every required dependency in any direction. A definition may sit in an annex. An exception may sit after several limbs. A termination right may depend on a covenant breach in another article. These are graph relationships, not descendants of one tree node. The programme's binding architecture already requires explicit definition, exception, override, bring-down, trigger and cross-reference relationships, and says later consumers must not reconstruct them from nearby text or rows. [E8]

The recommendation within this proposal is therefore:

> Keep one faithful source tree for reading and navigation. Put legal scope, inheritance, cross-references and claim dependencies in a typed semantic graph. Resolve claims over that graph. Treat rendered rows as queries over resolved graph data. Do not make a strict tree the semantic analysis model.

This is a restructuring, not a full replacement. The immutable byte source, evidence-span rules, governed claim identities and publication controls are useful foundations. The current late structural annotations and family-specific resolver joins should move behind a graph-building and graph-resolution seam.

## What the present system proves

The current system preserves the admitted UTF-8 text and can mint exact semantic spans. The immutable source builder hashes the exact bytes, records converter and source-map digests, and validates a reconstructed source byte-for-byte. Its semantic span records exact half-open byte offsets and a digest of the selected bytes. [E1]

The deterministic sectionizer produces exact, nested spans for `ROOT`, `ARTICLE`, `SECTION` and marker-derived `SUBSECTION` nodes. Its identifiers include the parent identifier, depth, byte interval and text digest. Tests prove exact byte round trips, parent containment and deterministic repeat output. [E2] [E3]

That representation is not a complete agreement structure. The sectionizer does not create nodes for bare sentences, chapeaux, headings as independent blocks, markers as independent tokens, provisos or trailing qualifications. Markerless text is deliberately represented as one section-only leaf. The governing-context test confirms that a markerless section has no item and no sibling children. [E2] [E4]

Structure is also late. The placement pass says it annotates assertions that already exist, does not mint claim identity, does not rewrite claims and does not gate model input. It derives one encompassing evidence interval when an entry has several evidence edges. The candidate context service refuses any candidate that does not have exactly one evidence edge with role `OPERATIVE_TEXT`. [E4] [E5]

The limb tree is a second structural representation. It is minted from compiled, model-shaped `limb_path` values rather than directly from source blocks. Missing ancestors are created mechanically and path nodes have no source span. Qualifier flow can traverse descendants, but only after the system finds a target path node or assertion node. [E6] The 69-case Red Hat disposition found 66 marker paths and three descriptive paths. Only six of 68 open-world limb candidates also produced assertion nodes. This means a model path currently mixes source-outline identity with semantic descriptions. [E11]

Claim resolution contains family logic and structural repair logic in the same large module. Provision grouping defaults to section, concept and party, and a provision can span the whole governing section. Candidate governing context and limb trees are then joined during resolution. The final structure annotation is applied only near the return boundary. [E7] The earlier structural diagnosis found six of nine reviewed examples where necessary context lived outside the isolated quote, and found several family gates that did not consult structure already calculated elsewhere. It also documented deal-specific termination chapeau grammars and materially different outcomes for equivalent legal forms. [E10]

The current claim schema can carry several evidence edges and distinguishes operative text, definitions, exceptions, cross-references and derivation inputs. That is a sound primitive. [E12] The governed relationship vocabulary is too small for the target analysis, however. It contains only `BRINGS_DOWN`, `CONTAINED_IN`, `EXCEPTED_BY`, `TRIGGERED_BY` and `USES_DEFINITION`. It does not contain general governance, application, qualification or source-support relationships. [E13]

Rendering is a separate, explicit route. A claim must map through a family projection and then match exactly one review row under the declared route. The preview fails closed when the family has no route, a card is absent or non-unique, no row is produced, or the row lineage is ambiguous. [E14] This determinism is valuable. It does not show that a row retained all claim information. Some bridge projections explicitly remove `structure_context` before producing bridge-facing output. [E15]

Publication remains separate from validation. A missing publication filter preserves historical input, while an active serving filter validates a sidecar. `REQUIRE_PUBLISHED` always returns false until a future receipt validator exists. [E16] The graph proposal keeps that control unchanged.

## Design 1: modules and interfaces

A **module** is a body of implementation hidden behind a small interface. A **seam** is the boundary at which one module passes governed data to another. This proposal uses four main modules.

| Module | Main interface | Result | Complexity hidden from the caller |
|---|---|---|---|
| `SourceIndex` | `index(admittedSource, parserVersion) -> SourceGraphRevision` | Exact source nodes, containment edges, order edges, marker and heading records, and cross-reference occurrences | Byte mapping, marker disambiguation, sentence boundaries, parent selection, stable identifiers and source round-trip checks |
| `ClaimGraphBuilder` | `build(sourceRevision, contractBundle, proposals?) -> CandidateClaimGraph` | Expected claim slots, source-backed proposition occurrences, candidate legal relationships and typed uncertainty | Candidate normalisation, evidence verification, dependency discovery, definition lookup, scope-path construction and optional model-proposal handling |
| `ClaimGraphResolver` | `resolve(candidateGraph, governedRules, humanRulings) -> ResolvedClaimGraph` | Claims and relationships in resolved, review, open-world or failed states | Dependency ordering, fixed-point scope, exception precedence, conflict detection, deterministic normalisation and residual retention |
| `ProjectionEngine` | `project(resolvedGraph, viewDefinition) -> ProjectionResult` | Rows or navigation views with complete claim, relationship and source lineage | Family routing, grouping, row matching, display labels and duplicate checks |

`SourceIndex` exposes narrow read methods in addition to `index`: `node(id)`, `slice(id)` and `navigate(id, direction)`. `ClaimGraphResolver` exposes `explain(claimRevisionId)`, which returns the complete dependency and provenance path used for one answer. These methods make the modules deep. A caller does not need to know how a chapeau was found or how an exception overrode a parent rule.

The current code already has reusable pieces for these modules. Exact source construction and semantic spans fit inside `SourceIndex`. Claim and relationship validators fit inside the graph modules. Existing family projectors and the rendered-row preview fit behind `ProjectionEngine`. [E1] [E12] [E14]

## Design 2: seam between source structure and semantic analysis

The source-to-semantic seam carries only source facts. It must not carry review-row labels or family projection shapes.

The payload is:

```text
SourceGraphRevision
  canonical_text_id
  document_hash
  parser_version
  nodes[]
  structural_edges[]
  reference_occurrences[]
  unresolved_boundaries[]
```

Each semantic object refers to one or more source nodes through evidence edges. It may also select a smaller exact span inside a node. The semantic layer may not rewrite the source node, change its parent, or claim that derived words occur inside a child block.

This seam fixes two current defects. First, source structure exists before candidate extraction rather than as an annotation added after claim resolution. Second, a semantic occurrence can use several exact source spans without losing governing context merely because the candidate-context service requires one operative edge. The current evidence schema already permits several ordered evidence edges, so this is a responsibility change rather than a new evidence principle. [E5] [E12]

## Design 3: seam between semantic analysis and rendered output

The semantic-to-output seam is a projection query. A query receives resolved claims and typed relationships. It must not parse source prose to recover an actor, governing verb, exception, date anchor or cross-reference.

Every projected row returns:

```text
row value
claim revision identifiers
relationship revision identifiers used by the row
source node identifiers and exact evidence identifiers
projection rule identifier and version
unrendered governed fields, if the view deliberately omits them
```

A separate inactive `PublicationControl.evaluate(projection, authority)` boundary may consume the completed projection. It is not part of `ProjectionEngine`.

The `unrendered governed fields` list is important. It converts silent content loss into a measured choice. For example, a compact market table may omit exact causation wording, but its result must say that the field exists in the claim graph and is not displayed. A detailed legal review can request that field without re-extracting the contract.

The present exact claim-to-row matching and fail-closed errors should remain. [E14] The row is still the unit that a lawyer judges under Decision 17, but the row does not define the source structure or semantic facts. Decision 17 itself records that the representations-to-rendered-row join did not yet exist when the review contract was set. [E17]

## Design 4: node types and stable identifiers

A **stable identifier** is an identifier that does not change when an unrelated relationship or display label changes. It is not an identifier that survives a change to the underlying source bytes.

### Source nodes

The source tree contains these node types:

- `AGREEMENT_BLOCK`
- `ARTICLE_BLOCK`
- `SECTION_BLOCK`
- `NUMBERED_SUBSECTION_BLOCK`
- `UNNUMBERED_SENTENCE_BLOCK`
- `CHAPEAU_BLOCK`
- `LIST_ITEM_BLOCK`
- `SUB_LIST_ITEM_BLOCK`
- `TRAILING_QUALIFICATION_BLOCK`
- `PROVISO_BLOCK`
- `HEADING_BLOCK`
- `MARKER_TOKEN`
- `REFERENCE_TOKEN`
- `SEPARATOR_BLOCK`, for page furniture or a verified non-operative separator

Every visible source block has an exact byte interval. Parents can contain the intervals of their children. Leaf blocks form an ordered coverage of the operative source, subject to explicit separator blocks. Headings and marker tokens are not silently folded into semantic text.

A source-node occurrence identifier is derived from:

```text
canonical_text_id
node_type
absolute_start or authored_marker_start
```

The source-node revision records the end byte, exact-byte digest, parent, roles, heading classification, parser version and current edge set. A correction to parentage, end boundary or heading classification therefore does not change an occurrence whose kind and start anchor remain the same. If kind or start changes, an explicit alias links the occurrences. The current section identifier includes parent identifier and depth, so a parentage correction can change descendant identifiers even when their own bytes do not change. [E3]

### Semantic nodes

The graph uses semantic occurrence types rather than forcing every legal fact into a structural node:

- `CLAIM_OCCURRENCE`
- `PROPOSITION_OCCURRENCE`
- `PARTY_OCCURRENCE`
- `DEFINED_TERM_OCCURRENCE`
- `EVENT_OCCURRENCE`
- `CONDITION_OCCURRENCE`
- `QUALIFIER_OCCURRENCE`
- `EXCEPTION_OCCURRENCE`
- `TEMPORAL_OCCURRENCE`
- `RESULT_OCCURRENCE`

Existing claim occurrence identifiers should remain during migration. New graph occurrence identifiers should derive from the stable subject anchor, governed definition and occurrence ordinal. A revision identifier then includes state, value, evidence and relationship closure. When a subject must change, an explicit alias ledger maps old and new identities. No migration stage silently reuses an old identifier for a different source subject.

## Design 5: parent-child and cross-reference handling

The source tree uses `CONTAINS`, `NEXT_SIBLING`, `LABELS` and `HAS_HEADING` edges. Each source node has one structural parent, apart from the agreement root. This supports collapse and expansion without a separate navigation model.

The semantic graph uses typed edges such as:

- `SUPPORTED_BY`
- `HAS_ACTOR`
- `HAS_MODAL_OR_VERB`
- `HAS_OBJECT`
- `GOVERNS`
- `QUALIFIES`
- `EXCEPTS`
- `APPLIES_TO`
- `USES_DEFINITION`
- `REFERS_TO`
- `TRIGGERED_BY`
- `BRINGS_DOWN`
- `CONTROLS`
- `ACTS_THROUGH`
- `MIRRORS`
- `DERIVED_FROM`

A cross-reference has two parts. A `REFERENCE_TOKEN` source node preserves the written words, such as “Section 7.01 or Section 7.03”. A semantic `REFERS_TO` edge links it to each resolved target node. The edge also records the legal use, such as incorporating a condition or only naming a location. If one target is missing or ambiguous, the reference remains present but unresolved. The resolver must not copy all target-section semantics into the referring claim.

A strict tree is therefore sufficient for document navigation but insufficient for legal analysis. A definition can govern many distant clauses. One proviso can qualify several limbs. One sentence can support several claims. One claim can require several non-contiguous spans. These are valid many-to-many links. The target programme already represents no-shop restrictions with explicit `GOVERNS`, `APPLIES_TO`, `EXCEPTED_BY` and `USES_DEFINITION` relationships, rather than containment or proximity. [E8]

## Design 6: inheritance rules

**Inheritance** means that a child proposition receives context written in another source block. This proposal does not copy inherited values into a child as if they were child text. It derives typed edges.

Context can flow from a governing node only when a versioned rule proves the scope:

- grammatical subject or legal actor;
- modal and governing verb, such as “Parent shall”;
- direct object or restricted-action class;
- negation;
- temporal scope;
- condition or trigger;
- qualification or exception;
- defined-term use;
- declared cross-reference effect;
- party role and capacity;
- proviso or trailing qualification.

Each flow record contains:

```text
derived_field
value
source_node_id
source_span_id
destination_semantic_node_id
relationship_path[]
rule_id and rule_version
status: PROVED | AMBIGUOUS | CONFLICTED
```

For example, if limb `(ii)` inherits “Parent shall” from a chapeau, the child claim has `HAS_ACTOR Parent` and `HAS_MODAL_OR_VERB shall`. Both edges point to the chapeau's exact span and record the governing-path rule. The limb's own evidence does not claim that those words occur inside limb `(ii)`.

The following values must never flow by proximity alone:

- a fact that applies only to a sibling;
- a heading or outline marker treated as operative language;
- the full content of a cross-referenced section;
- a definition's party treated as the actor at each use;
- a parent's subject, verb, negation or exception where the child supplies conflicting grammar;
- a review-row label, family name, taxonomy code or display default;
- any unresolved or ambiguous context;
- an actor from one sentence into a separate reciprocal sentence.

This is stricter than the current annotation model. The current governing-context result returns copied text records for the leaf, chain, siblings and trailing text, but not typed subject or verb edges. The current limb path flow has useful fail-closed ambiguity rules, yet its structural path may have no byte span and can originate in model output. [E4] [E6] [E11]

## Design 7: provenance rules

Every source assertion is verified against exact bytes before it enters the graph. Every derived assertion records all source and rule inputs. The minimum rules are:

1. A claim can have one or more `SUPPORTED_BY` evidence edges.
2. Each evidence edge names a source node, exact span, evidence role and document ordinal.
3. An inherited field points to the block that contains its words and to the child semantic object that receives their effect.
4. A relationship revision has its own evidence. It does not borrow a claim's evidence by convention.
5. A derived value records the complete dependency path and rule version.
6. A projection records every claim and relationship it used.
7. No object can state `PRESENT` if a required evidence or scope dependency is unresolved.

The existing claim schema supports ordered evidence roles and validates exact source order. [E12] The missing part is the typed relationship path between structural context and the fact that uses it.

## Design 8: error and uncertainty handling

An **open-world item** is source-backed content for which the governed vocabulary has no approved answer slot. It is not an error count to add to resolved or review counts. A **review item** is an attempted answer that failed a deterministic gate and needs a ruling or implementation correction.

The graph records typed uncertainty at the smallest affected object:

- `UNRESOLVED_BOUNDARY`
- `AMBIGUOUS_GOVERNANCE`
- `CROSS_REFERENCE_UNRESOLVED`
- `SEMANTIC_CONFLICT`
- `REQUIRED_DEPENDENCY_MISSING`
- `MODEL_PROPOSAL_UNCORROBORATED`
- `OUTPUT_OWNER_MISSING`

An unresolved required dependency blocks the dependent claim. It does not invalidate unrelated graph regions. Two exclusive interpretations remain separate candidate subgraphs. The resolver does not choose the more convenient one. A human ruling can select one alternative, and the ruling identifier becomes part of the resolution provenance.

Model output, if Phase B resumes later, is only a proposal. It can suggest proposition boundaries, candidate semantic types and candidate edges within a supplied source neighbourhood. Deterministic code remains responsible for source bytes, structure, identifiers, exact evidence verification, governed relationship materialisation, resolution gates, row lineage and publication. The model must receive the source node, ancestors, relevant siblings, linked definitions and cross-reference targets. It must not receive a flattened row and be asked to reconstruct lost structure. The programme already requires the worker to see only a registered semantic envelope and requires deterministic scope reconciliation before claims materialise. [E8]

The Phase B input should therefore be a versioned `SemanticEnvelope` with the focus source-node identifier, exact focus bytes, ordered ancestor identifiers and bytes, relevant sibling identifiers and bytes, typed chapeau and qualification links, resolved definition links, cross-reference occurrences and targets, and any unresolved boundary or scope alternatives. The response may cite only identifiers and spans supplied in that envelope. A model suggestion cannot create or change source structure.

No Phase B route is required to build or test this proposal. Recorded candidates and current resolutions are enough for a shadow prototype.

## Design 9: worked example, Metsera Section 7.04

### Source

Metsera Section 7.04 is 539 bytes and is headed “Frustration of Closing Conditions”. [E18] It contains two independent, unnumbered sentences:

1. Neither Parent nor Merger Sub may rely on failure of a condition in Sections 7.01 or 7.02 if Parent's or Merger Sub's material breach primarily caused the failure.
2. The Company may not rely on failure of a condition in Sections 7.01 or 7.03 if its material breach primarily caused the failure. [E19]

The current sectionizer produces one `SECTION` node for 7.04 and no children. Its complete node-kind set for that agreement is `ROOT`, `ARTICLE`, `SECTION` and `SUBSECTION`. This was confirmed with the read-only command in the reproducibility note below. The markerless governing context is one leaf containing the heading, both sentences and page footer. [E19]

### Current semantic result

The resolved claim uses the second sentence as operative evidence, but its subject is a provision that spans the full section. Its party value is the reciprocal label `Either Principal Party`. The claim records one explicit cross-reference, Section 7.01, even though its evidence quote says Section 7.01 or Section 7.03. The same resolution file labels the first sentence as a “parent chapeau” and the second as a “child clause”, although the source has two reciprocal standalone sentences. [E19]

The rendered row is:

```text
Mutual conditions Condition Frustration / Prevention See provision
Party: Either Principal Party Material breach
```

It omits the two branch-specific actors, the two different condition sets, “may not rely”, “primarily caused”, and the relationship between causation and material breach. Ben's review independently identified the missing party, conditions, “primarily caused” and “material breach” detail. [E20] The row reaches output, so mechanical row emission does not prove legal information retention.

### Proposed source tree

```text
SECTION 7.04  Frustration of Closing Conditions
  HEADING_BLOCK
  UNNUMBERED_SENTENCE_BLOCK A  Parent and Merger Sub branch
    REFERENCE_TOKEN -> 7.01
    REFERENCE_TOKEN -> 7.02
  UNNUMBERED_SENTENCE_BLOCK B  Company branch
    REFERENCE_TOKEN -> 7.01
    REFERENCE_TOKEN -> 7.03
  SEPARATOR_BLOCK  page footer
```

### Proposed semantic graph

```text
Claim A FRUSTRATION_PREVENTION
  HAS_ACTOR -> Parent
  HAS_ACTOR -> Merger Sub
  HAS_MODAL_OR_VERB -> may not rely
  APPLIES_TO -> conditions in 7.01
  APPLIES_TO -> conditions in 7.02
  QUALIFIES -> primarily caused by material breach of Parent or Merger Sub
  SUPPORTED_BY -> sentence A

Claim B FRUSTRATION_PREVENTION
  HAS_ACTOR -> Company
  HAS_MODAL_OR_VERB -> may not rely
  APPLIES_TO -> conditions in 7.01
  APPLIES_TO -> conditions in 7.03
  QUALIFIES -> primarily caused by material breach of Company
  SUPPORTED_BY -> sentence B

Reciprocal result
  DERIVED_FROM -> Claim A
  DERIVED_FROM -> Claim B
```

The reciprocal result may drive one compact row, but the row retains two named branches and their exact lineage. It may not replace them with a single mutual label unless the projection declares the omitted fields.

### Reproducibility note

The following read-only command was run at the reviewed commit:

```bash
node - <<'NODE'
const fs = require('fs');
const { sectionizeAdmittedSource } = require('./lib/canonical-v2/native-producer/deterministic-sectionizer');
const path = 'evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final/adapter-result.json';
const source = JSON.parse(fs.readFileSync(path, 'utf8')).admitted_source_contexts[0];
const tree = sectionizeAdmittedSource({
  source_text: source.canonical_text.text,
  document_hash: source.document_hash,
});
const section = tree.nodes.find((node) => node.reference === '7.04');
console.log({
  section,
  node_kinds: [...new Set(tree.nodes.map((node) => node.kind))],
  children: tree.nodes.filter((node) => node.parent_section_id === section.section_id),
});
NODE
```

Observed section identifier: `d39762ec2022dcd18e2b2cb6ef4e504b91c17e2c028e96eafb0b0130f677b249`. Observed child list: empty.

## Design 10: migration risk

Migration risk is higher than for a narrow hierarchy-first repair. The current provision identifier can include a whole-section span and party. Claim revisions include attributes and evidence. Moving the semantic subject from a whole section to one sentence or proposition can therefore change identities and replay results. [E1] [E7]

The safe response is side-by-side migration, not a one-step cutover:

1. Add a shadow source-node registry. Keep all current claims, pins, projections and publication states unchanged.
2. Add stable aliases from current section and subsection identifiers to shadow source-node identifiers.
3. Build a shadow semantic graph from recorded evidence only. Do not call a model.
4. Compare old and shadow source-to-claim lineage. Do not change resolution state or value.
5. Run one family through a shadow graph resolver. Produce a complete resolution-set diff. Stage 2Y does not change a pin or current selector.
6. Stop if a previously resolved claim changes state or value unexpectedly.
7. Stop if open-world count rises in any family.
8. Keep publication at `NONE`. Do not activate serving.
9. Make each stage an additive commit that can be reverted without data migration. Any later pin selection, current-selector change or live retirement requires separate post-certification authority.

The immutable source and existing claim evidence make this incremental path possible. [E1] [E12] A full replacement is not justified unless the prototype shows that existing claim identifiers cannot be aliased or that graph construction cannot preserve current resolved claims.

## Design 11: test strategy and measurements

Passing unit tests do not prove information preservation. The primary tests compare source facts with graph facts and then with rendered facts.

### Source tests

- Exact byte round trip for every source node.
- Every operative byte belongs to one leaf block or a declared separator block.
- Every non-root node has one parent and is contained by it.
- Bare independent sentences become separate children.
- A chapeau and its limbs are separate nodes with explicit governance edges.
- Sub-limbs preserve marker depth.
- Descriptive headings never become marker identities.
- Provisos and trailing qualifications have exact spans.
- Correcting a parent or heading classification does not change a child identifier when its node type and exact span do not change.

The current tests are reusable for exact bytes, parent containment and deterministic repeat output, but they need new completeness assertions at sentence and qualification level. [E2]

### Graph tests

- A subject and governing verb inherited by a limb cite the chapeau span, not the limb span.
- A sibling's actor, exception or date does not leak.
- A child with conflicting grammar overrides inherited context and records the conflict resolution.
- One claim can use several evidence nodes.
- One source node can support several atomic claims.
- A cross-reference with two targets produces two links.
- A definition link does not imply that definition text is present in the use node.
- An ambiguous exception blocks only dependent claims.
- Qualifier and exception precedence is deterministic and versioned.
- Reordering model proposals does not change graph or claim output.

### End-to-end fixtures

The minimum corpus set is:

- Metsera 7.04 for two unnumbered reciprocal sentences and several cross-references.
- QXO 3.1(b), including 3.1(b)(ii), for chapeau, limbs, sub-limbs and shared evidence.
- One real termination provision with a governing grant chapeau and cross-provision breach limitation.
- Red Hat Sections 3.01 and 3.02 for the 69 limb dispositions and the distinction between 66 marker paths and three descriptive paths. [E11]

For each fixture, freeze a source-to-node-to-edge-to-claim-to-row ledger. A test fails if any source fact disappears without an explicit output-omission record.

### Programme measurements

The acceptance dashboard must report:

- percentage of operative source leaf blocks with stable nodes;
- percentage of inherited fields with a source span, relationship path and rule version;
- percentage of resolved claims with complete required dependency closure;
- percentage of projected rows with complete claim and relationship lineage;
- count of source fields deliberately omitted by each projection;
- exact resolution-set state and value diff against the old path;
- open-world change by family;
- unresolved boundary, governance and cross-reference counts;
- distinct row-output signatures and duplicate excess;
- human row acceptance, only after a lawyer has judged the rows.

## Current measurement reconciliation

The current figures describe different stages. They are not four parts of one recovery total.

| Figure | What it measures | What it does not measure |
|---|---|---|
| 2,201 attempted | `resolved + review`, where review counts only rows with `has_resolution === false` | It is not `resolved + review + open-world` |
| 1,526 resolved | Current resolved claim entries across 130 pinned runs | It does not prove a correct row or human acceptance |
| 1,701 open-world | Separate source-backed items outside approved mapping | It is not added to attempted or resolved |
| 675 review | Attempted candidates without a resolution | It is not every row in `review_queue`, because resolved audit rows can remain there |
| 1,241 mechanically reach a row with content | Resolved claims for which the current route, card and exact row match all succeeded and the matched row had non-placeholder text | It does not test whether all source detail survived |
| 109 feature-lineage failures | 100 MAE, seven antitrust and two employee claims raised `CLAIM_FEATURE_ROW_NOT_UNIQUE` because the matching-row count was not exactly one | It is not a semantic rejection. The saved aggregate does not retain claim identifiers, feature keys or observed match cardinality. PLAN diagnoses grouped feature claims, but the aggregate cannot prove grouping as the cause of every failure. |
| One routed claim produces no row | One termination claim passed route and card projection but `selectRows` emitted no row | It is not an absent family owner |
| 175 are in families absent from the approved route registry | 76 key defined terms, 70 representations, 17 tax, five appraisal, five financing, one dividends and one guaranty claim | They are resolved claims, not failed extraction |

These values come from the measurement code and report, not from PLAN. The script defines the extraction counters at lines 71 to 77 and evaluates every resolved entry through the route and row-preview path at lines 396 to 448. The report records zero model calls, no product writes, publication authorisation `NONE` and serving disabled. [E21]

The cautious 1,097 figure is calculated as 1,241 claim-level mechanical successes minus 144 claim-level deductions covered by four known-loss rules. The four rules identify 25 D&O claims, 75 no-shop claims, 36 no-other-representations/fraud claims and 108 MAE claims. One hundred MAE claims already fail the mechanical row path, so 244 identified claims produce only 144 further deductions. `1,097 / 1,526 = 71.9%`. The evidence labels this set `KNOWN_LOSS_ADJUSTED_NOT_HUMAN_ACCEPTED` and records human acceptance as not measured. [E22]

The measurement supports the graph proposal in two ways. First, row emission is a transport fact, not an information-preservation fact. Metsera 7.04 emits a row while losing negotiated detail. [E19] [E20] Second, missing output owners and non-unique feature-to-row lineage should remain projection errors. They should not change the source tree or claim graph.

## Design 12: complexity hidden from callers

Callers should not manage:

- UTF-8 and character-offset conversion;
- marker parsing and sentence segmentation;
- stable source identifiers;
- graph dependency ordering;
- inherited-field provenance;
- definition and cross-reference resolution;
- qualifier and exception precedence;
- alternative interpretations;
- multi-span evidence;
- family-specific row matching;

A caller asks for a resolved claim, an explanation, a source navigation node or a projection. The module returns a governed result or a typed refusal. This localises future fixes. A new termination chapeau grammar changes one graph rule. It does not require each family resolver and row projector to learn how to reconstruct the same context.

## Keep, change or replace under this proposal

| Current responsibility | Decision | Reason |
|---|---|---|
| Immutable source and semantic-span builders | Keep | Exact bytes, content identities and span validation are correct primitives. [E1] |
| Deterministic sectionizer | Change | Keep article, section and marker parsing, but add complete leaf blocks, stable node identities independent of parentage, and explicit structure edges. [E2] [E3] |
| Governing-structure and candidate-context services | Change, then retire as public seams | Reuse their containment logic inside graph construction. Replace text bundles with typed governance edges and support multi-span evidence. [E4] [E5] |
| Model-derived limb-component tree | Replace as the authoritative structure | Retain assertion-node and fail-closed attachment ideas. Derive paths from source nodes, and keep descriptive semantic labels outside marker identity. [E6] [E11] |
| Claim and relationship validators | Keep and extend | Multi-edge evidence and governed revisions are useful. Add the missing legal and provenance relationship types. [E12] [E13] |
| Candidate resolution | Restructure | Split candidate graph construction from deterministic graph resolution. Remove source-parent reconstruction and family-specific structural joins from the resolution monolith. [E7] [E10] |
| Family routing and product projectors | Change | Keep views and exact route ownership, but consume complete resolved graph records and declare omitted fields. Do not parse prose or rebuild context. [E14] [E15] |
| Rendered-row preview | Keep | Its exact claim-to-row matching and fail-closed errors are sound projection checks. Add completeness and omission reporting. [E14] |
| Publication disposition and serving filter | Keep | Validation and publication are already separate. Publication remains inactive. [E16] |

## Smallest useful prototype

The smallest useful prototype is a read-only shadow graph for three real provisions:

1. Metsera 7.04, to prove separate unnumbered sentence nodes, branch-specific actors and multi-target cross-references.
2. QXO 3.1(b), to prove chapeau-to-limb and sub-limb provenance without copying words into children.
3. One termination section selected from the existing diagnosis, to prove a governing grant chapeau plus a cross-provision limitation.

No model call, pin regeneration, baseline update, production write or publication action is permitted. Use recorded sources and candidates. The prototype passes only if:

- every selected source byte is represented by an exact node;
- every inherited semantic field has a source span and rule path;
- every current resolved claim retains its state and canonical value, unless an expected difference was declared before the run;
- open-world does not increase in any tested family;
- the Metsera graph retains both sentences, actors, condition-reference sets, “may not rely”, “primarily caused” and “material breach”;
- the shadow projection can account for every field that it displays or omits;
- publication remains `NONE`.

If the prototype cannot preserve current resolved claims through aliases, stop and escalate the identity design. If the source parser cannot distinguish the two Metsera sentences and the QXO chapeau/limbs deterministically, stop and escalate the boundary grammar. If the graph has to copy unproven context rather than record a typed edge, reject this architecture.

## Terra-agent execution packets for the prototype

Each packet is bounded so a Terra-level agent can execute it. “Escalate” means stop that packet and ask a Sol-level agent or Ben for the named judgement. These are future implementation packets. They were not executed for this report.

| Packet | Terra-agent task | Required output | Stop or escalation condition |
|---|---|---|---|
| P0 | Reconfirm commit, dirty state and evidence paths. Create a read-only fixture manifest for the three provisions. | Manifest with source hashes, byte intervals and existing claim IDs | Stop on source-hash mismatch or moved evidence. Do not repair evidence. |
| P1 | Specify source-node and edge JSON schemas in a report branch. Include stable-ID and alias rules. | Schema document plus examples for all three provisions | Escalate stable identity or overlapping-span disputes to Sol before code. |
| P2 | Build a shadow source index behind a new isolated entry point. Do not change production callers. | Deterministic source graph JSON and focused tests | Stop if exact bytes do not round-trip or any existing source ID is overwritten. |
| P3 | Build graph import from current recorded claims and evidence. Add typed governance, support and cross-reference edges. | Candidate and resolved shadow graph JSON | Escalate any rule that needs legal interpretation. Do not infer it. |
| P4 | Add a shadow projection and omission ledger. | Source-to-node-to-edge-to-claim-to-row comparison for all three provisions | Stop if an existing resolved claim changes unexpectedly or open-world rises. |
| P5 | Run independent review. One agent checks source preservation. One checks claim parity. One checks projection completeness. | Signed comparison report and resolution-set diff | Any unresolved conflict blocks the prototype verdict. |
| P6 | Ask Ben only the legal questions exposed by P3 and P4. Apply rulings through a versioned ledger. | Ruling identifiers and rerun diff | Do not encode a lawyer's unstated preference. |

## Legal judgements this design cannot make

The architecture can preserve alternatives and provenance. Ben must decide the legal meaning when deterministic source grammar cannot settle it. The prototype should isolate these questions:

- Can reciprocal frustration sentences be presented as one “mutual” result, or must the two party branches always remain separate in legal review output?
- When a proviso follows several limbs, which limbs does it govern if punctuation and indentation support more than one reading?
- When a cross-reference lists several sections, does the output need each referenced condition, only the section references, or both?
- Which qualifications are negotiated terms that every legal row must display, such as “primarily caused”, “material”, “final and nonappealable” or “having jurisdiction”?
- When may a defined party group, such as “Either Principal Party”, replace the named source actors without losing legally material allocation?
- When may a projection collapse several atomic claims into one market-comparison row?
- Which open-world proposition types should receive new governed claim definitions and output owners?

## Evidence index

- **E1:** `lib/canonical-v2/source-structure.js:54-138`, immutable bytes and validation; `lib/canonical-v2/source-structure.js:148-217`, semantic spans and excerpts; `lib/canonical-v2/source-structure.js:308-414`, provision and component identities.
- **E2:** `lib/canonical-v2/native-producer/deterministic-sectionizer.js:1-48`, scope and parser sources; `lib/canonical-v2/native-producer/deterministic-sectionizer.js:214-340`, marker tree and heading heuristic; `lib/canonical-v2/native-producer/deterministic-sectionizer.js:790-831`, marker-derived subsection nodes; `lib/canonical-v2/native-producer/deterministic-sectionizer.js:835-1071`, public tree construction.
- **E3:** `lib/canonical-v2/native-producer/deterministic-sectionizer.js:740-787`, current section identity payload; `tests/canonical-v2-native-sectionizer.test.js:44-70`, exact byte and parent checks; `tests/canonical-v2-native-sectionizer.test.js:112-192`, real-corpus round-trip, determinism and QXO subsection checks.
- **E4:** `lib/canonical-v2/native-producer/governing-structure.js:1-41`, containment, fail-closed behaviour and markerless floor; `lib/canonical-v2/native-producer/governing-structure.js:166-208`, outline leaves; `lib/canonical-v2/native-producer/governing-structure.js:221-365`, chapeau-chain and containment resolution; `tests/canonical-v2-candidate-governing-context.test.js:129-158`, markerless section-only test.
- **E5:** `lib/canonical-v2/native-producer/candidate-governing-context.js:57-178`, exact single-operative-evidence requirement and returned context; `lib/canonical-v2/native-producer/structure-placement.js:1-24`, annotation-only scope; `lib/canonical-v2/native-producer/structure-placement.js:50-85`, evidence interval aggregation; `lib/canonical-v2/native-producer/structure-placement.js:114-267`, late annotation and bridge stripping helper.
- **E6:** `lib/canonical-v2/native-producer/limb-components.js:1-86`, model-path source and two-node design; `lib/canonical-v2/native-producer/limb-components.js:204-400`, tree minting and null path spans; `lib/canonical-v2/native-producer/limb-components.js:407-550`, qualifier attachment and flow.
- **E7:** `lib/canonical-v2/native-producer/candidate-resolution.js:1-59`, candidate resolution scope; `lib/canonical-v2/native-producer/candidate-resolution.js:1501-1555`, provision grouping and span; `lib/canonical-v2/native-producer/candidate-resolution.js:4501-4508`, candidate context construction; `lib/canonical-v2/native-producer/candidate-resolution.js:6079-6358`, resolution and limb handling; `lib/canonical-v2/native-producer/candidate-resolution.js:11808-11848`, final structure annotation.
- **E8:** `docs/CODEX-PROGRAM.md:238-260`, binding source-fact and graph rule; `docs/CODEX-PROGRAM.md:350-425`, semantic envelope, scope compilation and typed graph closure; `docs/CODEX-PROGRAM.md:502-580`, capitalisation and no-shop target examples.
- **E10:** `docs/codex-program/notes/structural-inheritance-diagnosis.md:11-75`, reviewed context-loss examples; `docs/codex-program/notes/structural-inheritance-diagnosis.md:79-124`, missing downstream joins; `docs/codex-program/notes/structural-inheritance-diagnosis.md:135-203`, termination grammar divergence; `docs/codex-program/notes/structural-inheritance-diagnosis.md:235-276`, provision excerpt and atomic claims.
- **E11:** `docs/codex-program/notes/step-2x-l1-limb-disposition.md:64-84`, 69-case disposition; `docs/codex-program/notes/step-2x-l1-limb-disposition.md:99-132`, marker and descriptive paths and assertion-node coverage.
- **E12:** `lib/canonical-v2/claims-relationships.js:3-70`, states, evidence roles and revision fields; `lib/canonical-v2/claims-relationships.js:162-208`, ordered evidence; `lib/canonical-v2/claims-relationships.js:290-423`, claim and relationship construction.
- **E13:** `lib/canonical-v2/contract-bundle.js:45-50`, current five relationship definitions; `lib/canonical-v2/contract-bundle.js:4031`, expected relationship keys.
- **E14:** `lib/review-parity/rendered-row-preview-contract.js:6-218`, family routes and explicit row-match contracts; `lib/review-parity/rendered-row-preview.js:325-389`, claim projection; `lib/review-parity/rendered-row-preview.js:391-539`, exact row selection and fail-closed errors.
- **E15:** `lib/canonical-v2/general-covenants-product-projection.js:144-162`, bridge projection strips structure context.
- **E16:** `lib/canonical-v2/publication-disposition.js:20-40`, validation and publication as separate axes; `lib/canonical-v2/publication-serving-filter.js:22-55`, serving-filter behaviour.
- **E17:** `docs/core/DECISIONS.md:1658-1682`, rendered row as legal judgement unit; `docs/core/DECISIONS.md:1728-1748`, missing representations join at the time of the decision.
- **E18:** `evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final/section-location-scan.json:41-47`, Section 7.04 location.
- **E19:** `evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final/resolution.json:1068-1331`, resolved claim, whole-section subject, evidence, cross-reference and markerless context; `evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final/resolution.json:1590-1682`, parallel review/open-world entries; `evidence/canonical-v2/stage-2y-cd-report.json#/.current.full_output_duplicate_groups`, group containing claim `7490a23a2cc41cb78ce7260d45ae80a7795b2453bd2fe45672243a61107eddb9`.
- **E20:** `evidence/review-feedback/2026-08-10/README.md:12-21`, review artefact limits; `evidence/review-feedback/2026-08-10/ben-row-feedback.json:70`, Metsera card 61 feedback.
- **E21:** `scripts/stage-2y-cd-measurement.mjs:71-77`, extraction-state definitions; `scripts/stage-2y-cd-measurement.mjs:396-448`, rendering-funnel method; `evidence/canonical-v2/stage-2y-cd-report.json#/.authority`; `evidence/canonical-v2/stage-2y-cd-report.json#/.current.totals`; `evidence/canonical-v2/stage-2y-cd-report.json#/.current.by_family`.
- **E22:** `scripts/stage-2y-cd-known-loss-adjustment.mjs:175-228`, known-loss counts and arithmetic; `scripts/stage-2y-cd-known-loss-adjustment.mjs:232-305`, authority, rules and human-acceptance status; `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json#/summary`; `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json#/rule_counts`; `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json#/reason_counts`.
