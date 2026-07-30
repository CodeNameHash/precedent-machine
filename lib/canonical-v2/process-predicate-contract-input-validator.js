const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_PREDICATE_CONTRACT_INPUT_KIND = 'PROCESS_PREDICATE_CONTRACT_INPUT';
const PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA = 'PROCESS_PREDICATE_CONTRACT_INPUT/V1';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_INPUT_KIND =
  'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_STABLE_ID =
  'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE/V1';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SCHEMA =
  'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE/V1';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST =
  'sha256:6f2fa9e584f09dbe644d7e45f6ce7225d8b8ef811b530daf2cc35821ded69d46';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_CANONICAL_DIGEST =
  '3874b0a4ea42f261c11556a004863cd6dcdf634b6200042b1817f874b0d5e194';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST =
  'a038cc96cdd1db83a0b33ca1de165969c132f1f90261d12a6f927386316686af';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_KIND =
  'PROCESS_EXCLUSIVITY_QUESTION_RECONCILIATION';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_ID =
  'PROCESS_EXCLUSIVITY_QUESTION_RECONCILIATION/V1';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_ERROR =
  'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION';
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT = 48;
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT = 190;
const PROCESS_EXCLUSIVITY_COMPLETENESS_ORDINARY_PREDICATE_COUNT = 23;
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_KEYS =
  Object.freeze([
    'blockers',
    'challenge_question_reconciliations',
    'closed_disposition_domains',
    'completeness_counts',
    'deterministic_content_digest',
    'freeze_disposition',
    'independent_review',
    'integrity_scheme',
    'object_kind',
    'ordinary_predicate_reconciliations',
    'proposed_ordinary_predicates',
    'reconciliation_status',
    'schema_version',
    'source_bindings',
    'stable_id',
  ]);
const PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_SOURCE_BINDING =
  Object.freeze({
    repository_path:
      'contracts/canonical-v2/successor/process/predicates/exclusivity-completeness-challenge-catalogue.v1.json',
    source_commit: 'b93d71a35305815f0257efed9e94173d8646f184',
    source_commit_parent: 'a3149cfb6434f3166aac2c3bd9631e637d5df8ae',
    stable_id: PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_STABLE_ID,
    schema_version: PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SCHEMA,
    git_blob_oid: '680a8a005b1f833965f234b395f270dd6a6345bf',
    exact_raw_file_content_digest:
      'sha256:0eb8776815ecce587f31e382d52152448e941335a06e7ba36180c497e4ade653',
    declared_sealed_catalogue_digest:
      PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST,
    recalculated_sealed_catalogue_digest:
      PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST,
    seal_verified: true,
    blind_input_manifest_digest:
      'sha256:78986bc77587b6c2d1dcce97837ee5c0157f71af11f2bdb5404ed756cf8376b1',
  });
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

function omitKey(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key));
}

function requireExactKeys(value, expected, label, code) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())
  ) {
    fail(code, `${label} fields do not match the governed contract.`);
  }
}

function challengeId(prefix, value, omittedKey) {
  return `${prefix}:sha256:${sha256Hex(Buffer.from(
    canonicalJson(omitKey(value, omittedKey)),
    'utf8',
  ))}`;
}

function validateChallengeCatalogue(value) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE';
  requireExactKeys(value, [
    'authoring_task_identity',
    'blind_input_manifest_digest',
    'challenge_authoring_method_class',
    'challenge_questions',
    'coverage_argument',
    'integrity_scheme',
    'known_limits',
    'object_kind',
    'schema_version',
    'sealed_catalogue_digest',
    'stable_id',
  ], 'Process exclusivity completeness challenge catalogue', code);
  if (
    value.object_kind !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_INPUT_KIND
    || value.stable_id !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_STABLE_ID
    || value.schema_version !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SCHEMA
    || value.sealed_catalogue_digest
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST
    || !Array.isArray(value.challenge_questions)
    || value.challenge_questions.length
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT
  ) {
    fail(code, 'The Process exclusivity completeness challenge catalogue identity is invalid.');
  }

  const questionIds = new Set();
  const answerSlotIds = new Set();
  let answerSlotCount = 0;
  for (const question of value.challenge_questions) {
    requireExactKeys(question, [
      'answer_slots',
      'challenge_question_id',
      'evidence_demand',
      'legal_proposition',
      'source_scenario',
      'user_question',
    ], 'Challenge question', code);
    if (
      question.challenge_question_id !== challengeId(
        'PROCESS_EXCLUSIVITY_CHALLENGE_QUESTION/V1',
        question,
        'challenge_question_id',
      )
      || questionIds.has(question.challenge_question_id)
      || !Array.isArray(question.answer_slots)
      || question.answer_slots.length === 0
    ) {
      fail(code, 'A challenge question is missing, duplicated, reordered, or mutated.');
    }
    questionIds.add(question.challenge_question_id);
    for (const slot of question.answer_slots) {
      requireExactKeys(slot, [
        'answer_meaning',
        'answer_state_classes',
        'challenge_answer_slot_id',
        'multiplicity',
      ], 'Challenge answer slot', code);
      if (
        slot.challenge_answer_slot_id !== challengeId(
          'PROCESS_EXCLUSIVITY_CHALLENGE_ANSWER_SLOT/V1',
          slot,
          'challenge_answer_slot_id',
        )
        || answerSlotIds.has(slot.challenge_answer_slot_id)
      ) {
        fail(code, 'A challenge answer slot is missing, duplicated, reordered, or mutated.');
      }
      answerSlotIds.add(slot.challenge_answer_slot_id);
      answerSlotCount += 1;
    }
  }
  if (
    questionIds.size !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT
    || answerSlotIds.size !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT
    || answerSlotCount !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT
  ) {
    fail(code, 'The Process exclusivity completeness challenge catalogue is incomplete.');
  }

  const sealedDigest = `sha256:${sha256Hex(Buffer.from(
    canonicalJson(omitKey(value, 'sealed_catalogue_digest')),
    'utf8',
  ))}`;
  const canonicalDigest = sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
  if (
    sealedDigest !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST
    || canonicalDigest
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_CANONICAL_DIGEST
  ) {
    fail(code, 'The Process exclusivity completeness challenge catalogue does not match its complete governed content.');
  }
}

