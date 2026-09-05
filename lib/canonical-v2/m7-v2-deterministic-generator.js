'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const ANALYSIS_SCHEMA = 'AGREEMENT_ANALYSIS/V2';
const SOURCE_CLOSURE_SCHEMA = 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1';
const FACT_SCHEMA = 'AGREEMENT_SEMANTIC_FACT/V2';
const GOVERNED_DISCLOSURE_NOTE_SCHEMA = 'STAGE_2Y_M7_V2_GOVERNED_DISCLOSURE_NOTE/V1';
const EXPRESSION_SCHEMA = 'STAGE_2Y_M7_V2_EXPRESSION/V1';
const EFFECT_SCHEMA = 'STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1';
const RULE_SCHEMA = 'AGREEMENT_LEGAL_RULE/V2';
const CANDIDATE_SET_SCHEMA = 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1';
const LEDGER_SCHEMA = 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1';
const DISPOSITION_SCHEMA = 'STAGE_2Y_M7_V2_DISPOSITION/V1';
const EQUIVALENCE_SLOTS = Object.freeze([
  'actor', 'effect', 'standard', 'threshold', 'timing', 'conditions', 'qualifications',
]);
const SYNTHETIC_EXPRESSION_OPERATORS = Object.freeze(new Map([
  ['ALL_OF', { min: 2, max: Infinity, roles: ['MEMBER'] }],
  ['ANY_OF', { min: 2, max: Infinity, roles: ['MEMBER'] }],
  ['NOT', { min: 1, max: 1, roles: ['NEGATED'] }],
  ['IF_THEN', { min: 2, max: 2, roles: ['CONDITION', 'CONSEQUENCE'] }],
  ['EXCEPTION_TO', { min: 2, max: 2, roles: ['BASE', 'EXCEPTION'] }],
  ['EARLIER_OF', { min: 2, max: Infinity, roles: ['MEMBER'] }],
]));
const SYNTHETIC_TEMPORAL_FACT_TYPES = Object.freeze(new Set([
  'DATE', 'DURATION', 'PERIOD', 'REFERENCE',
]));
const TEMPORAL_PHASE1_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_TEMPORAL_PHASE1_AUTHORITY/V1';
const TEMPORAL_PHASE1_AUTHORITY_ID =
  'ac7af03e6206c62ef20eb97bff7f47e2180b23bc0468b7b517792078c10350a7';
const TEMPORAL_PHASE1_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-temporal-phase1-authority.json';
const TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH = 24742;
const TEMPORAL_PHASE1_AUTHORITY_SHA256 =
  '64ac377ea1124c379423d9fa5a79c751d9880f11b170a156538668ac5c965ec8';
const TERMINATION_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V2';
const TERMINATION_PHASE2_AUTHORITY_ID =
  'df1e3d4711e1b2fca09ea681e43db19a6b7cbfe1055e6a57c3ea48b2f588bf15';
const TERMINATION_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';
const TERMINATION_PHASE2_AUTHORITY_BYTE_LENGTH = 787442;
const TERMINATION_PHASE2_AUTHORITY_SHA256 =
  '897022076002dc07d16d7a60071dd932c829428fe0763d42d9b70fd1b21055cb';
const TERMINATION_PHASE2_ERROR = Object.freeze({
  AUTHORITY: 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
  TOPOLOGY: 'M7_V2_TERMINATION_PHASE2_EVIDENCE_TOPOLOGY',
  PROVENANCE: 'M7_V2_TERMINATION_PHASE2_EVIDENCE_PROVENANCE',
  REFERENCE: 'M7_V2_TERMINATION_PHASE2_REFERENCE_RESOLUTION',
});

function fail(detail) {
  throw new Error(`M7_V2_DETERMINISTIC_GENERATOR: ${detail}`);
}

function clone(value) {
  return structuredClone(value);
}

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function temporalPhase1AuthorityFail(detail) {
  const code = 'M7_V2_TEMPORAL_PHASE1_AUTHORITY_DRIFT';
  const error = new TypeError(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function terminationPhase2Fail(code, detail) {
  const error = new TypeError(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function hasExactKeys(value, expectedKeys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expectedKeys].sort());
}

function validateTemporalPhase1AuthorityEnvelope(envelope) {
  if (!hasExactKeys(envelope, ['binding', 'record'])
      || !hasExactKeys(envelope.binding, [
        'byte_length',
        'path',
        'record_id',
        'record_id_field',
        'schema_version',
        'sha256',
      ])
      || !envelope.record || typeof envelope.record !== 'object'
      || Array.isArray(envelope.record)) {
    temporalPhase1AuthorityFail('temporal Phase 1 authority envelope is invalid');
  }
  const { binding, record } = envelope;
  if (binding.byte_length !== TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH
      || binding.path !== TEMPORAL_PHASE1_AUTHORITY_PATH
      || binding.record_id !== TEMPORAL_PHASE1_AUTHORITY_ID
      || binding.record_id_field !== 'temporal_phase1_authority_id'
      || binding.schema_version !== TEMPORAL_PHASE1_AUTHORITY_SCHEMA
      || binding.sha256 !== TEMPORAL_PHASE1_AUTHORITY_SHA256
      || record.schema_version !== TEMPORAL_PHASE1_AUTHORITY_SCHEMA
      || record.temporal_phase1_authority_id !== TEMPORAL_PHASE1_AUTHORITY_ID) {
    temporalPhase1AuthorityFail(
      'temporal Phase 1 authority binding does not match the sealed record',
    );
  }
  let recordBytes;
  let recomputedRecordId;
  try {
    recordBytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
    const unsignedRecord = { ...record };
    delete unsignedRecord.temporal_phase1_authority_id;
    recomputedRecordId = contentId(TEMPORAL_PHASE1_AUTHORITY_SCHEMA, unsignedRecord);
  } catch {
    temporalPhase1AuthorityFail('temporal Phase 1 authority record is not canonical');
  }
  if (recordBytes.length !== TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH
      || sha256Hex(recordBytes) !== TEMPORAL_PHASE1_AUTHORITY_SHA256
      || recomputedRecordId !== TEMPORAL_PHASE1_AUTHORITY_ID) {
    temporalPhase1AuthorityFail(
      'temporal Phase 1 authority record bytes do not match the sealed record',
    );
  }
  return deepFreeze(JSON.parse(canonicalJson({
    policy_overlay: record.policy_overlay,
    red_hat_source_authority: record.red_hat_source_authority,
  })));
}

function validateTerminationPhase2AuthorityEnvelope(envelope) {
  if (!hasExactKeys(envelope, ['binding', 'record'])
      || !hasExactKeys(envelope.binding, [
        'byte_length',
        'path',
        'record_id',
        'record_id_field',
        'schema_version',
        'sha256',
      ])
      || !envelope.record || typeof envelope.record !== 'object'
      || Array.isArray(envelope.record)) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.AUTHORITY,
      'Termination Phase2 authority envelope is invalid',
    );
  }
  const { binding, record } = envelope;
  if (binding.byte_length !== TERMINATION_PHASE2_AUTHORITY_BYTE_LENGTH
      || binding.path !== TERMINATION_PHASE2_AUTHORITY_PATH
      || binding.record_id !== TERMINATION_PHASE2_AUTHORITY_ID
      || binding.record_id_field !== 'termination_authoring_phase2_authority_id'
      || binding.schema_version !== TERMINATION_PHASE2_AUTHORITY_SCHEMA
      || binding.sha256 !== TERMINATION_PHASE2_AUTHORITY_SHA256
      || record.schema_version !== TERMINATION_PHASE2_AUTHORITY_SCHEMA
      || record.termination_authoring_phase2_authority_id
        !== TERMINATION_PHASE2_AUTHORITY_ID) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.AUTHORITY,
      'Termination Phase2 authority binding does not match the sealed record',
    );
  }
  let recordBytes;
  let recomputedRecordId;
  try {
    recordBytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
    const unsignedRecord = { ...record };
    delete unsignedRecord.termination_authoring_phase2_authority_id;
    recomputedRecordId = contentId(TERMINATION_PHASE2_AUTHORITY_SCHEMA, unsignedRecord);
  } catch {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.AUTHORITY,
      'Termination Phase2 authority record is not canonical',
    );
  }
  if (recordBytes.length !== TERMINATION_PHASE2_AUTHORITY_BYTE_LENGTH
      || sha256Hex(recordBytes) !== TERMINATION_PHASE2_AUTHORITY_SHA256
      || recomputedRecordId !== TERMINATION_PHASE2_AUTHORITY_ID) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.AUTHORITY,
      'Termination Phase2 authority bytes do not match the sealed record',
    );
  }
  return deepFreeze(JSON.parse(canonicalJson(record)));
}

const ENGLISH_CARDINAL_SMALL = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19],
]);
const ENGLISH_CARDINAL_TENS = new Map([
  ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50],
  ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90],
]);

function parseEnglishCardinalGroup(inputTokens) {
  const tokens = [...inputTokens];
  let value = 0;
  if (tokens.length >= 2 && ENGLISH_CARDINAL_SMALL.has(tokens[0])
      && ENGLISH_CARDINAL_SMALL.get(tokens[0]) <= 9 && tokens[1] === 'hundred') {
    value = ENGLISH_CARDINAL_SMALL.get(tokens[0]) * 100;
    tokens.splice(0, 2);
    if (tokens[0] === 'and') {
      if (tokens.length === 1) return null;
      tokens.shift();
    }
  }
  if (tokens.length === 0) return value > 0 ? value : null;
  if (tokens.length === 1) {
    const remainder = ENGLISH_CARDINAL_SMALL.get(tokens[0])
      ?? ENGLISH_CARDINAL_TENS.get(tokens[0]);
    return remainder ? value + remainder : null;
  }
  if (tokens.length === 2 && ENGLISH_CARDINAL_TENS.has(tokens[0])
      && ENGLISH_CARDINAL_SMALL.has(tokens[1])
      && ENGLISH_CARDINAL_SMALL.get(tokens[1]) <= 9) {
    return value + ENGLISH_CARDINAL_TENS.get(tokens[0])
      + ENGLISH_CARDINAL_SMALL.get(tokens[1]);
  }
  return null;
}

