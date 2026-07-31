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
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
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
    value.definition.source_receipt_contract.materialisation_input_schema_version,
    'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_INPUT/V1',
  );
  assert.equal(
    value.definition.source_receipt_contract.source_materialisation_validator,
    'validateProcessExclusivityPilotMaterialisation(receipt,input)',
  );
  assert.equal(value.definition.source_receipt_contract.full_materialisation_input_required, true);
  assert.equal(value.definition.source_receipt_contract.source_materialisation_input_canonical_bytes_participate_in_adapter_identity, true);
  assert.equal(value.definition.source_receipt_contract.correctly_rehashed_receipt_substitution_without_exact_materialisation_input_permitted, false);
  assert.equal(
    value.definition.target_admission_contract.admission_receipt_schema_version,
    'PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT/V1',
  );
  assert.equal(value.definition.source_receipt_contract.source_input_and_receipt_id_and_canonical_bytes_required, true);
  assert.equal(value.definition.target_admission_contract.admission_input_and_receipt_canonical_bytes_required, true);
  assert.equal(value.definition.target_admission_contract.target_compiler, 'compileProcessPhrasebookResultAdmission');
  assert.equal(value.definition.target_admission_contract.target_receipt_validator, 'validateProcessPhrasebookResultAdmissionReceipt');
  assert.deepEqual(value.definition.adapter_receipt_contract.required_fields, [
    'schema_version', 'process_phrasebook_admission_id', 'materialisation_input', 'materialisation_receipt',
    'materialisation_receipt_id', 'process_admission_input',
    'process_admission_receipt', 'candidate_release_binding',
    'pilot_product_authority_context', 'pilot_product_authority_input',
    'product_query_definition_id', 'adapter_state', 'authority_state',
    'authority_limits',
  ]);
  assert.deepEqual(value.definition.adapter_receipt_contract.identity_inputs, [
    'materialisation_input', 'materialisation_receipt', 'materialisation_receipt_id',
    'process_admission_input', 'process_admission_receipt',
    'candidate_release_binding', 'pilot_product_authority_context',
    'pilot_product_authority_input', 'product_query_definition_id',
    'adapter_state', 'authority_state', 'authority_limits',
  ]);
  assert.equal(value.definition.adapter_receipt_contract.complete_candidate_release_binding_required, true);
  assert.equal(value.definition.adapter_receipt_contract.complete_pilot_product_authority_context_required, true);
  assert.equal(value.definition.adapter_receipt_contract.complete_pilot_product_authority_input_required, true);
  assert.equal(
    value.definition.adapter_receipt_contract.product_query_definition_id_derivation,
    'DERIVED_FROM_COMPLETE_CANDIDATE_RELEASE_BOUND_ADMISSION_EVIDENCE_AND_VALIDATED_PILOT_PRODUCT_AUTHORITY',
  );
  assert.equal(value.definition.adapter_receipt_contract.authority_state, 'NOT_GRANTED');
  assert.deepEqual(new Set(Object.values(value.definition.adapter_receipt_contract.authority_limits)), new Set(['NONE']));
  assert.equal(value.definition.lineage_preservation_contract.exact_utf8_bytes_preserved, true);
  assert.equal(value.definition.caller_prohibition_contract.caller_query_authority_permitted, false);
  assert.equal(value.definition.authority_contract.creates_external_authority, false);
  assert.equal(value.definition.authority_contract.creates_new_result_architecture, false);
  assert.match(PROCESS_PILOT_ADMISSION_ADAPTER_CONTRACT_DEFINITION_DIGEST, /^[a-f0-9]{64}$/);
});

test('rejects hostile changes and derives every required root dependency edge', () => {
  const hostileChanges = [
    (value) => { value.definition.target_admission_contract.target_compiler = 'otherCompiler'; },
    (value) => { value.definition.target_admission_contract.target_receipt_validator = 'otherValidator'; },
    (value) => { value.definition.source_receipt_contract.source_materialisation_validator = 'hashOnlyReceipt'; },
    (value) => { value.definition.source_receipt_contract.full_materialisation_input_required = false; },
    (value) => { value.definition.source_receipt_contract.source_materialisation_input_canonical_bytes_participate_in_adapter_identity = false; },
    (value) => { value.definition.source_receipt_contract.correctly_rehashed_receipt_substitution_without_exact_materialisation_input_permitted = true; },
    (value) => { value.definition.adapter_receipt_contract.identity_inputs.pop(); },
    (value) => { value.definition.adapter_receipt_contract.required_fields.pop(); },
    (value) => { value.definition.adapter_receipt_contract.complete_candidate_release_binding_required = false; },
    (value) => { value.definition.adapter_receipt_contract.product_query_definition_id_derivation = 'CALLER_SUPPLIED'; },
    (value) => { value.definition.adapter_receipt_contract.authority_state = 'GRANTED'; },
    (value) => { value.definition.adapter_receipt_contract.authority_limits.writer = 'WRITE'; },
    (value) => { value.definition.dependency_contract.product_query_ir_stable_id = 'OTHER_QUERY_IR'; },
    (value) => { value.definition.authority_contract.creates_writer_authority = true; },
  ];
  for (const mutate of hostileChanges) {
    const changed = structuredClone(contract());
    mutate(changed);
    assert.throws(
      () => validateProcessPilotAdmissionAdapterContractInput(changed),
      { code: 'INVALID_METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER_CONTRACT_INPUT' },
    );
  }
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
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: compilation,
  });
  const disposition = proposal.proposed_dispositions.find(
    (entry) => entry.authored_identity.stable_id
      === 'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION_ADAPTER',
  );
  assert.deepEqual(
    disposition.ordered_dependency_identities.map((entry) => entry.stable_id),
    [
      'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
      'PROCESS',
      'PROCESS_NARRATION_OCCURRENCE',
      'PROCESS_PREDICATE_WITNESS',
      'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      'PROCESS_PASSAGE',
      'BOUNDED_INLINE_PASSAGE_PREVIEW',
      'PRODUCT_QUERY_IR',
      'PROCESS_CONTROLLED_CODE_REGISTRY',
    ],
  );
});

test('keeps the phase boundary to the contract path and away from the runtime bridge', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-metsera-exclusivity-process-phrasebook-admission-adapter-contract-v1.json',
  ), 'utf8'));
  assert.equal(allowlist.allowed.includes(RELATIVE_PATH.replace(/^/, 'contracts/canonical-v2/successor/')), true);
  assert.equal(allowlist.denied.includes('lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission.js'), true);
});
