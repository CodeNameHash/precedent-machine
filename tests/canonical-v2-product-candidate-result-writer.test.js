const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require(
  '../contracts/canonical-v2/successor/product/query/product-candidate-result-writer.v1.json',
);
const {
  ALLOWED_OPERATIONS,
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
  buildAgreementCandidateEnvelopeCarrier,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  compileAgreementCandidateProductMaterialisation,
} = require('../lib/canonical-v2/agreement-candidate-product-materialisation');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  authority,
  evaluationEvidence,
  familyInput,
} = require(
  './fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs',
);
const {
  validateAuthoredProductCandidateWriteInputs,
} = require(
  '../lib/canonical-v2/product-candidate-write-contract-input-validator',
);

const ROOT = path.join(__dirname, '..');

function agreementWriteFixture(profile) {
  const {
    input: authorityInput,
    context: authorityContext,
  } = authority();
  const envelopeInput = {
    family_profile_id: profile,
    family_input: familyInput(profile),
  };
  const prepared = evaluationEvidence({
    envelopeInput,
    authorityInput,
    authorityContext,
  });
  const materialisation = compileAgreementCandidateProductMaterialisation({
    agreement_candidate_envelope: prepared.envelopeValue,
    family_input: envelopeInput.family_input,
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_context_input: authorityInput,
    product_evaluation_evidence: prepared.product_evaluation_evidence,
  });
  return {
    contractBundle: envelopeInput.family_input.contract_bundle,
    envelope: prepared.envelopeValue,
    materialisation,
    writeSet: buildProductCandidateResultWriteEnvelope({
      adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
      domain_carrier: buildAgreementCandidateEnvelopeCarrier(
        prepared.envelopeValue,
        materialisation,
      ),
    }),
  };
}

test('registers one staging-only candidate-result writer contract', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductCandidateWriteInputs([{
      object_kind: contract.object_kind,
      canonical_value: contract,
    }]),
  );
  assert.equal(contract.stable_id, 'PRODUCT_CANDIDATE_RESULT_WRITER');
  assert.equal(
    contract.definition.operation_contract.operation,
    'PRODUCT_RESULT_CANDIDATE_RUN',
  );
  assert.equal(
    contract.definition.operation_contract.second_writer_permitted,
    false,
  );
  assert.equal(
    contract.definition.authority_contract.creates_production_authority,
    false,
  );
});

test('fails closed before a partial Product chain can reach the writer', () => {
  assert.throws(
    () => validateProductCandidateResultWriteSet(
      buildProductCandidateResultWriteEnvelope({
        adapter_identifier: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
        domain_carrier: { schema_version: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1' },
      }),
    ),
    (error) => error.code === 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
  );
  assert.equal(
    PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    'PRODUCT_CANDIDATE_RESULT_RECORD/V1',
  );
  assert.equal(
    ALLOWED_OPERATIONS.has('PRODUCT_RESULT_CANDIDATE_RUN'),
    true,
  );
});

test('rejects unknown adapters and carrier substitution before Product persistence', () => {
  assert.equal(
    PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA,
    'PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE/V1',
  );
  assert.throws(
    () => validateProductCandidateResultWriteSet(
      buildProductCandidateResultWriteEnvelope({
        adapter_identifier: 'NEAREST_PRODUCT_CHAIN',
        domain_carrier: {},
      }),
    ),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE',
  );
});

for (const profile of [
  'CAPITALISATION_BRING_DOWN_V3',
  'IOC_CAPEX_RESTRICTION_V1',
]) {
  test(`${profile} reaches the one immutable candidate-result insert and exact replay is a no-op`, async () => {
    const fixture = agreementWriteFixture(profile);
    const validation = validateProductCandidateResultWriteSet(fixture.writeSet);
    assert.equal(validation.materialisable, true);
    assert.equal(validation.candidateRecord.candidate_state, 'CANDIDATE_NOT_ACTIVE');
    assert.equal(
      validation.candidateRecord.corpus_release_id,
      fixture.materialisation.candidate_release_binding.corpus_release_id,
    );
    const repository = new InMemoryCanonicalRepository();
    const writer = createCanonicalWriter({
      repository,
      contractBundle: fixture.contractBundle,
    });
    const first = await writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: `agreement:${profile}`,
      writeSet: fixture.writeSet,
    });
    const replay = await writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: `agreement:${profile}`,
      writeSet: fixture.writeSet,
    });
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(repository.snapshot().productCandidateResults.length, 1);
  });
}

