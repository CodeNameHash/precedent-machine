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
  ['REPRESENTATIONS', /\brepresentations? and warranties\b/i],
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

function representativeLegalUnit(index, section, familyKey) {
  const candidates = descendants(index, section)
    .filter((node) => SELECTED_FOCUS_KINDS.has(node.node_kind))
    .filter((node) => node.extent_span.end_byte - node.extent_span.start_byte >= 40);
  if (candidates.length === 0) return section;
  if (familyKey === 'MAE_DEFINITION') {
    const definition = candidates.find((node) => /[“\"](?:Company |Parent )?Material Adverse Effect[”\"]\s+means\b/i.test(sectionText(index, node)));
    if (definition) return definition;
  }
  if (familyKey === 'KEY_DEFINED_TERMS') {
    const definition = candidates.find((node) => /[“\"][^”\"]+[”\"]\s+(?:means|has the meaning)\b/i.test(sectionText(index, node)));
    if (definition) return definition;
  }
  for (const kind of ['SENTENCE', 'PARAGRAPH', 'LIMB', 'CHAPEAU', 'QUALIFICATION']) {
    const match = candidates.find((node) => node.node_kind === kind);
    if (match) return match;
  }
  return candidates[0];
}

function selectFamilySections(index, familyOrder) {
  const sections = index.nodes
    .filter((node) => node.node_kind === 'SECTION' && node.extent_span.end_byte - node.extent_span.start_byte >= 100)
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
    const sourceNode = match ? representativeLegalUnit(index, match.node, family.family_key) : null;
    return {
      family_key: family.family_key,
      wave: family.wave,
      state: match ? 'RECORDED_INPUT_BINDING' : 'INPUT_NOT_AVAILABLE',
      source_node_occurrence_id: sourceNode?.node_occurrence_id ?? null,
      source_span: sourceNode ? structuredClone(sourceNode.extent_span) : null,
      source_reference: sourceNode?.reference ?? match?.node.reference ?? null,
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
  for (const input of familyInputs.filter((entry) => entry.state === 'RECORDED_INPUT_BINDING')) {
    const node = nodesById.get(input.source_node_occurrence_id);
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
          source_reference: input.source_reference,
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
      section_reference: input.source_reference,
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

module.exports = {
  FAMILY_MATCHERS,
  applyAmbiguityGate,
  buildBaseAnalysis,
  deriveFocusNodeIds,
  deriveSemanticPolicy,
  selectFamilySections,
};
