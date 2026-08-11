# Phase B interface audit

Date: 2026-08-10

Status: report-only. Phase B remains deferred. No model call was made for this audit.

## Decision

Phase B must not resume against its current flat section-text interface.

If Phase B resumes, each extraction call should receive one frozen `PhaseBInputPacket`. A packet is an immutable, content-addressed input record. It should contain:

1. the exact admitted source and conversion binding;
2. a complete source subtree for the selected provision;
3. every governing ancestor and linked definition needed to read that subtree;
4. deterministic inheritance links, with the source node and source span for every inherited value;
5. the frozen semantic task and permitted claim definitions;
6. a proposal-only output contract; and
7. report-only authority and call limits.

The model may propose legal meaning. It must not create source structure, choose a repeated quote occurrence, invent inheritance, assign final claim state, write product data, or control publication.

The current blocked-row packet remains valid historical evidence for the experiment that produced it. It is not the target extraction interface. Reusing it as the target would ask the model to compensate for known structural defects.

## Terms

- **Canonical text** is the UTF-8 text produced by the admitted conversion process. Its bytes are the coordinate system used by extraction.
- **Source node** is one stable block in the written agreement. Examples are an article, section, sentence, chapeau, limb, sub-limb, proviso or trailing qualification.
- **Source subtree** is one source node and all of its descendants in source order.
- **Context link** is a deterministic statement that text in one source node governs another source node. For example, a chapeau subject may govern limb `(ii)`.
- **Provenance** is the record of where a value came from and how it was derived. It includes the source node, exact byte span and deterministic rule.
- **Semantic task** is the frozen list of legal facts that the call may propose. It is separate from source structure.
- **Proposal** is a non-authoritative model suggestion. It is not a resolved claim.
- **Evaluation packet** is the separate record used to score a proposal. It may contain historical candidates or human decisions. Those fields should not be mixed into the extraction input.
- **Scope closure** means that the packet includes all source text needed to analyse the selected node, including governing ancestors, attached qualifications and resolved cross-references that the task depends on.

## Current Phase B authority and result

The controlling programme record is `docs/core/PLAN.md:2872-2900`.

Phase B is deferred by Ben. The shared code lock is `PHASE_B_LIVE_DEFERRED = true` in `scripts/stage-2y-phase-b-live-authority.mjs:1-9`. The tests in `tests/stage-2y-phase-b-live-authority.test.js:19-43` prove that the lock covers:

- the Sol probe;
- the Sol Financing continuation;
- the V1 Terra route;
- the V1 cross-vendor route;
- the V2 baseline route;
- the V2 cross-vendor route; and
- the generic runner's direct Phase B lead probe.

No route should be called while that lock remains.

The complete Financing continuation is sealed in `evidence/canonical-v2/stage-2y-phase-b/sol-financing-continuation.json`:

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Attempted | 17 | 17 | 0 |
| Resolved | 5 | 5 | 0 |
| Open-world | 35 | 46 | +11 |
| Review | 12 | 12 | 0 |

All eight selected sections completed. Five sections increased open-world. No previously resolved claim changed value or state. Exact duplicate excess was zero. Nested overlap increased by one row, which does not explain the eleven extra open-world items. The recorded stop is `OPEN_WORLD_RISE`.

The separate V2 blocked-row experiment is sealed by `evidence/canonical-v2/stage-2y-phase-b-v2/manifest.json` and `evidence/canonical-v2/stage-2y-phase-b-v2/terra-calls.json`. Its manifest selects 150 deterministic-blocked rows. Only 43 calls completed before deferral. Each completed record binds the row, prompt, provider identity, provider request, response bytes and usage. This is useful transcript evidence. It is not a complete experiment.

Both experiments are report-only. Their manifests state:

- `product_writes: false`;
- `publication_authorisation: "NONE"`; and
- `serving_activated: false`.

## The current input seam

The current live extraction runner receives the full admitted text, then resolves requested section references before any provider call. This fail-closed resolution is sound. See `lib/canonical-v2/native-producer/native-extraction-run.js:540-623`.

After resolution, the runner builds `governed_scope` at `native-extraction-run.js:636-652`. It contains:

- document hash;
- section reference and section identifier;
- parent section identifier;
- structural kind and depth;
- section start and end;
- text hash; and
- the selected section text.

