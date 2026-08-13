'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const FAMILY_MATCHERS = Object.freeze([
  ['EMPLOYEE_MATTERS', /\b(?:employee matters|employee benefits?|benefit plans?)\b/i],
  ['TERMINATION', /\btermination of (?:the )?agreement|termination rights?\b/i],
  ['GENERAL_COVENANTS', /\b(?:public announcements?|access to information|further assurances?)\b/i],
  ['CLOSING_CONDITIONS', /\bconditions? to (?:the )?(?:merger|closing|obligations?)\b/i],
  ['MAE_DEFINITION', /\bmaterial adverse effect\b/i],
  ['KEY_DEFINED_TERMS', /\b(?:definitions?|defined terms?)\b/i],
  // Two arms doing two jobs. The first matches the heading that attributes the
  // representations to a party, which is how both document shapes name the
  // operative article. The second is never expected to match a heading; it
  // selects the operative sentence once representativeLegalUnit filters inside
  // the matched node. The bare phrase "representations and warranties" is
  // deliberately excluded: it also heads survival, conditions and non-reliance
  // provisions, and document-order selection then binds whichever comes first.
  ['REPRESENTATIONS', /\brepresentations? and warranties\s+of\b|\brepresents? and warrants?\b/i],
  ['INTERIM_OPERATING', /\bconduct of (?:the )?business\b/i],
  ['NO_SHOP', /\b(?:no solicitation|acquisition proposals?|takeover proposals?)\b/i],
  ['DNO_INDEMNIFICATION', /\b(?:indemnification|directors? and officers? insurance)\b/i],
  ['NO_OTHER_REPS_FRAUD', /\b(?:no other representations?|non-reliance|fraud)\b/i],
  ['ANTITRUST_REGULATORY', /\b(?:antitrust|HSR Act|regulatory approvals?|governmental approvals?)\b/i],
  ['APPRAISAL_DISSENTERS_RIGHTS', /\b(?:appraisal|dissenters?) rights?\b/i],
  ['CAPITALISATION', /\bcapitali[sz]ation\b/i],
  ['CONSIDERATION', /\b(?:merger consideration|conversion of (?:company )?(?:stock|shares)|exchange of certificates)\b/i],
  ['DIVIDENDS', /\bdividends?\b/i],
  ['FINANCING_COVENANTS', /\b(?:financing|debt commitment)\b/i],
  ['GUARANTY_FINANCING_PARTY', /\b(?:guaranty|financing sources?)\b/i],
  ['MATERIAL_CONTRACTS', /\bmaterial contracts?\b/i],
  ['MERGER_STRUCTURE_CLOSING', /\b(?:the merger|closing|effective time)\b/i],
  ['MISC_BOILERPLATE', /\b(?:governing law|notices|assignment|entire agreement|severability|counterparts)\b/i],
  ['PROXY_MEETING', /\b(?:proxy statement|stockholders? meeting|shareholders? meeting)\b/i],
  ['SPECIFIC_PERFORMANCE_REMEDIES', /\b(?:specific performance|specific enforcement|equitable relief)\b/i],
  ['TAX_MATTERS', /\b(?:tax matters?|tax treatment|transfer taxes?)\b/i],
  ['TERMINATION_FEE', /\b(?:termination fee|fees and expenses)\b/i],
]);

const SELECTED_FOCUS_KINDS = new Set([
  'PARAGRAPH',
  'SENTENCE',
  'CHAPEAU',
  'LIMB',
  'QUALIFICATION',
]);

function compareNodes(left, right) {
  return left.extent_span.start_byte - right.extent_span.start_byte
    || left.extent_span.end_byte - right.extent_span.end_byte
    || left.node_occurrence_id.localeCompare(right.node_occurrence_id);
}

