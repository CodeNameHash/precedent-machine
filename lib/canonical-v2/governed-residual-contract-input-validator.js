const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND =
  'GOVERNED_RESIDUAL_CONTRACT_INPUT';
const GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA =
  'GOVERNED_RESIDUAL_CONTRACT_INPUT/V1';
const GOVERNED_RESIDUAL_CONTRACT_IDS = Object.freeze([
  'GOVERNED_RESIDUAL_DISPOSITION',
  'GOVERNED_RESIDUAL_IMPACT',
  'GOVERNED_RESIDUAL_OBSERVATION',
  'GOVERNED_RESIDUAL_PRODUCER_REGISTRY',
  'GOVERNED_RESIDUAL_REVIEW_QUEUE',
  'GOVERNED_RESIDUAL_UNIVERSE',
  'SEMANTIC_BOUNDARY_ADMISSION',
  'SEMANTIC_BOUNDARY_CONSUMPTION',
]);
const GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS = Object.freeze({
  GOVERNED_RESIDUAL_DISPOSITION: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_DISPOSITION_DEFINITION',
    definition_digest:
      'd9f104bc0e7e8d573b0bcf1006ca8a1337dae552b95ed056195a514f082076c3',
  }),
  GOVERNED_RESIDUAL_IMPACT: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_IMPACT_DEFINITION',
    definition_digest:
      'c9bcb66ee2e8ec3752df4d57e802ba7b2d723d1a5a2d83cc3425fbaa36b16f38',
  }),
  GOVERNED_RESIDUAL_OBSERVATION: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_OBSERVATION_DEFINITION',
    definition_digest:
      'ad265985fb4276ac183ee8ab766694fa371d9227f3b83f725379f318ad1729a1',
  }),
  GOVERNED_RESIDUAL_PRODUCER_REGISTRY: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY_DEFINITION',
    definition_digest:
      'e5cf74b917906b140b42f7ecbf8bba36f6c0395e410c02da4d72998e9d79f70b',
  }),
  GOVERNED_RESIDUAL_REVIEW_QUEUE: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_REVIEW_QUEUE_DEFINITION',
    definition_digest:
      'a6bc1897991f61bd19ef0e21df006911710c5c026a4ee5af32e6e426265e6070',
  }),
  GOVERNED_RESIDUAL_UNIVERSE: Object.freeze({
    contract_type: 'GOVERNED_RESIDUAL_UNIVERSE_DEFINITION',
    definition_digest:
      '8a9ffaf32ffbc6c7b4c94be36159e1a5eecccb603fb2b90ded779b2a60fdb515',
  }),
  SEMANTIC_BOUNDARY_ADMISSION: Object.freeze({
    contract_type: 'SEMANTIC_BOUNDARY_ADMISSION_DEFINITION',
    definition_digest:
      '7f1780f00ed5acea03b720a6501a3160716385e2b5876b9bc091baa98f1a4e55',
  }),
  SEMANTIC_BOUNDARY_CONSUMPTION: Object.freeze({
    contract_type: 'SEMANTIC_BOUNDARY_CONSUMPTION_DEFINITION',
    definition_digest:
      '22a22e972d73e5c720944f41ca93977af391953fa8fc6aeee4a5c400d49ba80c',
  }),
});

const AUTHORITY_KEYS = Object.freeze([
  'definition_only',
  'creates_runtime_authority',
  'creates_extraction_authority',
  'creates_database_authority',
  'creates_writer_execution_authority',
  'creates_serving_authority',
  'creates_release_authority',
  'creates_import_authority',
  'creates_activation_authority',
  'creates_production_authority',
  'creates_contract_freeze_authority',
]);

class GovernedResidualContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GovernedResidualContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new GovernedResidualContractInputError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function validateAuthorityContract(authority, stableId) {
  const code = 'GOVERNED_RESIDUAL_AUTHORITY_ESCALATION';
  requireExactKeys(
    authority,
    AUTHORITY_KEYS,
    `${stableId} authority contract`,
    code,
  );
  if (
    authority.definition_only !== true
    || AUTHORITY_KEYS
      .filter((key) => key !== 'definition_only')
      .some((key) => authority[key] !== false)
  ) {
    fail(
      code,
      'A governed residual input must define contracts without runtime authority.',
      { stable_id: stableId },
    );
  }
}

