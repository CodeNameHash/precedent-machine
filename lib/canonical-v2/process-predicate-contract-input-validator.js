const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_PREDICATE_CONTRACT_INPUT_KIND = 'PROCESS_PREDICATE_CONTRACT_INPUT';
const PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA = 'PROCESS_PREDICATE_CONTRACT_INPUT/V1';
const PROCESS_PREDICATE_CONTRACT_IDS = Object.freeze([
  'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL',
  'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
]);
const SUCCESSOR_MACHINE_RULE_KEYS = Object.freeze([
  'evidence_binding',
  'optional_typed_link_families',
  'primary_value_carrier_terminal_type',
  'required_typed_link_families',
  'semantic_kind',
  'unlisted_typed_link_family_rule',
  'value_grain',
]);
const SUCCESSOR_EVIDENCE_BINDING = Object.freeze({
  witness_assertion_evidence:
    'DIRECT_EXACT_ADMITTED_SOURCE_UTF8_INTERVAL_REQUIRED',
  each_link_own_evidence: true,
  cross_reference_passage_revision_required: true,
  same_governed_deal_required: true,
  same_release_required: true,
  same_frozen_contract_pair_required: true,
  paragraph_or_date_proximity_can_create_link: false,
});
const SUCCESSOR_TERMINAL_TYPES = Object.freeze([
  'BIDDER_TRACK_REVISION',
  'PROCESS_AGREEMENT_REVISION',
  'PROCESS_EVENT_REVISION',
  'PROCESS_PARTICIPANT_REVISION',
  'PROCESS_PASSAGE_REVISION',
  'PROCESS_POSITION_REVISION',
  'PROCESS_RELATIONSHIP_REVISION',
  'TEMPORAL_EXPRESSION_REVISION',
]);
const SUCCESSOR_RESPONSE_UNION_RULE = Object.freeze({
  successor_predicate_keys_can_be_atomic_constituents: false,
  successor_predicate_keys_can_be_generic_union: false,
  atomic_constituent_set_remains_governed_by_response_contract: true,
  new_union_membership_requires_successor_contract: true,
});

const PROCESS_PREDICATE_DEFINITION_CONTRACTS = Object.freeze({
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL: Object.freeze({
    version_field: 'protocol_version',
    expected_version: 1,
    definition_digest: 'aca7f7c72abb4dc14b6e5f09fb672f1cbf8f2b574a8f8645bd82cd7ca43498df',
    error_code: 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL',
    label: 'Process exclusivity completeness-challenge protocol',
  }),
  PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE: Object.freeze({
    version_field: 'catalogue_version',
    expected_version: 2,
    definition_digest: '3199b52a59da41f4d26f2b6fa3bd58484a4cf7229e10dcb11988461adbe8264b',
    error_code: 'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    label: 'Process exclusivity predicate catalogue',
  }),
});

class ProcessPredicateContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPredicateContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPredicateContractInputError(code, message, details);
}

function sortedUniqueTerminalFamilies(
  value,
  permittedCardinalities,
  label,
  code,
) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(code, `${label} must be a non-empty array.`);
  }
  const terminalTypes = [];
  for (const entry of value) {
    if (
      !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || canonicalJson(Object.keys(entry).sort())
        !== canonicalJson(['cardinality', 'terminal_type'])
      || !SUCCESSOR_TERMINAL_TYPES.includes(entry.terminal_type)
      || !permittedCardinalities.includes(entry.cardinality)
    ) {
      fail(code, `${label} contains an invalid typed-link family.`);
    }
    terminalTypes.push(entry.terminal_type);
  }
  const sorted = [...terminalTypes].sort();
  if (
    new Set(terminalTypes).size !== terminalTypes.length
    || canonicalJson(terminalTypes) !== canonicalJson(sorted)
  ) {
    fail(code, `${label} must be sorted and unique.`);
  }
  return terminalTypes;
}