function deriveFocusNodeIds(index) {
  const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const hasSelectedDescendant = (node) => {
    const queue = [...node.child_node_occurrence_ids];
    const seen = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (seen.has(id)) throw new TypeError('source node cycle');
      seen.add(id);
      const child = byId.get(id);
      if (!child) throw new TypeError(`missing source node ${id}`);
      if (SELECTED_FOCUS_KINDS.has(child.node_kind)) return true;
      queue.push(...child.child_node_occurrence_ids);
    }
    return false;
  };
  return index.nodes
    .filter((node) => SELECTED_FOCUS_KINDS.has(node.node_kind)
      || (node.node_kind === 'SECTION' && !hasSelectedDescendant(node)))
    .sort(compareNodes)
    .map((node) => node.node_occurrence_id);
}

function deriveSemanticPolicy(basePolicy, index, indexPath, indexBytes) {
  const policy = structuredClone(basePolicy);
  const focusNodeIds = deriveFocusNodeIds(index);
  const referenceCounts = new Map();
  for (const node of index.nodes) {
    if (node.reference === null) continue;
    referenceCounts.set(node.reference, (referenceCounts.get(node.reference) || 0) + 1);
  }
  const referenceInventory = index.annotations
    .filter((annotation) => annotation.annotation_kind === 'SECTION_REFERENCE')
    .reduce((counts, annotation) => {
      const candidates = referenceCounts.get(annotation.value) || 0;
      counts.annotation_count += 1;
      if (candidates === 0) counts.unresolved_no_target += 1;
      else if (candidates === 1) counts.resolved_unique += 1;
      else counts.ambiguous_multiple_targets += 1;
      return counts;
    }, {
      annotation_count: 0,
      resolved_unique: 0,
      unresolved_no_target: 0,
      ambiguous_multiple_targets: 0,
    });
  const definitionCounts = new Map();
  for (const annotation of index.annotations.filter((entry) => entry.annotation_kind === 'DEFINED_TERM_DEFINITION')) {
    definitionCounts.set(annotation.value, (definitionCounts.get(annotation.value) || 0) + 1);
  }
  const definitionUseInventory = index.annotations
    .filter((annotation) => annotation.annotation_kind === 'DEFINED_TERM_USE')
    .reduce((counts, annotation) => {
      const candidates = definitionCounts.get(annotation.value) || 0;
      counts.uses += 1;
      if (candidates === 1) counts.resolved_unique += 1;
      else if (candidates > 1) counts.ambiguous_multiple += 1;
      return counts;
    }, {
      uses: 0,
      resolved_unique: 0,
      ambiguous_multiple: 0,
    });
  const definitionInventory = {
    definitions: [...definitionCounts.values()].reduce((sum, count) => sum + count, 0),
    ...definitionUseInventory,
  };
  policy.input_contract.exact_agreement_count = 1;
  policy.input_contract.agreement_order = [index.source_binding.agreement_id];
  policy.input_contract.agreement_indexes = [{
    deal: index.source_binding.deal,
    agreement_id: index.source_binding.agreement_id,
    agreement_index_id: index.agreement_index_id,
    path: indexPath,
    byte_length: indexBytes.length,
    sha256: sha256Hex(indexBytes),
    canonical_text_sha256: index.source_binding.canonical_text_sha256,
    structural_policy_digest: index.structural_policy.policy_digest,
    focus_count: focusNodeIds.length,
    m2_ambiguity_count: index.ambiguities.length,
  }];
  policy.input_contract.capture_fixture_bindings = [];
  policy.fixture_scope_rules = [];
  policy.reference_resolution_contract.per_agreement_expected = [{
    agreement_id: index.source_binding.agreement_id,
    ...referenceInventory,
  }];
  policy.definition_resolution_contract.per_agreement_expected = [{
    agreement_id: index.source_binding.agreement_id,
    ...definitionInventory,
  }];
  if (policy.input_contract.expected_totals) {
    policy.input_contract.expected_totals.focus_count = focusNodeIds.length;
    policy.input_contract.expected_totals.m2_structure_ambiguity_count = index.ambiguities.length;
  }
  policy.bound_experiment = {
    experiment_id: `M7_ADDITIVE_${index.source_binding.agreement_id}`,
    agreement_id: index.source_binding.agreement_id,
    state: 'REPORT_ONLY_NO_MODEL',
  };
  delete policy.policy_digest;
  policy.policy_digest = sha256Hex(Buffer.from(canonicalJson(policy), 'utf8'));
  return { policy, focusNodeIds };
}

