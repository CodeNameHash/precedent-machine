'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const ANALYSIS_SCHEMA = 'AGREEMENT_ANALYSIS/V2';
const SOURCE_CLOSURE_SCHEMA = 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1';
const FACT_SCHEMA = 'AGREEMENT_SEMANTIC_FACT/V2';
const EXPRESSION_SCHEMA = 'STAGE_2Y_M7_V2_EXPRESSION/V1';
const EFFECT_SCHEMA = 'STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1';
const RULE_SCHEMA = 'AGREEMENT_LEGAL_RULE/V2';
const CANDIDATE_SET_SCHEMA = 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1';
const LEDGER_SCHEMA = 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1';
const DISPOSITION_SCHEMA = 'STAGE_2Y_M7_V2_DISPOSITION/V1';
const EQUIVALENCE_SLOTS = Object.freeze([
  'actor', 'effect', 'standard', 'threshold', 'timing', 'conditions', 'qualifications',
]);

function fail(detail) {
  throw new Error(`M7_V2_DETERMINISTIC_GENERATOR: ${detail}`);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function sealInline(schemaVersion, idField, body) {
  return {
    schema_version: schemaVersion,
    [idField]: contentId(schemaVersion, body),
    ...body,
  };
}

function wordTokens(value) {
  return value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function profileResult(profile, sourceText) {
  const words = wordTokens(sourceText);
  const requested = profile.match_test.tokens.flatMap(wordTokens);
  const matched = profile.match_test.kind === 'SOURCE_TOKEN_SEQUENCE'
    ? requested.length > 0 && requested.length <= words.length
      && words.some((_, offset) => offset <= words.length - requested.length
        && requested.every((token, index) => words[offset + index] === token))
    : profile.match_test.kind === 'SOURCE_TOKEN_ALL'
      && requested.every((token) => words.includes(token));
  if (typeof matched !== 'boolean') fail(`unsupported profile matcher ${profile.match_test.kind}`);
  const leafId = profile.match_test.leaf_id;
  return {
    profile_id: profile.profile_id,
    profile_key: profile.profile_key,
    matched,
    predicate_result_digest: sha256Hex(canonicalJson({
      matched,
      leaf_results: [{ leaf_id: leafId, result: matched }],
    })),
    decisive_leaf_ids: [leafId],
  };
}

function byteRange(sourceBytes, sourceText, needle, from = 0) {
  const startCharacter = sourceText.indexOf(needle, from);
  if (startCharacter < 0 || sourceText.indexOf(needle, startCharacter + 1) >= 0) {
    fail(`expected one exact source token ${JSON.stringify(needle)}`);
  }
  const startByte = Buffer.byteLength(sourceText.slice(0, startCharacter), 'utf8');
  return [startByte, startByte + Buffer.byteLength(needle, 'utf8')];
}

function makeSpan(agreementIndexId, nodeId, sourceBytes, startByte, endByte, operative) {
  if (!Number.isInteger(startByte) || !Number.isInteger(endByte)
      || startByte < 0 || endByte <= startByte || endByte > sourceBytes.length) {
    fail(`invalid source span ${startByte}:${endByte}`);
  }
  const bytes = sourceBytes.subarray(startByte, endByte);
  const textSha256 = sha256Hex(bytes);
  const material = /[\p{L}\p{N}]/u.test(bytes.toString('utf8'));
  return {
    span_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
      agreement_index_id: agreementIndexId,
      source_node_occurrence_id: nodeId,
      start_byte: startByte,
      end_byte: endByte,
      text_sha256: textSha256,
    }),
    source_node_occurrence_id: nodeId,
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: textSha256,
    legal_text: material,
    operative,
    materiality: material ? 'MATERIAL' : 'NON_MATERIAL',
  };
}

function sourceTextForSpan(sourceBytes, span) {
  return sourceBytes.subarray(span.start_byte, span.end_byte).toString('utf8');
}