function parseEnglishCardinal(surface) {
  const tokens = surface.toLowerCase().split(/[\s-]+/u).filter(Boolean);
  if (tokens.length === 0) return null;
  const scales = [
    ['billion', 1_000_000_000],
    ['million', 1_000_000],
    ['thousand', 1_000],
  ];
  let cursor = 0;
  let total = 0;
  for (const [scaleWord, scale] of scales) {
    const scaleIndex = tokens.indexOf(scaleWord, cursor);
    if (scaleIndex < 0) continue;
    const groupTokens = tokens.slice(cursor, scaleIndex);
    if (groupTokens[0] === 'and' && total > 0) groupTokens.shift();
    const group = parseEnglishCardinalGroup(groupTokens);
    if (group === null) return null;
    total += group * scale;
    cursor = scaleIndex + 1;
  }
  const finalTokens = tokens.slice(cursor);
  if (finalTokens[0] === 'and' && total > 0) finalTokens.shift();
  if (finalTokens.length > 0) {
    const finalGroup = parseEnglishCardinalGroup(finalTokens);
    if (finalGroup === null) return null;
    total += finalGroup;
  }
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function parseTemporalPhase1BusinessDayDuration(surface) {
  const match = /^(at least )?(.+?)(?: \(([1-9]\d*)\))? Business (Day|Days)$/u.exec(surface);
  if (!match) return null;
  const amountIsNumeral = /^[1-9]\d*$/u.test(match[2]);
  const amount = amountIsNumeral ? Number(match[2]) : parseEnglishCardinal(match[2]);
  const parentheticalAmount = match[3] === undefined ? null : Number(match[3]);
  if (!Number.isSafeInteger(amount) || amount <= 0
      || (amountIsNumeral && parentheticalAmount !== null)
      || (!amountIsNumeral && parentheticalAmount === null)
      || (parentheticalAmount !== null && parentheticalAmount !== amount)
      || (amount === 1 && match[4] !== 'Day')
      || (amount !== 1 && match[4] !== 'Days')) {
    return null;
  }
  return {
    bound_type: match[1] ? 'AT_LEAST' : 'EXACT',
    count: amount,
    unit: 'BUSINESS_DAY',
  };
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
  if (!['SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ALL'].includes(profile.match_test.kind)) {
    fail(`unsupported profile matcher ${profile.match_test.kind}`);
  }
  if (!Array.isArray(profile.match_test.tokens)) {
    fail(`profile ${profile.profile_id} has no source tokens`);
  }
  if (profile.match_test.tokens.length === 0 || profile.match_test.tokens.some(
    (token) => typeof token !== 'string' || wordTokens(token).length !== 1,
  )) {
    fail(`profile ${profile.profile_id} must use non-empty one-word source tokens`);
  }
  const words = wordTokens(sourceText);
  const requested = profile.match_test.tokens.flatMap(wordTokens);
  let matched;
  if (profile.match_test.kind === 'SOURCE_TOKEN_SEQUENCE') {
    matched = requested.length > 0 && requested.length <= words.length
      && words.some((_, offset) => offset <= words.length - requested.length
        && requested.every((token, index) => words[offset + index] === token));
  } else if (profile.match_test.kind === 'SOURCE_TOKEN_ALL') {
    matched = requested.every((token) => words.includes(token));
  }
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

function byteRange(sourceText, needle, absoluteStart = 0, from = 0) {
  const startCharacter = sourceText.indexOf(needle, from);
  if (startCharacter < 0 || sourceText.indexOf(needle, startCharacter + 1) >= 0) {
    fail(`expected one exact source token ${JSON.stringify(needle)}`);
  }
  const startByte = Buffer.byteLength(sourceText.slice(0, startCharacter), 'utf8');
  return [
    absoluteStart + startByte,
    absoluteStart + startByte + Buffer.byteLength(needle, 'utf8'),
  ];
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
  return contextCompilation.semantic_relationships.filter(
    (relationship) => relationship.target_endpoint?.source_node_occurrence_id === nodeId
      && relationship.schema_version === 'CONTEXT_SEMANTIC_RELATIONSHIP/V1'
      && relationship.relationship_type === 'BOUND_ENTITY'
      && relationship.state === 'RESOLVED'
      && relationship.target_endpoint?.source_span != null,
  ).map((relationship) => {
    const native = relationship.target_endpoint.source_span;
    if (native.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        || !Number.isInteger(native.start_byte) || !Number.isInteger(native.end_byte)
        || native.start_byte < 0 || native.end_byte <= native.start_byte
        || native.end_byte > sourceBytes.length
        || native.text_sha256 !== sha256Hex(
          sourceBytes.subarray(native.start_byte, native.end_byte),
        )) {
      fail(`native party relationship ${relationship.semantic_relationship_id} has stale support`);
    }
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
  contextEdgeIds = [], legalSubject, ruleId, normalisationRule }) {
  const sourceSupportIds = supportSpans.map((span) => span.span_id);
  const legalEffectRole = fieldKey === 'APPLIES_TO' ? 'LEGAL_ACTOR'
    : fieldKey === 'LEGAL_EFFECT' ? 'OPERATIVE_EFFECT' : 'LEGAL_PARAMETER';
  const semanticFactKey = contentId(FACT_SCHEMA, {
    agreement_id: agreementId,
    field_key: fieldKey,
    normalised_typed_value: typedValue,
    legal_subject: legalSubject,
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
    legal_subject: legalSubject,
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

function selectMostSpecificProfile(profiles, profileResults) {
  const byId = new Map();
  for (const profile of profiles) {
    if (typeof profile.profile_id !== 'string' || byId.has(profile.profile_id)) {
      fail('approved profiles must have unique profile IDs');
    }
    byId.set(profile.profile_id, profile);
  }
  for (const profile of profiles) {
    const seen = new Set([profile.profile_id]);
    let parentId = profile.parent_profile_id;
    while (parentId !== null) {
      if (typeof parentId !== 'string' || !byId.has(parentId) || seen.has(parentId)) {
        fail(`profile ${profile.profile_id} has an invalid ancestry chain`);
      }
      seen.add(parentId);
      parentId = byId.get(parentId).parent_profile_id;
    }
  }
  const matched = profileResults.filter((result) => result.matched);
  const isAncestor = (ancestorId, descendantId) => {
    let parentId = byId.get(descendantId).parent_profile_id;
    while (parentId !== null) {
      if (parentId === ancestorId) return true;
      parentId = byId.get(parentId).parent_profile_id;
    }
    return false;
  };
  const mostSpecific = matched.filter((candidate) => !matched.some(
    (other) => other.profile_id !== candidate.profile_id
      && isAncestor(candidate.profile_id, other.profile_id),
  ));
  if (mostSpecific.length !== 1) return null;
  return byId.get(mostSpecific[0].profile_id);
}

function profileMatchState(profileResults, selectedProfile) {
  const matchedCount = profileResults.filter((result) => result.matched).length;
  if (selectedProfile) return 'EXACT_ONE_MOST_SPECIFIC';
  return matchedCount === 0 ? 'NO_COMPATIBLE_PROFILE' : 'AMBIGUOUS_PROFILE_MATCH';
}

function compileReviewOnlyOccurrence({
  agreementIndex,
  approvedFamilyPackets,
  approvedStructureDispositions,
  node,
  nodeStart,
  nodeEnd,
  nodeText,
  occurrenceId,
  profileResults,
  profiles,
  sourceBytes,
  additionalIssues = [],
}) {
  const nodeId = node.node_occurrence_id;
  const span = makeSpan(
    agreementIndex.agreement_index_id, nodeId, sourceBytes, nodeStart, nodeEnd, false,
  );
  const spans = [span];
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
    governing_chapeau_span_ids: [span.span_id],
    required_dependency_ids: [],
    governing_start_byte: nodeStart,
    governing_end_byte: nodeEnd,
    whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
    context_spans: [],
    spans,
  });
  const matchState = profileMatchState(profileResults, null);
  const candidateProfileIds = profileResults.filter((result) => result.matched)
    .map((result) => result.profile_id).sort(lexicalCompare);
  const effectIdentity = {
    input_occurrence_id: occurrenceId,
    source_span_ids: [span.span_id],
    fact_ids: [],
    expression_root_id: null,
  };
  const effectId = contentId(EFFECT_SCHEMA, effectIdentity);
  const effect = {
    effect_id: effectId,
    ...effectIdentity,
    profile_results: profileResults,
    selected_profile_id: null,
    selected_profile_key: null,
    no_more_specific_descendant_match: false,
    generic_level_output_authority: null,
    candidate_profile_ids: candidateProfileIds,
  };
  const familyKeys = [...new Set(profiles.map((candidate) => candidate.family_key))];
  const packetFamilyKeys = new Set(
    approvedFamilyPackets.families.map((family) => family.family_key),
  );
  if (profileResults.filter((result) => result.matched).some((result) => {
    const selected = profiles.find((candidate) => candidate.profile_id === result.profile_id);
    return selected && !packetFamilyKeys.has(selected.family_key);
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
      effect_kind: 'REVIEW',
      rule_ids: [],
      source_span_ids: [span.span_id],
      operative_marker_span_ids: [],
      treatments: [],
    }],
  });
  const coveragePartition = {
    source_closure_id: sourceClosure.source_closure_id,
    entries: [{
      span_id: span.span_id,
      treatment_kind: 'REVIEW_RESIDUE',
      owner_id: null,
      reason_code: 'NO_SINGLE_PROFILE',
      authority_id: null,
      materiality: span.materiality,
    }],
  };
  const allFamilyProfileResults = familyKeys.map((familyKey) => ({
    family_key: familyKey,
    matched_profile_ids: profileResults.filter((result) => result.matched
      && profiles.some((candidate) => candidate.family_key === familyKey
        && candidate.profile_id === result.profile_id)).map((result) => result.profile_id).sort(),
  }));
  const issue = {
    effect_id: effectId,
    rule_id: null,
    issue_code: 'NO_SINGLE_PROFILE',
    extraction_state: matchState === 'AMBIGUOUS_PROFILE_MATCH' ? 'AMBIGUOUS' : 'INCOMPLETE',
    source_quality: 'SUFFICIENT',
    source_span_ids: [span.span_id],
  };
  const partyIssue = {
    effect_id: effectId,
    rule_id: null,
    issue_code: 'PARTY_PROOF_UNPROVED',
    extraction_state: issue.extraction_state,
    source_quality: 'SUFFICIENT',
    source_span_ids: [span.span_id],
  };
  const extraIssues = Array.isArray(additionalIssues) ? additionalIssues.map((code) => ({
    effect_id: effectId,
    rule_id: null,
    issue_code: code,
    extraction_state: issue.extraction_state,
    source_quality: 'SUFFICIENT',
    source_span_ids: [span.span_id],
  })) : [];
  const disposition = sealInline(DISPOSITION_SCHEMA, 'disposition_id', {
    input_occurrence_id: occurrenceId,
    prior_family_key: null,
    authored_unit_id: nodeId,
    source_closure_id: sourceClosure.source_closure_id,
    source_closure_digest: sha256Hex(canonicalJson(sourceClosure)),
    candidate_set_id: candidateSet.candidate_set_id,
    candidate_set_digest: sha256Hex(canonicalJson(candidateSet)),
    rule_ids: [],
    all_family_profile_results: allFamilyProfileResults,
    compatible_cross_family_match_count: allFamilyProfileResults.reduce(
      (count, entry) => count + entry.matched_profile_ids.length, 0,
    ),
    extraction_state: issue.extraction_state,
    source_quality: 'SUFFICIENT',
    output_disposition: 'REVIEW_ONLY',
    profile_match_state: matchState,
    absence_proofs: [],
    issues: [issue, partyIssue, ...extraIssues],
    no_comparison_authorities: [],
    no_output_authority: null,
  });
  rejectMatchingStructureDisposition({
    approvedStructureDispositions,
    agreementIndex,
    occurrenceId,
    nodeId,
    nodeStart,
    nodeEnd,
    nodeText,
    sourceBytes,
  });
  return {
    occurrenceId,
    sourceClosure,
    facts: [],
    expressions: [],
    rule: null,
    candidateSet,
    effectLedger,
    coveragePartition,
    disposition,
  };
}

function validateSelectedProfileCapability(
  profile, node, factDrafts, contextCompilation, requiredOperators = [],
) {
  if (!Array.isArray(profile.allowed_source_types)
      || !profile.allowed_source_types.some((entry) =>
        entry?.source_type === node.node_kind)) {
    fail(`selected profile ${profile.profile_id} does not allow node kind ${node.node_kind}`);
  }
  if (!Array.isArray(profile.allowed_operators) || profile.allowed_operators.length === 0
      || requiredOperators.some((operator) => !profile.allowed_operators.includes(operator))) {
    fail(`selected profile ${profile.profile_id} does not allow its expression operators`);
  }
  if (!Array.isArray(profile.required_fields) || !Array.isArray(profile.optional_fields)) {
    fail(`selected profile ${profile.profile_id} has no closed field declarations`);
  }
  const emitted = new Map(factDrafts.map((draft) => [draft.fieldKey, {
    valueType: draft.valueType,
    materiality: 'MATERIAL',
    typedValue: draft.typedValue,
  }]));
  const declared = new Map();
  const requiredFieldKeys = new Set();
  for (const [kind, requirements] of [
    ['required', profile.required_fields],
    ['optional', profile.optional_fields],
  ]) {
    const allowedCardinalities = kind === 'required'
      ? ['ONE', 'ONE_OR_MORE']
      : ['ZERO_OR_ONE', 'ZERO_OR_MORE'];
    for (const requirement of requirements) {
      if (!requirement || typeof requirement.field_key !== 'string'
          || !allowedCardinalities.includes(requirement.cardinality)
          || declared.has(requirement.field_key)) {
        fail(`selected profile ${profile.profile_id} has invalid field declarations`);
      }
      const generated = emitted.get(requirement.field_key);
      if ((kind === 'required' && !generated)
          || (generated && (requirement.value_type !== generated.valueType
            || requirement.materiality !== generated.materiality))) {
        fail(`selected profile ${profile.profile_id} cannot prove ${requirement.field_key}`);
      }
      declared.set(requirement.field_key, requirement);
      if (kind === 'required') requiredFieldKeys.add(requirement.field_key);
    }
  }
  if ([...emitted.keys()].some((fieldKey) => !declared.has(fieldKey))) {
    fail(`selected profile ${profile.profile_id} does not declare every emitted field`);
  }
  if (!Array.isArray(profile.minimum_floor_fields)
      || new Set(profile.minimum_floor_fields).size !== profile.minimum_floor_fields.length
      || !profile.minimum_floor_fields.includes('APPLIES_TO')
      || !profile.minimum_floor_fields.includes('LEGAL_EFFECT')
      || profile.minimum_floor_fields.some(
        (fieldKey) => !requiredFieldKeys.has(fieldKey) || !emitted.has(fieldKey),
      )) {
    fail(`selected profile ${profile.profile_id} has an unsupported minimum field`);
  }
  if (!Array.isArray(profile.child_rule_profiles)
      || !Array.isArray(profile.allowed_dependency_types)) {
    fail(`selected profile ${profile.profile_id} has invalid child or dependency declarations`);
  }
  for (const childProfile of profile.child_rule_profiles) {
    if (!childProfile || !['ZERO_OR_ONE', 'ZERO_OR_MORE', 'ONE', 'ONE_OR_MORE'].includes(
      childProfile.cardinality,
    )) {
      fail(`selected profile ${profile.profile_id} has an invalid child rule cardinality`);
    }
    if (childProfile.cardinality === 'ONE' || childProfile.cardinality === 'ONE_OR_MORE') {
      fail(`selected profile ${profile.profile_id} requires unsupported child output`);
    }
  }
  const selectedNodeDependencies = [
    ...(Array.isArray(contextCompilation.reference_edges)
      ? contextCompilation.reference_edges : []),
    ...(Array.isArray(contextCompilation.definition_edges)
      ? contextCompilation.definition_edges : []),
  ].filter((edge) => edge?.owner_node_occurrence_id === node.node_occurrence_id);
  if (selectedNodeDependencies.length !== 0) {
    fail(`selected profile ${profile.profile_id} has unsupported selected-node dependencies`);
  }
  if (!Array.isArray(profile.conditional_requirements)) {
    fail(`selected profile ${profile.profile_id} has invalid conditional requirements`);
  }
  for (const condition of profile.conditional_requirements) {
    const predicate = condition?.predicate;
    const predicateDeclaration = declared.get(predicate?.field_key);
    const predicateFact = emitted.get(predicate?.field_key);
    if (!predicateDeclaration || predicate.operator !== 'EQUALS'
        || predicate.value_type !== predicateDeclaration.value_type
        || !Array.isArray(condition.required_field_keys)) {
      fail(`selected profile ${profile.profile_id} has an unsupported conditional requirement`);
    }
    if (!predicateFact) continue;
    if (canonicalJson(predicate.typed_value) === canonicalJson(predicateFact.typedValue)
        && condition.required_field_keys.some((fieldKey) => !emitted.has(fieldKey))) {
      fail(`selected profile ${profile.profile_id} cannot emit a triggered conditional field`);
    }
  }
}

function terminationPhase2GovernedIds(authority) {
  const ids = new Set(
    authority.authorised_synthetic_rule_components.map((component) => component.component_key),
  );
  function visit(value, key = '') {
    if (typeof value === 'string') {
      if (/(?:^|_)(?:id|ids)$/u.test(key) && /^[0-9a-f]{64}$/u.test(value)) ids.add(value);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, key));
      return;
    }
    Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  }
  visit(authority);
  const ownerRegistry = authority.implementation_contract
    .reference_target_owner_template_registry;
  for (const template of ownerRegistry.templates) {
    ids.add(contentId(ownerRegistry.agreement_semantic_fact_v2_identity_projection.domain, {
      agreement_id: template.agreement_id,
      field_key: template.field_key,
      normalised_typed_value: template.typed_value,
      legal_subject: template.legal_subject,
      temporal_scope_signature: template.temporal_scope_signature,
      source_support_ids: template.source_supports.map(
        (support) => support.source_support_id,
      ),
      legal_effect_role: template.legal_effect_role,
    }));
  }
  return ids;
}

function terminationPhase2NormalisedValue(authority, fixture, contract, atom, agreementId) {
  const descriptor = contract.typed_value;
  if (descriptor && typeof descriptor === 'object'
      && !Array.isArray(descriptor)
      && descriptor.kind === 'DERIVED_REFERENCE_TARGET/V1') {
    const ownerRegistry = authority.implementation_contract
      .reference_target_owner_template_registry;
    const descriptorKey = canonicalJson(descriptor);
    const matches = ownerRegistry.templates.filter(
      (template) => canonicalJson(template.descriptor_key) === descriptorKey,
    );
    if (matches.length !== 1) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.REFERENCE,
        `reference descriptor for ${contract.field_key} does not resolve exactly once`,
      );
    }
    const [template] = matches;
    return contentId(fixture.reference_owner_projection_contract.owner_fact_projection_domain, {
      agreement_id: agreementId,
      field_key: template.field_key,
      value_type: template.value_type,
      typed_value: template.typed_value,
      legal_subject: template.legal_subject,
      temporal_scope_signature: template.temporal_scope_signature,
      legal_effect_role: template.legal_effect_role,
    });
  }
  if (contract.normaliser_id.startsWith('DURATION_PARSER/')) {
    const durationPolicy = authority.policy_overlay.duration_parser_v3;
    let forms;
    if (contract.normaliser_id === 'DURATION_PARSER/V1') {
      forms = durationPolicy.inherited_v1_forms;
    } else if (contract.normaliser_id === 'DURATION_PARSER/V2') {
      forms = [
        durationPolicy.inherited_v2_phase2_source_form,
        ...durationPolicy.phase1_v2_unchanged.exact_inherited_forms,
      ];
    } else if (contract.normaliser_id === durationPolicy.rule_id) {
      forms = durationPolicy.exact_added_forms;
    } else {
      forms = [];
    }
    const matches = forms.filter((entry) => entry.source_form === atom);
    if (matches.length !== 1
        || canonicalJson(matches[0].typed_value) !== canonicalJson(contract.typed_value)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        `duration normaliser does not reproduce ${contract.field_key}`,
      );
    }
  } else if (contract.normaliser_id === 'REFERENCE_EDGE/V1'
      && (contract.value_type !== 'REFERENCE'
        || typeof contract.typed_value !== 'string'
        || !/^[0-9a-f]{64}$/u.test(contract.typed_value))) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.REFERENCE,
      `direct reference for ${contract.field_key} is invalid`,
    );
  } else if (contract.normaliser_id === 'ENUM_LITERAL_MAP/V1') {
    const normalisedEnum = wordTokens(atom).join('_').toUpperCase();
    if (contract.value_type !== 'ENUM'
        || typeof contract.typed_value !== 'string'
        || !/^[\p{L}\p{N}'’]+(?:[ _-][\p{L}\p{N}'’]+)*$/u.test(atom)
        || /\b(?:and|or|if|unless|except|provided|earlier|later)\b/iu.test(atom)
        || normalisedEnum !== contract.typed_value) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        `enum normaliser does not reproduce ${contract.field_key}`,
      );
    }
  }
  return clone(contract.typed_value);
}