The provider prompt receives that section text and a list of known definitions. The Financing prompt renders a flat `SOURCE TEXT` block. See `lib/canonical-v2/native-producer/financing-producer-prompt.js:1-6`.

The V2 blocked-row experiment gives the model a flat row with these main fields:

- current candidate and current state;
- deal, family and section reference;
- governed placements;
- one row evidence string;
- source digests for existing run artefacts; and
- the full recorded section text.

It does not give the model a complete typed source tree. In sampled rows, `candidate.structure_context` can be `UNDETERMINED` with reason `NO_EVIDENCE_SPAN`. The row still carries the current candidate and the entire section.

The V2 prompt says that party text and every supporting quote must occur byte-for-byte in the flat `source_text`. See `scripts/stage-2y-phase-b-v2-model-experiment.mjs:136-166` and `:349-370`.

This rule prevents an unsupported party inference. It also exposes the structural problem. A limb can validly inherit its subject from a chapeau. The subject words do not occur inside the limb. A flat source string can show both texts, but it does not state which chapeau governs which limb or where the inherited subject came from. The model must infer the missing structural link.

The provider currently turns a returned quote into evidence after the response. `locateQuoteBytes` chooses the first occurrence of that quote. Although `locateAllQuoteBytes` exists, the general path uses the first match. See `lib/canonical-v2/native-producer/anthropic-provider.js:584-627`. A model must not be responsible for resolving this source-coordinate ambiguity.

The provider can also accept a model limb path and then shape claims and qualifiers around it. See `anthropic-provider.js:671-700` and `:765-893`. A descriptive model path is semantic assistance. It is not proof of the written outline.

## Why the current packet cannot be the resumed interface

The current packet combines three different representations:

1. source text and coarse section metadata;
2. an existing semantic candidate and its current extraction state; and
3. the list of governed claim placements used to score the experiment.

This combination has five material effects.

First, a historical candidate can anchor the extractor. The model can repair or agree with the current answer instead of independently reading the source.

Second, a whole section is too coarse for provenance. It does not identify separate unnumbered sentences, chapeaux, limbs, provisos or trailing qualifications as stable blocks.

Third, inheritance is implicit. A party, grammatical subject, modal verb, governing verb, condition or exception can be present somewhere in the section but have no recorded relationship to the target limb.

Fourth, evidence is located after the model responds. Repeated text can bind to the wrong occurrence.

Fifth, current extraction outputs such as `RESOLVED`, `OPEN_WORLD` and `REVIEW` are used as model dispositions. The target architecture requires the model to produce proposals. Deterministic validation and governed review must decide final claim state.

The canonical programme contract already states the right separation. `docs/codex-program/canonical-contracts.md:906-950` defines model inference as an offline, non-authoritative proposal step bound to an exact input envelope and immutable transcript. `canonical-contracts.md:9976-10038` excludes releases, serving state and publication authority from that envelope. `canonical-contracts.md:1669-1704` defines half-open UTF-8 source intervals and stable structural spans.

## Required Phase B input

### One external interface

The proposed module should expose one call:

```text
propose_semantics(PhaseBInputPacket) -> SemanticInferenceTranscript
```

The interface is small. The packet builder hides source selection, tree traversal, source-map validation, context compilation, definition lookup, cross-reference resolution, prompt rendering, byte limits and digest calculation.

The transcript records the exact request and response. A separate deterministic module validates proposals. Phase B must not call a resolver, renderer, writer or publisher.

### Packet schema

The following is the minimum complete packet. Names are illustrative, but the information and authority are required.

