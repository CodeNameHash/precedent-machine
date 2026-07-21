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
});

const EXPECTED_CONCEPT_KEYS = ['COND-B-REP', 'REP-T-CAP'];
const EXPECTED_RELATIONSHIP_KEYS = ['BRINGS_DOWN', 'CONTAINED_IN', 'USES_DEFINITION'];
const EXPECTED_CLAIM_KEYS = [
  'KNOWLEDGE_QUALIFIER',
  'REPRESENTATION_ACCURACY_EXCEPTION',
  'REPRESENTATION_ACCURACY_STANDARD',
];
const EXPECTED_STATES = ['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'];

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
  })) throw new Error('contract bundle payload mismatch');
  if (fingerprint !== contentId('CANONICAL_CONTRACT_BUNDLE/V1', payload)) throw new Error('contract fingerprint mismatch');
  return true;
}

module.exports = {
  FIXTURE_CONTRACT_INPUT,
  compileFixtureContract,
  validateContractBundle,
};