function sectionText(index, node) {
  const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8');
  return bytes.subarray(node.extent_span.start_byte, node.extent_span.end_byte).toString('utf8');
}

function descendants(index, node) {
  const byId = new Map(index.nodes.map((entry) => [entry.node_occurrence_id, entry]));
  const result = [];
  const queue = [...node.child_node_occurrence_ids];
  while (queue.length > 0) {
    const child = byId.get(queue.shift());
    if (!child) continue;
    result.push(child);
    queue.push(...child.child_node_occurrence_ids);
  }
  return result.sort(compareNodes);
}

function sectionHeading(index, section) {
  const byId = new Map(index.nodes.map((entry) => [entry.node_occurrence_id, entry]));
  const heading = section.child_node_occurrence_ids.map((id) => byId.get(id))
    .find((node) => node?.node_kind === 'HEADING');
  return heading ? sectionText(index, heading) : '';
}

// How the authored unit was chosen, so a filtered pick and a fallback pick are
// never indistinguishable downstream:
//   AUTHORED_UNIT_MATCH      a unit inside the container matched the family
//   HEADING_MATCH            the container had no authored units; it stands alone
//   DOCUMENT_ORDER_FALLBACK  units existed, none matched, first one taken
const SELECTION_MODES = Object.freeze({
  AUTHORED_UNIT_MATCH: 'AUTHORED_UNIT_MATCH',
  HEADING_MATCH: 'HEADING_MATCH',
  DOCUMENT_ORDER_FALLBACK: 'DOCUMENT_ORDER_FALLBACK',
});

// Article headings are searched for this family only. Every other family keeps
// section-heading matching until it earns its own rule: the article backstop is
// broad, and applied generally it bound SkyWater CONSIDERATION to an
// exchange-agent mechanic sitting under an "exchange of certificates" article.
const ARTICLE_MATCH_FAMILIES = new Set(['REPRESENTATIONS']);

// The substantive organisation and existence representation — duly organised or
// incorporated, validly existing, in good standing. It is the first real
// representation the Company makes, and unlike the disclosure chapeau above it
// it actually states something. All seven agreements carry one.
const ORGANISATION_EXISTENCE = /\b(?:duly (?:organi[sz]ed|incorporated|formed)|validly existing|good standing)\b/i;

// The no-conflicts representation, recognised by its operative formula rather
// than by a heading. Ben's ruling, 2026-08-12: more is going on in this rep than
// in organisation and existence, so it carries more comparison signal.
//
// Heading matching was tried and is not usable: "Noncontravention", "No
// Violations" and "Non-Contravention of Government Contracts" head provisions
// that are respectively an authority rep, a governmental-filings rep and a
// niche government-contracts rep. The formula is what identifies the rep --
// execution and delivery, negated, followed by the conflict verbs.
const NO_CONFLICTS_EXECUTION = /\bexecution,?\s+(?:and\s+)?deliver/i;
const NO_CONFLICTS_NEGATION = /\b(?:do(?:es)? not|will not|none of)\b/i;
const NO_CONFLICTS_EFFECT = /\b(?:conflict|violate|contravene|breach|default)\b/i;

function statesNoConflicts(text) {
  return NO_CONFLICTS_EXECUTION.test(text)
    && NO_CONFLICTS_NEGATION.test(text)
    && NO_CONFLICTS_EFFECT.test(text);
}

const REVIEW_REASONS = Object.freeze({
  CHAPEAU_CONTEXT_UNLINKED: 'CHAPEAU_CONTEXT_UNLINKED',
  DISCLOSURE_CHAPEAU_ONLY: 'DISCLOSURE_CHAPEAU_ONLY',
});