function validateMember(member) {
  const code = 'INVALID_GOVERNED_RESIDUAL_CONTRACT_INPUT';
  requireObject(member, 'Governed residual authored member', code);
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Governed residual contract input', code);

  const registered = GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS[value.stable_id];
  if (
    !registered
    || member.object_kind !== GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND
    || value.object_kind !== GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND
    || value.schema_version !== GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'GOVERNANCE'
    || value.definition?.contract_type !== registered.contract_type
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The governed residual contract identity is not registered.', {
      stable_id: value?.stable_id,
    });
  }

  validateAuthorityContract(value.definition.authority_contract, value.stable_id);
  const actualDigest = sha256Hex(
    Buffer.from(canonicalJson(value.definition), 'utf8'),
  );
  if (actualDigest !== registered.definition_digest) {
    fail(
      code,
      'The governed residual contract does not match its complete reviewed definition.',
      {
        stable_id: value.stable_id,
        expected_definition_digest: registered.definition_digest,
        actual_definition_digest: actualDigest,
      },
    );
  }
  return value;
}

function validateFamilyBindings(values) {
  const code = 'GOVERNED_RESIDUAL_FAMILY_CROSS_BINDING_MISMATCH';
  const byId = new Map(values.map((value) => [value.stable_id, value.definition]));
  const producer = byId.get('GOVERNED_RESIDUAL_PRODUCER_REGISTRY');
  const observation = byId.get('GOVERNED_RESIDUAL_OBSERVATION');
  const admission = byId.get('SEMANTIC_BOUNDARY_ADMISSION');
  const consumption = byId.get('SEMANTIC_BOUNDARY_CONSUMPTION');
  const universe = byId.get('GOVERNED_RESIDUAL_UNIVERSE');
  const disposition = byId.get('GOVERNED_RESIDUAL_DISPOSITION');
  const impact = byId.get('GOVERNED_RESIDUAL_IMPACT');
  const queue = byId.get('GOVERNED_RESIDUAL_REVIEW_QUEUE');

  requireExactArray(
    producer.pilot_scope_contract.allowed_deal_keys,
    ['METSERA', 'QXO'],
    'Pilot residual deal scope',
    code,
  );
  requireExactArray(
    universe.universe_contract.scope_codes,
    ['PRE_SCOPE', 'CANDIDATE_COMPLETE'],
    'Residual universe scope order',
    code,
  );
  requireExactArray(
    consumption.consumption_contract.terminal_outcomes,
    ['GOVERNED_CARRIER', 'GOVERNED_RESIDUAL'],
    'Semantic boundary terminal outcomes',
    code,
  );
  requireExactArray(
    impact.impact_contract.closed_impact_dispositions,
    [
      'NO_CANONICAL_IMPACT',
      'ISOLATED_SOURCE_SPECIFIC',
      'AFFECTS_CANONICAL_RESULT',
      'AFFECTS_CORPUS_SCOPE',
      'AFFECTS_CANONICAL_CONTRACT',
    ],
    'Residual impact disposition order',
    code,
  );
  if (
    admission.admission_contract.registered_producer_kinds_source
      !== 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY'
    || universe.universe_contract.producer_enumerator_source
      !== 'GOVERNED_RESIDUAL_PRODUCER_REGISTRY'
    || observation.observation_contract.source_backed_evidence_required !== true
    || disposition.disposition_contract.terminal_disposition_implies_impact_clearance !== false
    || impact.impact_contract.terminal_disposition_implies_zero_impact !== false
    || queue.queue_contract.complete_universe_manifest_required !== true
    || queue.queue_contract.complete_disposition_manifest_required !== true
    || queue.queue_contract.complete_impact_closure_set_required !== true
  ) {
    fail(
      code,
      'The governed residual family has a missing or cross-wired lifecycle binding.',
    );
  }
}

function validateAuthoredGovernedResidualInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND,
  );
  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    GOVERNED_RESIDUAL_CONTRACT_IDS,
    'Governed residual contract member set',
    'GOVERNED_RESIDUAL_CONTRACT_MEMBERSHIP_MISMATCH',
  );
  const values = members.map(validateMember);
  validateFamilyBindings(values);
  return true;
}

module.exports = {
  AUTHORITY_KEYS,
  GOVERNED_RESIDUAL_CONTRACT_DEFINITIONS,
  GOVERNED_RESIDUAL_CONTRACT_IDS,
  GOVERNED_RESIDUAL_CONTRACT_INPUT_KIND,
  GOVERNED_RESIDUAL_CONTRACT_INPUT_SCHEMA,
  GovernedResidualContractInputError,
  validateAuthoredGovernedResidualInputs,
};
