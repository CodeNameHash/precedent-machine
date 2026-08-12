'use strict';

const crypto = require('node:crypto');
const { contentId } = require('./canonical-bytes');

const ACTOR_REQUIRED = new Set([
  'ANTITRUST_REGULATORY',
  'CLOSING_CONDITIONS',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING',
  'MATERIAL_CONTRACTS',
  'MERGER_STRUCTURE_CLOSING',
  'NO_OTHER_REPS_FRAUD',
  'NO_SHOP',
  'PROXY_MEETING',
  'REPRESENTATIONS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION',
  'TERMINATION_FEE',
]);

const TIMING_PATTERN = /(?:TRIGGER|TIME|DATE|DAY|PERIOD|DEADLINE|WINDOW|DURATION|CURE|EFFECTIVE)/i;
const ACTOR_PATTERN = /(?:ACTOR|PARTY|CAPACITY|OBLIGOR|HOLDER|PAYER|PAYEE|BENEFICIARY|ISSUER|COMPANY|PARENT|BUYER|TARGET|GUARANTOR|CLAIMANT|RESPONDENT|FILER)/i;
const QUALIFICATION_PATTERN = /(?:EXCEPT|PROVIDED|QUALIF|STANDARD|THRESHOLD|LIMIT|CAP|CONSENT|KNOWLEDGE|MATERIAL|EFFORT|CONDITION)/i;

function isPresent(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableUnique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.filter(isPresent)) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function semanticAttributes(claim) {
  const attributes = structuredClone(claim.legacy_claim_revision?.attributes || {});
  delete attributes.answer_provenance;
  delete attributes.assertion_kind;
  return attributes;
}

function valuesMatching(object, pattern, prefix = '') {
  if (!object || typeof object !== 'object') return [];
  const result = [];
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!isPresent(value)) continue;
    if (pattern.test(path)) result.push({ field: path, value: structuredClone(value) });
  }
  return result;
}

function evidenceFor(baseAnalysis, claim) {
  const ids = new Set(claim.evidence_edge_ids || []);
  return baseAnalysis.evidence_edges
    .filter((edge) => ids.has(edge.analysis_evidence_edge_id))
    .sort((a, b) => a.ordinal - b.ordinal || a.analysis_evidence_edge_id.localeCompare(b.analysis_evidence_edge_id));
}