// The nearest CHAPEAU inside the same container that opens at or before the
// selected unit. Nearest rather than first, so a nested chapeau governs in
// preference to the article-level one.
function governingChapeau(index, container, selected) {
  return descendants(index, container)
    .filter((node) => node.node_kind === 'CHAPEAU')
    // A node never governs itself. An operative rule can be a chapeau in its own
    // right -- metsera states no-conflicts as a chapeau introducing enumerated
    // limbs -- and it still sits under the article's disclosure chapeau.
    .filter((node) => node.node_occurrence_id !== selected.node_occurrence_id)
    .filter((node) => node.extent_span.start_byte <= selected.extent_span.start_byte)
    .sort(compareNodes)
    .pop() ?? null;
}

// One authored sentence is one legal unit. A container such as
// "(a) Organization, Good Standing and Qualification. The Company is a
// corporation duly organized… The Partnership is a limited partnership…"
// states several representations, and modiv states three about three different
// entities. Emitting the container as one claim keeps only the first and drops
// the rest, and puts the sub-heading at the front of the displayed rule.
//
// So the container is evidence and context; each sentence inside it is a rule.
// The sub-heading stays reachable through the container binding and never
// appears as a rule. A container with no sentence children is its own unit.
// Units are filtered by the same test that selected the container, because a
// container can be wider than the provision that matched it. TopBuild's
// organisation limb runs on into an MAE carve-out and an "Affiliate" definition;
// unfiltered, those become representation rows, which is plainly wrong. Where
// the filter empties the set the sentences are kept as they are, so a container
// is never reduced to nothing.
function authoredUnitsWithin(index, node, statesTheRule) {
  const sentences = descendants(index, node)
    .filter((child) => child.node_kind === 'SENTENCE')
    .filter((child) => child.extent_span.end_byte - child.extent_span.start_byte >= 40)
    .sort(compareNodes);
  if (sentences.length === 0) return { units: [node], setAside: [] };
  const onTopic = statesTheRule
    ? sentences.filter((child) => statesTheRule(sectionText(index, child)))
    : [];
  if (onTopic.length === 0) return { units: sentences, setAside: [] };
  const kept = new Set(onTopic.map((child) => child.node_occurrence_id));
  // Everything the filter excluded is named, not merely absent. redhat's
  // container bundles the authority, enforceability, board-approval and
  // governmental-consents representations alongside no-conflicts, and a reader
  // of this output must be able to see that they were set aside rather than
  // that they were never there.
  return {
    units: onTopic,
    setAside: sentences.filter((child) => !kept.has(child.node_occurrence_id)),
  };
}

