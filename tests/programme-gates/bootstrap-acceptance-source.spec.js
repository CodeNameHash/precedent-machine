const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const test = require('node:test');

const {
  createContractFreezeContractBundle,
  enumerateContractFreezeExpectedMembers,
} = require('../../lib/programme-gates/contract-freeze-contracts');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');
const { domainDigest } = require('../../lib/programme-gates/bytes');
const {
  VALIDATOR_EXECUTABLE_FILES,
  programmeGateValidatorExecutableDigest,
} = require('../../lib/programme-gates/validator-executable');

const ROOT = 'a'.repeat(64);

test('the reviewed bootstrap source is reproducible and contains eleven complete definitions', () => {
  execFileSync(
    process.execPath,
    ['scripts/generate-bootstrap-acceptance-source.mjs', '--check'],
    { cwd: process.cwd(), stdio: 'pipe' },
  );
  const source = JSON.parse(
    fs.readFileSync('docs/codex-program/bootstrap-acceptance-source.json', 'utf8'),
  );
  assert.equal(source.definition_count, 11);
  assert.equal(source.genesis_gate_count, 10);
  assert.equal(source.definitions.length, 11);
  assert.equal(source.ordered_gate_ids.at(-1), 'P1_CONTRACT_FREEZE_ATTESTED');
  for (const definition of source.definitions) {
    assert.equal(definition.descriptor.activation_state, 'ACTIVE');
    assert.ok(definition.member_schemas.length > 0);
    assert.ok(definition.ordered_claim_predicates.length > 0);
    assert.equal(
      definition.member_universe.enumerator_transitive_source_closure_digest,
      source.acceptance_executable_closure_digest,
    );
    assert.ok(definition.ordered_claim_predicates.every((predicate) => (
      predicate.measurement_transitive_source_closure_digest
        === source.acceptance_executable_closure_digest
      && /^[a-f0-9]{64}$/.test(predicate.measurement_executable_digest)
    )));
  }
  const modules = new Map(
    source.runtime_source_modules.map((module) => [module.path, module]),
  );
  assert.ok(VALIDATOR_EXECUTABLE_FILES.every((file) => modules.has(file)));
  assert.equal(
    source.acceptance_executable_closure_digest,
    programmeGateValidatorExecutableDigest({ root: process.cwd() }),
  );
  assert.equal(
    source.runtime_source_set_digest,
    domainDigest(
      'PROGRAMME_GATE_BOOTSTRAP_RUNTIME_SOURCE_SET/V1',
      source.runtime_source_modules.map((module) => ({
        path: module.path,
        byte_length: module.byte_length,
        sha256: module.sha256,
      })),
    ),
  );
  for (const module of source.runtime_source_modules) {
    assert.equal(Buffer.byteLength(module.utf8_source), module.byte_length);
    assert.equal(
      crypto.createHash('sha256').update(module.utf8_source).digest('hex'),
      module.sha256,
    );
  }
  for (const required of [
    'lib/programme-gates/bytes.js',
    'lib/programme-gates/review-controller.js',
    'lib/programme-gates/review-evidence.js',
    'lib/programme-gates/cold-review-tasks.js',
  ]) {
    assert.ok(modules.has(required));
  }
  const review = source.definitions.find(
    (definition) => definition.descriptor.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  );
  const inputs = review.ordered_claim_predicates.find(
    (predicate) => (
      predicate.claim_key === 'five_named_lane_outcomes_recorded_same_root'
    ),
  ).exact_input_member_types_and_paths;
  for (const jsonPointer of [
    '/registered_prompt_id',
    '/cold_review_prompt_digest',
    '/parent_session_state',
    '/no_earlier_review_conclusions_were_inputs',
    '/controller_key_id',
    '/reviewer_principal_id',
  ]) {
    assert.ok(inputs.some((input) => (
      input.member_type === 'TrustedReviewControllerRecord'
      && input.json_pointer === jsonPointer
    )));
  }
});

test('P1 compiles from the bootstrap source contract and enumerates its closed witness set', () => {
  const bundle = createContractFreezeContractBundle({ specificationRoot: ROOT });
  assert.equal(bundle.definitions.length, 1);
  const [definition] = bundle.definitions;
  assert.equal(definition.evidence_contract, 'exact-contract-freeze-attestation-and-status-generation/v9');
  assert.equal(definition.specification_root, ROOT);
  assert.equal(validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition), true);

  const members = enumerateContractFreezeExpectedMembers({
    evidenceObject: {
      contract_authority_manifest_id: 'a'.repeat(64),
      compilation_receipt_id: 'b'.repeat(64),
      semantic_identity_review_id: 'c'.repeat(64),
      freeze_gate_approval_id: 'd'.repeat(64),
      status_generation: 1,
      authority_member_inventory: [{
        member_id: 'authority-evidence:test',
        member_type: 'ContractFreezeAuthorityEvidence',
      }],
    },
  });
  assert.deepEqual(
    members.map((member) => member.member_type),
    [
      'ContractFreezeAttestationIdentity',
      'ContractFreezeAuthorityManifest',
      'ContractBundleCompilationReceipt',
      'ContractDiffReviewAttestation',
      'ContractFreezeApproval',
      'ProgrammeGateStatusArtefact',
      'ContractFreezeAuthorityEvidence',
    ],
  );
});
