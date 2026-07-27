const Ajv = require('ajv');

const HEX_64 = '^[a-f0-9]{64}$';
const BASE64 = '^[A-Za-z0-9+/]+={0,2}$';
const TOKEN = '^[A-Z][A-Z0-9_./:-]{0,127}$';
const LOWER_ID = '^[a-z0-9][a-z0-9_./:-]{0,127}$';
const TYPE_ID = '^[A-Za-z][A-Za-z0-9_./:-]{0,127}$';

function closedObject(properties, required = Object.keys(properties)) {
  return {
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  };
}

const digest = { type: 'string', pattern: HEX_64 };
const token = { type: 'string', pattern: TOKEN };
const lowerId = { type: 'string', pattern: LOWER_ID };
const typeId = { type: 'string', pattern: TYPE_ID };
const nonEmptyString = { type: 'string', minLength: 1 };
const timestamp = { type: 'string', format: 'canonical-utc-timestamp' };
const stringSet = {
  type: 'array',
  uniqueItems: true,
  items: nonEmptyString,
};

const claimValueSchema = {
  oneOf: [
    { type: 'boolean' },
    { type: 'integer' },
    { type: 'number' },
    { type: 'string' },
    { type: 'null' },
  ],
};

const exactAcceptanceClaimSchema = closedObject({
  claim_key: lowerId,
  result_type: { enum: ['BOOLEAN', 'INTEGER', 'NUMBER', 'STRING', 'NULL'] },
  typed_value: claimValueSchema,
});

const claimPredicateSchema = closedObject({
  claim_key: lowerId,
  result_type: { enum: ['BOOLEAN', 'INTEGER', 'NUMBER', 'STRING', 'NULL'] },
  exact_input_member_types_and_paths: {
    type: 'array',
    minItems: 1,
    items: closedObject({
      member_type: typeId,
      json_pointer: { type: 'string', pattern: '^(/([^/~]|~[01])*)*$' },
    }),
  },
  measurement_executable_digest: digest,
  measurement_configuration_digest: digest,
  comparison_operator: {
    enum: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUALS'],
  },
  expected_typed_value: claimValueSchema,
});