```text
PHASE_B_INPUT_PACKET/V1
  packet_id
  schema_version

  authority
    programme_decision_id
    experiment_id
    report_only = true
    product_writes = false
    publication_authorisation = NONE
    serving_activated = false
    permitted_provider_profile
    maximum_attempts
    maximum_input_bytes
    maximum_output_bytes

  source_binding
    immutable_source_document_id
    source_occurrence_id
    source_content_id
    raw_bytes_sha256
    canonical_text_id
    canonical_text_sha256
    canonical_text_byte_length
    converter_executable_digest
    converter_configuration_digest
    source_map_digest
    canonical_text_verification_id
    source_admission_manifest_id
    admitted_intervals

  scope_binding
    family_id
    requested_claim_definition_keys
    focus_node_ids
    selected_subtree_root_ids
    selection_rule_id
    selection_rule_version
    selected_node_ids_in_source_order
    selected_interval_root
    excluded_intervals_with_reason
    unresolved_scope_issues

  source_structure
    structural_model_version
    tree_root_digest
    nodes
      source_node_id
      structure_revision_id
      parent_source_node_id
      structural_kind
      source_roles
      source_order_ordinal
      absolute_start
      absolute_end
      exact_text
      exact_text_sha256
      label_span_id
      heading_span_id
      parse_state
    edges
      edge_id
      edge_kind
      source_node_id
      target_node_id
    boundary_alternatives
    byte_coverage_proof

  context_links
    context_link_id
    context_kind
    source_node_id
    source_span_id
    source_text
    target_node_ids
    relationship_path
    derivation_rule_id
    derivation_rule_version
    state
    competing_link_ids

  linked_source
    reference_occurrences
    definition_occurrences
    party_occurrences
    control_relationship_occurrences

  semantic_task
    canonical_contract_bundle_id
    contract_freeze_attestation_id
    primitive_schema_ids
    family_id
    claim_definitions
    relationship_definitions
    evidence_role_definitions
    allowed_canonical_values
    expected_claim_slots
    open_world_proposal_allowed

  proposal_contract
    permitted_proposal_kinds
    permitted_reference_types
    required_evidence_roles
    uncertainty_codes
    residual_codes

  build_provenance
    packet_builder_executable_digest
    packet_builder_configuration_digest
    dependency_digests
    parser_version
    context_compiler_version
    input_set_root
    input_order_root
```

### Source binding

The prompt does not need the binary contents of an SEC filing or Word package. It does need a binding to those immutable original bytes and the complete conversion chain. The exact canonical text bytes used by analysis must be included for the selected scope.

Every coordinate must be a half-open UTF-8 byte interval `[start, end)`. For example, `[120, 126)` means bytes 120 through 125. Browser character indices and model token positions are not authoritative coordinates.

The packet must fail before inference if any source digest, source-map digest, admission identifier or byte interval does not reproduce.

### Source structure

The selected source structure must include, in source order:

- the selected section or other analysis root;
- all descendants down to deterministic leaf blocks;
- every ancestor whose text can govern the selected node;
- attached headings and labels;
- chapeaux, limbs and sub-limbs;
- each separate unnumbered sentence;
- provisos, exceptions and trailing qualifications; and
- referenced definitions or provisions required by the semantic task.

Each node needs a stable occurrence identifier and a separate structure-revision identifier. The occurrence identifier should derive from:

```text
canonical_text_id
structural_kind
absolute_start or authored_marker_start
```

The structure-revision identifier includes the structural-model version, end byte, exact-byte digest, parent, source order and roles. A parent, end-boundary or role correction therefore produces a new revision without changing an occurrence whose kind and start anchor remain the same. A changed kind or start requires an explicit alias. The old tree and every old revision must remain reproducible.

`structural_kind` records the written form, such as `SECTION`, `SENTENCE`, `CHAPEAU`, `LIMB`, `SUB_LIMB` or `PROVISO`. `source_roles` records compatible functions. For example, one sentence may be both a trailing sentence and a qualification. Keeping kind and role separate avoids forcing one block into one legal interpretation.

The byte-coverage proof must show that the structural leaves partition every admitted byte in scope exactly once. A gap or overlap blocks the call. Whitespace and page artefacts still need a typed disposition. They must not vanish.

When the parser has two plausible structures, the packet should contain both typed alternatives and mark the affected node `AMBIGUOUS`. It must not present one guess as proved structure.

### Inherited context

A context link is not a copied value. It is a relationship from source evidence to the nodes it governs.

Required context kinds are:

- grammatical subject;
- legal actor or obligor;
- beneficiary or controlled party;
- modal, such as `shall`, `may` or `will`;
- governing verb;
- object or governed action;
- negation;
- condition;
- temporal scope;
- materiality qualifier;
- exception or proviso;
- trailing qualification; and
- definition or cross-reference dependency.

Each context link must record:

