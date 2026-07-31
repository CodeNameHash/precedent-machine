const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_KIND =
  'PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT';
const PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_SCHEMA =
  'PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT/V1';
const PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_STABLE_ID =
  'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER';
const PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST =
  '6f1341d59b5c3a03eaadffb806e96f80d917701d30d6a8f9ded0b896aca1d707';

class ProcessPilotAdmissionAdapterContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPilotAdmissionAdapterContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPilotAdmissionAdapterContractInputError(code, message, details);
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

function validateProcessPilotAdmissionAdapterContractInput(member) {
  const code = 'INVALID_METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER_CONTRACT_INPUT';
  const value = member?.canonical_value || member;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Metsera Process admission adapter contract input', code);
  if (
    value.object_kind !== PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_KIND
    || value.stable_id !== PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_STABLE_ID
    || value.schema_version !== PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_SCHEMA
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type
      !== 'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER'
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Metsera Process admission adapter identity is invalid.');
  }
  const digest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  if (digest !== PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST) {
    fail(code, 'The Metsera Process admission adapter definition has changed.', {
      expected_definition_digest:
        PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST,
      actual_definition_digest: digest,
    });
  }
  return true;
}

function validateAuthoredProcessPilotAdmissionAdapterContractInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) throw new TypeError('authoredMembers must be an array');
  const members = authoredMembers.filter((member) => (
    member?.object_kind === PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_KIND
  ));
  if (members.length === 0) return;
  if (members.length !== 1) {
    fail(
      'PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_MEMBERSHIP_MISMATCH',
      'Exactly one Metsera Process admission adapter contract input is required.',
    );
  }
  validateProcessPilotAdmissionAdapterContractInput(members[0]);
}

module.exports = {
  PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_KIND,
  PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT_SCHEMA,
  PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_STABLE_ID,
  PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST,
  ProcessPilotAdmissionAdapterContractInputError,
  validateAuthoredProcessPilotAdmissionAdapterContractInputs,
  validateProcessPilotAdmissionAdapterContractInput,
};