function validateProcessExclusivityCompletenessChallengeReconciliation(
  reconciliation,
  challengeCatalogue,
) {
  const code =
    PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_ERROR;
  try {
    validateChallengeCatalogue(challengeCatalogue);
  } catch (error) {
    fail(code, 'The supplied challenge catalogue is invalid.', {
      cause_code: error.code || null,
    });
  }

  requireExactKeys(
    reconciliation,
    PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_KEYS,
    'Process exclusivity completeness challenge reconciliation',
    code,
  );
  if (
    reconciliation.object_kind
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_KIND
    || reconciliation.stable_id
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_ID
    || reconciliation.schema_version
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_ID
    || reconciliation.deterministic_content_digest
      !== `sha256:${PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST}`
  ) {
    fail(code, 'The Process exclusivity completeness challenge reconciliation identity is invalid.');
  }

  const sourceBinding = reconciliation.source_bindings?.challenge_catalogue;
  requireExactKeys(
    sourceBinding,
    Object.keys(PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_SOURCE_BINDING),
    'Process exclusivity completeness challenge catalogue source binding',
    code,
  );
  if (
    canonicalJson(sourceBinding)
      !== canonicalJson(
        PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_SOURCE_BINDING,
      )
    || sourceBinding.stable_id !== challengeCatalogue.stable_id
    || sourceBinding.schema_version !== challengeCatalogue.schema_version
    || sourceBinding.declared_sealed_catalogue_digest
      !== challengeCatalogue.sealed_catalogue_digest
    || sourceBinding.recalculated_sealed_catalogue_digest
      !== challengeCatalogue.sealed_catalogue_digest
    || sourceBinding.seal_verified !== true
  ) {
    fail(code, 'The reconciliation does not bind the exact sealed challenge catalogue.');
  }

  const counts = reconciliation.completeness_counts;
  if (
    counts?.ordinary_predicates_expected
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_ORDINARY_PREDICATE_COUNT
    || counts.ordinary_predicates_reconciled
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_ORDINARY_PREDICATE_COUNT
    || counts.challenge_questions_expected
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT
    || counts.challenge_questions_reconciled
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT
    || counts.challenge_answer_slots_expected
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT
    || counts.challenge_answer_slots_reconciled
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT
  ) {
    fail(code, 'The reconciliation completeness claims are invalid.');
  }

  const ordinaryReconciliations =
    reconciliation.ordinary_predicate_reconciliations;
  const questionReconciliations =
    reconciliation.challenge_question_reconciliations;
  if (
    !Array.isArray(ordinaryReconciliations)
    || ordinaryReconciliations.length
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_ORDINARY_PREDICATE_COUNT
    || !Array.isArray(questionReconciliations)
    || questionReconciliations.length
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_QUESTION_COUNT
    || questionReconciliations.some(
      (question) => !Array.isArray(question?.answer_slot_reconciliations),
    )
    || questionReconciliations.reduce(
      (count, question) => count + question.answer_slot_reconciliations.length,
      0,
    ) !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_ANSWER_SLOT_COUNT
  ) {
    fail(code, 'The reconciliation member counts are incomplete or duplicated.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(Buffer.from(
      canonicalJson(omitKey(reconciliation, 'deterministic_content_digest')),
      'utf8',
    ));
  } catch (error) {
    fail(code, 'The Process exclusivity completeness challenge reconciliation is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (
    actualDigest
      !== PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST
  ) {
    fail(code, 'The Process exclusivity completeness challenge reconciliation does not match its fixed governed content.', {
      expected_reconciliation_digest:
        PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST,
      actual_reconciliation_digest: actualDigest,
    });
  }
}
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
  const challengeMembers = authoredMembers.filter(
    (member) => member?.object_kind
      === PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_INPUT_KIND,
  );
  if (members.length === 0 && challengeMembers.length === 0) return;

  if (members.length > 0) {
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

  if (challengeMembers.length > 1) {
    fail(
      'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_CARDINALITY_MISMATCH',
      'The Process exclusivity completeness challenge catalogue is duplicated.',
    );
  }
  if (challengeMembers.length === 1) {
    validateChallengeCatalogue(challengeMembers[0].canonical_value);
  }
}

module.exports = {
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_CANONICAL_DIGEST,
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_INPUT_KIND,
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_SEALED_DIGEST,
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE_STABLE_ID,
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_RECONCILIATION_DIGEST,
  PROCESS_PREDICATE_CONTRACT_IDS,
  PROCESS_PREDICATE_CONTRACT_INPUT_KIND,
  PROCESS_PREDICATE_CONTRACT_INPUT_SCHEMA,
  ProcessPredicateContractInputError,
  validateAuthoredProcessPredicateInputs,
  validateProcessExclusivityCompletenessChallengeReconciliation,
};