- the exact source node and byte span;
- the exact observed words;
- every target node it governs;
- the parent-to-child path used;
- the deterministic rule and version;
- whether the link is `PROVED`, `AMBIGUOUS` or `CONFLICTED`; and
- any competing links.

Example:

```text
context_kind: GRAMMATICAL_SUBJECT
source_node_id: chapeau-17
source_span_id: span-for-Parent
source_text: Parent
target_node_ids: [limb-i, limb-ii]
relationship_path: [section-6.4, chapeau-17, limb-ii]
derivation_rule_id: CHAPEAU_TO_PARALLEL_LIMBS
state: PROVED
```

The proposal for limb `(ii)` may refer to this link. It must not claim that `Parent` occurs inside limb `(ii)`.

Context must not be passed when its scope is uncertain. The packet should expose the ambiguity and the raw source. It should not silently choose a sibling subject, extend an exception beyond its grammar, turn permission into an obligation, remove negation, or convert a definition into an occurrence-specific fact.

### Cross-references and definitions

A tree is not enough for cross-references. The packet should include typed links from the reference occurrence to its resolved targets.

Each reference record needs:

- the source node and exact span of the reference;
- the exact reference words;
- link kind, such as `SECTION_REFERENCE` or `DEFINED_TERM_USE`;
- zero, one or several target node identifiers;
- resolution state;
- deterministic resolver version; and
- unresolved alternatives or reason.

A referenced target should be copied into `linked_source` only when it is needed for the frozen semantic task. Its own source identifier and absolute span remain authoritative. This keeps the packet bounded without hiding a necessary definition or exception.

### Semantic task

The semantic task is separate from source structure. It should state what the call may propose, not what the source says.

It should include the frozen claim and relationship definitions, their versions, evidence rules and allowed values. It should not include:

- a rendered row;
- a Review V2 output owner;
- publication state;
- a market answer;
- the current active pin;
- a final claim revision;
- a final absence or not-applicable decision; or
- an unlabelled historical candidate.

For an experiment that intentionally tests recovery of existing blocked candidates, the candidate and current state belong in a separate `EvaluationPacket`. If protocol design requires the extractor to see that candidate, the manifest must state that the experiment is assisted recovery, not independent extraction. The result must not be used to validate the target extraction interface.

## Required model output

The model should return proposed semantic observations. It should not return authoritative extraction states.

Each proposal should contain:

- the packet identifier;
- one allowed claim or relationship definition, or a typed open-world proposal;
- one or more source node identifiers;
- observed raw words;
- a proposed canonical value, when allowed;
- evidence selections;
- any context-link identifiers relied on;
- any definition or cross-reference identifiers relied on;
- uncertainty and competing interpretations; and
- a concise rationale.

An evidence selection should use one of two forms:

1. an existing source span identifier; or
2. an exact quote, containing source node identifier and occurrence ordinal.

The model must not supply a trusted byte offset. The deterministic verifier locates all exact occurrences inside the named node. It accepts the specified occurrence only when it is unique under the supplied selector. It then creates the semantic span. This avoids the current first-match behaviour.

A proposal may cite several source nodes. For example, a financing covenant claim may cite:

- the chapeau for `Parent shall`;
- limb `(ii)` for the required action;
- a trailing proviso for the limit; and
- a definition node for `Financing Commitments`.

That is one semantic proposition with four source-backed inputs. It is not four duplicated claims.

The model must never create or finalise:

- a source node or source edge;
- a source coordinate;
- an inherited context link;
- a stable claim identifier;
- `ABSENT` or `NOT_APPLICABLE` for the agreement;
- a final Buyer or Seller role without governed party evidence;
- a final resolved, review or open-world state;
- an output owner or rendered row;
- a pin, baseline or release member; or
- publication authority.

The complete request, response, tool bytes, termination state, model, prompt, executable, configuration and dependency digests must be retained in an immutable `SemanticInferenceTranscript`. This follows `canonical-contracts.md:914-933`.

## What remains deterministic

The following work must complete before any model call:

- source admission and source-map verification;
- canonical text production;
- source node boundaries and identifiers;
- parent-child order;
- heading and outline-marker classification where proved;
- byte coverage;
- exact quote occurrence enumeration;
- structural inheritance links where proved;
- cross-reference and defined-term occurrence detection;
- packet scope selection;
- contract and claim-definition lookup;
- prompt construction;
- packet, prompt and request digests; and
- authority and call-budget checks.

