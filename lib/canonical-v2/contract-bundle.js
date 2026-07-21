const { canonicalJson, contentId } = require('./canonical-bytes');

const FIXTURE_CONTRACT_INPUT = Object.freeze({
  schema_version: 'FIXTURE_CONTRACT_INPUT/V1',
  contract_key: 'QXO_CAPITALISATION_BRING_DOWN_VERTICAL_SLICE',
  concepts: Object.freeze([
    Object.freeze({ concept_key: 'COND-B-REP', version: 1 }),
    Object.freeze({ concept_key: 'REP-T-CAP', version: 1 }),
  ]),
  relationship_definitions: Object.freeze([
    Object.freeze({ relationship_key: 'BRINGS_DOWN', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
    Object.freeze({ relationship_key: 'CONTAINED_IN', effect_mode: 'NON_SEMANTIC', version: 1 }),
    Object.freeze({ relationship_key: 'USES_DEFINITION', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
  ]),
  claim_definitions: Object.freeze([
    Object.freeze({
      claim_definition_key: 'KNOWLEDGE_QUALIFIER',
      version: 1,
      allowed_canonical_values: Object.freeze([true]),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
      version: 1,
      allowed_canonical_values: Object.freeze(['DE_MINIMIS_INACCURACIES']),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      version: 1,
      allowed_canonical_values: Object.freeze([
        'MAT_ALL_RESPECTS',
        'MAT_ALL_RESPECTS_DE_MINIMIS',
        'MAT_ALL_MATERIAL',
        'MAT_MAE_QUALIFIED',
      ]),
      canonical_value_required_when_present: true,
    }),
  ]),
  claim_states: Object.freeze([
    'PRESENT',
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]),
  party_tuple_fields: Object.freeze(['role', 'value', 'capacity']),
  residual_reason_codes: Object.freeze([
    'UNKNOWN_ATTRIBUTE',
    'INVALID_TAXONOMY_CODE',
    'PRESENT_WITHOUT_EVIDENCE',
    'ABSENT_WITHOUT_COMPLETE_SCOPE',
    'NON_PRESENT_ASSERTED_VALUE',
    'PRESENT_WITHOUT_RESOLVED_TARGET',
    'PRESENT_WITHOUT_EFFECT',
    'STATE_DETAIL_REQUIRED',
    'INVALID_CANONICAL_VALUE',
    'CANONICAL_IDENTITY_MISMATCH',
    'EVIDENCE_REFERENCE_UNRESOLVED',
  ]),
  serving_exact_detail_actions: Object.freeze([
    Object.freeze({
      action_slot_key: 'ACCURACY_STANDARD_CLAIM_EVIDENCE',
      action_version: 1,
      parent_kind: 'RESULT_ROW',
      detail_kind: 'CLAIM_EVIDENCE',
      selection_path_schema: 'RESULT_COMPONENT_CLAIM_EVIDENCE/V1',
      contextual_cardinality: 'EXACTLY_ONE',
      comparator: 'COMPONENT_ORDINAL_THEN_EVIDENCE_ORDINAL',
      duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
      maximum_references: 1,
      maximum_encoded_bytes: 16384,
      whole_document_permission: false,
      object_authorisation_predicate: 'PARENT_SELECTED_CLAIM_EVIDENCE_ONLY',
      route: 'INLINE_BATCH',
      response_schema: 'SERVING_EXACT_DETAIL_CLAIM_EVIDENCE_RESPONSE/V1',
      projection_version: 1,
    }),
  ]),
  parser_proposal_boundary: Object.freeze({
    adapter_key: 'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL',
    adapter_version: 1,
    allowed_proposal_kinds: Object.freeze(['STRUCTURAL_SECTION', 'DEFINITION_CANDIDATE']),
    canonical_write_permission: false,
    absence_decision_permission: false,
    comparability_decision_permission: false,
    semantic_identity_permission: false,
    exact_evidence_required: true,
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
  }),
});

const EXPECTED_CONCEPT_KEYS = ['COND-B-REP', 'REP-T-CAP'];
const EXPECTED_RELATIONSHIP_KEYS = ['BRINGS_DOWN', 'CONTAINED_IN', 'USES_DEFINITION'];
const EXPECTED_CLAIM_KEYS = [
  'KNOWLEDGE_QUALIFIER',
  'REPRESENTATION_ACCURACY_EXCEPTION',
  'REPRESENTATION_ACCURACY_STANDARD',
];
const EXPECTED_STATES = ['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'];
const EXPECTED_EXACT_DETAIL_ACTION_KEYS = ['ACCURACY_STANDARD_CLAIM_EVIDENCE'];
const EXPECTED_PROPOSAL_BOUNDARY = Object.freeze({
  adapter_key: 'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL',
  adapter_version: 1,
  allowed_proposal_kinds: ['STRUCTURAL_SECTION', 'DEFINITION_CANDIDATE'],
  canonical_write_permission: false,
  absence_decision_permission: false,
  comparability_decision_permission: false,
  semantic_identity_permission: false,
  exact_evidence_required: true,
  coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
  source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
});

function sortedUnique(values, label) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`${label} must be a non-empty array`);
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error(`${label} contains duplicates`);
  return sorted;
}

function assertExact(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} does not match the frozen fixture contract`);
  }
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('contract input must be an object');
  if (input.schema_version !== 'FIXTURE_CONTRACT_INPUT/V1') throw new Error('invalid fixture contract schema version');
  if (input.contract_key !== 'QXO_CAPITALISATION_BRING_DOWN_VERTICAL_SLICE') throw new Error('invalid fixture contract key');

  const concepts = sortedUnique(input.concepts.map((entry) => entry && entry.concept_key), 'concept keys');
  const relationships = sortedUnique(
    input.relationship_definitions.map((entry) => entry && entry.relationship_key),
    'relationship keys',
  );
  const claims = sortedUnique(
    input.claim_definitions.map((entry) => entry && entry.claim_definition_key),
    'claim definition keys',
  );
  assertExact(concepts, EXPECTED_CONCEPT_KEYS, 'concept keys');
  assertExact(relationships, EXPECTED_RELATIONSHIP_KEYS, 'relationship keys');
  assertExact(claims, EXPECTED_CLAIM_KEYS, 'claim definition keys');
  assertExact(input.claim_states, EXPECTED_STATES, 'claim states');
  assertExact(input.party_tuple_fields, ['role', 'value', 'capacity'], 'party tuple fields');
  assertExact(input.residual_reason_codes, [
    'UNKNOWN_ATTRIBUTE',
    'INVALID_TAXONOMY_CODE',
    'PRESENT_WITHOUT_EVIDENCE',
    'ABSENT_WITHOUT_COMPLETE_SCOPE',
    'NON_PRESENT_ASSERTED_VALUE',
    'PRESENT_WITHOUT_RESOLVED_TARGET',
    'PRESENT_WITHOUT_EFFECT',
    'STATE_DETAIL_REQUIRED',
    'INVALID_CANONICAL_VALUE',
    'CANONICAL_IDENTITY_MISMATCH',
    'EVIDENCE_REFERENCE_UNRESOLVED',
  ], 'residual reason codes');
  const exactDetailActions = sortedUnique(
    input.serving_exact_detail_actions.map((entry) => entry && entry.action_slot_key),
    'serving exact-detail action keys',
  );
  assertExact(exactDetailActions, EXPECTED_EXACT_DETAIL_ACTION_KEYS, 'serving exact-detail action keys');
  assertExact(input.parser_proposal_boundary, EXPECTED_PROPOSAL_BOUNDARY, 'parser proposal boundary');

  for (const entry of input.concepts) {
    if (!entry || entry.version !== 1 || Object.keys(entry).sort().join(',') !== 'concept_key,version') {
      throw new Error('invalid fixture concept definition');
    }
  }
  for (const entry of input.relationship_definitions) {
    if (!entry || entry.version !== 1 || !['NON_SEMANTIC', 'TYPED_LEGAL_EFFECT'].includes(entry.effect_mode)) {
      throw new Error('invalid fixture relationship definition');
    }
    if (Object.keys(entry).sort().join(',') !== 'effect_mode,relationship_key,version') {
      throw new Error('invalid fixture relationship fields');
    }
  }
  for (const entry of input.claim_definitions) {
    if (!entry || entry.version !== 1
      || !Array.isArray(entry.allowed_canonical_values)
      || entry.allowed_canonical_values.length === 0
      || entry.canonical_value_required_when_present !== true
      || Object.keys(entry).sort().join(',') !== 'allowed_canonical_values,canonical_value_required_when_present,claim_definition_key,version') {
      throw new Error('invalid fixture claim definition');
    }
  }
  for (const entry of input.serving_exact_detail_actions) {
    if (!entry
      || entry.action_version !== 1
      || entry.parent_kind !== 'RESULT_ROW'
      || entry.detail_kind !== 'CLAIM_EVIDENCE'
      || entry.selection_path_schema !== 'RESULT_COMPONENT_CLAIM_EVIDENCE/V1'
      || entry.contextual_cardinality !== 'EXACTLY_ONE'
      || entry.comparator !== 'COMPONENT_ORDINAL_THEN_EVIDENCE_ORDINAL'
      || entry.duplicate_policy !== 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT'
      || entry.maximum_references !== 1
      || entry.maximum_encoded_bytes !== 16384
      || entry.whole_document_permission !== false
      || entry.object_authorisation_predicate !== 'PARENT_SELECTED_CLAIM_EVIDENCE_ONLY'
      || entry.route !== 'INLINE_BATCH'
      || entry.response_schema !== 'SERVING_EXACT_DETAIL_CLAIM_EVIDENCE_RESPONSE/V1'
      || entry.projection_version !== 1
      || Object.keys(entry).sort().join(',') !== [
        'action_slot_key',
        'action_version',
        'comparator',
        'contextual_cardinality',
        'detail_kind',
        'duplicate_policy',
        'maximum_encoded_bytes',
        'maximum_references',
        'object_authorisation_predicate',
        'parent_kind',
        'projection_version',
        'response_schema',
        'route',
        'selection_path_schema',
        'whole_document_permission',
      ].sort().join(',')) {
      throw new Error('invalid fixture exact-detail action definition');
    }
  }
}

function compileParserProposalBoundary(entry) {
  const body = {
    schema_version: 'PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    proposal_boundary_definition_id: contentId('PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1', body),
    proposal_boundary_definition_payload_digest: contentId(
      'PARSER_PROPOSAL_BOUNDARY_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileExactDetailAction(entry) {
  const body = {
    schema_version: 'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    action_definition_id: contentId('SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1', body),
    action_definition_payload_digest: contentId(
      'SERVING_EXACT_DETAIL_ACTION_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileFixtureContract(input = FIXTURE_CONTRACT_INPUT) {
  validateInput(input);
  const payload = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE/V1',
    contract_key: input.contract_key,
    concepts: [...input.concepts].sort((a, b) => a.concept_key.localeCompare(b.concept_key)),
    relationship_definitions: [...input.relationship_definitions]
      .sort((a, b) => a.relationship_key.localeCompare(b.relationship_key)),
    claim_definitions: [...input.claim_definitions]
      .sort((a, b) => a.claim_definition_key.localeCompare(b.claim_definition_key)),
    claim_states: [...input.claim_states],
    party_tuple_fields: [...input.party_tuple_fields],
    residual_reason_codes: [...input.residual_reason_codes],
    serving_exact_detail_action_definitions: [...input.serving_exact_detail_actions]
      .sort((a, b) => a.action_slot_key.localeCompare(b.action_slot_key))
      .map(compileExactDetailAction),
    parser_proposal_boundary_definition: compileParserProposalBoundary(input.parser_proposal_boundary),
  };
  const fingerprint = contentId('CANONICAL_CONTRACT_BUNDLE/V1', payload);
  return Object.freeze({ ...payload, fingerprint });
}

function validateContractBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new TypeError('contract bundle must be an object');
  if (!/^[a-f0-9]{64}$/.test(bundle.fingerprint || '')) throw new Error('invalid contract fingerprint');
  const { fingerprint, ...payload } = bundle;
  const expected = compileFixtureContract({
    schema_version: 'FIXTURE_CONTRACT_INPUT/V1',
    contract_key: payload.contract_key,
    concepts: payload.concepts,
    relationship_definitions: payload.relationship_definitions,
    claim_definitions: payload.claim_definitions,
    claim_states: payload.claim_states,
    party_tuple_fields: payload.party_tuple_fields,
    residual_reason_codes: payload.residual_reason_codes,
    serving_exact_detail_actions: payload.serving_exact_detail_action_definitions.map((definition) => {
      const {
        schema_version: _schemaVersion,
        action_definition_id: _definitionId,
        action_definition_payload_digest: _payloadDigest,
        ...input
      } = definition;
      return input;
    }),
    parser_proposal_boundary: (() => {
      const {
        schema_version: _schemaVersion,
        proposal_boundary_definition_id: _definitionId,
        proposal_boundary_definition_payload_digest: _payloadDigest,
        ...input
      } = payload.parser_proposal_boundary_definition;
      return input;
    })(),
  });
  if (payload.schema_version !== expected.schema_version) throw new Error('invalid contract bundle schema version');
  if (canonicalJson(payload) !== canonicalJson({
    schema_version: expected.schema_version,
    contract_key: expected.contract_key,
    concepts: expected.concepts,
    relationship_definitions: expected.relationship_definitions,
    claim_definitions: expected.claim_definitions,
    claim_states: expected.claim_states,
    party_tuple_fields: expected.party_tuple_fields,
    residual_reason_codes: expected.residual_reason_codes,
    serving_exact_detail_action_definitions: expected.serving_exact_detail_action_definitions,
    parser_proposal_boundary_definition: expected.parser_proposal_boundary_definition,
  })) throw new Error('contract bundle payload mismatch');
  if (fingerprint !== contentId('CANONICAL_CONTRACT_BUNDLE/V1', payload)) throw new Error('contract fingerprint mismatch');
  return true;
}

module.exports = {
  FIXTURE_CONTRACT_INPUT,
  compileFixtureContract,
  validateContractBundle,
};