function projectPartyEdges(contextCompilation, spans, sourceBytes, nodeId) {
  const byNativeRange = new Map(spans.map((span) => [
    `${span.start_byte}:${span.end_byte}:${span.text_sha256}`,
    span,
  ]));
  return contextCompilation.semantic_relationships.map((relationship) => {
    if (relationship.schema_version !== 'CONTEXT_SEMANTIC_RELATIONSHIP/V1'
        || relationship.relationship_type !== 'BOUND_ENTITY'
        || relationship.state !== 'RESOLVED'
        || relationship.target_endpoint?.source_node_occurrence_id !== nodeId
        || relationship.target_endpoint?.source_span === null) {
      fail('the first compiler slice accepts only resolved native bound-entity relationships');
    }
    const native = relationship.target_endpoint.source_span;
    const support = byNativeRange.get(
      `${native.start_byte}:${native.end_byte}:${native.text_sha256}`,
    );
    if (!support
        || relationship.target_endpoint.canonical_label !== sourceTextForSpan(sourceBytes, support)) {
      fail(`native party relationship ${relationship.semantic_relationship_id} has stale support`);
    }
    return {
      edge_id: `${relationship.semantic_relationship_id}:${relationship.target_endpoint.entity_id}`,
      edge_type: 'PARTY_ALIAS',
      target_id: relationship.target_endpoint.entity_id,
      state: relationship.state,
      source_support_ids: [support.span_id],
      support,
    };
  }).sort((left, right) => left.support.start_byte - right.support.start_byte);
}

function makeFact({ agreementId, fieldKey, valueType, typedValue, supportSpans,
  contextEdgeIds = [], ruleId, normalisationRule }) {
  const sourceSupportIds = supportSpans.map((span) => span.span_id);
  const legalEffectRole = fieldKey === 'APPLIES_TO' ? 'LEGAL_ACTOR'
    : fieldKey === 'LEGAL_EFFECT' ? 'OPERATIVE_EFFECT' : 'LEGAL_PARAMETER';
  const semanticFactKey = contentId(FACT_SCHEMA, {
    agreement_id: agreementId,
    field_key: fieldKey,
    normalised_typed_value: typedValue,
    legal_subject: 'COMPANY',
    temporal_scope_signature: 'CURRENT',
    source_support_ids: sourceSupportIds,
    legal_effect_role: legalEffectRole,
  });
  return {
    fact_id: contentId(FACT_SCHEMA, {
      agreement_id: agreementId,
      semantic_fact_key: semanticFactKey,
    }),
    semantic_fact_key: semanticFactKey,
    owner_rule_id: ruleId,
    field_key: fieldKey,
    label_id: `label-${fieldKey}`,
    value_type: valueType,
    typed_value: clone(typedValue),
    materiality: 'MATERIAL',
    atomicity: 'ATOMIC_TYPED_VALUE',
    legal_effect_role: legalEffectRole,
    legal_subject: 'COMPANY',
    temporal_scope_signature: 'CURRENT',
    source_support_ids: sourceSupportIds,
    dependency_ids: [],
    normalisation_proof: {
      rule_id: normalisationRule,
      input_source_span_ids: sourceSupportIds,
      input_context_edge_ids: contextEdgeIds,
      result_digest: sha256Hex(canonicalJson(typedValue)),
    },
    display_rule: 'DISPLAY_REQUIRED',
  };
}

function equivalenceSignature(profile, expressionSignature, facts) {
  const result = {};
  for (const slot of EQUIVALENCE_SLOTS) {
    const mapping = profile.equivalence_signature_mapping[slot];
    const entries = [];
    for (const fieldKey of mapping.field_keys) {
      entries.push(...facts.filter((fact) => fact.field_key === fieldKey).map((fact) => ({
        kind: 'FACT',
        field_key: fact.field_key,
        value_type: fact.value_type,
        typed_value: clone(fact.typed_value),
        legal_subject: fact.legal_subject,
        temporal_scope_signature: fact.temporal_scope_signature,
        legal_effect_role: fact.legal_effect_role,
      })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))));
    }
    if (mapping.expression_signature_role === 'CANONICAL_EXPRESSION') {
      entries.push({
        kind: 'EXPRESSION',
        role: 'CANONICAL_EXPRESSION',
        signature: expressionSignature,
      });
    }
    result[slot] = entries;
  }
  return result;
}

