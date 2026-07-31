const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const resultContract = require(
  '../../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);

const RESULT_IDENTITY_SCHEMA =
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT_IDENTITY/V1';
const RESULT_ID_DOMAIN = 'PROCESS_PHRASEBOOK_PASSAGE_RESULT/V1';
const RESULT_PAYLOAD_DOMAIN =
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessPhrasebookPassageResult';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'precomputed_process_narration_occurrence_id',
  'exact_evidence_role_slot_key',
  'governed_ordinal',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_result_slot_binding_state',
  'selected_narration_state',
  'predicate_witness_state',
  'result_input_lineage_state',
  'preview_binding_state',
  'ordering_projection_state',
  'release_membership_state',
  'authority_limits',
  'process_phrasebook_passage_result_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...resultContract.definition.occurrence_identity.prohibited_inputs,
  'bidder_track_id',
  'canonical_text',
  'canonical_text_digest',
  'candidate_membership',
  'citation',
  'coverage',
  'evidence_role',
  'exact_detail_reference',
  'failure_detail',
  'lineage',
  'matched_passage_preview',
  'ordering_ordinal',
  'predicate_witness_revision_id',
  'process_narration_revision_id',
  'release_identity',
  'retelling_relationship',
  'selected_narration',
  'source_order',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  expected_result_slot_binding: 'NONE',
  narration_selection: 'NONE',
  predicate_witness_binding: 'NONE',
  result_input_lineage: 'NONE',
  preview_binding: 'NONE',
  ordering_projection: 'NONE',
  release_membership: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPhrasebookResultIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPhrasebookResultIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPhrasebookResultIdentityError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      expected: required,
      actual,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  let equal = false;
  try {
    equal = canonicalJson(actual) === canonicalJson(expected);
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
  if (!equal) {
    fail(code, `${label} is not the approved value.`, {
      expected,
      actual,
    });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function requireGovernedKey(value, label, code) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed upper-case key.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateContractBinding() {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_CONTRACT_BINDING';
  const definition = resultContract.definition;
  if (
    resultContract.object_kind !== 'SERVING_PROCESS_CONTRACT_INPUT'
    || resultContract.stable_id !== 'PROCESS_PHRASEBOOK_PASSAGE_RESULT'
    || resultContract.schema_version !== 'SERVING_PROCESS_CONTRACT_INPUT/V1'
    || definition?.domain_key !== 'PROCESS'
    || definition?.contract_type !== 'RESULT_DEFINITION'
    || definition?.contract_version !== 1
  ) {
    fail(code, 'The ProcessPhrasebookPassageResult contract identity is invalid.');
  }
  requireExactKeys(
    definition,
    [
      'domain_key',
      'contract_type',
      'contract_version',
      'result_contract',
      'occurrence_identity',
      'lineage_contract',
      'preview_contract',
      'ordering_contract',
      'release_treatment',
      'authority_contract',
    ],
    'ProcessPhrasebookPassageResult definition',
    code,
  );
  requireExactValue(
    definition.result_contract,
    {
      logical_type: LOGICAL_TYPE,
      output_grain: 'RESULT',
      parent_kind: 'RESULT_ROW',
      one_occurrence_per_admitted_predicate_witness_narration: true,
      claim_or_application_join_can_mint_result: false,
      result_definition_required_before_materialisation: true,
    },
    'ProcessPhrasebookPassageResult result contract',
    code,
  );
  requireExactValue(
    definition.occurrence_identity,
    {
      stable_id_domain: RESULT_ID_DOMAIN,
      stable_id_inputs: IDENTITY_INPUT_KEYS,
      prohibited_inputs: [
        'application_join_order',
        'candidate_values',
        'display_text',
        'model_output',
        'query_text',
        'selected_revision_id',
      ],
      ordinal_comparator: 'CANONICAL_SOURCE_INTERVAL_COMPARATOR/V1',
      expected_result_slot_required_before_materialisation: true,
    },
    'ProcessPhrasebookPassageResult occurrence identity',
    code,
  );
  requireExactValue(
    definition.lineage_contract,
    {
      required_terminal_types: [
        'PROCESS_NARRATION_REVISION',
        'PREDICATE_WITNESS_REVISION',
      ],
      selected_narration_required: true,
      predicate_witness_required: true,
      complete_result_input_lineage_required: true,
      source_local_narration_identity_required: true,
      retelling_relationship_retained: true,
    },
    'ProcessPhrasebookPassageResult lineage contract',
    code,
  );
  requireExactValue(
    definition.preview_contract,
    {
      definition_stable_id: 'BOUNDED_INLINE_PASSAGE_PREVIEW',
      matched_passage_preview_required: true,
      inline_with_result_row: true,
      one_detail_request_per_visible_passage_permitted: false,
    },
    'ProcessPhrasebookPassageResult preview contract',
    code,
  );
  requireExactValue(
    definition.ordering_contract,
    {
      total_comparator: [
        'DIRECT_PREDICATE_WITNESS_BEFORE_CONTEXTUAL_OR_RETOLD_EVIDENCE',
        'SOURCE_LOCAL_PRIMARY_NARRATION_BEFORE_LATER_RETELLING',
        'GOVERNED_SOURCE_ORDER',
      ],
      diversification_applies_after_total_comparator: true,
      diversification_keys: [
        'governed_deal_admission_id',
        'bidder_track_id',
      ],
      application_memory_can_recreate_ranking_authority: false,
    },
    'ProcessPhrasebookPassageResult ordering contract',
    code,
  );
  requireExactValue(
    definition.release_treatment,
    {
      prewrite_admission_release_state: 'NOT_RELEASE_BOUND',
      candidate_membership_established_by:
        'PRODUCT_QUERY_RESULT_RELEASE_PARTITION/V1',
      candidate_membership_required_before_product_candidate_write: false,
      candidate_membership_required_before_product_release: true,
      release_pinned: true,
      immutable_after_release: true,
      exact_release_citation_redirect: false,
    },
    'ProcessPhrasebookPassageResult release treatment',
    code,
  );
  requireExactValue(
    definition.authority_contract,
    {
      creates_runtime_result: false,
      creates_writer_authority: false,
      creates_serving_authority: false,
      creates_release_authority: false,
      creates_contract_freeze_authority: false,
    },
    'ProcessPhrasebookPassageResult authority contract',
    code,
  );
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(
    input,
    'ProcessPhrasebookPassageResult identity input',
    'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY',
  );
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_PHRASEBOOK_RESULT_VALUE_DERIVED_IDENTITY',
      'Values, text, lineage, release data, ranking and model output cannot define result identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function resultIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    precomputed_process_narration_occurrence_id:
      input.precomputed_process_narration_occurrence_id,
    exact_evidence_role_slot_key: input.exact_evidence_role_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessPhrasebookResultIdentityInput(input) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessPhrasebookPassageResult identity input',
    code,
  );
  validateContractBinding();
  requireDigest(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireDigest(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  requireDigest(
    input.precomputed_process_narration_occurrence_id,
    'Precomputed ProcessNarrationOccurrence ID',
    code,
  );
  requireGovernedKey(
    input.exact_evidence_role_slot_key,
    'Exact evidence-role slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(
      code,
      'The governed result ordinal must be a non-negative safe integer.',
    );
  }
  return input;
}

function buildProcessPhrasebookResultIdentity(input) {
  validateProcessPhrasebookResultIdentityInput(input);
  const identity = cloneCanonical(
    resultIdentity(input),
    'ProcessPhrasebookPassageResult identity',
    'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY',
  );
  const body = {
    schema_version: RESULT_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_result_slot_binding_state: 'UNRESOLVED',
    selected_narration_state: 'UNRESOLVED',
    predicate_witness_state: 'UNRESOLVED',
    result_input_lineage_state: 'UNRESOLVED',
    preview_binding_state: 'UNRESOLVED',
    ordering_projection_state: 'UNRESOLVED',
    release_membership_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessPhrasebookPassageResult authority limits',
      'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_phrasebook_passage_result_id: contentId(
      RESULT_ID_DOMAIN,
      resultIdentity(body),
    ),
    canonical_payload_digest: contentId(
      RESULT_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessPhrasebookResultIdentity(value) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessPhrasebookPassageResult identity',
    code,
  );
  if (
    value.schema_version !== RESULT_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_result_slot_binding_state !== 'UNRESOLVED'
    || value.selected_narration_state !== 'UNRESOLVED'
    || value.predicate_witness_state !== 'UNRESOLVED'
    || value.result_input_lineage_state !== 'UNRESOLVED'
    || value.preview_binding_state !== 'UNRESOLVED'
    || value.ordering_projection_state !== 'UNRESOLVED'
    || value.release_membership_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The result identity type or boundary state is invalid.');
  }
  validateProcessPhrasebookResultIdentityInput(resultIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessPhrasebookPassageResult authority limits',
    code,
  );
  const expectedId = contentId(
    RESULT_ID_DOMAIN,
    resultIdentity(value),
  );
  if (value.process_phrasebook_passage_result_id !== expectedId) {
    fail(
      'PROCESS_PHRASEBOOK_RESULT_ID_MISMATCH',
      'The result ID does not bind the exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_phrasebook_passage_result_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    RESULT_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_PHRASEBOOK_RESULT_PAYLOAD_MISMATCH',
      'The result identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  ProcessPhrasebookResultIdentityError,
  buildProcessPhrasebookResultIdentity,
  validateProcessPhrasebookResultIdentity,
};