The following work must remain deterministic after the response:

- JSON and schema validation;
- verification of every node, span, link and definition reference;
- exact quote occurrence selection;
- allowed-value checks;
- duplicate and overlap reporting;
- residual production;
- comparison against the previous resolution set;
- the four extraction-state measurements;
- rendered-row and output-owner measurements; and
- every stop decision.

Human review may adjudicate legal ambiguity. A deterministic normaliser may consume only the exact reviewed proposal bytes. Separate model calls may disagree. Their disagreement is evidence for review, not a majority-vote rule.

## Defects Phase B must never compensate for

Phase B must stop, or receive a typed ambiguity, rather than compensate for any of these defects:

| Upstream or downstream defect | Why a model repair is invalid |
| --- | --- |
| A missing node for an unnumbered sentence | The model cannot make that sentence navigable or give it a stable source identity. |
| A missing chapeau, limb, sub-limb, proviso or trailing node | The model would be inventing the source hierarchy. |
| Wrong parent-child placement | Later inheritance and collapse behaviour would still be wrong. |
| A heading treated as an outline marker, or the reverse | The written hierarchy is deterministic source evidence, not semantic opinion. |
| Missing party, subject, modal or governing verb inheritance | A bare value without its source link gives false provenance. |
| An exception or qualification attached to the wrong scope | The model would silently alter legal effect. |
| A repeated quote with no occurrence selector | First-match evidence can point to the wrong source bytes. |
| Missing source-map or byte provenance | A plausible quote cannot replace an admitted coordinate. |
| Missing definition or cross-reference target | The model should not reconstruct a hidden dependency from general knowledge. |
| Missing party or control relationship evidence | The model must not infer Buyer, Seller, controlled entity or controller from deal convention. |
| Wrong family routing or incomplete source scope | A model cannot know what text the deterministic router omitted. |
| Missing governed claim definition or approved value | An open-world proposal may expose the gap. It cannot approve a new canonical meaning. |
| Faulty resolution rules | Model output cannot be used as an unrecorded exception to a resolver. |
| Missing output owner or lossy rendered row | Rendering is a later projection. The model must not tailor source meaning to fit the row. |
| Duplicate collapse or claim grouping error | Grouping requires deterministic identity and lineage. |
| Publication or pin control | The experiment has no publication authority. |

The current flat packet's party rule is a concrete example. `Never infer a party` is correct. Requiring party words to occur somewhere in the entire section is not enough. The target packet must identify whether those words are local to the limb or inherited from a governing node.

## Locks that must remain in force

The following items stay locked unless Ben makes a new, recorded programme decision:

1. `PHASE_B_LIVE_DEFERRED` stays `true` across every route.
2. Product writes stay disabled.
3. Publication authorisation stays `NONE`.
4. Serving activation stays false.
5. The model process has no writer credential and no route to canonical tables.
6. The eight completed Financing calls are never repeated.
7. The 43 completed V2 blocked-row calls are never repeated.
8. Historical requests, responses, provider request identifiers, prompts, executable identities and digests remain byte-for-byte sealed.
9. The one completed V5 Closing Conditions call remains historical evidence. No new V5 call is permitted.
10. Historical V5 validation is not weakened to make a new call pass.
11. No pin, baseline, resolution set, family route, output-owner map or publication state changes because of Phase B.
12. Maximum attempts, input bytes, output bytes, provider profile and cost are fixed in the new manifest before any call.
13. Model tools and external network retrieval remain disabled for the call. The recorded agreement packet is the only factual input.

The old and new packets need different schema and prompt versions. A new packet must not overwrite the V1 or V2 evidence manifests.

## Resume prerequisites

All prerequisites below must pass before the shared deferral can be reconsidered.