function compileTerminationPhase2Component(authority, componentKey) {
  const components = authority.authorised_synthetic_rule_components.filter(
    (component) => component.component_key === componentKey,
  );
  if (components.length !== 1) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.TOPOLOGY,
      `unknown or duplicated Termination Phase2 component ${componentKey}`,
    );
  }
  const [component] = components;
  const componentContract = authority.synthetic_component_contract;
  if (!hasExactKeys(component, componentContract.exact_component_record_keys)) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.TOPOLOGY,
      `component ${componentKey} has an invalid record shape`,
    );
  }
  const fixture = componentContract.synthetic_fixture_identity_contract;
  const factPathRows = fixture.fact_path_registry.filter(
    (row) => row.component_key === componentKey,
  );
  const factPathByKey = new Map(factPathRows.map(
    (row) => [`${row.expression_path}\0${row.field_key}`, row],
  ));
  const atomBySupportId = new Map(fixture.atom_text_registry.map(
    (row) => [row.source_support_id, row.source_text],
  ));
  const factContractByField = new Map(component.fact_contracts.map(
    (contract) => [contract.field_key, contract],
  ));
  const supportByLabel = new Map(component.source_supports.map(
    (support) => [support.label, support],
  ));
  const operatorContractByName = new Map(component.operator_contracts.map(
    (contract) => [contract.operator, contract.exact_contract],
  ));
  if (factContractByField.size !== component.fact_contracts.length
      || supportByLabel.size !== component.source_supports.length
      || operatorContractByName.size !== component.operator_contracts.length) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.TOPOLOGY,
      `component ${componentKey} contains duplicated contracts`,
    );
  }

  const records = [];
  const usedFacts = new Set();
  const usedOperators = new Set();
  function visit(node, path, parentPath) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        `component ${componentKey} has an invalid node at ${path}`,
      );
    }
    if (node.kind === 'FACT') {
      if (!hasExactKeys(node, ['kind', 'field_key'])
          || usedFacts.has(node.field_key)) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.TOPOLOGY,
          `component ${componentKey} has an invalid or repeated fact at ${path}`,
        );
      }
      const contract = factContractByField.get(node.field_key);
      const pathRow = factPathByKey.get(`${path}\0${node.field_key}`);
      if (!contract || !pathRow
          || !hasExactKeys(contract, componentContract.fact_contract.exact_keys)
          || !Array.isArray(contract.source_support_labels)
          || contract.source_support_labels.length !== 1
          || contract.source_support_labels[0] !== pathRow.source_support_label) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.TOPOLOGY,
          `component ${componentKey} cannot bind fact ${node.field_key} at ${path}`,
        );
      }
      const support = supportByLabel.get(pathRow.source_support_label);
      const atom = atomBySupportId.get(pathRow.source_support_id);
      if (!support || typeof atom !== 'string'
          || !hasExactKeys(support, componentContract.source_support_contract.exact_keys)
          || !hasExactKeys(
            support.source_span,
            componentContract.source_support_contract.source_span_exact_keys,
          )) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.PROVENANCE,
          `component ${componentKey} has no exact atom support for ${node.field_key}`,
        );
      }
      const nativeSupportId = contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: component.agreement_index_id,
        source_node_occurrence_id: support.node_occurrence_id,
        start_byte: support.source_span.start_byte,
        end_byte: support.source_span.end_byte,
        text_sha256: support.source_span.text_sha256,
      });
      if (nativeSupportId !== pathRow.source_support_id
          || Buffer.byteLength(atom, 'utf8')
            !== support.source_span.end_byte - support.source_span.start_byte
          || sha256Hex(Buffer.from(atom, 'utf8')) !== support.source_span.text_sha256) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.PROVENANCE,
          `component ${componentKey} has stale atom support for ${node.field_key}`,
        );
      }
      usedFacts.add(node.field_key);
      records.push({
        atom,
        kind: 'FACT',
        node,
        parentPath,
        path,
        pathRow,
        support,
        token: atom,
      });
      return node.field_key;
    }
    if (node.kind !== 'EXPRESSION'
        || !hasExactKeys(node, ['kind', 'operator', 'result_kind', 'children'])
        || !Array.isArray(node.children)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        `component ${componentKey} has an invalid expression at ${path}`,
      );
    }
    const operatorContract = operatorContractByName.get(node.operator);
    const arity = operatorContract?.arity;
    const validArity = Number.isInteger(arity)
      ? node.children.length === arity
      : ['AT_LEAST_2', 'AT_LEAST_2_TEMPORAL'].includes(arity)
        && node.children.length >= 2;
    if (!operatorContract || node.result_kind !== operatorContract.result_kind || !validArity) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        `component ${componentKey} violates ${node.operator} at ${path}`,
      );
    }
    usedOperators.add(node.operator);
    records.push({ kind: 'EXPRESSION', node, parentPath, path, token: node.operator });
    const childSignatures = node.children.map((child, index) => {
      if (!hasExactKeys(child, componentContract.expression_contract.child_exact_keys)) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.TOPOLOGY,
          `component ${componentKey} has an invalid ${node.operator} child`,
        );
      }
      const childContract = Array.isArray(operatorContract.allowed_child_contracts)
        ? operatorContract.allowed_child_contracts[index]
        : null;
      const expectedRole = childContract?.role
        ?? (operatorContract.child_roles.length === 1
          ? operatorContract.child_roles[0] : operatorContract.child_roles[index]);
      const allowedChildKinds = childContract?.allowed_child_kinds
        ?? operatorContract.allowed_child_kinds;
      if (child.role !== expectedRole || !allowedChildKinds.includes(child.node?.kind)) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.TOPOLOGY,
          `component ${componentKey} has an invalid ${node.operator} child role`,
        );
      }
      if (child.node.kind === 'FACT') {
        const factContract = factContractByField.get(child.node.field_key);
        const allowedValueKinds = childContract?.allowed_fact_value_kinds
          ?? operatorContract.fact_value_kinds;
        if (Array.isArray(allowedValueKinds)
            && (!factContract || !allowedValueKinds.includes(factContract.value_type))) {
          terminationPhase2Fail(
            TERMINATION_PHASE2_ERROR.TOPOLOGY,
            `component ${componentKey} has an invalid ${node.operator} fact type`,
          );
        }
      } else if (Array.isArray(childContract?.allowed_expression_result_kinds)
          && !childContract.allowed_expression_result_kinds.includes(child.node.result_kind)) {
        terminationPhase2Fail(
          TERMINATION_PHASE2_ERROR.TOPOLOGY,
          `component ${componentKey} has an invalid ${node.operator} expression type`,
        );
      }
      return visit(child.node, `${path}.${index + 1}`, path);
    });
    return `${node.operator}(${childSignatures.join(',')})`;
  }

  const literalSignature = visit(component.expression_tree, '0', null);
  if (literalSignature !== component.literal_signature
      || usedFacts.size !== component.fact_contracts.length
      || usedFacts.size !== factPathRows.length
      || canonicalJson([...usedOperators].sort())
        !== canonicalJson([...component.allowed_operators].sort())
      || canonicalJson([...operatorContractByName.keys()].sort())
        !== canonicalJson([...component.allowed_operators].sort())) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.TOPOLOGY,
      `component ${componentKey} does not reproduce its sealed topology`,
    );
  }

  const construction = fixture.source_text_construction_contract;
  const recordTexts = records.map((record) => {
    const pathLength = Buffer.byteLength(record.path, 'utf8');
    if (record.kind === 'EXPRESSION') {
      return `E${pathLength}:${record.path}`
        + `${Buffer.byteLength(record.token, 'utf8')}:${record.token}`;
    }
    const fieldKey = record.node.field_key;
    return `F${pathLength}:${record.path}`
      + `${Buffer.byteLength(fieldKey, 'utf8')}:${fieldKey}`
      + `${Buffer.byteLength(record.atom, 'utf8')}:${record.atom}`;
  });
  const sourceText = `${construction.header}\n${recordTexts.join('\n')}`;
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const componentContractSha256 = sha256Hex(canonicalJson(component));
  const identity = fixture.identity_contract;
  const fixtureId = contentId(identity.fixture_id.domain, {
    component_contract_sha256: componentContractSha256,
    fixture_contract_version: fixture.fixture_contract_version,
    synthetic_source_text_byte_length: sourceBytes.length,
    synthetic_source_text_sha256: sha256Hex(sourceBytes),
  });
  const childIds = Object.fromEntries(identity.derived_child_id_contracts.map((contract) => [
    contract.identity_name,
    contentId(contract.domain, { fixture_id: fixtureId }),
  ]));
  const governedIds = terminationPhase2GovernedIds(authority);
  for (const derivedId of [fixtureId, ...Object.values(childIds)]) {
    if (governedIds.has(derivedId)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.PROVENANCE,
        `component ${componentKey} derives a governed identity`,
      );
    }
  }

  let cursor = Buffer.byteLength(`${construction.header}\n`, 'utf8');
  const spanByPath = new Map();
  const spans = records.map((record, index) => {
    const recordText = recordTexts[index];
    const tokenBytes = Buffer.from(record.token, 'utf8');
    const tokenOffset = Buffer.byteLength(recordText, 'utf8') - tokenBytes.length;
    const startByte = cursor + tokenOffset;
    const endByte = startByte + tokenBytes.length;
    const textSha256 = sha256Hex(tokenBytes);
    const span = {
      span_id: contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: childIds.agreement_index_id,
        source_node_occurrence_id: childIds.source_node_occurrence_id,
        start_byte: startByte,
        end_byte: endByte,
        text_sha256: textSha256,
      }),
      source_node_occurrence_id: childIds.source_node_occurrence_id,
      start_byte: startByte,
      end_byte: endByte,
      text_sha256: textSha256,
      legal_text: false,
      operative: false,
      materiality: 'NON_MATERIAL',
    };
    spanByPath.set(record.path, span);
    cursor += Buffer.byteLength(recordText, 'utf8') + (index + 1 < records.length ? 1 : 0);
    return span;
  });
  if (cursor !== sourceBytes.length) {
    terminationPhase2Fail(
      TERMINATION_PHASE2_ERROR.PROVENANCE,
      `component ${componentKey} has an invalid synthetic byte partition`,
    );
  }

  const factByPath = new Map();
  const facts = records.filter((record) => record.kind === 'FACT').map((record) => {
    const contract = factContractByField.get(record.node.field_key);
    const typedValue = terminationPhase2NormalisedValue(
      authority,
      fixture,
      contract,
      record.atom,
      childIds.agreement_id,
    );
    const fact = makeFact({
      agreementId: childIds.agreement_id,
      fieldKey: contract.field_key,
      valueType: contract.value_type,
      typedValue,
      supportSpans: [spanByPath.get(record.path)],
      contextEdgeIds: [],
      legalSubject: contract.legal_subject,
      ruleId: 'SYNTHETIC_PENDING_RULE_ID',
      normalisationRule: contract.normaliser_id,
    });
    if (governedIds.has(fact.fact_id) || governedIds.has(fact.semantic_fact_key)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.PROVENANCE,
        `component ${componentKey} derives a governed fact identity`,
      );
    }
    factByPath.set(record.path, fact);
    return fact;
  });

  const expressionByPath = new Map();
  function compileExpression(node, path) {
    const children = node.children.map((child, index) => {
      const childPath = `${path}.${index + 1}`;
      const compiledChild = child.node.kind === 'FACT'
        ? factByPath.get(childPath) : compileExpression(child.node, childPath);
      return {
        kind: child.node.kind,
        id: child.node.kind === 'FACT'
          ? compiledChild.fact_id : compiledChild.expression_id,
        ordinal: index + 1,
        role: child.role,
      };
    });
    const expressionIdentity = {
      operator: node.operator,
      result_kind: node.result_kind,
      children,
      connective_span_ids: [spanByPath.get(path).span_id],
      authored_limb_marker_span_ids: [],
      scope_span_ids: records.filter(
        (record) => record.path === path || record.path.startsWith(`${path}.`),
      ).map((record) => spanByPath.get(record.path).span_id),
    };
    const expression = {
      expression_id: contentId(EXPRESSION_SCHEMA, expressionIdentity),
      ...expressionIdentity,
    };
    if (governedIds.has(expression.expression_id)) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.PROVENANCE,
        `component ${componentKey} derives a governed expression identity`,
      );
    }
    expressionByPath.set(path, expression);
    return expression;
  }
  const rootExpression = compileExpression(component.expression_tree, '0');
  const expressions = records.filter((record) => record.kind === 'EXPRESSION').map((record) => ({
    ...expressionByPath.get(record.path),
    parent_expression_id: record.parentPath === null
      ? null : expressionByPath.get(record.parentPath).expression_id,
  }));
  return deepFreeze({
    profile_id: `${fixture.output_contract.profile_id_prefix}${childIds.profile_content_id}`,
    expression_signature: component.literal_signature,
    root_expression_id: rootExpression.expression_id,
    source_spans: spans,
    facts,
    expressions,
  });
}

