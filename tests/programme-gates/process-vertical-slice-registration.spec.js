const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const { domainDigest } = require('../../lib/programme-gates/bytes');
const {
  PROCESS_VERTICAL_SLICE_ACCEPTANCE_ITEMS,
  PROCESS_VERTICAL_SLICE_ADVERSARIAL_REJECTIONS,
  PROCESS_VERTICAL_SLICE_GATE_BINDING,
} = require('../../lib/programme-gates/registry');
const {
  processVerticalSliceEvidenceCanExecute,
  processVerticalSliceEvidenceIsInternallyBound,
  processVerticalSliceEvidenceMatchesRelease,
} = require('../../lib/programme-gates/predicates');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');
const {
  expectedTestExecutableDigest,
  testExecutableFiles,
  testExecutableState,
} = require('../../lib/programme-gates/test-executable-registry');

const ROOT = path.resolve(__dirname, '../..');
const DIGEST = (index) => crypto.createHash('sha256').update(String(index)).digest('hex');

function evidence() {
  const value = {
    schema_version: 'PROCESS_VERTICAL_SLICE_ATTESTATION/V1',
    gate_id: 'PROCESS_VERTICAL_SLICE_PASS',
    status: 'PASS',
    frozen_pair_id: DIGEST(1),
    canonical_contract_bundle_id: DIGEST(2),
    canonical_contract_bundle_payload_digest: DIGEST(3),
    agreement_shared_and_process_input_root: DIGEST(4),
    code_commit: 'a'.repeat(40),
    candidate_release_manifest_id: DIGEST(5),
    candidate_release_manifest_payload_digest: DIGEST(6),
    pm_data_version: 'PM-DATA/V1',
    product_field_catalogue_id: DIGEST(7),
    product_field_catalogue_payload_digest: DIGEST(8),
    navigation_catalogue_id: DIGEST(9),
    navigation_catalogue_payload_digest: DIGEST(10),
    source_universe_manifest_id: DIGEST(11),
    source_universe_manifest_payload_digest: DIGEST(12),
    sealed_gold_package_id: DIGEST(13),
    sealed_gold_package_payload_digest: DIGEST(14),
    release_scope_decision_id: DIGEST(15),
    release_scope_decision_payload_digest: DIGEST(16),
    benchmark_manifest_id: DIGEST(17),
    benchmark_manifest_payload_digest: DIGEST(18),
    acceptance_item_evidence: PROCESS_VERTICAL_SLICE_ACCEPTANCE_ITEMS.map((item_id, index) => ({
      item_id,
      certification_id: DIGEST(`acceptance-${index}`),
    })),
    predicate_certification_identities: [DIGEST(19)],
    field_certification_identities: [DIGEST(20)],
    adversarial_rejection_receipts: PROCESS_VERTICAL_SLICE_ADVERSARIAL_REJECTIONS.map(
      (rejection_code, index) => ({
        rejection_code,
        test_id: 'VERTICAL-SLICE-01',
        test_execution_id: DIGEST(`rejection-${index}`),
      }),
    ),
    attester_key_id: 'PROGRAMME_GATE_VALIDATOR_2026_07',
    signature_algorithm: 'Ed25519',
    signature: Buffer.alloc(64, 1).toString('base64'),
  };
  const unsigned = { ...value };
  delete unsigned.signature;
  value.attestation_id = domainDigest('PROCESS_VERTICAL_SLICE_ATTESTATION_ID/V1', unsigned);
  value.payload_digest = domainDigest('PROCESS_VERTICAL_SLICE_ATTESTATION_PAYLOAD/V1', unsigned);
  return value;
}

function rebind(value) {
  const rebound = { ...value };
  const signature = rebound.signature;
  delete rebound.attestation_id;
  delete rebound.payload_digest;
  delete rebound.signature;
  const attestationId = domainDigest('PROCESS_VERTICAL_SLICE_ATTESTATION_ID/V1', rebound);
  const payloadDigest = domainDigest('PROCESS_VERTICAL_SLICE_ATTESTATION_PAYLOAD/V1', rebound);
  rebound.attestation_id = attestationId;
  rebound.payload_digest = payloadDigest;
  rebound.signature = signature;
  return rebound;
}

test('registers the Process gate as a deferred, non-substitutable successor binding', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'docs/codex-program/programme-gates.yaml'),
    'utf8',
  );
  const registration = YAML.parse(source).programme_gate_registry
    .deferred_successor_gate_registrations.PROCESS_VERTICAL_SLICE_PASS;
  assert.deepEqual(registration, {
    evidence_contract: PROCESS_VERTICAL_SLICE_GATE_BINDING.evidence_contract,
    evidence_schema_id: PROCESS_VERTICAL_SLICE_GATE_BINDING.evidence_schema_id,
    canonical_predecessor_gate_id: 'P1_VERTICAL_SLICE_PASS',
    canonical_predecessor_is_substitutable: false,
    governing_gate_activation_state: 'DEFERRED_UNTIL_P8_EXACT_ROOT_AMENDMENT',
    governing_gate_entry_required_before_evidence_execution: true,
    evidence_execution_state: 'BLOCKED',
    successor_candidate_scope_dependency_required: true,
    required_adversarial_tests: ['VERTICAL-SLICE-01'],
    authority: 'NONE',
  });
  assert.equal(PROCESS_VERTICAL_SLICE_GATE_BINDING.authority, 'NONE');
  assert.equal(PROCESS_VERTICAL_SLICE_GATE_BINDING.evidence_execution_state, 'BLOCKED');
  assert.equal(testExecutableState('VERTICAL-SLICE-01'), 'IMPLEMENTED');
  assert.deepEqual(testExecutableFiles('VERTICAL-SLICE-01'), [
    'tests/programme-gates/process-vertical-slice-registration.spec.js',
    'tests/programme-gates-schema-registry.test.js',
  ]);
  assert.match(expectedTestExecutableDigest('VERTICAL-SLICE-01'), /^[a-f0-9]{64}$/);
});

test('rejects missing, wrong, duplicate, substituted, unsigned and cross-release evidence', () => {
  const valid = evidence();
  assert.equal(validateSchema('PROCESS_VERTICAL_SLICE_ATTESTATION/V1', valid), true);
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(valid), true);
  assert.equal(processVerticalSliceEvidenceMatchesRelease(valid, valid), true);
  assert.equal(processVerticalSliceEvidenceCanExecute(valid), false);

  const missing = { ...valid };
  delete missing.benchmark_manifest_payload_digest;
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(missing), false);

  const wrong = { ...valid, gate_id: 'P1_VERTICAL_SLICE_PASS' };
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(wrong), false);

  const duplicate = rebind({
    ...valid,
    acceptance_item_evidence: [
      ...valid.acceptance_item_evidence,
      { ...valid.acceptance_item_evidence[0], certification_id: DIGEST('duplicate') },
    ],
  });
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(duplicate), false);

  const substituted = rebind({
    ...valid,
    canonical_contract_bundle_payload_digest: DIGEST('substituted-contract'),
  });
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(substituted), true);
  assert.equal(processVerticalSliceEvidenceMatchesRelease(substituted, valid), false);

  const unsigned = { ...valid };
  delete unsigned.signature;
  assert.equal(processVerticalSliceEvidenceIsInternallyBound(unsigned), false);

  const crossRelease = rebind({
    ...valid,
    candidate_release_manifest_id: DIGEST('other-release'),
  });
  assert.equal(processVerticalSliceEvidenceMatchesRelease(crossRelease, valid), false);
});
