const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST,
  validateProcessPilotAdmissionAdapterContractInput,
} = require('../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission-adapter-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const RELATIVE_PATH =
  'process/results/metsera-exclusivity-process-phrasebook-admission-adapter.v1.json';

function contract() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, RELATIVE_PATH), 'utf8'));
}

test('governs the exact non-authorising Metsera materialisation-to-admission bridge', () => {
  const value = contract();
  assert.doesNotThrow(() => validateProcessPilotAdmissionAdapterContractInput(value));
  assert.equal(value.object_kind, 'PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT');
  assert.equal(value.stable_id, 'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER');
  assert.equal(value.schema_version, 'PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT/V1');
  assert.equal(
    value.definition.source_receipt_contract.schema_version,
    'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_RECEIPT/V1',
  );
  assert.equal(
    value.definition.target_admission_contract.admission_receipt_schema_version,
    'PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT/V1',
  );
  assert.equal(value.definition.source_receipt_contract.source_receipt_id_and_canonical_bytes_required, true);
  assert.equal(value.definition.target_admission_contract.admission_input_and_receipt_canonical_bytes_required, true);
  assert.equal(value.definition.lineage_preservation_contract.exact_utf8_bytes_preserved, true);
  assert.equal(value.definition.caller_prohibition_contract.caller_query_authority_permitted, false);
  assert.equal(value.definition.authority_contract.creates_external_authority, false);
  assert.equal(value.definition.authority_contract.creates_new_result_architecture, false);
  assert.match(PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST, /^[a-f0-9]{64}$/);
});

test('rejects any changed bridge definition and compiles it as a closed required kind', () => {
  const changed = contract();
  changed.definition.authority_contract.creates_writer_authority = true;
  assert.throws(
    () => validateProcessPilotAdmissionAdapterContractInput(changed),
    { code: 'INVALID_METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER_CONTRACT_INPUT' },
  );
  const compilation = compileCanonicalContractInput({ root_directory: ROOT });
  const member = compilation.authored_members.find(
    (entry) => entry.relative_path === RELATIVE_PATH,
  );
  assert.equal(member.stable_id, 'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER');
  assert.equal(
    compilation.canonical_bundle_input_identity.per_kind_counts
      .PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_INPUT,
    1,
  );
  assert.equal(canonicalJson(member.canonical_value), canonicalJson(contract()));
});

test('keeps the phase boundary to the contract path and away from the runtime bridge', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-metsera-exclusivity-process-phrasebook-admission-adapter-contract-v1.json',
  ), 'utf8'));
  assert.equal(allowlist.allowed.includes(RELATIVE_PATH.replace(/^/, 'contracts/canonical-v2/successor/')), true);
  assert.equal(allowlist.denied.includes('lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission.js'), true);
});