const schemas = Object.freeze({
  'ProgrammeGateAcceptanceDefinition/V1': {
    $id: 'ProgrammeGateAcceptanceDefinition/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateAcceptanceDefinition/V1' },
      definition_id: digest,
      definition_digest: digest,
      evidence_contract: lowerId,
      specification_root: digest,
      frozen_contract_pair_digest: { oneOf: [digest, { type: 'null' }] },
      evidence_object_json_schema_id: nonEmptyString,
      evidence_object_json_schema_digest: digest,
      evidence_subject_type: typeId,
      evidence_subject_identity_fields: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: lowerId,
      },
      immutable_member_universe_definition: closedObject({
        universe_id: token,
        ordering_rule: token,
        duplicate_effect: { const: 'OPEN' },
        missing_or_extra_effect: { const: 'OPEN' },
      }),
      immutable_member_json_schema_set_digest: digest,
      member_enumerator_executable_digest: digest,
      member_enumerator_configuration_digest: digest,
      ordered_claim_predicate_definitions: {
        type: 'array',
        minItems: 1,
        items: claimPredicateSchema,
      },
    }),
  },

  'ProgrammeGateEvidenceEnvelope/V2': {
    $id: 'ProgrammeGateEvidenceEnvelope/V2',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateEvidenceEnvelope/V2' },
      gate_id: token,
      evidence_contract: lowerId,
      acceptance_definition_id: digest,
      acceptance_definition_digest: digest,
      specification_root: digest,
      code_commit: { type: 'string', pattern: '^[a-f0-9]{40}$' },
      environment: { enum: ['STAGING', 'PRODUCTION'] },
      evidence_subject_type: typeId,
      evidence_subject_id: digest,
      evidence_subject_payload_digest: digest,
      required_evidence_object_type: typeId,
      required_evidence_object_payload_digest: digest,
      exact_acceptance_claims: {
        type: 'array',
        minItems: 1,
        items: exactAcceptanceClaimSchema,
      },
      immutable_member_root: digest,
      test_result_root: digest,
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      terminal_state: { const: 'PASS' },
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'TrustedReviewControllerRecord/V1': {
    $id: 'TrustedReviewControllerRecord/V1',
    ...closedObject({
      schema_version: { const: 'TrustedReviewControllerRecord/V1' },
      controller_id: token,
      controller_version: nonEmptyString,
      review_runtime_version: nonEmptyString,
      review_runtime_binary_digest: digest,
      fixed_controller_runtime_context_digest: digest,
      exact_specification_root: digest,
      exact_model_identifier: nonEmptyString,
      reasoning_level: { enum: ['xhigh'] },
      immutable_task_id: nonEmptyString,
      immutable_session_id: nonEmptyString,
      immutable_review_id: nonEmptyString,
      registered_prompt_id: token,
      cold_review_prompt_digest: digest,
      controller_supplied_input_manifest_digest: digest,
      exact_input_context_digest: digest,
      input_context_digest_before_review: digest,
      input_context_digest_after_review: digest,
      review_output_digest: digest,
      review_start_time: timestamp,
      review_end_time: timestamp,
      reviewer_principal_id: nonEmptyString,
      reviewer_source_control_identity_set: stringSet,
      reviewer_disposition: { enum: ['PASS', 'FAIL'] },
      reviewer_edit_set_root: digest,
      parent_session_state: { const: 'GENESIS' },
      no_earlier_review_conclusions_were_inputs: { const: true },
      nonce: nonEmptyString,
      signature_algorithm: { const: 'Ed25519' },
      controller_key_id: token,
      controller_signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ReviewerIndependenceAttestation/V1': {
    $id: 'ReviewerIndependenceAttestation/V1',
    ...closedObject({
      schema_version: { const: 'ReviewerIndependenceAttestation/V1' },
      reviewer_principal_id: nonEmptyString,
      immutable_session_id: nonEmptyString,
      session_parent_or_genesis: { const: 'GENESIS' },
      exact_input_context_digest: digest,
      authoring_event_intersection_root: digest,
      prior_conclusion_intersection_root: digest,
      reviewer_edit_set_root: digest,
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ProgrammeGateStatusArtefact/V2': {
    $id: 'ProgrammeGateStatusArtefact/V2',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateStatusArtefact/V2' },
      specification_root: digest,
      code_commit: { type: 'string', pattern: '^[a-f0-9]{40}$' },
      environment: { enum: ['STAGING', 'PRODUCTION'] },
      generation: { type: 'integer', minimum: 1 },
      predecessor_status_id: { oneOf: [digest, { const: 'NONE' }] },
      gate_registry_digest: digest,
      ordered_gate_projection: {
        type: 'array',
        minItems: 1,
        items: closedObject({
          gate_id: token,
          state: { enum: ['OPEN', 'PASS', 'FAIL', 'NOT_APPLICABLE'] },
          evidence_envelope_id: { oneOf: [digest, { type: 'null' }] },
          evidence_payload_digest: { oneOf: [digest, { type: 'null' }] },
        }),
      },
      ordered_work_class_projection: {
        type: 'array',
        minItems: 1,
        items: closedObject({
          work_class: lowerId,
          state: { enum: ['OPEN', 'PASS'] },
        }),
      },
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ProgrammeStatusPublicationHead/V1': {
    $id: 'ProgrammeStatusPublicationHead/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeStatusPublicationHead/V1' },
      generation: { type: 'integer', minimum: 1 },
      predecessor_git_object_id: {
        oneOf: [
          { type: 'string', pattern: '^[a-f0-9]{40}$' },
          { const: 'NONE' },
        ],
      },
      status_git_object_id: { type: 'string', pattern: '^[a-f0-9]{40}$' },
      status_artefact_id: digest,
      status_artefact_payload_digest: digest,
      publisher_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ProgrammeGateValidatorConfiguration/V1': {
    $id: 'ProgrammeGateValidatorConfiguration/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateValidatorConfiguration/V1' },
      configuration_id: { const: 'PROGRAMME_GATE_VALIDATOR_CONFIG/V1' },
      schema_registry_ids: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: nonEmptyString,
      },
      signature_algorithm: { const: 'Ed25519' },
      invalid_or_missing_evidence_state: { const: 'OPEN' },
      unknown_schema_effect: { const: 'OPEN' },
      unknown_key_effect: { const: 'OPEN' },
      invalid_signature_effect: { const: 'OPEN' },
      unknown_or_extra_claim_effect: { const: 'OPEN' },
      permitted_environments: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: { enum: ['STAGING', 'PRODUCTION'] },
      },
    }),
  },

  'TrustedProgrammeGatePublicKeys/V1': {
    $id: 'TrustedProgrammeGatePublicKeys/V1',
    ...closedObject({
      schema_version: { const: 'TrustedProgrammeGatePublicKeys/V1' },
      registry_state: { enum: ['EMPTY_NOT_ACTIVATED', 'ACTIVE'] },
      keys: {
        type: 'array',
        uniqueItems: true,
        items: closedObject({
          key_id: token,
          algorithm: { const: 'Ed25519' },
          public_key_pem: { type: 'string', pattern: '^-----BEGIN PUBLIC KEY-----' },
          permitted_roles: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: token,
          },
          permitted_domains: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: token,
          },
          valid_from: timestamp,
          valid_until: timestamp,
          revoked_at: { oneOf: [timestamp, { type: 'null' }] },
        }),
      },
    }),
  },

  'ProgrammeGateReviewLaneRegistry/V1': {
    $id: 'ProgrammeGateReviewLaneRegistry/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateReviewLaneRegistry/V1' },
      lanes: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          lane_id: token,
          required_reviewer_profile: token,
          registered_prompt_id: token,
        }),
      },
    }),
  },
});

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
ajv.addFormat('canonical-utc-timestamp', {
  type: 'string',
  validate(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) return false;
    const canonical = new Date(milliseconds).toISOString();
    return value === canonical || value === canonical.replace('.000Z', 'Z');
  },
});

const validators = new Map(
  Object.entries(schemas).map(([schemaId, schema]) => [schemaId, ajv.compile(schema)]),
);

function schemaFor(schemaId) {
  const schema = schemas[schemaId];
  if (!schema) throw new Error(`unknown programme-gate schema ID: ${schemaId}`);
  return schema;
}

function validateSchema(schemaId, value) {
  const validate = validators.get(schemaId);
  if (!validate) throw new Error(`unknown programme-gate schema ID: ${schemaId}`);
  if (validate(value)) return true;
  const details = ajv.errorsText(validate.errors, { separator: '; ' });
  throw new Error(`${schemaId} validation failed: ${details}`);
}

module.exports = {
  SCHEMA_IDS: Object.freeze(Object.keys(schemas)),
  schemas,
  schemaFor,
  validateSchema,
};