1. **New authority.** Ben records a new programme decision that names the exact protocol, provider profile, families, cohort, call count, cost limit and stop policy.
2. **Eight-section semantic diff.** The team explains the Financing change from 35 to 46 open-world items using the recorded responses. It must not repeat a completed call.
3. **Comparator decision.** The team decides how V5 historical output and V6 output can be compared. The decision keeps the old V5 call sealed and forbids new V5 calls.
4. **Structural prototype.** The new tree passes real-agreement tests for articles, sections, nested subsections, separate unnumbered sentences, chapeaux, limbs, sub-limbs, headings, outline markers, provisos and trailing qualifications.
5. **Byte closure.** Structural leaves partition every admitted byte in each prototype scope. All node and text hashes reproduce.
6. **Inheritance prototype.** Every inherited subject, actor, modal, governing verb, condition, qualification and exception has source-node and source-span provenance. Tests prove no sibling leakage.
7. **Reference prototype.** Defined terms and section references have typed occurrence links, resolved targets or explicit unresolved states.
8. **Packet V1 freeze.** The packet schema, builder, selection rule, prompt, provider profile, output schema, validators and all digests are frozen in a new manifest.
9. **Cohort decision.** The team decides whether the old 150 blocked rows still represent the intended population after structural repair. Any regenerated cohort gets a new set root and order root. The old cohort remains untouched.
10. **Independent extraction design.** Existing candidates and current states are removed from the extractor input, or the protocol clearly labels the study as assisted recovery and prevents generalisation to independent extraction.
11. **Offline replay.** Recorded responses are replayed through the new deterministic validators where schema permits. Incompatible historical responses stay historical. They are not silently reshaped.
12. **Ground-truth plan.** The recovered subset has at least 50 human adjudications and a defined lower confidence bound. Party accuracy remains unmeasured unless the seven decided cards are expanded or the anchor re-sit occurs.
13. **Dry authority check.** A no-call dry run proves that the model adapter cannot write product data, alter pins, activate serving or publish.
14. **Adversarial tests.** Tests reject an unknown node, missing ancestor, ambiguous repeated quote, unproved inherited value, source digest drift, new V5 request and duplicate completed request.
15. **Independent approval.** One reviewer who did not build the packet confirms scope closure and the absence of current-answer leakage.

The old thresholds remain historical evidence:

- at least 60% recovery of the blocked sample;
- every recovered placement cross-vendor scored;
- at least 50 recovered placements human-adjudicated; and
- at least 95% agreement or correctness on that recovered subset.

Those thresholds should be reviewed when the new protocol is frozen. They must not be weakened after results are known. A pass licenses only the proposal mechanism. It does not authorise publication.

## Stop conditions for a resumed experiment

Stop before a call if:

- the shared deferral has not been replaced by the named programme decision;
- a packet, source, source-map, tree, contract, prompt or provider digest differs from the manifest;
- the selected scope has a byte gap, overlap or missing required ancestor;
- a required inheritance link lacks provenance;
- a structural ambiguity is hidden instead of represented;
- a completed request would be repeated;
- the provider profile or prompt version differs from the manifest;
- a new call would use V5;
- writer or publication credentials are reachable; or
- the call or byte budget would be exceeded.

Stop immediately after a call if:

- the provider call fails or returns a malformed or truncated response;
- the response cites an unknown node, span, context link, definition or claim definition;
- an exact quote is missing or its occurrence cannot be selected unambiguously;
- the response attempts to create structure, final claim state, output or publication authority;
- request, response or provider receipt binding fails;
- an unexpected previously resolved claim changes value, evidence or state; or
- a source-backed detail disappears from the proposal-to-resolution diff.

Stop at the complete family boundary if:

- open-world increases in that family;
- review increases without an approved semantic explanation;
- attempted coverage falls;
- duplicate or nested overlap changes cannot account for the measured change;
- human correctness or cross-vendor agreement misses the frozen threshold; or
- party attribution is reported as passed without adequate ground truth.

Count attempted, resolved, open-world and review separately. Do not add them. A negative result is still useful. It shows that the proposal mechanism or its input is not ready.

## Safe pre-resume work

The next Phase B work should be offline and deterministic:

1. produce the required eight-section semantic diff from recorded Financing responses;
2. map each old Phase B row to the source nodes that a correct packet would require;
3. mark every missing node, missing context link and ambiguous quote occurrence;
4. build packet examples as static report evidence, without a provider call;
5. replay recorded response JSON through the proposed output validator where possible; and
6. freeze no new live manifest until the architecture prototype passes its source-to-proposal tests.

