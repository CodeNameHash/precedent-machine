const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateProcessPhrasebookResultAdmissionReceipt,
} = require('./process-phrasebook-result-admission');
const {
  METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA,
  validateMetseraExclusivityProcessPhrasebookAdmission,
} = require('./metsera-exclusivity-process-phrasebook-admission');

const METSERA_PRODUCT_ADMISSION_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_ADMISSION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_LIMITS = Object.freeze({
  query: 'NONE',
  source_read: 'NONE',
  extraction: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product admission: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  if (
    canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) {
    fail(`${label} does not have the exact required fields`);
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(`${label} must be a lower-case SHA-256 digest`);
  }
  return value;
}

function intendedCandidateBinding(input, receipt) {
  const ordering = input.passage_order_projection;
  const membership = input.candidate_release_membership;
  if (
    membership?.membership_state !== 'NOT_RELEASE_BOUND'
    || receipt.release_membership_state !== 'NOT_RELEASE_BOUND'
    || receipt.admission_state !== 'VALIDATED_NOT_RELEASE_BOUND'
    || receipt.serving_state !== 'NOT_SERVED'
    || ordering?.candidate_release_manifest_id
      !== membership.candidate_release_manifest_id
    || ordering?.candidate_release_manifest_payload_digest
      !== membership.candidate_release_manifest_payload_digest
  ) {
    fail(
      'the Process admission claims candidate membership before the Product release partition',
    );
  }
  return {
    candidate_release_manifest_id: requireDigest(
      ordering.candidate_release_manifest_id,
      'Intended candidate release manifest ID',
    ),
    candidate_release_manifest_payload_digest: requireDigest(
      ordering.candidate_release_manifest_payload_digest,
      'Intended candidate release payload digest',
    ),
  };
}

function buildProductAdmission(input = {}) {
  requireExactKeys(
    input,
    ['process_phrasebook_admission'],
    'Metsera Product admission input',
  );
  const bridgeInput = input.process_phrasebook_admission;
  if (bridgeInput === null || bridgeInput === undefined) {
    fail('the real Process materialisation bridge is required');
  }
  try {
    validateMetseraExclusivityProcessPhrasebookAdmission(bridgeInput);
  } catch (error) {
    fail(`the real Process materialisation bridge is invalid: ${error.code || error.message}`);
  }
  const processAdmissionInput = bridgeInput.process_admission_input;
  const processAdmissionReceipt = bridgeInput.process_admission_receipt;
  try {
    validateProcessPhrasebookResultAdmissionReceipt(
      processAdmissionReceipt,
      processAdmissionInput,
    );
  } catch (error) {
    fail(`the checked Process admission is invalid: ${error.code || error.message}`);
  }
  const intended = intendedCandidateBinding(
    processAdmissionInput,
    processAdmissionReceipt,
  );
  const body = {
    schema_version: METSERA_PRODUCT_ADMISSION_SCHEMA,
    materialisation_receipt_id: bridgeInput.materialisation_receipt_id,
    ...intended,
    corpus_release_id: null,
    admission_input: clone(processAdmissionInput),
    admission_receipt: clone(processAdmissionReceipt),
    process_phrasebook_admission: clone(bridgeInput),
    source_treatment: 'PROCESS_NARRATION_NOT_ACTUAL_DRAFTING',
    adapter_state: 'VALIDATED_NOT_RELEASE_BOUND',
    authority_limits: clone(AUTHORITY_LIMITS),
  };
  return {
    schema_version: body.schema_version,
    product_admission_adapter_receipt_id: contentId(
      METSERA_PRODUCT_ADMISSION_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductAdmission(input) {
  return deepFreeze(buildProductAdmission(clone(input)));
}

function validateMetseraExclusivityProductAdmission(value) {
  const rebuilt = buildProductAdmission({
    process_phrasebook_admission: value?.process_phrasebook_admission,
  });
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product admission adapter receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ADMISSION_SCHEMA,
  compileMetseraExclusivityProductAdmission,
  validateMetseraExclusivityProductAdmission,
};