function generateAnalysisV2({ baseAnalysis, agreementIndex, contextCompilation,
  approvedFamilyPackets, approvedFamilyProfileSet, approvedStructureDispositions,
  governance }) {
  const agreementId = baseAnalysis.agreement_id;
  if (agreementIndex.source_binding.agreement_id !== agreementId
      || contextCompilation.agreement_index_binding.agreement_index_id
        !== agreementIndex.agreement_index_id
      || baseAnalysis.context_compilation_binding.context_compilation_id
        !== contextCompilation.context_compilation_id
      || baseAnalysis.claims.length !== 1
      || baseAnalysis.claims[0].source_node_occurrence_ids.length !== 1) {
    fail('native M4, M3, and M2 records do not form one exact governed occurrence');
  }
  const claim = baseAnalysis.claims[0];
  const occurrenceId = claim.claim_occurrence_id;
  const nodeId = claim.source_node_occurrence_ids[0];
  const node = agreementIndex.nodes.find(
    (candidate) => candidate.node_occurrence_id === nodeId,
  );
  const sourceText = agreementIndex.source_binding.canonical_text;
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  if (!node || node.extent_span.start_byte !== 0
      || node.extent_span.end_byte !== sourceBytes.length
      || node.extent_span.text_sha256 !== sha256Hex(sourceBytes)
      || agreementIndex.source_binding.canonical_text_sha256 !== sha256Hex(sourceBytes)
      || agreementIndex.source_binding.canonical_text_byte_length !== sourceBytes.length) {
    fail('the governed M2 node is not one exact full-source authored unit');
  }

  const profiles = approvedFamilyProfileSet.profiles;
  const profileResults = profiles.map((profile) => profileResult(profile, sourceText));
  const matched = profileResults.filter((result) => result.matched);
  if (matched.length !== 1) fail(`expected one approved profile match, received ${matched.length}`);
  const profile = profiles.find((candidate) => candidate.profile_id === matched[0].profile_id);
  const expressionSignature = profile.required_expression_signature;
  if (expressionSignature !== 'ALL_OF(APPLIES_TO,FAMILY_MARKER)') {
    fail(`unsupported first-slice expression ${expressionSignature}`);
  }
  const treeEntry = approvedFamilyProfileSet.subtype_tree_bindings.find(
    (entry) => entry.family_key === profile.family_key,
  );
  if (!treeEntry) fail(`missing subtype tree binding for ${profile.family_key}`);
  const profileSnapshots = profiles.map((candidate) => {
    const selectedTree = approvedFamilyProfileSet.subtype_tree_bindings.find(
      (entry) => entry.family_key === candidate.family_key,
    );
    if (!selectedTree) fail(`missing subtype tree binding for ${candidate.family_key}`);
    return {
      ...clone(candidate),
      profile_set_binding: clone(approvedFamilyProfileSet.__binding),
      tree_binding: clone(selectedTree.binding),
    };
  });

  const modalRange = byteRange(sourceBytes, sourceText, 'shall');
  const familyToken = profile.match_test.tokens.find((token) =>
    wordTokens(token).some((word) => word.startsWith('family')));
  if (!familyToken) fail('selected profile has no family source token');
  const familyRange = byteRange(sourceBytes, sourceText, familyToken);
  const nativeParties = contextCompilation.semantic_relationships.map((relationship) => ({
    start: relationship.target_endpoint?.source_span?.start_byte,
    end: relationship.target_endpoint?.source_span?.end_byte,
  })).sort((left, right) => left.start - right.start);
  if (nativeParties.length !== 2 || nativeParties.some(
    (range) => !Number.isInteger(range.start) || !Number.isInteger(range.end),
  )) {
    fail('the first compiler slice requires two exact native party aliases');
  }
  const ranges = [
    modalRange,
    [modalRange[1], nativeParties[0].start],
    [nativeParties[0].start, nativeParties[0].end],
    [nativeParties[0].end, nativeParties[1].start],
    [nativeParties[1].start, nativeParties[1].end],
    [nativeParties[1].end, familyRange[0]],
    familyRange,
    [familyRange[1], sourceBytes.length],
  ];
  if (ranges.some(([start, end]) => end <= start)
      || ranges.some(([start, end], index) => index > 0 && start !== ranges[index - 1][1])) {
    fail('native source does not have the closed first-slice byte partition');
  }
  const spans = ranges.map(([start, end], index) => makeSpan(
    agreementIndex.agreement_index_id, nodeId, sourceBytes, start, end, index === 0,
  ));
  const partyEdges = projectPartyEdges(contextCompilation, spans, sourceBytes, nodeId);
  if (partyEdges.length !== 2
      || partyEdges[0].support.span_id !== spans[2].span_id
      || partyEdges[1].support.span_id !== spans[4].span_id) {
    fail('native party aliases do not align with the exact source partition');
  }

  const sourceClosure = sealInline(SOURCE_CLOSURE_SCHEMA, 'source_closure_id', {
    authored_unit_id: nodeId,
    agreement_index_binding: clone(agreementIndex.__binding),
    canonical_source_binding: {
      canonical_text_id: agreementIndex.source_binding.canonical_text_id,
      canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
      canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
    },
    source_node_occurrence_id: nodeId,
    complete_review_state: 'COMPLETE_REVIEWED_SOURCE_CLOSURE',
    governing_chapeau_span_ids: [spans[0].span_id],
    required_dependency_ids: [],
    governing_start_byte: 0,
    governing_end_byte: sourceBytes.length,
    whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
    spans,
  });

  const factDrafts = [
    {
      fieldKey: 'LEGAL_EFFECT', valueType: 'ENUM', typedValue: 'SHALL',
      supportSpans: [spans[0]], normalisationRule: 'ENUM_LITERAL_MAP/V1',
    },
    {
      fieldKey: 'APPLIES_TO', valueType: 'PARTY_SET',
      typedValue: { parties: partyEdges.map((edge) => edge.target_id) },
      supportSpans: spans.slice(1, 5),
      contextEdgeIds: partyEdges.map((edge) => edge.edge_id),
      normalisationRule: 'BOUND_PARTY_ALIAS/V1',
    },
    {
      fieldKey: 'FAMILY_MARKER', valueType: 'ENUM',
      typedValue: sourceText.slice(
        sourceText.indexOf(familyToken), sourceText.indexOf(familyToken) + familyToken.length,
      ).toUpperCase(),
      supportSpans: spans.slice(5, 7), normalisationRule: 'ENUM_LITERAL_MAP/V1',
    },
  ];
  const pendingFacts = factDrafts.map((draft) => makeFact({
    agreementId, ...draft, ruleId: 'PENDING_RULE_ID',
  }));
  const expressionIdentity = {
    operator: 'ALL_OF',
    result_kind: 'LOGICAL',
    children: [
      { kind: 'FACT', id: pendingFacts[1].fact_id, ordinal: 1, role: 'MEMBER' },
      { kind: 'FACT', id: pendingFacts[2].fact_id, ordinal: 2, role: 'MEMBER' },
    ],
    connective_span_ids: [spans[7].span_id],
    authored_limb_marker_span_ids: [],
    scope_span_ids: spans.map((span) => span.span_id),
  };
  const expression = {
    expression_id: contentId(EXPRESSION_SCHEMA, expressionIdentity),
    ...expressionIdentity,
    parent_expression_id: null,
  };
  const effectIdentity = {
    input_occurrence_id: occurrenceId,
    source_span_ids: spans.map((span) => span.span_id),
    fact_ids: pendingFacts.map((fact) => fact.fact_id),
    expression_root_id: expression.expression_id,
  };
  const effectId = contentId(EFFECT_SCHEMA, effectIdentity);
  const ruleId = contentId(RULE_SCHEMA, {
    agreement_id: agreementId,
    input_occurrence_id: occurrenceId,
    effect_id: effectId,
    family_key: profile.family_key,
    profile_id: profile.profile_id,
    subtype_path: profile.subtype_path,
    semantic_fact_keys: pendingFacts.map((fact) => fact.semantic_fact_key),
    canonical_expression_signature: expressionSignature,
    child_rule_ids: [],
    source_closure_id: sourceClosure.source_closure_id,
  });
  const facts = pendingFacts.map((fact) => ({ ...fact, owner_rule_id: ruleId }));
  const rule = {
    schema_version: RULE_SCHEMA,
    rule_id: ruleId,
    input_occurrence_id: occurrenceId,
    authored_unit_id: nodeId,
    effect_id: effectId,
    family_key: profile.family_key,
    profile_id: profile.profile_id,
    subtype_path: clone(profile.subtype_path),
    applies_to_fact_ids: [facts[1].fact_id],
    fact_ids: facts.map((fact) => fact.fact_id),
    consumer_link_ids: [],
    root_expression_id: expression.expression_id,
    child_rule_ids: [],
    source_closure_id: sourceClosure.source_closure_id,
    expression_signature: expressionSignature,
    equivalence_signature: equivalenceSignature(profile, expressionSignature, facts),
    validation: {
      extraction_state: 'COMPLETE',
      source_quality: 'SUFFICIENT',
      output_disposition: 'NORMAL',
      issue_codes: [],
      no_comparison_authority: null,
    },
  };
  const effect = {
    effect_id: effectId,
    ...effectIdentity,
    profile_results: profileResults,
    selected_profile_id: profile.profile_id,
    selected_profile_key: profile.profile_key,
    no_more_specific_descendant_match: true,
    generic_level_output_authority: null,
  };
  const familyKeys = [...new Set(profiles.map((candidate) => candidate.family_key))];
  const packetFamilyKeys = new Set(
    approvedFamilyPackets.families.map((family) => family.family_key),
  );
  if (profileResults.filter((result) => result.matched).some((result) => {
    const selected = profiles.find((candidate) => candidate.profile_id === result.profile_id);
    return !packetFamilyKeys.has(selected.family_key);
  })) {
    fail('a selected family is absent from Work0 evidence');
  }
  const candidateSet = sealInline(CANDIDATE_SET_SCHEMA, 'candidate_set_id', {
    authored_unit_id: nodeId,
    source_closure_id: sourceClosure.source_closure_id,
    considered_family_keys: familyKeys,
    effects: [effect],
  });
  const effectLedger = sealInline(LEDGER_SCHEMA, 'effect_ledger_id', {
    authored_unit_id: nodeId,
    source_closure_id: sourceClosure.source_closure_id,
    entries: [{
      effect_id: effectId,
      input_occurrence_id: occurrenceId,
      effect_kind: 'MODAL',
      rule_ids: [ruleId],
      source_span_ids: spans.map((span) => span.span_id),
      operative_marker_span_ids: [spans[0].span_id],
      treatments: [{
        treatment_kind: 'RULE',
        target_id: ruleId,
        source_span_ids: spans.slice(0, 7).map((span) => span.span_id),
        authority_id: null,
      }, {
        treatment_kind: 'EXPRESSION',
        target_id: expression.expression_id,
        source_span_ids: [spans[7].span_id],
        authority_id: null,
      }],
    }],
  });
  const coveragePartition = {
    source_closure_id: sourceClosure.source_closure_id,
    entries: spans.map((span, index) => ({
      span_id: span.span_id,
      treatment_kind: index === 7 ? 'LOGIC_CONNECTIVE' : 'FACT',
      owner_id: index === 7 ? expression.expression_id
        : index === 0 ? facts[0].fact_id
          : index <= 4 ? facts[1].fact_id : facts[2].fact_id,
      reason_code: null,
      authority_id: null,
      materiality: span.materiality,
    })),
  };
  const allFamilyProfileResults = familyKeys.map((familyKey) => ({
    family_key: familyKey,
    matched_profile_ids: profileResults.filter((result) => result.matched
      && profiles.some((candidate) => candidate.family_key === familyKey
        && candidate.profile_id === result.profile_id)).map((result) => result.profile_id).sort(),
  }));
  const disposition = sealInline(DISPOSITION_SCHEMA, 'disposition_id', {
    input_occurrence_id: occurrenceId,
    prior_family_key: profile.family_key,
    authored_unit_id: nodeId,
    source_closure_id: sourceClosure.source_closure_id,
    source_closure_digest: sha256Hex(canonicalJson(sourceClosure)),
    candidate_set_id: candidateSet.candidate_set_id,
    candidate_set_digest: sha256Hex(canonicalJson(candidateSet)),
    rule_ids: [ruleId],
    all_family_profile_results: allFamilyProfileResults,
    compatible_cross_family_match_count: 0,
    extraction_state: 'COMPLETE',
    source_quality: 'SUFFICIENT',
    output_disposition: 'NORMAL',
    profile_match_state: 'EXACT_ONE_MOST_SPECIFIC',
    absence_proofs: [],
    issues: [],
    no_comparison_authorities: [],
    no_output_authority: null,
  });
  const analysisBody = {
    agreement_id: agreementId,
    governed_input_occurrence_ids: [occurrenceId],
    governance: clone(governance),
    profile_snapshots: profileSnapshots,
    candidate_sets: [candidateSet],
    source_closures: [sourceClosure],
    dependencies: [],
    facts,
    expressions: [expression],
    rules: [rule],
    authored_unit_effect_ledgers: [effectLedger],
    shared_fact_coverages: [],
    coverage_partitions: [coveragePartition],
    ownership_links: [],
    family_corrections: [],
    dispositions: [disposition],
    counts: {
      governed_input_occurrences: 1,
      rules: 1,
      facts: 3,
      expressions: 1,
      shared_fact_coverages: 0,
      source_closures: 1,
      dispositions: 1,
    },
  };
  if (approvedStructureDispositions.members.some((member) =>
    member.scope?.governed_input_occurrence_ids?.includes(occurrenceId)
      && profileResult({
        profile_id: member.structure_disposition_id,
        profile_key: member.kind,
        match_test: member.match_test,
      }, sourceText).matched)) {
    fail('an approved structure disposition claims the otherwise normal occurrence');
  }
  return deepFreeze(sealInline(ANALYSIS_SCHEMA, 'agreement_analysis_id', analysisBody));
}

module.exports = { generateAnalysisV2 };