function groupClaims(baseAnalysis, familyKey) {
  const groups = new Map();
  for (const claim of baseAnalysis.claims.filter((candidate) => candidate.family === familyKey)) {
    const evidence = evidenceFor(baseAnalysis, claim);
    const nodeIds = stableUnique(evidence.map((edge) => edge.source_node_occurrence_id)).sort();
    const groupKey = nodeIds.length > 0 ? nodeIds.join('+') : `NO_SOURCE:${claim.analysis_claim_id}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { groupKey, nodeIds, claims: [], evidence: [] });
    const group = groups.get(groupKey);
    group.claims.push(claim);
    group.evidence.push(...evidence);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    claims: group.claims.sort((a, b) => a.analysis_claim_id.localeCompare(b.analysis_claim_id)),
    evidence: [...new Map(group.evidence.map((edge) => [edge.analysis_evidence_edge_id, edge])).values()]
      .sort((a, b) => a.source_span.start_byte - b.source_span.start_byte || a.analysis_evidence_edge_id.localeCompare(b.analysis_evidence_edge_id)),
  })).sort((a, b) => a.groupKey.localeCompare(b.groupKey));
}

function sourceRecords(index, nodeIds) {
  const nodeById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8');
  return nodeIds.map((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) return { node_occurrence_id: nodeId, validation_state: 'MISSING_SOURCE_NODE' };
    const span = node.extent_span;
    const textBytes = bytes.subarray(span.start_byte, span.end_byte);
    const textHash = sha256(textBytes);
    return {
      node_occurrence_id: nodeId,
      node_kind: node.node_kind,
      structure_revision_id: node.structure_revision_id,
      extent_span: structuredClone(span),
      text: textBytes.toString('utf8'),
      validation_state: textHash === span.text_sha256 ? 'EXACT_BYTES_VERIFIED' : 'SOURCE_HASH_MISMATCH',
    };
  });
}

function actorPhrases(index, nodeIds) {
  const nodeById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  const canonicalText = index.source_binding.canonical_text;
  const modalPattern = /(?:^|[.;:\n]\s*|\([a-z0-9ivx]+\)\s*)([^.;:\n]{1,220}?)\s+(shall|will|must|may|agrees?|acknowledges?|represents?|warrants?|has|have|is|are)\b/gmi;
  const windows = [];
  for (const nodeId of nodeIds) {
    let node = nodeById.get(nodeId);
    if (!node) continue;
    windows.push({
      node_occurrence_id: node.node_occurrence_id,
      start_byte: node.extent_span.start_byte,
      text: Buffer.from(canonicalText, 'utf8').subarray(node.extent_span.start_byte, node.extent_span.end_byte).toString('utf8'),
      provenance_kind: 'DIRECT',
    });
    let childStart = node.extent_span.start_byte;
    for (let depth = 0; depth < 4 && node.parent_node_occurrence_id; depth += 1) {
      node = nodeById.get(node.parent_node_occurrence_id);
      if (!node) break;
      const prefixStart = Math.max(node.extent_span.start_byte, childStart - 1200);
      const prefix = Buffer.from(canonicalText, 'utf8').subarray(prefixStart, childStart).toString('utf8');
      windows.push({
        node_occurrence_id: node.node_occurrence_id,
        start_byte: prefixStart,
        text: prefix,
        provenance_kind: 'INHERITED_FROM_ANCESTOR',
      });
      childStart = node.extent_span.start_byte;
    }
  }
  const candidates = [];
  for (const window of windows) {
    modalPattern.lastIndex = 0;
    let match;
    while ((match = modalPattern.exec(window.text)) !== null) {
      const phrase = match[1].trim().replace(/^[-–—,\s]+/, '');
      if (phrase.split(/\s+/).length < 2 || /^\d+$/.test(phrase)) continue;
      const phraseOffset = match.index + match[0].indexOf(match[1]) + match[1].indexOf(phrase);
      const startByte = window.start_byte + Buffer.byteLength(window.text.slice(0, phraseOffset), 'utf8');
      const endByte = startByte + Buffer.byteLength(phrase, 'utf8');
      candidates.push({
        value: phrase,
        modal: match[2],
        source_node_occurrence_id: window.node_occurrence_id,
        source_span: {
          coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
          start_byte: startByte,
          end_byte: endByte,
          text_sha256: sha256(Buffer.from(phrase, 'utf8')),
        },
        provenance_kind: window.provenance_kind,
      });
    }
  }
  return stableUnique(candidates);
}

function contextRecords(baseAnalysis, contextCompilation, claims) {
  const dependencyIds = new Set(claims.flatMap((claim) => claim.dependency_edge_ids || []));
  const dependencies = baseAnalysis.dependency_edges.filter((edge) => dependencyIds.has(edge.dependency_edge_id));
  const factById = new Map((contextCompilation.context_facts || []).map((fact) => [fact.context_fact_id, fact]));
  return dependencies
    .filter((edge) => edge.dependency_kind === 'CONTEXT_FACT')
    .map((edge) => ({ dependency_edge: edge, fact: factById.get(edge.target_id) || null }))
    .filter((entry) => entry.fact)
    .sort((a, b) => a.fact.source_span.start_byte - b.fact.source_span.start_byte || a.fact.context_fact_id.localeCompare(b.fact.context_fact_id));
}

function requiredRoles(familyKey, claims, actorValues, timingValues) {
  const roles = ['AUTHORED_SOURCE', 'LEGAL_EFFECT_OR_MECHANIC', 'MEMBER_FACTS'];
  if (ACTOR_REQUIRED.has(familyKey)) roles.push('ACTOR_OR_PARTIES');
  const needsTiming = timingValues.length > 0 || claims.some((claim) => {
    const legacy = claim.legacy_claim_revision || {};
    return /(?:DATE|DAY|PERIOD|DEADLINE|WINDOW|DURATION|CURE|TAIL_PERIOD)/i.test(claim.claim_definition_key)
      || TIMING_PATTERN.test(JSON.stringify(legacy.taxonomy_codes || {}))
      || valuesMatching(semanticAttributes(claim), TIMING_PATTERN).length > 0;
  });
  if (needsTiming) roles.push('TRIGGER_OR_TIMING');
  if (actorValues.length === 0 && ACTOR_REQUIRED.has(familyKey)) return roles;
  if (needsTiming && timingValues.length === 0) return roles;
  return roles;
}

function buildProposition(baseAnalysis, index, contextCompilation, familyPolicy, group) {
  const sources = sourceRecords(index, group.nodeIds);
  const context = contextRecords(baseAnalysis, contextCompilation, group.claims);
  const contextActorValues = context
    .filter((entry) => ACTOR_PATTERN.test(entry.fact.role))
    .map((entry) => ({ role: entry.fact.role, value: entry.fact.value, context_fact_id: entry.fact.context_fact_id }));
  const actorValues = stableUnique([
    ...group.claims.flatMap((claim) => [claim.legacy_party, claim.legacy_capacity]),
    ...group.claims.flatMap((claim) => valuesMatching(semanticAttributes(claim), ACTOR_PATTERN)),
    ...contextActorValues,
    ...actorPhrases(index, group.nodeIds),
  ]);
  const contextTimingValues = context
    .filter((entry) => TIMING_PATTERN.test(entry.fact.role))
    .map((entry) => ({ role: entry.fact.role, value: entry.fact.value, context_fact_id: entry.fact.context_fact_id }));
  const sourceTimingValues = sources
    .filter((source) => /\b(?:prior to|after|before|within|during|until|upon|when|as of|at any time|no later than|Business Day|calendar day|month|year|Effective Time|Closing Date|record date|deemed (?:given|received)|date and time)\b/i.test(source.text))
    .map((source) => ({
      value: source.text,
      source_node_occurrence_id: source.node_occurrence_id,
      source_span: source.extent_span,
      extraction_state: 'EXACT_AUTHORED_TRIGGER_OR_TIMING_CLAUSE',
    }));
  const memberTriggerValues = group.claims
    .filter((claim) => /TRIGGER/i.test(claim.claim_definition_key))
    .map((claim) => ({
      claim_definition_key: claim.claim_definition_key,
      raw_value: claim.legacy_claim_revision?.raw_value ?? null,
      canonical_value: claim.legacy_claim_revision?.canonical_value ?? null,
    }));
  const timingValues = stableUnique([...group.claims.flatMap((claim) => {
    const legacy = claim.legacy_claim_revision || {};
    return [
      legacy.applicability,
      legacy.day_basis,
      legacy.unit,
      ...valuesMatching(semanticAttributes(claim), TIMING_PATTERN),
    ];
  }), ...contextTimingValues, ...sourceTimingValues, ...memberTriggerValues]);
  const qualificationValues = stableUnique(group.claims.flatMap((claim) => [
    claim.legacy_claim_revision?.scope,
    ...valuesMatching(semanticAttributes(claim), QUALIFICATION_PATTERN),
  ]));
  const legalEffects = stableUnique(group.claims.map((claim) => ({
    claim_definition_key: claim.claim_definition_key,
    assertion_kind: claim.legacy_claim_revision?.attributes?.assertion_kind
      || claim.legacy_claim_revision?.taxonomy_codes?.assertion_kind
      || null,
  })));
  const memberFacts = group.claims.map((claim) => ({
    analysis_claim_id: claim.analysis_claim_id,
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_definition_key: claim.claim_definition_key,
    party: structuredClone(claim.legacy_party ?? null),
    capacity: claim.legacy_capacity ?? null,
    raw_value: structuredClone(claim.legacy_claim_revision?.raw_value ?? null),
    canonical_value: structuredClone(claim.legacy_claim_revision?.canonical_value ?? null),
    attributes: semanticAttributes(claim),
  }));
  const roles = {
    AUTHORED_SOURCE: sources,
    LEGAL_EFFECT_OR_MECHANIC: legalEffects,
    MEMBER_FACTS: memberFacts,
    ACTOR_OR_PARTIES: actorValues,
    TRIGGER_OR_TIMING: timingValues,
    QUALIFICATIONS: qualificationValues,
  };
  const required = requiredRoles(familyPolicy.family_key, group.claims, actorValues, timingValues);
  const missing = required.filter((role) => !isPresent(roles[role])
    || (role === 'AUTHORED_SOURCE' && roles[role].some((source) => source.validation_state !== 'EXACT_BYTES_VERIFIED'))
    || (role !== 'AUTHORED_SOURCE' && group.evidence.some((edge) => edge.source_bytes_match !== true)));
  const unsigned = {
    agreement_id: baseAnalysis.agreement_id,
    family_key: familyPolicy.family_key,
    family_policy_id: familyPolicy.family_policy_id,
    authored_unit_key: group.groupKey,
    member_analysis_claim_ids: group.claims.map((claim) => claim.analysis_claim_id),
    member_claim_occurrence_ids: group.claims.map((claim) => claim.claim_occurrence_id),
    claim_definition_keys: stableUnique(group.claims.map((claim) => claim.claim_definition_key)).sort(),
    source_node_occurrence_ids: group.nodeIds,
    source_evidence_edge_ids: group.evidence.map((edge) => edge.analysis_evidence_edge_id),
    context_fact_ids: context.map((entry) => entry.fact.context_fact_id),
    required_roles: required,
    roles,
    proposition_validation_state: missing.length === 0 ? 'COMPLETE' : 'MISSING_REQUIRED_ROLE',
    missing_required_roles: missing,
    projection_eligibility: missing.length === 0 ? 'M6_PENDING' : 'BLOCKED',
    diagnostic_codes: missing.length === 0 ? [] : ['MISSING_REQUIRED_ROLE'],
  };
  return {
    schema_version: 'STAGE_2Y_M5_COMPOUND_PROPOSITION/V1',
    compound_proposition_id: contentId('STAGE_2Y_M5_COMPOUND_PROPOSITION/V1', unsigned),
    ...unsigned,
  };
}

function policyForFamily(familyKey, wave) {
  const unsigned = {
    family_key: familyKey,
    wave,
    unit_rule: 'SMALLEST_AUTHORED_SOURCE_NODE_WITH_SHARED_GOVERNING_CONTEXT',
    member_rule: 'OLD_CLAIMS_ARE_FACT_MEMBERS_NOT_STANDALONE_COMPLETE_PROPOSITIONS',
    actor_rule: ACTOR_REQUIRED.has(familyKey) ? 'REQUIRED' : 'NOT_UNIVERSALLY_REQUIRED',
    timing_rule: 'REQUIRED_ONLY_WHEN_THE_CLAIM_DEFINITION_OR_AUTHORED_ATTRIBUTES_MAKE_TIMING_OR_TRIGGER_MATERIAL',
    qualification_rule: 'PRESERVE_WHEN_AUTHORED_NOT_UNIVERSALLY_REQUIRED',
    ambiguity_rule: 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION_AND_FLAG_THE_REASON',
    ownership_rule: 'ONE_SEMANTIC_OWNER_WITH_LINKED_CONSUMERS',
    product_treatment: familyKey === 'CAPITALISATION' ? 'PARKED_UNTIL_PRODUCT_STAGE_9F' : 'SHADOW_ONLY',
    ben_approval_id: 'BEN-M5-CORRECTION-2026-08-12',
    approval_state: 'BEN_APPROVED_AND_SEALED',
  };
  return {
    schema_version: 'STAGE_2Y_M5_FAMILY_SPECIFIC_POLICY/V1',
    family_policy_id: contentId('STAGE_2Y_M5_FAMILY_SPECIFIC_POLICY/V1', unsigned),
    ...unsigned,
  };
}

function adaptCompoundFamily(baseAnalysis, agreementIndex, contextCompilation, familyPolicy) {
  if (baseAnalysis?.schema_version !== 'AGREEMENT_ANALYSIS/V1') throw new TypeError('baseAnalysis must be AGREEMENT_ANALYSIS/V1');
  if (agreementIndex?.schema_version !== 'AGREEMENT_INDEX/V1') throw new TypeError('agreementIndex must be AGREEMENT_INDEX/V1');
  if (contextCompilation?.schema_version !== 'CONTEXT_COMPILATION/V1') throw new TypeError('contextCompilation must be CONTEXT_COMPILATION/V1');
  if (familyPolicy?.schema_version !== 'STAGE_2Y_M5_FAMILY_SPECIFIC_POLICY/V1') throw new TypeError('familyPolicy must be STAGE_2Y_M5_FAMILY_SPECIFIC_POLICY/V1');
  if (baseAnalysis.agreement_id !== agreementIndex.source_binding.agreement_id) throw new TypeError('agreement inputs do not match');
  const propositions = groupClaims(baseAnalysis, familyPolicy.family_key)
    .map((group) => buildProposition(baseAnalysis, agreementIndex, contextCompilation, familyPolicy, group));
  const memberLedger = propositions.flatMap((proposition) => proposition.member_analysis_claim_ids.map((analysisClaimId) => ({
    analysis_claim_id: analysisClaimId,
    compound_proposition_id: proposition.compound_proposition_id,
    disposition: proposition.proposition_validation_state === 'COMPLETE'
      ? 'ABSORBED_IN_COMPLETE_PROPOSITION'
      : 'MISSING_REQUIRED_ROLE',
    missing_required_roles: proposition.missing_required_roles,
  }))).sort((a, b) => a.analysis_claim_id.localeCompare(b.analysis_claim_id));
  const unsigned = {
    family_key: familyPolicy.family_key,
    agreement_id: baseAnalysis.agreement_id,
    base_analysis_id: baseAnalysis.agreement_analysis_id,
    agreement_index_id: agreementIndex.agreement_index_id,
    context_compilation_id: contextCompilation.context_compilation_id,
    family_policy_id: familyPolicy.family_policy_id,
    member_claim_count: memberLedger.length,
    compound_proposition_count: propositions.length,
    complete_proposition_count: propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length,
    incomplete_proposition_count: propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length,
    propositions,
    member_ledger: memberLedger,
  };
  return {
    schema_version: 'STAGE_2Y_M5_COMPOUND_ADAPTER_RESULT/V1',
    compound_adapter_result_id: contentId('STAGE_2Y_M5_COMPOUND_ADAPTER_RESULT/V1', unsigned),
    ...unsigned,
  };
}

module.exports = { adaptCompoundFamily, policyForFamily };
