const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const RESULT_DEFINITION_INPUT_KIND = 'RESULT_DEFINITION_INPUT';
const RESULT_DEFINITION_INPUT_SCHEMA = 'RESULT_DEFINITION_INPUT/V1';
const PILOT_RESULT_DEFINITION_IDS = Object.freeze([
  'BUYER_INITIAL_MATCH_RIGHT',
  'TARGET_CAPEX_RESTRICTION',
]);
const PILOT_RESULT_DEFINITIONS = Object.freeze({
  BUYER_INITIAL_MATCH_RIGHT: Object.freeze({
    definition_digest: 'e6a6af5d06efab91288e84e5df315909ad6d34a54d095ffbf642f9b736b75de5',
    error_code: 'INVALID_PILOT_NO_SHOP_RESULT_DEFINITION_INPUT',
  }),
  TARGET_CAPEX_RESTRICTION: Object.freeze({
    definition_digest: '46ff111b60ea7c665fcaba7e99f9f84c43dae19962cac16dcf579abb9bc806c5',
    error_code: 'INVALID_PILOT_IOC_RESULT_DEFINITION_INPUT',
  }),
});

class PilotResultDefinitionInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotResultDefinitionInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new PilotResultDefinitionInputError(code, message, details);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function validateMember(member) {
  const value = member.canonical_value;
  const registered = PILOT_RESULT_DEFINITIONS[value?.stable_id];
  const code = registered?.error_code
    || 'INVALID_PILOT_RESULT_DEFINITION_INPUT';

  requireExactKeys(value, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'Pilot result definition input', code);
  const definition = value.authored_definition;
  if (
    !registered
    || value.object_kind !== RESULT_DEFINITION_INPUT_KIND
    || value.schema_version !== RESULT_DEFINITION_INPUT_SCHEMA
    || definition?.result_key !== value.stable_id
    || definition?.result_version !== 1
  ) {
    fail(code, 'The pilot result definition identity is not registered.');
  }

  const expected = value.stable_id === 'TARGET_CAPEX_RESTRICTION'
    ? {
      concept_key: 'IOC-CAPEX',
      claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      value_slot_key: 'CAPEX_THRESHOLD',
      ownership_mode: 'RESULT_OPTIONAL_RELATIONSHIPS',
      optional_relationship: {
        relationship_key: 'EXCEPTED_BY',
        relationship_version: 3,
      },
    }
    : {
      concept_key: 'NOSOL-MATCH',
      claim_definition_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      value_slot_key: 'INITIAL_MATCH_PERIOD',
      ownership_mode: 'RESULT_CLAIM',
      optional_relationship: null,
    };
  const slot = definition?.primary_claim_slots?.[0];
  const lineageSlot = definition?.expected_result_input_lineage_slots?.[0];
  const metricSlot = definition?.market_metric_slots?.[0];
  if (
    definition.concept_key !== expected.concept_key
    || definition.market_metric_slot_count !== 1
    || slot?.required_claim_definition_key !== expected.claim_definition_key
    || slot?.value_slot_key !== expected.value_slot_key
    || lineageSlot?.value_slot_key !== expected.value_slot_key
    || metricSlot?.value_slot_key !== expected.value_slot_key
    || definition.relationship_ownership?.mode !== expected.ownership_mode
    || definition.relationship_ownership?.relationship_required_for_result_completeness !== false
  ) {
    fail(code, 'The pilot result target or value slot is not governed exactly.');
  }
  if (expected.optional_relationship === null) {
    if (
      canonicalJson(definition.relationship_ownership.optional_relationships)
      !== canonicalJson([])
      || canonicalJson(lineageSlot?.required_relationship_keys) !== canonicalJson([])
    ) {
      fail(code, 'The no-shop result must remain owned by its claim.');
    }
  } else if (
    canonicalJson(definition.relationship_ownership.optional_relationships)
    !== canonicalJson([expected.optional_relationship])
    || canonicalJson(lineageSlot?.required_relationship_keys)
      !== canonicalJson([])
  ) {
    fail(code, 'The IOC result must retain only optional EXCEPTED_BY/V3 ownership.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(Buffer.from(canonicalJson(definition), 'utf8'));
  } catch (error) {
    fail(code, 'The pilot result definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(code, 'The pilot result definition has changed.', {
      expected_definition_digest: registered.definition_digest,
      actual_definition_digest: actualDigest,
    });
  }
}

function validateAuthoredPilotResultDefinitionInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === RESULT_DEFINITION_INPUT_KIND
      && PILOT_RESULT_DEFINITION_IDS.includes(
        member.canonical_value?.stable_id,
      ),
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(stableIds) !== canonicalJson(PILOT_RESULT_DEFINITION_IDS)) {
    fail(
      'PILOT_RESULT_DEFINITION_MEMBERSHIP_MISMATCH',
      'The pilot result definition set is incomplete or duplicated.',
      {
        actual_stable_ids: stableIds,
        expected_stable_ids: PILOT_RESULT_DEFINITION_IDS,
      },
    );
  }
  members.forEach(validateMember);
}

module.exports = {
  PILOT_RESULT_DEFINITION_IDS,
  PILOT_RESULT_DEFINITIONS,
  PilotResultDefinitionInputError,
  validateAuthoredPilotResultDefinitionInputs,
};