function compileSyntheticProfileExpression(input) {
  const terminationPhase2OwnProperty = input && typeof input === 'object'
    && !Array.isArray(input)
    && Object.hasOwn(input, 'terminationAuthoringPhase2Authority');
  if (terminationPhase2OwnProperty) {
    if (input.terminationAuthoringPhase2Authority === undefined) {
      const fallbackInput = { ...input };
      delete fallbackInput.terminationAuthoringPhase2Authority;
      return compileSyntheticProfileExpression(fallbackInput);
    }
    const terminationPhase2Authority = validateTerminationPhase2AuthorityEnvelope(
      input.terminationAuthoringPhase2Authority,
    );
    const exactInputKeys = terminationPhase2Authority.synthetic_component_contract
      .synthetic_fixture_identity_contract.active_input_contract.exact_keys;
    if (!hasExactKeys(input, exactInputKeys)
        || typeof input.component_key !== 'string'
        || input.component_key.length === 0) {
      terminationPhase2Fail(
        TERMINATION_PHASE2_ERROR.TOPOLOGY,
        'active Termination Phase2 compiler input has an invalid shape',
      );
    }
    return compileTerminationPhase2Component(
      terminationPhase2Authority,
      input.component_key,
    );
  }
  const temporalPhase1AuthoritySupplied = input && typeof input === 'object'
    && !Array.isArray(input) && Object.hasOwn(input, 'temporalPhase1Authority')
    && input.temporalPhase1Authority !== undefined;
  const temporalPhase1Capability = temporalPhase1AuthoritySupplied
    ? validateTemporalPhase1AuthorityEnvelope(input.temporalPhase1Authority)
    : null;
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.agreement_id !== 'string' || input.agreement_id.length === 0
      || typeof input.agreement_index_id !== 'string' || input.agreement_index_id.length === 0
      || typeof input.source_node_occurrence_id !== 'string'
      || input.source_node_occurrence_id.length === 0
      || !input.profile || typeof input.profile !== 'object'
      || Array.isArray(input.profile)
      || typeof input.profile.profile_id !== 'string' || input.profile.profile_id.length === 0
      || !Array.isArray(input.profile.allowed_operators)
      || typeof input.profile.required_expression_signature !== 'string'
      || !input.source || typeof input.source !== 'object' || Array.isArray(input.source)
      || typeof input.source.text !== 'string' || input.source.text.length === 0
      || !Array.isArray(input.source.facts)
      || !input.source.expression || typeof input.source.expression !== 'object') {
    fail('synthetic profile expression input is invalid');
  }
  const governedDisclosureNoteById = new Map();
  if (Array.isArray(input.source.governed_disclosure_notes)) {
    for (const note of input.source.governed_disclosure_notes) {
      if (!note || typeof note !== 'object' || Array.isArray(note)
          || note.schema_version !== GOVERNED_DISCLOSURE_NOTE_SCHEMA
          || typeof note.governed_disclosure_note_id !== 'string'
          || governedDisclosureNoteById.has(note.governed_disclosure_note_id)) {
        fail('synthetic governed disclosure note is invalid or duplicated');
      }
      governedDisclosureNoteById.set(note.governed_disclosure_note_id, note);
    }
  }
  const effectiveOperators = temporalPhase1Capability
    ? new Map(SYNTHETIC_EXPRESSION_OPERATORS) : SYNTHETIC_EXPRESSION_OPERATORS;
  const effectiveTemporalFactTypes = temporalPhase1Capability
    ? new Set([...SYNTHETIC_TEMPORAL_FACT_TYPES, 'DEFINED_TERM'])
    : SYNTHETIC_TEMPORAL_FACT_TYPES;
  if (temporalPhase1Capability) {
    for (const contract of temporalPhase1Capability.policy_overlay.new_operator_contracts) {
      effectiveOperators.set(contract.operator, {
        min: contract.arity,
        max: contract.arity,
        roles: contract.allowed_child_contracts.map((child) => child.role),
        resultKind: contract.result_kind,
        childContracts: contract.allowed_child_contracts,
      });
    }
    const definedTermExtension = temporalPhase1Capability.policy_overlay
      .existing_operator_extensions.find((extension) => extension.base_operator === 'EARLIER_OF');
    const earlierOf = effectiveOperators.get('EARLIER_OF');
    effectiveOperators.set('EARLIER_OF', {
      ...earlierOf,
      resultKind: 'TEMPORAL',
      childContracts: [{
        allowed_child_kinds: ['FACT', 'EXPRESSION'],
        allowed_expression_result_kinds: ['TEMPORAL'],
        allowed_fact_value_kinds: definedTermExtension.resulting_allowed_fact_value_kinds,
        role: 'MEMBER',
      }],
    });
    effectiveOperators.set('ANY_OF', {
      ...effectiveOperators.get('ANY_OF'),
      resultKind: 'LOGICAL',
      childContracts: [{
        allowed_child_kinds: ['EXPRESSION'],
        allowed_expression_result_kinds: ['LOGICAL'],
        role: 'MEMBER',
      }],
    });
    effectiveOperators.set('NOT', {
      ...effectiveOperators.get('NOT'),
      resultKind: 'LOGICAL',
      childContracts: [{
        allowed_child_kinds: ['EXPRESSION'],
        allowed_expression_result_kinds: ['LOGICAL'],
        role: 'NEGATED',
      }],
    });
    const signatures = temporalPhase1Capability.policy_overlay.required_synthetic_signatures;
    if (!Object.values(signatures).includes(input.profile.required_expression_signature)) {
      fail('temporal Phase 1 authority permits only its exact synthetic signatures');
    }
    const expectedNodeId = input.profile.required_expression_signature === signatures.red_hat_7_01_d
      ? temporalPhase1Capability.red_hat_source_authority.exact_m2_nodes.find(
        (node) => node.purpose === '7_01_D_TEMPORAL_RULE_SOURCE',
      ).node_occurrence_id
      : temporalPhase1Capability.policy_overlay.event_reference_contract
        .consumer_node_occurrence_id;
    if (input.source_node_occurrence_id !== expectedNodeId) {
      fail('temporal Phase 1 synthetic signature cites an unauthorised source node');
    }
  }
  if (!temporalPhase1Capability) {
    const seenExpressionNodes = new Set();
    const findUnsupportedOperator = (node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)
          || seenExpressionNodes.has(node)) return null;
      seenExpressionNodes.add(node);
      if (typeof node.operator === 'string' && !effectiveOperators.has(node.operator)) {
        return node.operator;
      }
      if (!Array.isArray(node.children)) return null;
      for (const child of node.children) {
        const unsupported = findUnsupportedOperator(child);
        if (unsupported) return unsupported;
      }
      return null;
    };
    const unsupportedOperator = findUnsupportedOperator(input.source.expression);
    if (unsupportedOperator) {
      fail(
        `synthetic operator ${unsupportedOperator} is unsupported, disallowed, or has invalid arity`,
      );
    }
  }
  const sourceBytes = Buffer.from(input.source.text, 'utf8');
  const occupiedRanges = [];
  const spans = [];
  function sourceSpan(selector, label) {
    if (!selector || typeof selector !== 'object' || Array.isArray(selector)
        || !Number.isInteger(selector.start_byte) || !Number.isInteger(selector.end_byte)
        || selector.start_byte < 0 || selector.end_byte <= selector.start_byte
        || selector.end_byte > sourceBytes.length
        || typeof selector.quote !== 'string' || selector.quote.length === 0
        || sourceBytes.subarray(selector.start_byte, selector.end_byte).toString('utf8')
          !== selector.quote
        || occupiedRanges.some(([start, end]) => (
          selector.start_byte < end && selector.end_byte > start
        ))) {
      fail(`synthetic ${label} selector is invalid or overlaps another source part`);
    }
    occupiedRanges.push([selector.start_byte, selector.end_byte]);
    const span = makeSpan(
      input.agreement_index_id,
      input.source_node_occurrence_id,
      sourceBytes,
      selector.start_byte,
      selector.end_byte,
      false,
    );
    spans.push(span);
    return span;
  }

  const temporalDurationFixtureByField = temporalPhase1Capability ? new Map([
    [
      'INTENT_NOTICE_LEAD_PERIOD',
      {
        boundType: 'AT_LEAST',
        count: 1,
        authoritySupportLabel: 'CII_ONE_BUSINESS_DAY',
      },
    ],
    [
      'CURE_PERIOD',
      {
        boundType: 'EXACT',
        count: 30,
        authoritySupportLabel: 'D_THIRTY_BUSINESS_DAYS',
      },
    ],
  ]) : null;
  const temporalAuthoritySupportByLabel = temporalPhase1Capability ? new Map(
    temporalPhase1Capability.red_hat_source_authority.exact_support_spans.map(
      (support) => [support.label, support.source_span],
    ),
  ) : null;
  const temporalDefinedTermFields = new Set([
    'CAPABILITY_TERMINATION_DATE',
    'DEADLINE_TERMINATION_DATE',
  ]);

  const factByKey = new Map();
  for (const sourceFact of input.source.facts) {
    if (!sourceFact || typeof sourceFact !== 'object' || Array.isArray(sourceFact)
        || typeof sourceFact.field_key !== 'string' || sourceFact.field_key.length === 0
        || factByKey.has(sourceFact.field_key)
        || typeof sourceFact.value_type !== 'string' || sourceFact.value_type.length === 0
        || typeof sourceFact.legal_subject !== 'string'
        || sourceFact.legal_subject.trim().length === 0
        || sourceFact.typed_value === undefined) {
      fail('synthetic source fact is invalid or duplicated');
    }
    const hasNormalisationRule = Object.hasOwn(sourceFact, 'normalisation_rule_id');
    const hasAuthoritySourceSupport = Object.hasOwn(sourceFact, 'authority_source_support');
    if (!temporalPhase1Capability && (hasNormalisationRule || hasAuthoritySourceSupport)) {
      fail('temporal normalisation evidence requires temporal Phase 1 authority');
    }
    const supportSpan = sourceSpan(sourceFact.selector, `fact ${sourceFact.field_key}`);
    let normalisationRule = 'SYNTHETIC_LITERAL/V1';
    if (temporalPhase1Capability) {
      if (sourceFact.value_type === 'DEFINED_TERM') {
        if (hasNormalisationRule || hasAuthoritySourceSupport
            || !temporalDefinedTermFields.has(sourceFact.field_key)
            || sourceFact.typed_value !== 'Termination Date') {
          fail('temporal Phase 1 DEFINED_TERM fact is invalid');
        }
      } else if (sourceFact.value_type === 'DURATION') {
        const durationFixture = temporalDurationFixtureByField.get(sourceFact.field_key);
        const parsedDuration = parseTemporalPhase1BusinessDayDuration(
          sourceFact.selector.quote,
        );
        const durationRule = temporalPhase1Capability.policy_overlay.duration_normalisation;
        const expectedAuthoritySupport = durationFixture
          ? temporalAuthoritySupportByLabel.get(durationFixture.authoritySupportLabel) : null;
        if (!durationFixture || !parsedDuration
            || parsedDuration.bound_type !== durationFixture.boundType
            || parsedDuration.count !== durationFixture.count
            || !durationRule.allowed_bound_types.includes(parsedDuration.bound_type)
            || parsedDuration.unit !== durationRule.business_day_unit.canonical_unit
            || !hasNormalisationRule || !hasAuthoritySourceSupport
            || sourceFact.normalisation_rule_id !== durationRule.normalisation_rule_id
            || canonicalJson(sourceFact.typed_value) !== canonicalJson(parsedDuration)
            || canonicalJson(sourceFact.authority_source_support)
              !== canonicalJson(expectedAuthoritySupport)) {
          fail('temporal Phase 1 duration fact does not prove its exact parser result');
        }
        normalisationRule = durationRule.normalisation_rule_id;
      } else if (hasNormalisationRule || hasAuthoritySourceSupport) {
        fail('temporal Phase 1 normalisation evidence is attached to a non-duration fact');
      }
    }
    const fact = makeFact({
      agreementId: input.agreement_id,
      fieldKey: sourceFact.field_key,
      valueType: sourceFact.value_type,
      typedValue: sourceFact.typed_value,
      legalSubject: sourceFact.legal_subject,
      supportSpans: [supportSpan],
      ruleId: 'SYNTHETIC_PENDING_RULE_ID',
      normalisationRule,
    });
    factByKey.set(sourceFact.field_key, fact);
  }

  const temporalFixtureFactReferenceCounts = temporalPhase1Capability
    ? new Map([...factByKey.keys()].map((fieldKey) => [fieldKey, 0])) : null;
  const allowedOperators = new Set(input.profile.allowed_operators);
  const visitedNodes = new Set();
  function compileNode(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || visitedNodes.has(node)) {
      fail('synthetic expression tree is cyclic, shared, or invalid');
    }
    visitedNodes.add(node);
    const contract = effectiveOperators.get(node.operator);
    if (!contract || !allowedOperators.has(node.operator)
        || !Array.isArray(node.children)
        || node.children.length < contract.min || node.children.length > contract.max) {
      fail(`synthetic operator ${node.operator} is unsupported, disallowed, or has invalid arity`);
    }
    const connectiveSpan = sourceSpan(node.selector, `operator ${node.operator}`);
    if (Object.hasOwn(node, 'authored_limb_marker_selectors')) {
      fail('authored limb markers are unsupported in synthetic expressions');
    }
    const compiledChildren = node.children.map((child) => {
      if (child && typeof child === 'object' && !Array.isArray(child)
          && typeof child.fact_key === 'string') {
        const fact = factByKey.get(child.fact_key);
        if (!fact) fail(`synthetic expression cites unknown fact ${child.fact_key}`);
        if (temporalFixtureFactReferenceCounts) {
          temporalFixtureFactReferenceCounts.set(
            fact.field_key,
            temporalFixtureFactReferenceCounts.get(fact.field_key) + 1,
          );
        }
        return {
          kind: 'FACT',
          id: fact.fact_id,
          signature: fact.field_key,
          expression: null,
          resultKind: effectiveTemporalFactTypes.has(fact.value_type)
            ? 'TEMPORAL' : 'LOGICAL',
          valueType: fact.value_type,
        };
      }
      if (child && typeof child === 'object' && !Array.isArray(child)
          && typeof child.governed_disclosure_note_id === 'string') {
        const note = governedDisclosureNoteById.get(child.governed_disclosure_note_id);
        if (!note) {
          fail(
            `synthetic expression cites unknown governed disclosure note ${child.governed_disclosure_note_id}`,
          );
        }
        return {
          kind: 'GOVERNED_DISCLOSURE_NOTE',
          id: note.governed_disclosure_note_id,
          signature: note.field_key,
          expression: null,
          resultKind: 'LOGICAL',
        };
      }
      const compiled = compileNode(child);
      return {
        kind: 'EXPRESSION',
        id: compiled.expression.expression_id,
        signature: compiled.signature,
        expression: compiled,
        resultKind: compiled.expression.result_kind,
      };
    });
    const childReferences = compiledChildren.map((child) => `${child.kind}:${child.id}`);
    if (new Set(childReferences).size !== childReferences.length) {
      fail(`synthetic operator ${node.operator} cites the same child twice`);
    }
    const resultKind = contract.resultKind
      ?? (node.operator === 'EARLIER_OF' ? 'TEMPORAL' : 'LOGICAL');
    if (temporalPhase1Capability && contract.childContracts) {
      for (const [index, child] of compiledChildren.entries()) {
        const childContract = contract.childContracts.length === 1
          ? contract.childContracts[0] : contract.childContracts[index];
        if (!childContract || !childContract.allowed_child_kinds.includes(child.kind)) {
          fail(`${node.operator} child ${index + 1} has an invalid authority-gated kind`);
        }
        if (child.kind === 'FACT'
            && (!Array.isArray(childContract.allowed_fact_value_kinds)
              || !childContract.allowed_fact_value_kinds.includes(child.valueType))) {
          fail(`${node.operator} child ${index + 1} has an invalid authority-gated fact type`);
        }
        if (child.kind === 'EXPRESSION'
            && (!Array.isArray(childContract.allowed_expression_result_kinds)
              || !childContract.allowed_expression_result_kinds.includes(child.resultKind))) {
          fail(`${node.operator} child ${index + 1} has an invalid authority-gated result kind`);
        }
      }
    }
    if (!temporalPhase1Capability && resultKind === 'TEMPORAL'
        && compiledChildren.some((child) => child.resultKind !== 'TEMPORAL')) {
      fail(`${node.operator} contains a non-temporal synthetic child`);
    }
    const descendantSpans = [
      connectiveSpan,
      ...compiledChildren.flatMap((child) => (
        child.kind === 'FACT'
          ? factByKey.get(child.signature).source_support_ids.map((spanId) => (
            spans.find((span) => span.span_id === spanId)
          ))
          : child.kind === 'GOVERNED_DISCLOSURE_NOTE'
            ? []
            : child.expression.scopeSpans
      )),
    ].sort((left, right) => left.start_byte - right.start_byte);
    const identity = {
      operator: node.operator,
      result_kind: resultKind,
      children: compiledChildren.map((child, index) => ({
        kind: child.kind,
        id: child.id,
        ordinal: index + 1,
        role: contract.roles.length === 1 ? contract.roles[0] : contract.roles[index],
      })),
      connective_span_ids: [connectiveSpan.span_id],
      authored_limb_marker_span_ids: [],
      scope_span_ids: [...new Set(descendantSpans.map((span) => span.span_id))],
    };
    return {
      expression: {
        expression_id: contentId(EXPRESSION_SCHEMA, identity),
        ...identity,
        parent_expression_id: null,
      },
      signature: `${node.operator}(${compiledChildren.map(
        (child) => child.signature,
      ).join(',')})`,
      children: compiledChildren,
      scopeSpans: descendantSpans,
    };
  }

  const root = compileNode(input.source.expression);
  if (temporalFixtureFactReferenceCounts) {
    const invalidFixtureFact = [...temporalFixtureFactReferenceCounts.entries()].find(
      ([, referenceCount]) => referenceCount !== 1,
    );
    if (invalidFixtureFact) {
      fail(
        `temporal Phase 1 exact synthetic fixture must cite ${invalidFixtureFact[0]} exactly once`,
      );
    }
  }
  if (root.signature !== input.profile.required_expression_signature) {
    fail(`synthetic expression signature ${root.signature} does not match its profile`);
  }
  const expressions = [];
  function materialize(node, parentExpressionId) {
    expressions.push({
      ...node.expression,
      parent_expression_id: parentExpressionId,
    });
    for (const child of node.children) {
      if (child.expression) materialize(child.expression, node.expression.expression_id);
    }
  }
  materialize(root, null);
  spans.sort((left, right) => left.start_byte - right.start_byte);
  return deepFreeze({
    profile_id: input.profile.profile_id,
    expression_signature: root.signature,
    root_expression_id: root.expression.expression_id,
    source_spans: spans,
    facts: [...factByKey.values()],
    expressions,
  });
}