This sequence uses evidence already paid for. It does not rerun Phase B.

## Acceptance tests for the interface

The following tests are sufficient to decide whether the packet is structurally ready. They are not proof that a model is legally accurate.

| Test | Required result |
| --- | --- |
| Same source and versions | Byte-identical packet and packet identifier. |
| One-byte source change | New source, node, packet and transcript binding. |
| Separate unnumbered sentences | One stable child node per sentence. |
| Chapeau and two limbs | Each limb receives the same subject and verb link with chapeau provenance. |
| Limb-local override | The child override wins and the inherited alternative remains traceable. |
| Trailing proviso | The proviso governs only the proved target nodes. |
| Repeated quote | Model selection without node and occurrence ordinal is rejected. |
| Cross-reference | Use occurrence, target occurrence and resolver provenance are retained. |
| Ambiguous parentage | Packet reports alternatives and does not call the model as if one were proved. |
| Missing byte | Packet construction fails before inference. |
| Unknown model node | Output validation fails closed. |
| Current-answer leakage | Independent extraction packet contains no current candidate or state. |
| Report-only authority | No writer, pin, serving or publication path is reachable. |
| Historical receipt | Every completed old call still validates against its original manifest. |

## Evidence index

- Deferral, Financing counts, stop code, partial 43 of 150 baseline and V5/V6 comparator issue: `docs/core/PLAN.md:2872-2900`.
- Human and cross-vendor decision rules: `docs/core/PLAN.md:2902-2949`.
- Current Phase B status and current Stage 2Y measurements: `docs/core/PLAN.md:3007-3046`.
- Shared live lock: `scripts/stage-2y-phase-b-live-authority.mjs:1-9`.
- Route coverage for the live lock: `tests/stage-2y-phase-b-live-authority.test.js:19-43`.
- Financing family stop logic and sealed call validation: `scripts/stage-2y-phase-b-sol-financing-continuation.mjs:37-46` and `:127-180`.
- Complete Financing evidence: `evidence/canonical-v2/stage-2y-phase-b/sol-financing-continuation.json`.
- V2 blocked-row manifest and partial transcripts: `evidence/canonical-v2/stage-2y-phase-b-v2/manifest.json` and `evidence/canonical-v2/stage-2y-phase-b-v2/terra-calls.json`.
- Current blocked-row prompt and validators: `scripts/stage-2y-phase-b-v2-model-experiment.mjs:136-166` and `:349-370`.
- Current section-level governed scope and provider seam: `lib/canonical-v2/native-producer/native-extraction-run.js:540-754`.
- Current first-occurrence quote anchoring: `lib/canonical-v2/native-producer/anthropic-provider.js:584-627`.
- Current model-supplied limb and qualifier shaping: `lib/canonical-v2/native-producer/anthropic-provider.js:671-700` and `:765-893`.
- Target inference transcript and reviewed-payload authority: `docs/codex-program/canonical-contracts.md:906-950`.
- Target semantic input envelope and deterministic normaliser: `docs/codex-program/canonical-contracts.md:9976-10038`.
- Target byte coordinates and structural-span identity: `docs/codex-program/canonical-contracts.md:1669-1704`.
- Complete transport dispositions for the 69 historical Red Hat limb proposals: `docs/codex-program/notes/step-2x-l1-limb-disposition.md:64-132`.

## Remaining uncertainty

This audit does not decide whether model reasoning will improve legal extraction after structure is repaired. The current stopped experiment cannot answer that question because its input seam is flat and its Financing result increased open-world.

It also does not decide structural source binding for the 69 historical Red Hat limb proposals. Their transport dispositions are complete: one is `RESIDUAL_QUOTE_UNVERIFIED`, 62 are `OPEN_WORLD_ONLY`, and six are `OPEN_WORLD_AND_ASSERTION_NODE`. Nothing is unaccounted for. They are not 69 unresolved legal questions. The structural prototype must bind each proposal to an exact source node or record a typed `SOURCE_NODE_UNBOUND` result while preserving its existing disposition. Only the subset for which the grammar permits more than one legally material parentage or scope needs Ben's legal judgement. If Phase B resumes, it should receive those typed alternatives. It should not receive all 69 proposals as one undifferentiated ambiguity set.
