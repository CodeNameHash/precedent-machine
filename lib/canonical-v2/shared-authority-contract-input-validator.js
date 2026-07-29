const { canonicalJson } = require('./canonical-bytes');

const SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND = 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT';
const SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA = 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1';

const CANONICAL_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);

const VALUE_RULE_BY_STATE = Object.freeze({
  PRESENT: 'VALUE_AND_EVIDENCE_REQUIRED',
  ABSENT: 'COMPLETE_SCOPE_AND_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_APPLICABLE: 'APPLICABILITY_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_EXAMINED: 'NO_VALUE',
  FAILED: 'FAILURE_DETAIL_REQUIRED_NO_VALUE',
});

const COMMON_KEYS = Object.freeze([
  'logical_type',
  'logical_type_version',
  'expected_slot',
  'occurrence_identity',
  'revision_identity',
  'state_rules',
  'evidence_rules',
  'physical_carrier',
  'writer_action',
  'release_treatment',
  'import_treatment',
  'trace_treatment',
  'exact_detail_treatment',
  'consumer_projection_rule',
  'type_contract',
]);

const TYPE_SPECS = Object.freeze({
  EntitySubject: Object.freeze({
    stableId: 'ENTITY_SUBJECT',
    slotKind: 'SUBJECT_IDENTITY_SLOT',
    slotSchema: 'ENTITY_SUBJECT_IDENTITY_SLOT/V1',
    occurrenceDomain: 'ENTITY_SUBJECT/V1',
    occurrenceInputs: Object.freeze([
      'identity_authority_type',
      'identity_authority_value',
    ]),
    excludedValueFields: Object.freeze([
      'classification_codes',
      'display_label',
      'status',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_name',
      'database_row_id',
      'deal_date',
      'deal_economics',
      'display_name',
      'source_order',
      'ticker',
    ]),
    revisionType: 'EntitySubjectRevision',
    revisionDomain: 'ENTITY_SUBJECT_REVISION/V1',
    revisionInputs: Object.freeze([
      'classification_revisions',
      'display_label',
      'entity_subject_id',
      'evidence_edges',
      'revision_status',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'entity_subjects',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: true,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES_OR_GOVERNED_APPROVAL_ATTESTATION',
    writerAction: 'MATERIALISE_ENTITY_SUBJECT',
    terminalType: 'ENTITY_REVISION',
    detailAction: 'ENTITY_SUBJECT_EVIDENCE',
  }),
  EntityNameOccurrence: Object.freeze({
    stableId: 'ENTITY_NAME_OCCURRENCE',
    slotKind: 'SOURCE_NAME_SLOT',
    slotSchema: 'ENTITY_NAME_OCCURRENCE_SLOT/V1',
    occurrenceDomain: 'ENTITY_NAME_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'expected_name_slot_key',
      'governed_ordinal',
      'name_role',
      'source_occurrence_id',
    ]),
    excludedValueFields: Object.freeze([
      'entity_subject_id',
      'exact_name_text',
      'language',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_name',
      'entity_subject_id',
      'exact_name_text',
      'normalised_name',
    ]),
    revisionType: 'EntityNameRevision',
    revisionDomain: 'ENTITY_NAME_REVISION/V1',
    revisionInputs: Object.freeze([
      'entity_name_occurrence_id',
      'entity_subject_id',
      'evidence_state',
      'exact_name_text',
      'extraction_version',
      'language',
      'source_interval',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'entity_name_occurrences',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_ENTITY_NAME_OCCURRENCE',
    terminalType: 'ENTITY_NAME_REVISION',
    detailAction: 'ENTITY_NAME_EVIDENCE',
  }),
  EntityIdentityBridge: Object.freeze({
    stableId: 'ENTITY_IDENTITY_BRIDGE',
    slotKind: 'SOURCE_IDENTITY_RELATIONSHIP_SLOT',
    slotSchema: 'ENTITY_IDENTITY_BRIDGE_SLOT/V1',
    occurrenceDomain: 'ENTITY_IDENTITY_BRIDGE/V1',
    occurrenceInputs: Object.freeze([
      'bridge_rule_key',
      'expected_identity_bridge_slot_key',
      'governed_ordinal',
      'source_local_subject_occurrence_id',
    ]),
    excludedValueFields: Object.freeze([
      'identity_disposition',
      'selected_entity_subject_id',
      'state',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'identity_disposition',
      'normalised_name',
      'selected_entity_subject_id',
      'state',
    ]),
    revisionType: 'EntityIdentityBridgeRevision',
    revisionDomain: 'ENTITY_IDENTITY_BRIDGE_REVISION/V1',
    revisionInputs: Object.freeze([
      'bridge_rule_and_version',
      'conflict_checks',
      'entity_identity_bridge_id',
      'evidence_edges',
      'identity_disposition',
      'review_evidence',
      'selected_entity_subject_id',
      'state',
      'supersession',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrierName: 'entity_identity_bridges',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'ADMIT_ENTITY_IDENTITY_BRIDGE',
    terminalType: 'IDENTITY_BRIDGE_REVISION',
    detailAction: 'ENTITY_IDENTITY_BRIDGE_EVIDENCE',
  }),
});

class SharedAuthorityContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SharedAuthorityContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new SharedAuthorityContractInputError(code, message, details);
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
  if (JSON.stringify(actual) !== JSON.stringify(orderedExpected)) {
    fail(code, `${label} fields do not match the authored contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function requireExactObject(value, expected, label, code) {
  requireObject(value, label, code);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual: value,
      expected,
    });
  }
}

function validateCommonDefinition(value, spec, code) {
  requireExactKeys(value, COMMON_KEYS, 'shared-authority logical type definition', code);
  if (value.logical_type_version !== 1) {
    fail(code, 'Shared-authority logical type version must be 1.');
  }

  requireExactKeys(value.expected_slot, [
    'slot_kind',
    'slot_schema',
    'identity_inputs',
    'value_fields_excluded_from_identity',
  ], 'expected slot', code);
  if (
    value.expected_slot.slot_kind !== spec.slotKind
    || value.expected_slot.slot_schema !== spec.slotSchema
  ) {
    fail(code, 'Expected slot identity does not match the logical type.');
  }
  requireExactArray(
    value.expected_slot.identity_inputs,
    spec.occurrenceInputs,
    'expected_slot.identity_inputs',
    code,
  );
  requireExactArray(
    value.expected_slot.value_fields_excluded_from_identity,
    spec.excludedValueFields,
    'expected_slot.value_fields_excluded_from_identity',
    code,
  );

  requireExactKeys(value.occurrence_identity, [
    'stable_id_domain',
    'stable_id_inputs',
    'prohibited_inputs',
  ], 'occurrence identity', code);
  if (value.occurrence_identity.stable_id_domain !== spec.occurrenceDomain) {
    fail(code, 'Occurrence identity domain does not match the logical type.');
  }
  const valueIdentityInputs = spec.excludedValueFields.filter(
    (field) => value.occurrence_identity.stable_id_inputs.includes(field),
  );
  if (valueIdentityInputs.length > 0) {
    fail(
      'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
      'A value field cannot define a stable occurrence ID.',
      { value_identity_inputs: valueIdentityInputs },
    );
  }
  requireExactArray(
    value.occurrence_identity.stable_id_inputs,
    spec.occurrenceInputs,
    'occurrence_identity.stable_id_inputs',
    code,
  );
  requireExactArray(
    value.occurrence_identity.prohibited_inputs,
    spec.prohibitedIdentityInputs,
    'occurrence_identity.prohibited_inputs',
    code,
  );

  requireExactKeys(value.revision_identity, [
    'revision_type',
    'revision_id_domain',
    'immutable_inputs',
  ], 'revision identity', code);
  if (
    value.revision_identity.revision_type !== spec.revisionType
    || value.revision_identity.revision_id_domain !== spec.revisionDomain
  ) {
    fail(code, 'Revision identity does not match the logical type.');
  }
  requireExactArray(
    value.revision_identity.immutable_inputs,
    spec.revisionInputs,
    'revision_identity.immutable_inputs',
    code,
  );

  requireExactKeys(value.state_rules, [
    'allowed_states',
    'value_rule_by_state',
  ], 'state rules', code);
  requireExactArray(
    value.state_rules.allowed_states,
    CANONICAL_STATES,
    'state_rules.allowed_states',
    code,
  );
  requireExactObject(
    value.state_rules.value_rule_by_state,
    VALUE_RULE_BY_STATE,
    'state_rules.value_rule_by_state',
    code,
  );

  requireExactKeys(value.evidence_rules, [
    'exact_evidence_required',
    'source_occurrence_required',
    'approved_seed_attestation_permitted',
    'coordinate_space',
    'complete_scope_required_for_absent',
  ], 'evidence rules', code);
  if (
    value.evidence_rules.exact_evidence_required !== true
    || value.evidence_rules.source_occurrence_required !== spec.sourceOccurrenceRequired
    || value.evidence_rules.approved_seed_attestation_permitted
      !== spec.approvedSeedAttestationPermitted
    || value.evidence_rules.coordinate_space !== spec.evidenceCoordinateSpace
    || value.evidence_rules.complete_scope_required_for_absent !== true
  ) {
    fail(code, 'Evidence rules do not preserve exact admitted source evidence.');
  }

  requireExactKeys(value.physical_carrier, [
    'carrier_kind',
    'carrier_name',
    'release_partitioned',
  ], 'physical carrier', code);
  if (
    value.physical_carrier.carrier_kind !== spec.carrierKind
    || value.physical_carrier.carrier_name !== spec.carrierName
    || value.physical_carrier.release_partitioned !== true
  ) {
    fail(code, 'Physical carrier does not match the logical type.');
  }

  requireExactKeys(value.writer_action, [
    'action_key',
    'action_version',
    'candidate_only',
    'current_release_writer_path',
  ], 'writer action', code);
  if (
    value.writer_action.action_key !== spec.writerAction
    || value.writer_action.action_version !== 1
    || value.writer_action.candidate_only !== true
    || value.writer_action.current_release_writer_path !== false
  ) {
    fail(code, 'Writer action grants unsupported authority.');
  }

  requireExactObject(value.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    exact_release_citation_redirect: false,
  }, 'release treatment', code);
  requireExactObject(value.import_treatment, {
    mode: 'WHOLE_RELEASE_ONLY',
    stable_id_preserved: true,
    revision_id_preserved: true,
  }, 'import treatment', code);
  requireExactObject(value.trace_treatment, {
    terminal_type: spec.terminalType,
    occurrence_id_required: true,
    revision_id_required: true,
    evidence_edges_required: true,
  }, 'trace treatment', code);
  requireExactObject(value.exact_detail_treatment, {
    action_key: spec.detailAction,
    exact_evidence_only: true,
    preserve_release_identity: true,
  }, 'exact-detail treatment', code);
  requireExactObject(value.consumer_projection_rule, {
    projection_type: 'CanonicalDealFactProjection',
    terminal_type: spec.terminalType,
    typed_state_required: true,
    release_identity_required: true,
    conflict_indicator_required: true,
  }, 'consumer projection rule', code);
}

function validateEntitySubjectContract(value, code) {
  requireExactKeys(value, [
    'subject_classes',
    'identity_authority_types',
    'evidence_rule_by_identity_authority',
    'classification_codes',
    'display_name_creates_identity',
    'equivalence_requires_reviewed_relationship',
    'conflict_blocks_selection',
  ], 'EntitySubject type contract', code);
  requireExactArray(value.subject_classes, [
    'NATURAL_PERSON',
    'ORGANISATION',
    'GOVERNMENT_BODY',
  ], 'EntitySubject subject classes', code);
  requireExactArray(value.identity_authority_types, [
    'SEC_CIK',
    'LEI',
    'BEN_APPROVED_IMMUTABLE_IMPORT_SEED',
  ], 'EntitySubject identity authorities', code);
  requireExactObject(value.evidence_rule_by_identity_authority, {
    SEC_CIK: 'EXACT_SOURCE_OCCURRENCE_REQUIRED',
    LEI: 'EXACT_SOURCE_OCCURRENCE_REQUIRED',
    BEN_APPROVED_IMMUTABLE_IMPORT_SEED: 'GOVERNED_APPROVAL_ATTESTATION_REQUIRED',
  }, 'EntitySubject evidence rule by identity authority', code);
  requireExactArray(value.classification_codes, [
    'PUBLIC_COMPANY',
    'PRIVATE_COMPANY',
    'INVESTMENT_FIRM',
    'LAW_FIRM',
    'FINANCIAL_SERVICES_FIRM',
    'OTHER_ORGANISATION',
  ], 'EntitySubject classifications', code);
  if (
    value.display_name_creates_identity !== false
    || value.equivalence_requires_reviewed_relationship !== true
    || value.conflict_blocks_selection !== true
  ) {
    fail(
      'SHARED_AUTHORITY_DISPLAY_NAME_IDENTITY_FORBIDDEN',
      'A display name cannot create or unify an EntitySubject.',
    );
  }
}

function validateEntityNameContract(value, code) {
  requireExactKeys(value, [
    'name_roles',
    'identity_is_text_independent',
    'unresolved_source_local_name_permitted',
    'entity_subject_reference_required',
  ], 'EntityNameOccurrence type contract', code);
  requireExactArray(value.name_roles, [
    'LEGAL_NAME',
    'SHORT_NAME',
    'SOURCE_LOCAL_LABEL',
  ], 'EntityNameOccurrence name roles', code);
  if (
    value.identity_is_text_independent !== true
    || value.unresolved_source_local_name_permitted !== true
    || value.entity_subject_reference_required !== false
  ) {
    fail(code, 'A source name must remain separate from entity identity.');
  }
}

function validateEntityIdentityBridgeContract(value, code) {
  requireExactKeys(value, [
    'identity_dispositions',
    'permitted_terminal_combinations',
    'candidate_only_dispositions',
    'normalised_name_match_sufficient',
    'conflict_blocks_terminal_selection',
  ], 'EntityIdentityBridge type contract', code);
  requireExactArray(value.identity_dispositions, [
    'NAMED',
    'GOVERNED_BRIDGE_CONFIRMED',
    'SOURCE_LOCAL_ONLY',
    'CONFLICTING',
    'NO_BRIDGE_WITNESS',
  ], 'EntityIdentityBridge dispositions', code);
  requireExactArray(value.permitted_terminal_combinations, [
    'PRESENT:NAMED',
    'PRESENT:GOVERNED_BRIDGE_CONFIRMED',
    'ABSENT:NO_BRIDGE_WITNESS',
    'NOT_EXAMINED:SOURCE_LOCAL_ONLY',
    'NOT_APPLICABLE:SOURCE_LOCAL_ONLY',
    'FAILED:NONE',
  ], 'EntityIdentityBridge terminal combinations', code);
  requireExactArray(
    value.candidate_only_dispositions,
    ['CONFLICTING'],
    'EntityIdentityBridge candidate-only dispositions',
    code,
  );
  if (
    value.normalised_name_match_sufficient !== false
    || value.conflict_blocks_terminal_selection !== true
  ) {
    fail(code, 'A normalised name cannot prove an identity bridge.');
  }
}

function validateLogicalTypeMember(member) {
  const code = 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'shared-authority logical type input', code);
  const logicalType = value.definition?.logical_type;
  const spec = TYPE_SPECS[logicalType];
  if (
    value.object_kind !== SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND
    || value.schema_version !== SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA
    || !spec
    || value.stable_id !== spec.stableId
  ) {
    fail(
      'UNREGISTERED_SHARED_AUTHORITY_LOGICAL_TYPE',
      'Shared-authority logical type identity is not registered.',
      {
        logical_type: logicalType || null,
        stable_id: value.stable_id || null,
      },
    );
  }
  validateCommonDefinition(value.definition, spec, code);
  if (logicalType === 'EntitySubject') {
    validateEntitySubjectContract(value.definition.type_contract, code);
  } else if (logicalType === 'EntityNameOccurrence') {
    validateEntityNameContract(value.definition.type_contract, code);
  } else {
    validateEntityIdentityBridgeContract(value.definition.type_contract, code);
  }
  return value;
}

function validateAuthoredSharedAuthorityInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const relevant = authoredMembers.filter(
    (member) => member?.object_kind === SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND,
  );
  const seen = new Set();
  for (const member of relevant) {
    const value = validateLogicalTypeMember(member);
    if (seen.has(value.stable_id)) {
      fail(
        'DUPLICATE_SHARED_AUTHORITY_LOGICAL_TYPE',
        'A shared-authority logical type can appear only once.',
        { stable_id: value.stable_id },
      );
    }
    seen.add(value.stable_id);
  }
}

module.exports = {
  SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND,
  SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA,
  SharedAuthorityContractInputError,
  validateAuthoredSharedAuthorityInputs,
};