function rejectMatchingStructureDisposition({
  approvedStructureDispositions,
  agreementIndex,
  occurrenceId,
  nodeId,
  nodeStart,
  nodeEnd,
  nodeText,
  sourceBytes,
}) {
  for (const member of approvedStructureDispositions.members) {
    if (member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY') continue;
    const scope = member.scope;
    if (!scope?.governed_input_occurrence_ids?.includes(occurrenceId)) continue;
    if (scope.agreement_index_id !== agreementIndex.agreement_index_id
        || scope.source_node_occurrence_id !== nodeId) continue;
    const startByte = scope.start_byte;
    const endByte = scope.end_byte;
    if (!Number.isInteger(startByte) || !Number.isInteger(endByte)
        || startByte < nodeStart || endByte > nodeEnd || endByte <= startByte) {
      fail('an approved structure disposition has invalid governed source scope');
    }
    if (member.kind === 'NO_OUTPUT' && (startByte !== nodeStart || endByte !== nodeEnd)) {
      fail('a NO_OUTPUT structure disposition must cover the whole governed node');
    }
    let matchSource;
    if (member.match_test?.scope === 'EFFECT_SOURCE_SPANS') {
      matchSource = sourceBytes.subarray(startByte, endByte).toString('utf8');
    } else if (member.match_test?.scope === 'AUTHORED_UNIT_SOURCE_CLOSURE') {
      matchSource = nodeText;
    } else {
      fail('an approved structure disposition has an unsupported match scope');
    }
    if (profileResult({
      profile_id: member.structure_disposition_id,
      profile_key: member.kind,
      match_test: member.match_test,
    }, matchSource).matched) {
      fail('an approved structure disposition claims the otherwise normal occurrence');
    }
  }
}

function compileSyntheticOccurrence({
  agreementId,
  agreementIndex,
  approvedFamilyPackets,
  approvedStructureDispositions,
  contextCompilation,
  node,
  nodeStart,
  nodeEnd,
  nodeText,
  occurrenceId,
  payload,
  profile,
  profileResults,
  profiles,
  sourceBytes,
}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).length !== 2
      || !Object.hasOwn(payload, 'input_occurrence_id')
      || !Object.hasOwn(payload, 'source')
      || payload.input_occurrence_id !== occurrenceId
      || payload.source?.text !== sourceBytes.toString('utf8')) {
    fail(`synthetic expression payload for ${occurrenceId} is invalid or cites other source`);
  }
  const compiled = compileSyntheticProfileExpression({
    agreement_id: agreementId,
    agreement_index_id: agreementIndex.agreement_index_id,
    source_node_occurrence_id: node.node_occurrence_id,
    profile,
    source: payload.source,
  });
  validateSelectedProfileCapability(
    profile,
    node,
    payload.source.facts.map((fact) => ({
      fieldKey: fact.field_key,
      valueType: fact.value_type,
      typedValue: fact.typed_value,
    })),
    contextCompilation,
    [...new Set(compiled.expressions.map((expression) => expression.operator))],
  );
  const spans = compiled.source_spans.map((span) => ({ ...span }));
  if (spans.length === 0 || spans[0].start_byte !== nodeStart
      || spans.at(-1).end_byte !== nodeEnd
      || spans.some((span, index) => span.source_node_occurrence_id !== node.node_occurrence_id
        || (index > 0 && spans[index - 1].end_byte !== span.start_byte))) {
    fail(`synthetic expression payload for ${occurrenceId} does not partition its full node`);
  }
  const spanById = new Map(spans.map((span) => [span.span_id, span]));
  const factBySpan = new Map();
  for (const fact of compiled.facts) {
    for (const spanId of fact.source_support_ids) {
      if (!spanById.has(spanId) || factBySpan.has(spanId)) {
        fail(`synthetic expression payload for ${occurrenceId} has invalid fact ownership`);
      }
      factBySpan.set(spanId, fact.fact_id);
    }
  }
  const expressionBySpan = new Map();
  for (const expression of compiled.expressions) {
    for (const spanId of expression.connective_span_ids) {
      if (!spanById.has(spanId) || expressionBySpan.has(spanId) || factBySpan.has(spanId)) {
        fail(`synthetic expression payload for ${occurrenceId} has invalid logic ownership`);
      }
      expressionBySpan.set(spanId, expression.expression_id);
    }
  }
  if (spans.some((span) => !factBySpan.has(span.span_id)
      && !expressionBySpan.has(span.span_id))) {
    fail(`synthetic expression payload for ${occurrenceId} leaves source without an owner`);
  }
  const legalEffectFacts = compiled.facts.filter((fact) => fact.field_key === 'LEGAL_EFFECT');
  const modalMarkerSpanIds = legalEffectFacts.flatMap((fact) => fact.source_support_ids)
    .filter((spanId) => wordTokens(sourceTextForSpan(sourceBytes, spanById.get(spanId))).some(
      (word) => ['shall', 'may', 'must', 'will', 'would'].includes(word),
    ));
  if (modalMarkerSpanIds.length === 0) {
    fail(`synthetic expression payload for ${occurrenceId} has no source-backed modal`);
  }
  const operativeMarkerSpanIds = spans.filter(
    (span) => modalMarkerSpanIds.includes(span.span_id),
  ).map((span) => span.span_id);
  const operativeMarkerSet = new Set(operativeMarkerSpanIds);
  spans.forEach((span) => { span.operative = operativeMarkerSet.has(span.span_id); });
  const sourceClosure = sealInline(SOURCE_CLOSURE_SCHEMA, 'source_closure_id', {
    authored_unit_id: node.node_occurrence_id,
    agreement_index_binding: clone(agreementIndex.__binding),
    canonical_source_binding: {
      canonical_text_id: agreementIndex.source_binding.canonical_text_id,
      canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
      canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
    },
    source_node_occurrence_id: node.node_occurrence_id,
    complete_review_state: 'COMPLETE_REVIEWED_SOURCE_CLOSURE',
    governing_chapeau_span_ids: [...operativeMarkerSpanIds],
    required_dependency_ids: [],
    governing_start_byte: nodeStart,
    governing_end_byte: nodeEnd,
    whitespace_punctuation_policy_id: 'EXACT_UTF8_PARTITION/V1',
    spans,
  });
  const pendingFacts = compiled.facts.map((fact) => ({ ...fact }));
  const expressions = compiled.expressions.map((expression) => ({ ...expression }));
  const effectIdentity = {
    input_occurrence_id: occurrenceId,
    source_span_ids: spans.map((span) => span.span_id),
    fact_ids: pendingFacts.map((fact) => fact.fact_id),
    expression_root_id: compiled.root_expression_id,
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
    canonical_expression_signature: compiled.expression_signature,
    child_rule_ids: [],
    source_closure_id: sourceClosure.source_closure_id,
  });
  const facts = pendingFacts.map((fact) => ({ ...fact, owner_rule_id: ruleId }));
  const appliesToFactIds = facts.filter((fact) => fact.field_key === 'APPLIES_TO')
    .map((fact) => fact.fact_id);
  const rule = {
    schema_version: RULE_SCHEMA,
    rule_id: ruleId,
    input_occurrence_id: occurrenceId,
    authored_unit_id: node.node_occurrence_id,
    effect_id: effectId,
    family_key: profile.family_key,
    profile_id: profile.profile_id,
    subtype_path: clone(profile.subtype_path),
    applies_to_fact_ids: appliesToFactIds,
    fact_ids: facts.map((fact) => fact.fact_id),
    consumer_link_ids: [],
    root_expression_id: compiled.root_expression_id,
    child_rule_ids: [],
    source_closure_id: sourceClosure.source_closure_id,
    expression_signature: compiled.expression_signature,
    equivalence_signature: equivalenceSignature(profile, compiled.expression_signature, facts),
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
    authored_unit_id: node.node_occurrence_id,
    source_closure_id: sourceClosure.source_closure_id,
    considered_family_keys: familyKeys,
    effects: [effect],
  });
  const sourceOrder = new Map(spans.map((span, index) => [span.span_id, index]));
  const ordered = (spanIds) => [...spanIds].sort(
    (left, right) => sourceOrder.get(left) - sourceOrder.get(right),
  );
  const ruleSourceSpanIds = ordered(facts.flatMap((fact) => fact.source_support_ids));
  const expressionTreatments = expressions.map((expression) => ({
    treatment_kind: 'EXPRESSION',
    target_id: expression.expression_id,
    source_span_ids: ordered(expression.connective_span_ids),
    authority_id: null,
  }));
  const effectLedger = sealInline(LEDGER_SCHEMA, 'effect_ledger_id', {
    authored_unit_id: node.node_occurrence_id,
    source_closure_id: sourceClosure.source_closure_id,
    entries: [{
      effect_id: effectId,
      input_occurrence_id: occurrenceId,
      effect_kind: 'MODAL',
      rule_ids: [ruleId],
      source_span_ids: spans.map((span) => span.span_id),
      operative_marker_span_ids: [...operativeMarkerSpanIds],
      treatments: [{
        treatment_kind: 'RULE',
        target_id: ruleId,
        source_span_ids: ruleSourceSpanIds,
        authority_id: null,
      }, ...expressionTreatments],
    }],
  });
  const coveragePartition = {
    source_closure_id: sourceClosure.source_closure_id,
    entries: spans.map((span) => ({
      span_id: span.span_id,
      treatment_kind: expressionBySpan.has(span.span_id) ? 'LOGIC_CONNECTIVE' : 'FACT',
      owner_id: expressionBySpan.get(span.span_id) ?? factBySpan.get(span.span_id),
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
    authored_unit_id: node.node_occurrence_id,
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
  rejectMatchingStructureDisposition({
    approvedStructureDispositions,
    agreementIndex,
    occurrenceId,
    nodeId: node.node_occurrence_id,
    nodeStart,
    nodeEnd,
    nodeText,
    sourceBytes,
  });
  return {
    occurrenceId,
    sourceClosure,
    facts,
    expressions,
    rule,
    candidateSet,
    effectLedger,
    coveragePartition,
    disposition,
  };
}

function compileOccurrence({
  agreementId,
  agreementIndex,
  contextCompilation,
  approvedFamilyPackets,
  approvedFamilyProfileSet,
  approvedStructureDispositions,
  claim,
  sourceBytes,
  syntheticExpressionPayload,
}) {
  const occurrenceId = claim.claim_occurrence_id;
  const nodeId = claim.source_node_occurrence_ids[0];
  const matchingNodes = agreementIndex.nodes.filter(
    (candidate) => candidate.node_occurrence_id === nodeId,
  );
  if (matchingNodes.length !== 1) {
    fail(`governed occurrence ${occurrenceId} does not resolve to one M2 node`);
  }
  const node = matchingNodes[0];
  const nodeStart = node.extent_span?.start_byte;
  const nodeEnd = node.extent_span?.end_byte;
  if (node.extent_span?.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      || !Number.isInteger(nodeStart) || !Number.isInteger(nodeEnd)
      || nodeStart < 0 || nodeEnd <= nodeStart || nodeEnd > sourceBytes.length) {
    fail(`governed M2 node ${nodeId} has an invalid UTF-8 extent`);
  }
  const nodeBytes = sourceBytes.subarray(nodeStart, nodeEnd);
  const nodeText = nodeBytes.toString('utf8');
  if (Buffer.byteLength(nodeText, 'utf8') !== nodeBytes.length
      || node.extent_span.text_sha256 !== sha256Hex(nodeBytes)) {
    fail(`governed M2 node ${nodeId} has stale UTF-8 source bytes`);
  }

  const profiles = approvedFamilyProfileSet.profiles;
  const profileResults = profiles.map((profile) => profileResult(profile, nodeText));
  const profile = selectMostSpecificProfile(profiles, profileResults);
  const multiNode = claim.source_node_occurrence_ids.length !== 1;
  if (profile === null || multiNode) {
    if (syntheticExpressionPayload !== null) {
      fail(`synthetic expression payload for ${occurrenceId} requires one profile match`);
    }
    return compileReviewOnlyOccurrence({
      agreementIndex,
      approvedFamilyPackets,
      approvedStructureDispositions,
      node,
      nodeStart,
      nodeEnd,
      nodeText,
      occurrenceId,
      profileResults,
      profiles,
      sourceBytes,
      additionalIssues: multiNode ? ['MATERIAL_SPAN_UNMODELLED'] : [],
    });
  }
  const expressionSignature = profile.required_expression_signature;
  const treeEntry = approvedFamilyProfileSet.subtype_tree_bindings.find(
    (entry) => entry.family_key === profile.family_key,
  );
  if (!treeEntry) fail(`missing subtype tree binding for ${profile.family_key}`);
  if (syntheticExpressionPayload !== null) {
    return compileSyntheticOccurrence({
      agreementId,
      agreementIndex,
      approvedFamilyPackets,
      approvedStructureDispositions,
      contextCompilation,
      node,
      nodeStart,
      nodeEnd,
      nodeText,
      occurrenceId,
      payload: syntheticExpressionPayload,
      profile,
      profileResults,
      profiles,
      sourceBytes,
    });
  }
  if (expressionSignature !== 'ALL_OF(APPLIES_TO,FAMILY_MARKER)') {
    fail(`unsupported first-slice expression ${expressionSignature}`);
  }

  const modalRange = byteRange(nodeText, 'shall', nodeStart);
  const selectedTokens = profile.match_test.tokens;
  if (![1, 2].includes(selectedTokens.length)) {
    fail('selected profile has an unsupported selector-token count');
  }
  const familyToken = selectedTokens.find((token) =>
    wordTokens(token).some((word) => word.startsWith('family')));
  if (!familyToken || familyToken !== selectedTokens[0]) {
    fail('selected profile has no leading family source token');
  }
  const selectedTokenRanges = selectedTokens.map(
    (token) => byteRange(nodeText, token, nodeStart),
  );
  const markerRange = [
    selectedTokenRanges[0][0], selectedTokenRanges.at(-1)[1],
  ];
  if (sourceBytes.subarray(markerRange[0], markerRange[1]).toString('utf8')
      !== selectedTokens.join(' ')) {
    fail('selected profile tokens do not form one exact ordered marker phrase');
  }
  const trailingExpressionText = sourceBytes.subarray(
    markerRange[1], nodeEnd,
  ).toString('utf8');
  if (!/^\s+all_of$/u.test(trailingExpressionText)
      || trailingExpressionText.trim() !== 'all_of') {
    fail('selected source does not end with the exact all_of connective');
  }
  const nativeParties = contextCompilation.semantic_relationships.filter(
    (relationship) => relationship.target_endpoint?.source_node_occurrence_id === nodeId,
  ).map((relationship) => ({
    start: relationship.target_endpoint?.source_span?.start_byte,
    end: relationship.target_endpoint?.source_span?.end_byte,
  })).sort((left, right) => left.start - right.start);
  if (nativeParties.length !== 2 || nativeParties.some(
    (range) => !Number.isInteger(range.start) || !Number.isInteger(range.end)
      || range.start < nodeStart || range.end > nodeEnd || range.end <= range.start,
  )) {
    fail('the first compiler slice requires two exact native party aliases');
  }
  const ranges = [
    modalRange,
    [modalRange[1], nativeParties[0].start],
    [nativeParties[0].start, nativeParties[0].end],
    [nativeParties[0].end, nativeParties[1].start],
    [nativeParties[1].start, nativeParties[1].end],
    [nativeParties[1].end, markerRange[0]],
    markerRange,
    [markerRange[1], nodeEnd],
  ];
  if (modalRange[0] !== nodeStart
      || ranges.some(([start, end]) => end <= start)
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
    governing_start_byte: nodeStart,
    governing_end_byte: nodeEnd,
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
      typedValue: selectedTokens.length === 1
        ? sourceTextForSpan(sourceBytes, spans[6]).toUpperCase()
        : selectedTokens.map((token) => wordTokens(token)[0].toUpperCase()).join('_'),
      supportSpans: spans.slice(5, 7), normalisationRule: 'ENUM_LITERAL_MAP/V1',
    },
  ];
  validateSelectedProfileCapability(
    profile, node, factDrafts, contextCompilation, ['ALL_OF'],
  );
  const pendingFacts = factDrafts.map((draft) => makeFact({
    agreementId, ...draft, legalSubject: 'COMPANY', ruleId: 'PENDING_RULE_ID',
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
  rejectMatchingStructureDisposition({
    approvedStructureDispositions,
    agreementIndex,
    occurrenceId,
    nodeId,
    nodeStart,
    nodeEnd,
    nodeText,
    sourceBytes,
  });
  return {
    occurrenceId,
    sourceClosure,
    facts,
    expressions: [expression],
    expression,
    rule,
    candidateSet,
    effectLedger,
    coveragePartition,
    disposition,
  };
}

function generateAnalysisV2({ baseAnalysis, agreementIndex, contextCompilation,
  approvedFamilyPackets, approvedFamilyProfileSet, approvedStructureDispositions,
  governance, syntheticExpressionPayloads = [] }) {
  const agreementId = baseAnalysis.agreement_id;
  if (agreementIndex.source_binding.agreement_id !== agreementId
      || contextCompilation.agreement_index_binding.agreement_index_id
        !== agreementIndex.agreement_index_id
      || baseAnalysis.context_compilation_binding.context_compilation_id
        !== contextCompilation.context_compilation_id
      || !Array.isArray(baseAnalysis.claims) || baseAnalysis.claims.length === 0
      || !Array.isArray(agreementIndex.nodes)
      || !Array.isArray(contextCompilation.semantic_relationships)
      || !Array.isArray(approvedFamilyProfileSet.profiles)
      || baseAnalysis.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN') {
    fail('native M4, M3, and M2 records do not form governed occurrences');
  }
  const sourceText = agreementIndex.source_binding.canonical_text;
  if (typeof sourceText !== 'string') fail('the governed M2 source text is absent');
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  if (agreementIndex.source_binding.canonical_text_sha256 !== sha256Hex(sourceBytes)
      || agreementIndex.source_binding.canonical_text_byte_length !== sourceBytes.length) {
    fail('the governed M2 canonical source binding is stale');
  }
  const occurrenceIds = new Set();
  for (const claim of baseAnalysis.claims) {
    const nodeIds = Array.isArray(claim?.source_node_occurrence_ids)
      ? claim.source_node_occurrence_ids.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)
        || typeof claim.claim_occurrence_id !== 'string'
        || claim.claim_occurrence_id.length === 0
        || occurrenceIds.has(claim.claim_occurrence_id)
        || nodeIds.length === 0) {
      fail('each governed claim must have a unique ID and at least one M2 node');
    }
    occurrenceIds.add(claim.claim_occurrence_id);
  }
  if (!Array.isArray(syntheticExpressionPayloads)) {
    fail('synthetic expression payloads must be an array');
  }
  const syntheticPayloadByOccurrence = new Map();
  for (const payload of syntheticExpressionPayloads) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || typeof payload.input_occurrence_id !== 'string'
        || !occurrenceIds.has(payload.input_occurrence_id)
        || syntheticPayloadByOccurrence.has(payload.input_occurrence_id)) {
      fail('synthetic expression payloads must name unique governed occurrences');
    }
    syntheticPayloadByOccurrence.set(payload.input_occurrence_id, payload);
  }
  const profiles = approvedFamilyProfileSet.profiles;
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
  const compiled = [...baseAnalysis.claims].sort(
    (left, right) => lexicalCompare(left.claim_occurrence_id, right.claim_occurrence_id),
  ).map((claim) => compileOccurrence({
    agreementId,
    agreementIndex,
    contextCompilation,
    approvedFamilyPackets,
    approvedFamilyProfileSet,
    approvedStructureDispositions,
    claim,
    sourceBytes,
    syntheticExpressionPayload:
      syntheticPayloadByOccurrence.get(claim.claim_occurrence_id) ?? null,
  }));
  const occurrenceCount = compiled.length;
  const rulesByNode = new Map();
  for (const entry of compiled) {
    if (!entry.rule) continue;
    const nodeId = entry.rule.authored_unit_id;
    const bucket = rulesByNode.get(nodeId) ?? [];
    bucket.push(entry.rule);
    rulesByNode.set(nodeId, bucket);
  }
  for (const siblings of rulesByNode.values()) {
    if (siblings.length < 2) continue;
    const linked = siblings.map((rule) => rule.rule_id).sort(lexicalCompare);
    for (const rule of siblings) {
      rule.linked_rule_ids = linked.filter((ruleId) => ruleId !== rule.rule_id);
    }
  }
  const sourceClosures = [];
  const seenClosureIds = new Set();
  for (const entry of compiled) {
    if (seenClosureIds.has(entry.sourceClosure.source_closure_id)) continue;
    seenClosureIds.add(entry.sourceClosure.source_closure_id);
    sourceClosures.push(entry.sourceClosure);
  }
  const analysisBody = {
    agreement_id: agreementId,
    governed_input_occurrence_ids: compiled.map((entry) => entry.occurrenceId),
    governance: clone(governance),
    profile_snapshots: profileSnapshots,
    candidate_sets: compiled.map((entry) => entry.candidateSet),
    source_closures: sourceClosures,
    dependencies: [],
    facts: compiled.flatMap((entry) => entry.facts),
    expressions: compiled.flatMap((entry) => entry.expressions),
    rules: compiled.map((entry) => entry.rule).filter(Boolean),
    authored_unit_effect_ledgers: compiled.map((entry) => entry.effectLedger),
    shared_fact_coverages: [],
    coverage_partitions: compiled.map((entry) => entry.coveragePartition),
    ownership_links: [],
    family_corrections: [],
    dispositions: compiled.map((entry) => entry.disposition),
    counts: {
      governed_input_occurrences: occurrenceCount,
      rules: compiled.filter((entry) => entry.rule).length,
      facts: compiled.reduce((count, entry) => count + entry.facts.length, 0),
      expressions: compiled.reduce((count, entry) => count + entry.expressions.length, 0),
      shared_fact_coverages: 0,
      source_closures: sourceClosures.length,
      dispositions: occurrenceCount,
    },
  };
  return deepFreeze(sealInline(ANALYSIS_SCHEMA, 'agreement_analysis_id', analysisBody));
}

module.exports = { compileSyntheticProfileExpression, generateAnalysisV2 };