test('cross-family substitution and conflicting replay fail closed', async () => {
  const f28 = agreementWriteFixture('CAPITALISATION_BRING_DOWN_V3');
  const ioc = agreementWriteFixture('IOC_CAPEX_RESTRICTION_V1');
  const substituted = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
    domain_carrier: buildAgreementCandidateEnvelopeCarrier(
      f28.envelope,
      ioc.materialisation,
    ),
  });
  assert.throws(
    () => validateProductCandidateResultWriteSet(substituted),
    (error) => error.code
      === 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
  );

  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({
    repository,
    contractBundle: f28.contractBundle,
  });
  await writer.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'agreement:conflict',
    writeSet: f28.writeSet,
  });
  await assert.rejects(
    writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: 'agreement:conflict',
      writeSet: ioc.writeSet,
    }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('a correctly rehashed authority substitution fails before persistence', () => {
  const fixture = agreementWriteFixture('IOC_CAPEX_RESTRICTION_V1');
  const changed = JSON.parse(JSON.stringify(fixture.materialisation));
  changed.authority_state = 'GRANTED';
  const body = JSON.parse(JSON.stringify(changed));
  delete body.schema_version;
  delete body.agreement_candidate_product_materialisation_id;
  changed.agreement_candidate_product_materialisation_id = contentId(
    changed.schema_version,
    body,
  );
  const writeSet = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
    domain_carrier: buildAgreementCandidateEnvelopeCarrier(
      fixture.envelope,
      changed,
    ),
  });
  assert.throws(
    () => validateProductCandidateResultWriteSet(writeSet),
    (error) => error.code
      === 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
  );
});

test('a failure after the candidate insert rolls the whole transaction back', async () => {
  const fixture = agreementWriteFixture('IOC_CAPEX_RESTRICTION_V1');
  const repository = new InMemoryCanonicalRepository();
  const transaction = repository.transaction.bind(repository);
  repository.transaction = (operation) => transaction(async (writer) => {
    writer.writeReceipt = async () => {
      throw new Error('forced receipt failure');
    };
    return operation(writer);
  });
  const writer = createCanonicalWriter({
    repository,
    contractBundle: fixture.contractBundle,
  });
  await assert.rejects(
    writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: 'agreement:rollback',
      writeSet: fixture.writeSet,
    }),
    /forced receipt failure/,
  );
  assert.deepEqual(repository.snapshot().productCandidateResults, []);
  assert.deepEqual(repository.snapshot().receipts, []);
});

test('keeps Product candidate records inside the one canonical repository', async () => {
  const repository = new InMemoryCanonicalRepository();
  const record = {
    schema_version: PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    candidate_product_result_id: 'a'.repeat(64),
    marker: 'first',
  };
  await repository.transaction(async (transaction) => {
    await transaction.writeProductCandidateResult(record);
  });
  await repository.transaction(async (transaction) => {
    await transaction.writeProductCandidateResult(record);
  });
  assert.deepEqual(repository.snapshot().productCandidateResults, [record]);
  await assert.rejects(
    repository.transaction(async (transaction) => {
      await transaction.writeProductCandidateResult({
        ...record,
        marker: 'conflict',
      });
    }),
    (error) => error.code === 'CANONICAL_IDENTITY_CONFLICT',
  );
});

test('gives SQL the same staging-only operation and immutable table', () => {
  const writerSql = fs.readFileSync(
    path.join(
      ROOT,
      'sql/optionA/step0b-canonical-writer-by-contract.sql',
    ),
    'utf8',
  );
  const foundation = fs.readFileSync(
    path.join(ROOT, 'supabase/canonical-v2-foundation.sql'),
    'utf8',
  );
  const migration = fs.readFileSync(
    path.join(ROOT, 'supabase/canonical-v2-product-candidate-result-writer.sql'),
    'utf8',
  );
  for (const source of [writerSql, foundation, migration]) {
    assert.match(source, /PRODUCT_RESULT_CANDIDATE_RUN/);
    assert.match(source, /product_candidate_results/);
    assert.match(source, /AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION\/V1/);
    assert.match(source, /PRODUCT_CANDIDATE_RESULT_RECORD\/V1/);
    assert.match(source, /invalid Agreement candidate Product materialisation/);
  }
  assert.match(
    writerSql,
    /Product candidate-result identity conflict/,
  );
  assert.match(writerSql, /CANDIDATE_NOT_ACTIVE/);
  assert.equal(
    contract.definition.operation_contract.production_permitted,
    false,
  );
});

test('uses the exact bounded phase allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      '.github/phase-allowlists/wp-p8-generic-writer-correction.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.phase,
    'WP-P8-GENERIC-WRITER-CORRECTION',
  );
  assert.equal(allowlist.allowed.length, 13);
});