function validateSuccessorMachineRules(definition, code) {
  const contract = definition?.successor_predicate_definition_contract;
  const definitions = contract?.definitions;
  if (!Array.isArray(definitions) || definitions.length !== 18) {
    fail(code, 'The successor predicate machine-rule set is incomplete.');
  }
  const predicateKeys = new Set();
  const semanticKinds = new Set();
  for (const entry of definitions) {
    if (
      !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || canonicalJson(Object.keys(entry).sort()) !== canonicalJson([
        'exact_semantic_requirement',
        'machine_rule',
        'predicate_key',
        'predicate_version',
      ])
      || typeof entry.exact_semantic_requirement !== 'string'
      || entry.exact_semantic_requirement.length === 0
      || entry.predicate_version !== 1
    ) {
      fail(code, 'A successor predicate definition is invalid.');
    }
    const rule = entry.machine_rule;
    if (
      !rule
      || typeof rule !== 'object'
      || Array.isArray(rule)
      || canonicalJson(Object.keys(rule).sort())
        !== canonicalJson([...SUCCESSOR_MACHINE_RULE_KEYS].sort())
      || !/^[A-Z][A-Z0-9_]*$/.test(rule.semantic_kind)
      || rule.value_grain !== 'ONE_ATOMIC_LEGAL_PROPOSITION_PER_WITNESS'
      || !SUCCESSOR_TERMINAL_TYPES.includes(
        rule.primary_value_carrier_terminal_type,
      )
      || rule.unlisted_typed_link_family_rule !== 'FORBIDDEN'
      || canonicalJson(rule.evidence_binding)
        !== canonicalJson(SUCCESSOR_EVIDENCE_BINDING)
    ) {
      fail(code, 'A successor predicate machine rule is invalid.');
    }
    const required = sortedUniqueTerminalFamilies(
      rule.required_typed_link_families,
      ['ONE', 'ONE_OR_MORE'],
      `${entry.predicate_key} required typed-link families`,
      code,
    );
    const optional = sortedUniqueTerminalFamilies(
      rule.optional_typed_link_families,
      ['ZERO_OR_ONE', 'ZERO_OR_MORE'],
      `${entry.predicate_key} optional typed-link families`,
      code,
    );
    if (
      !required.includes(rule.primary_value_carrier_terminal_type)
      || required.some((terminalType) => optional.includes(terminalType))
      || predicateKeys.has(entry.predicate_key)
      || semanticKinds.has(rule.semantic_kind)
    ) {
      fail(code, 'A successor predicate machine rule is not closed.');
    }
    predicateKeys.add(entry.predicate_key);
    semanticKinds.add(rule.semantic_kind);
  }
  if (
    canonicalJson(contract.response_union_rule)
      !== canonicalJson(SUCCESSOR_RESPONSE_UNION_RULE)
  ) {
    fail(code, 'The successor predicate response-union rule is invalid.');
  }
}

function validateAuthoredProcessPredicateInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(stableIds) !== canonicalJson(PROCESS_PREDICATE_CONTRACT_IDS)) {
    fail(
      'PROCESS_PREDICATE_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Process predicate contract member set is incomplete, duplicated, or unregistered.',
      {
        actual_stable_ids: stableIds,
        expected_stable_ids: PROCESS_PREDICATE_CONTRACT_IDS,
      },
    );
  }

  for (const member of members) {
    const value = member.canonical_value;
    const contract = PROCESS_PREDICATE_DEFINITION_CONTRACTS[value?.stable_id];
    const keys = Object.keys(value || {}).sort();
    if (
      !contract
      || canonicalJson(keys) !== canonicalJson([
        'definition',
        'object_kind',
        'schema_version',
        'stable_id',
      ])
      || value.object_kind !== PROCESS_PREDICATE_CONTRACT_INPUT_KIND
      || value.schema_version !== PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA
      || value.definition?.domain_key !== 'PROCESS'
      || value.definition?.topic_key !== 'EXCLUSIVITY'
      || value.definition?.[contract.version_field]
        !== contract.expected_version
    ) {
      fail(
        contract?.error_code || 'INVALID_PROCESS_PREDICATE_CONTRACT_INPUT',
        'The Process predicate contract identity is invalid.',
      );
    }
    if (value.stable_id === 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE') {
      validateSuccessorMachineRules(value.definition, contract.error_code);
    }

    let actualDigest;
    try {
      actualDigest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
    } catch (error) {
      fail(
        contract.error_code,
        `The ${contract.label} is not canonical JSON.`,
        { cause: error.message },
      );
    }
    if (actualDigest !== contract.definition_digest) {
      fail(
        contract.error_code,
        `The ${contract.label} does not match its complete governed definition.`,
        {
          expected_definition_digest: contract.definition_digest,
          actual_definition_digest: actualDigest,
        },
      );
    }
  }
}

module.exports = {
  PROCESS_PREDICATE_CONTRACT_IDS,
  PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA,
  ProcessPredicateContractInputError,
  validateAuthoredProcessPredicateInputs,
};