function representativeLegalUnit(index, section, familyKey, matcher) {
  const allCandidates = descendants(index, section)
    .filter((node) => SELECTED_FOCUS_KINDS.has(node.node_kind))
    .filter((node) => node.extent_span.end_byte - node.extent_span.start_byte >= 40);
  if (allCandidates.length === 0) return { node: section, mode: SELECTION_MODES.HEADING_MATCH };
  if (familyKey === 'MAE_DEFINITION') {
    const definition = allCandidates.find((node) => /[“\"](?:Company |Parent )?Material Adverse Effect[”\"]\s+means\b/i.test(sectionText(index, node)));
    if (definition) return { node: definition, mode: SELECTION_MODES.AUTHORED_UNIT_MATCH };
  }
  if (familyKey === 'KEY_DEFINED_TERMS') {
    const definition = allCandidates.find((node) => /[“\"][^”\"]+[”\"]\s+(?:means|has the meaning)\b/i.test(sectionText(index, node)));
    if (definition) return { node: definition, mode: SELECTION_MODES.AUTHORED_UNIT_MATCH };
  }
  if (familyKey === 'REPRESENTATIONS') {
    const noConflicts = allCandidates.find((node) => statesNoConflicts(sectionText(index, node)));
    if (noConflicts) return { node: noConflicts, mode: SELECTION_MODES.AUTHORED_UNIT_MATCH };
  }
  const matchingCandidates = matcher
    ? allCandidates.filter((node) => matcher.test(sectionText(index, node)))
    : [];
  const matched = matchingCandidates.length > 0;
  const candidates = matched ? matchingCandidates : allCandidates;
  const mode = matched ? SELECTION_MODES.AUTHORED_UNIT_MATCH : SELECTION_MODES.DOCUMENT_ORDER_FALLBACK;
  for (const kind of ['SENTENCE', 'PARAGRAPH', 'LIMB', 'CHAPEAU', 'QUALIFICATION']) {
    const match = candidates.find((node) => node.node_kind === kind);
    if (match) return { node: match, mode };
  }
  return { node: candidates[0], mode };
}

function selectFamilySections(index, familyOrder) {
  const sections = index.nodes
    .filter((node) => node.node_kind === 'SECTION' && node.extent_span.end_byte - node.extent_span.start_byte >= 100)
    .sort(compareNodes)
    .map((node) => ({ node, heading: sectionHeading(index, node), text: sectionText(index, node) }));
  // Article headings are a backstop, never a preference. Agreements split into
  // two shapes: some attribute at section level ("Representations and Warranties
  // of the Company."), others carry the attribution on the article and leave
  // plain topic headings beneath it. Scanning sections alone loses the second
  // shape entirely, silently, as INPUT_NOT_AVAILABLE. Sections still win wherever
  // one matches, so no family gives up a binding it already had.
  const articles = index.nodes
    .filter((node) => node.node_kind === 'ARTICLE' && node.extent_span.end_byte - node.extent_span.start_byte >= 100)
    .sort(compareNodes)
    .map((node) => ({ node, heading: sectionHeading(index, node), text: sectionText(index, node) }));
  const matcherByFamily = new Map(FAMILY_MATCHERS);
  return familyOrder.map((family) => {
    const matcher = matcherByFamily.get(family.family_key);
    let match = matcher ? sections.find((entry) => matcher.test(entry.heading)) : null;
    if (!match && ['MAE_DEFINITION', 'KEY_DEFINED_TERMS'].includes(family.family_key)) {
      match = sections.find((entry) => /\b(?:certain )?definitions?\b/i.test(entry.heading)
        && (family.family_key !== 'MAE_DEFINITION' || /\bMaterial Adverse Effect\b/i.test(entry.text)));
    }
    if (!match && matcher && ARTICLE_MATCH_FAMILIES.has(family.family_key)) {
      match = articles.find((entry) => matcher.test(entry.heading));
    }
    const statesTheRule = family.family_key === 'REPRESENTATIONS'
      ? statesNoConflicts
      : (text) => Boolean(matcher) && matcher.test(text);
    const selected = match ? representativeLegalUnit(index, match.node, family.family_key, matcher) : null;
    const sourceNode = selected?.node ?? null;
    // The governing chapeau of the container is inherited context, not the
    // proposition itself. It qualifies everything beneath it ("Except as
    // disclosed…"), so a child sentence read without it can be read too widely.
    const chapeau = sourceNode
      ? governingChapeau(index, match.node, sourceNode)
      : null;
    const selectedUnits = sourceNode
      ? authoredUnitsWithin(index, sourceNode, statesTheRule)
      : { units: [], setAside: [] };
    let reviewReason = null;
    if (sourceNode && sourceNode.node_kind === 'CHAPEAU' && !statesTheRule(sectionText(index, sourceNode))) {
      // A disclosure chapeau states a carve-out, never a rule, so it cannot
      // stand as a complete comparison proposition. A chapeau that does state
      // the family's rule is a different thing: metsera writes its no-conflicts
      // representation as a chapeau introducing enumerated limbs.
      reviewReason = REVIEW_REASONS.DISCLOSURE_CHAPEAU_ONLY;
    } else if (sourceNode && family.family_key === 'REPRESENTATIONS' && !chapeau) {
      reviewReason = REVIEW_REASONS.CHAPEAU_CONTEXT_UNLINKED;
    }
    return {
      family_key: family.family_key,
      wave: family.wave,
      state: match ? 'RECORDED_INPUT_BINDING' : 'INPUT_NOT_AVAILABLE',
      selection_mode: selected?.mode ?? null,
      source_node_occurrence_id: sourceNode?.node_occurrence_id ?? null,
      source_span: sourceNode ? structuredClone(sourceNode.extent_span) : null,
      source_reference: sourceNode?.reference ?? match?.node.reference ?? null,
      context_chapeau_node_occurrence_id: chapeau?.node_occurrence_id ?? null,
      context_chapeau_span: chapeau ? structuredClone(chapeau.extent_span) : null,
      authored_units: selectedUnits.units.map((unit) => ({
        node_occurrence_id: unit.node_occurrence_id,
        node_kind: unit.node_kind,
        source_span: structuredClone(unit.extent_span),
        source_reference: unit.reference ?? sourceNode.reference ?? match?.node.reference ?? null,
      })),
      set_aside_units: selectedUnits.setAside.map((unit) => ({
        node_occurrence_id: unit.node_occurrence_id,
        node_kind: unit.node_kind,
        source_span: structuredClone(unit.extent_span),
        reason: 'DOES_NOT_STATE_THE_BOUND_RULE',
      })),
      review_required_reason: reviewReason,
    };
  });
}

function makeEvidenceEdge(agreementId, analysisClaimId, node) {
  const unsigned = {
    analysis_claim_id: analysisClaimId,
    evidence_role: 'OPERATIVE_TEXT',
    ordinal: 0,
    source_bytes_match: true,
    source_node_occurrence_id: node.node_occurrence_id,
    source_span: structuredClone(node.extent_span),
    span_provenance: {
      mode: 'M7_EXACT_M2_NODE_EXTENT',
      structure_revision_id: node.structure_revision_id,
    },
    stage_evidence_ids: {
      proposal_claim_evidence_id: null,
      resolution_claim_evidence_id: null,
      validation_claim_evidence_id: null,
      write_set_claim_evidence_id: null,
    },
  };
  return {
    schema_version: 'AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1',
    analysis_evidence_edge_id: contentId('AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1', {
      agreement_id: agreementId,
      ...unsigned,
    }),
    ...unsigned,
  };
}

function buildBaseAnalysis(index, contextCompilation, familyInputs) {
  const nodesById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const claims = [];
  const evidenceEdges = [];
  const boundUnits = familyInputs
    .filter((entry) => entry.state === 'RECORDED_INPUT_BINDING')
    .flatMap((entry) => entry.authored_units.map((unit) => ({ input: entry, unit })));
  for (const { input, unit } of boundUnits) {
    const node = nodesById.get(unit.node_occurrence_id);
    // The rule is the sentence. The container it sits in carries the
    // sub-heading and is recorded as context, so the heading stays traceable
    // without ever being read as part of the rule.
    const rawValue = sectionText(index, node);
    const occurrencePayload = {
      agreement_id: index.source_binding.agreement_id,
      family: input.family_key,
      source_node_occurrence_id: node.node_occurrence_id,
      claim_definition_key: `M7_DETERMINISTIC_${input.family_key}_SOURCE_PROVISION`,
    };
    const claimOccurrenceId = contentId('M7_DETERMINISTIC_CLAIM_OCCURRENCE/V1', occurrencePayload);
    const analysisClaimId = contentId('AGREEMENT_ANALYSIS_CLAIM/V1', occurrencePayload);
    const evidence = makeEvidenceEdge(index.source_binding.agreement_id, analysisClaimId, node);
    evidenceEdges.push(evidence);
    claims.push({
      schema_version: 'AGREEMENT_ANALYSIS_CLAIM/V1',
      analysis_claim_id: analysisClaimId,
      agreement_id: index.source_binding.agreement_id,
      deal: index.source_binding.deal,
      family: input.family_key,
      claim_definition_key: occurrencePayload.claim_definition_key,
      claim_definition_version: 1,
      claim_occurrence_id: claimOccurrenceId,
      complete_proposition: null,
      complete_proposition_claim_revision_id: null,
      dependency_edge_ids: [],
      diagnostic_codes: [],
      evidence_edge_ids: [evidence.analysis_evidence_edge_id],
      identity_state: 'M7_DETERMINISTIC_NO_LEGACY_BASELINE',
      legacy_capacity: null,
      legacy_party: null,
      legacy_resolution_state: 'PRESENT',
      legacy_claim_revision: {
        schema_version: 'CLAIM_REVISION/V1',
        claim_occurrence_id: claimOccurrenceId,
        claim_definition_key: occurrencePayload.claim_definition_key,
        claim_definition_version: 1,
        raw_value: rawValue,
        canonical_value: true,
        attributes: {
          assertion_kind: 'M7_DETERMINISTIC_SOURCE_PROVISION',
          source_reference: unit.source_reference ?? input.source_reference,
          container_node_occurrence_id: input.source_node_occurrence_id,
          context_chapeau_node_occurrence_id: input.context_chapeau_node_occurrence_id,
          answer_provenance: { tag: 'DETERMINISTIC_NO_MODEL' },
        },
        taxonomy_codes: { assertion_kind: 'M7_DETERMINISTIC_SOURCE_PROVISION' },
        applicability: null,
        day_basis: null,
        unit: null,
        scope: null,
      },
      projection_block_reason: 'M5_COMPOUND_ADAPTER_PENDING',
      projection_eligibility: 'BLOCKED',
      proposition_validation_state: 'M5_PENDING',
      required_role_schema_id: null,
      role_ids: [],
      section_reference: unit.source_reference ?? input.source_reference,
      source_node_occurrence_ids: [node.node_occurrence_id],
      source_run_identifier: 'M7_DETERMINISTIC_NO_PROVIDER',
      stage_claim_revision_ids: {
        proposal_claim_revision_id: null,
        resolution_claim_revision_id: null,
        validation_claim_revision_id: null,
        write_set_claim_revision_id: null,
        proposal_identity_state: 'NO_LEGACY_BASELINE',
        proposal_identity_reason: 'ADDITIVE_AGREEMENT',
        stage_identity_disposition: 'NO_LEGACY_BASELINE',
      },
    });
  }
  const payload = {
    schema_version: 'AGREEMENT_ANALYSIS/V1',
    agreement_id: index.source_binding.agreement_id,
    agreement_index_binding: {
      agreement_index_id: index.agreement_index_id,
    },
    context_compilation_binding: {
      context_compilation_id: contextCompilation.context_compilation_id,
    },
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    claims,
    evidence_edges: evidenceEdges,
    dependency_edges: [],
    claim_aliases: [],
    claim_equivalences: [],
    diagnostics: [],
    proposition_validation_results: [],
    role_provenance: [],
    roles: [],
    requested_scope: { mode: 'M7_ADDITIVE_ALL_REGISTERED_FAMILIES' },
    legacy_resolution_bindings: [],
    repository_round_trip_proof: { state: 'NO_LEGACY_BASELINE' },
    analysis_policy_binding: { state: 'M7_DETERMINISTIC_REPORT_ONLY' },
    analysis_task_binding: { state: 'M7_ADDITIVE' },
    counts: {
      claims: claims.length,
      evidence_edges: evidenceEdges.length,
      dependency_edges: 0,
    },
  };
  payload.agreement_analysis_id = contentId('AGREEMENT_ANALYSIS/V1', payload);
  return payload;
}

function ambiguousNodeIds(index) {
  const nodeIds = new Set(index.nodes.map((node) => node.node_occurrence_id));
  const result = new Set();
  const visit = (value) => {
    if (typeof value === 'string' && nodeIds.has(value)) result.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  index.ambiguities.forEach(visit);
  return result;
}

function ambiguityTouchesProposition(index, proposition) {
  const ambiguous = ambiguousNodeIds(index);
  if (ambiguous.size === 0) return false;
  const byId = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const isRelated = (sourceId, ambiguousId) => {
    let node = byId.get(ambiguousId);
    while (node) {
      if (node.node_occurrence_id === sourceId) return true;
      node = byId.get(node.parent_node_occurrence_id);
    }
    node = byId.get(sourceId);
    while (node) {
      if (node.node_occurrence_id === ambiguousId) return true;
      node = byId.get(node.parent_node_occurrence_id);
    }
    return false;
  };
  return proposition.source_node_occurrence_ids.some((sourceId) =>
    [...ambiguous].some((ambiguousId) => isRelated(sourceId, ambiguousId)));
}

function applyAmbiguityGate(index, propositions) {
  return propositions.map((proposition) => {
    if (!ambiguityTouchesProposition(index, proposition)) return proposition;
    const unsigned = structuredClone(proposition);
    delete unsigned.compound_proposition_id;
    unsigned.proposition_validation_state = 'MISSING_REQUIRED_ROLE';
    unsigned.missing_required_roles = [...new Set([
      ...unsigned.missing_required_roles,
      'UNAMBIGUOUS_SOURCE_STRUCTURE',
    ])];
    unsigned.projection_eligibility = 'BLOCKED';
    unsigned.diagnostic_codes = [...new Set([
      ...unsigned.diagnostic_codes,
      'M2_STRUCTURE_AMBIGUITY_DEPENDENCY',
    ])];
    return {
      schema_version: unsigned.schema_version,
      compound_proposition_id: contentId(unsigned.schema_version, unsigned),
      ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
    };
  });
}

// A unit reached by document order was not chosen because it states the family;
// it was chosen because it came first. That is a reviewable partial, never a
// normal comparison row. Same shape as the ambiguity gate above.
// Keyed by family plus node, never node alone: two families can legitimately
// bind the same authored unit, and one of them reaching it by document order
// must not drag the other into review.
const GATE_REASONS = Object.freeze({
  [SELECTION_MODES.DOCUMENT_ORDER_FALLBACK]: {
    missing_role: 'FAMILY_MATCHED_AUTHORED_UNIT',
    diagnostic: 'M7_DOCUMENT_ORDER_FALLBACK_SELECTION',
  },
  [REVIEW_REASONS.CHAPEAU_CONTEXT_UNLINKED]: {
    missing_role: 'GOVERNING_CHAPEAU_CONTEXT',
    diagnostic: 'M7_CHAPEAU_CONTEXT_UNLINKED',
  },
  [REVIEW_REASONS.DISCLOSURE_CHAPEAU_ONLY]: {
    missing_role: 'SUBSTANTIVE_LEGAL_UNIT',
    diagnostic: 'M7_DISCLOSURE_CHAPEAU_ONLY',
  },
});

function gateKey(familyKey, nodeId) {
  return `${familyKey} ${nodeId}`;
}

function applySelectionModeGate(familyInputs, propositions) {
  const gated = new Map();
  for (const input of familyInputs) {
    const reason = input.selection_mode === SELECTION_MODES.DOCUMENT_ORDER_FALLBACK
      ? SELECTION_MODES.DOCUMENT_ORDER_FALLBACK
      : input.review_required_reason;
    if (!reason || !GATE_REASONS[reason]) continue;
    gated.set(gateKey(input.family_key, input.source_node_occurrence_id), GATE_REASONS[reason]);
  }
  if (gated.size === 0) return propositions;
  return propositions.map((proposition) => {
    const hit = proposition.source_node_occurrence_ids
      .map((id) => gated.get(gateKey(proposition.family_key, id)))
      .find(Boolean);
    if (!hit) return proposition;
    const unsigned = structuredClone(proposition);
    delete unsigned.compound_proposition_id;
    unsigned.proposition_validation_state = 'MISSING_REQUIRED_ROLE';
    unsigned.missing_required_roles = [...new Set([
      ...unsigned.missing_required_roles,
      hit.missing_role,
    ])];
    unsigned.projection_eligibility = 'BLOCKED';
    unsigned.diagnostic_codes = [...new Set([
      ...unsigned.diagnostic_codes,
      hit.diagnostic,
    ])];
    return {
      schema_version: unsigned.schema_version,
      compound_proposition_id: contentId(unsigned.schema_version, unsigned),
      ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
    };
  });
}

module.exports = {
  FAMILY_MATCHERS,
  REVIEW_REASONS,
  SELECTION_MODES,
  applyAmbiguityGate,
  applySelectionModeGate,
  buildBaseAnalysis,
  deriveFocusNodeIds,
  deriveSemanticPolicy,
  selectFamilySections,
  statesNoConflicts,
};
