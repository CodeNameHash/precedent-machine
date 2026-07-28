const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const test = require('node:test');

const {
  createContractFreezeContractBundle,
  enumerateContractFreezeExpectedMembers,
} = require('../../lib/programme-gates/contract-freeze-contracts');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');

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
  }
});

test('P1 compiles from the bootstrap source contract and enumerates its closed witness set', () => {
  const bundle = createContractFreezeContractBundle({ specificationRoot: ROOT });
  assert.equal(bundle.definitions.length, 1);
  const [definition] = bundle.definitions;
  assert.equal(definition.evidence_contract, 'exact-contract-freeze-attestation-and-status-generation/v7');
  assert.equal(definition.specification_root, ROOT);
  assert.equal(validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition), true);

  const members = enumerateContractFreezeExpectedMembers({
    evidenceObject: {
      contract_authority_manifest_id: 'a'.repeat(64),
      compilation_receipt_id: 'b'.repeat(64),
      semantic_identity_review_id: 'c'.repeat(64),
      freeze_gate_approval_id: 'd'.repeat(64),
      status_generation: 1,
    },
  });
  assert.deepEqual(
    members.map((member) => member.member_type),
    [
      'ContractFreezeAuthorityManifest',
      'ContractBundleCompilationReceipt',
      'ContractDiffReviewAttestation',
      'ContractFreezeApproval',
      'ProgrammeGateStatusArtefact',
    ],
  );
});
