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
  buildProcessPhrasebookProductChain,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');
const {
  compileMetseraExclusivityProductResultSet,
} = require('../lib/canonical-v2/metsera-exclusivity-product-result-set');
const {
  compileMetseraExclusivityProductPresentation,
} = require('../lib/canonical-v2/metsera-exclusivity-product-presentation');
const {
  compileMetseraExclusivityProductSurfaces,
} = require('../lib/canonical-v2/metsera-exclusivity-product-surfaces');
const {
  buildMetseraRealProcessAdmission,
} = require('./fixtures/canonical-v2/metsera-real-process-admission');
const {
  executeMetseraTestCohort,
} = require(
  './fixtures/canonical-v2/metsera-external-cohort-execution',
);
const {
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
} = require('../lib/canonical-v2/pilot-product-authority-context');
const {
  compileAgreementCandidateProductMaterialisation,
} = require('../lib/canonical-v2/agreement-candidate-product-materialisation');
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function metseraProcessWriteFixture() {
  const { input: authorityInput, context: authorityContext } = authority();
  const processAdmission = buildMetseraRealProcessAdmission({
    authority_context: authorityContext,
    authority_input: authorityInput,
  });
  const productAdmission = compileMetseraExclusivityProductAdmission({
    process_phrasebook_admission: processAdmission,
  });
  const query = compileMetseraExclusivityProductQuery(
    productAdmission,
    authorityContext,
    authorityInput,
  );
  const row = compileMetseraExclusivityProductRow(
    productAdmission,
    authorityContext,
    authorityInput,
  );
  const resultSet = compileMetseraExclusivityProductResultSet(
    productAdmission,
    row,
    authorityContext,
    authorityInput,
  );
  const presentation = compileMetseraExclusivityProductPresentation(row, resultSet);
  const cohortEvidence = executeMetseraTestCohort(
    productAdmission,
    row,
  );
  const surfaces = compileMetseraExclusivityProductSurfaces(
    productAdmission,
    row,
    resultSet,
    presentation,
    authorityContext,
    authorityInput,
    cohortEvidence,
  );
  const processWriteSet = {
    schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
    candidate_release_binding: {
      candidate_release_manifest_id:
        authorityContext.candidate_release_manifest.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        authorityContext.candidate_release_manifest.canonical_payload_digest,
      corpus_release_id: authorityContext.candidate_release_manifest.corpus_release_id,
      product_query_definition_id: query.query_definition_id,
      release_state: 'CANDIDATE_NOT_ACTIVE',
      authority_state: 'NOT_GRANTED',
    },
    process_pilot_materialisation_receipt:
      processAdmission.materialisation_receipt,
    product_admission: productAdmission,
    product_row: row,
    product_result_set: resultSet,
    product_presentation: presentation,
    product_surfaces: surfaces,
  };
  return {
    authorityInput,
    authorityContext,
    writeSet: buildProductCandidateResultWriteEnvelope({
      adapter_identifier: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
      domain_carrier: buildProcessPhrasebookProductChain(
        processWriteSet,
        authorityContext,
        authorityInput,
      ),
    }),
  };
}

function rehashAuthorityContext(value) {
  const { authority_context_id: ignored, ...body } = value;
  value.authority_context_id = contentId(
    PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
    body,
  );
  return value;
}

function rehashProcessCarrier(writeSet) {
  const carrier = writeSet.domain_carrier;
  const body = clone(carrier);
  delete body.process_phrasebook_product_chain_id;
  delete body.process_phrasebook_product_chain_payload_digest;
  carrier.process_phrasebook_product_chain_id = contentId(
    carrier.schema_version,
    body,
  );
  carrier.process_phrasebook_product_chain_payload_digest = sha256Hex(
    Buffer.from(canonicalJson(body), 'utf8'),
  );
  return writeSet;
}

function rehashProductSurfaces(surfaces) {
  const surfaceBody = clone(surfaces);
  delete surfaceBody.schema_version;
  delete surfaceBody.product_surfaces_receipt_id;
  surfaces.product_surfaces_receipt_id = contentId(
    surfaces.schema_version,
    surfaceBody,
  );
}

function replaceMarketExecutionEvidence(surfaces, evidence) {
  for (const surface of ['COMPARE', 'CORPUS_CONTEXT']) {
    const binding = surfaces.surface_bindings[surface];
    binding.cohort_request = clone(evidence.cohort_request);
    binding.cohort_execution_input =
      clone(evidence.cohort_execution_input);
    binding.cohort_result = clone(evidence.cohort_result);
    binding.cohort_execution_receipt =
      clone(evidence.cohort_execution_receipt);
    binding.subject_cohort_membership = clone(
      evidence.cohort_result.subject_cohort_membership,
    );
    binding.independent_peer_count =
      evidence.cohort_result.counts.independent_peer_count;
  }
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

test('the Process Product candidate writer requires the exact authority pair in its carrier', async () => {
  const fixture = metseraProcessWriteFixture();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const missing = clone(fixture.writeSet);
  delete missing.domain_carrier.pilot_product_authority_context_input;
  rehashProcessCarrier(missing);
  await assert.rejects(
    writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: 'metsera:missing-authority',
      writeSet: missing,
    }),
    (error) => error.code === 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
  );
  const substituted = clone(fixture.writeSet);
  substituted.domain_carrier.pilot_product_authority_context
    .candidate_release_manifest.corpus_release_id = 'f'.repeat(64);
  rehashAuthorityContext(
    substituted.domain_carrier.pilot_product_authority_context,
  );
  rehashProcessCarrier(substituted);
  await assert.rejects(
    writer.write({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: 'metsera:substituted-authority',
      writeSet: substituted,
    }),
    (error) => error.code === 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
  );
  const first = await writer.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'metsera:exact-authority',
    writeSet: fixture.writeSet,
  });
  const replay = await writer.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'metsera:exact-authority',
    writeSet: fixture.writeSet,
  });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(repository.snapshot().productCandidateResults.length, 1);
  const retained = repository.snapshot().productCandidateResults[0]
    .complete_write_set.product_surfaces.surface_bindings.COMPARE;
  const supplied = fixture.writeSet.domain_carrier.complete_write_set
    .product_surfaces.surface_bindings.COMPARE;
  for (const key of [
    'cohort_request',
    'cohort_execution_input',
    'cohort_result',
    'cohort_execution_receipt',
  ]) {
    assert.deepEqual(retained[key], supplied[key]);
  }
});

test('rejects a correctly rehashed persisted materialisation receipt substitution', () => {
  const fixture = metseraProcessWriteFixture();
  const substituted = clone(fixture.writeSet);
  const receipt = substituted.domain_carrier.complete_write_set
    .process_pilot_materialisation_receipt;
  receipt.source_interval_state = 'SUBSTITUTED';
  const receiptBody = clone(receipt);
  delete receiptBody.materialisation_receipt_id;
  receipt.materialisation_receipt_id = contentId(
    receipt.schema_version,
    receiptBody,
  );
  rehashProcessCarrier(substituted);
  assert.throws(
    () => validateProductCandidateResultWriteSet(substituted),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE'
      && /does not equal the bridge-bound receipt/.test(error.message),
  );
});

test('Metsera surfaces fail closed without executed cohort evidence', () => {
  const fixture = metseraProcessWriteFixture();
  const writeSet =
    fixture.writeSet.domain_carrier.complete_write_set;
  assert.throws(
    () => compileMetseraExclusivityProductSurfaces(
      writeSet.product_admission,
      writeSet.product_row,
      writeSet.product_result_set,
      writeSet.product_presentation,
      fixture.authorityContext,
      fixture.authorityInput,
    ),
    /cohort execution evidence is required/,
  );
});

test('rejects locally fabricated execution proof in place of selected candidates', () => {
  const fixture = metseraProcessWriteFixture();
  const writeSet =
    fixture.writeSet.domain_carrier.complete_write_set;
  const fabricated = clone(
    writeSet.product_surfaces.surface_bindings.COMPARE,
  );
  const cohortEvidence = {
    cohort_request: fabricated.cohort_request,
    cohort_execution_input: {
      schema_version: 'METSERA_EXCLUSIVITY_COHORT_EXECUTION_INPUT/V1',
      execution_receipt_id: 'f'.repeat(64),
    },
    cohort_result: fabricated.cohort_result,
    cohort_execution_receipt: fabricated.cohort_execution_receipt,
  };
  assert.throws(
    () => compileMetseraExclusivityProductSurfaces(
      writeSet.product_admission,
      writeSet.product_row,
      writeSet.product_result_set,
      writeSet.product_presentation,
      fixture.authorityContext,
      fixture.authorityInput,
      cohortEvidence,
    ),
    /selected candidate cohort input fields are invalid/,
  );
});

test('rejects a correctly rehashed untyped Metsera subject exclusion', () => {
  const fixture = metseraProcessWriteFixture();
  const substituted = clone(fixture.writeSet);
  const surfaces = substituted.domain_carrier.complete_write_set
    .product_surfaces;
  surfaces.surface_bindings.COMPARE.subject_cohort_membership = {
    status: 'EXCLUDED',
    exclusion_reason: 'NO_INDEPENDENT_PEERS',
  };
  const surfaceBody = clone(surfaces);
  delete surfaceBody.schema_version;
  delete surfaceBody.product_surfaces_receipt_id;
  surfaces.product_surfaces_receipt_id = contentId(
    surfaces.schema_version,
    surfaceBody,
  );
  rehashProcessCarrier(substituted);
  assert.throws(
    () => validateProductCandidateResultWriteSet(substituted),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE'
      && /cohort|surface receipt/.test(error.details.cause),
  );
});

test('rejects a re-signed Metsera cohort result inconsistent with its execution input', () => {
  const fixture = metseraProcessWriteFixture();
  const substituted = clone(fixture.writeSet);
  const surfaces = substituted.domain_carrier.complete_write_set
    .product_surfaces;
  const evidence = {
    cohort_request:
      surfaces.surface_bindings.COMPARE.cohort_request,
    cohort_execution_input:
      surfaces.surface_bindings.COMPARE.cohort_execution_input,
    cohort_result:
      clone(surfaces.surface_bindings.COMPARE.cohort_result),
    cohort_execution_receipt:
      clone(
        surfaces.surface_bindings.COMPARE.cohort_execution_receipt,
      ),
  };
  evidence.cohort_result.counts.independent_peer_count = 1;
  const membership =
    evidence.cohort_result.subject_cohort_membership;
  membership.counts_digest = contentId(
    'SUBJECT_COHORT_COUNTS/V1',
    evidence.cohort_result.counts,
  );
  const membershipBody = clone(membership);
  delete membershipBody.membership_receipt_id;
  membership.membership_receipt_id = contentId(
    'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
    membershipBody,
  );
  const resultBody = clone(evidence.cohort_result);
  delete resultBody.cohort_result_id;
  evidence.cohort_result.cohort_result_id = contentId(
    evidence.cohort_result.schema_version,
    resultBody,
  );
  const receipt = evidence.cohort_execution_receipt;
  receipt.cohort_result_id = evidence.cohort_result.cohort_result_id;
  receipt.counts_digest = membership.counts_digest;
  receipt.membership_receipt_id = membership.membership_receipt_id;
  const receiptBody = clone(receipt);
  delete receiptBody.cohort_execution_receipt_id;
  receipt.cohort_execution_receipt_id = contentId(
    receipt.schema_version,
    receiptBody,
  );
  replaceMarketExecutionEvidence(surfaces, evidence);
  rehashProductSurfaces(surfaces);
  rehashProcessCarrier(substituted);
  assert.throws(
    () => validateProductCandidateResultWriteSet(substituted),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE'
      && /result or receipt was changed|surface receipt/.test(
        error.details.cause,
      ),
  );
});

test('rejects a content-addressed execution receipt substituted for the exact result', () => {
  const fixture = metseraProcessWriteFixture();
  const substituted = clone(fixture.writeSet);
  const surfaces = substituted.domain_carrier.complete_write_set
    .product_surfaces;
  const evidence = {
    cohort_request:
      surfaces.surface_bindings.COMPARE.cohort_request,
    cohort_execution_input:
      surfaces.surface_bindings.COMPARE.cohort_execution_input,
    cohort_result:
      surfaces.surface_bindings.COMPARE.cohort_result,
    cohort_execution_receipt:
      clone(
        surfaces.surface_bindings.COMPARE.cohort_execution_receipt,
      ),
  };
  evidence.cohort_execution_receipt.cohort_result_id =
    'f'.repeat(64);
  const receiptBody = clone(evidence.cohort_execution_receipt);
  delete receiptBody.cohort_execution_receipt_id;
  evidence.cohort_execution_receipt.cohort_execution_receipt_id =
    contentId(
      evidence.cohort_execution_receipt.schema_version,
      receiptBody,
    );
  replaceMarketExecutionEvidence(surfaces, evidence);
  rehashProductSurfaces(surfaces);
  rehashProcessCarrier(substituted);
  assert.throws(
    () => validateProductCandidateResultWriteSet(substituted),
    (error) => error.code === 'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE'
      && /result or receipt was changed|surface receipt/.test(
        error.details.cause,
      ),
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

test('keeps SQL staging-only and invokes Agreement validation', () => {
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
    assert.match(source, /validate_agreement_candidate_product_carrier/);
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

test('normalises the validated Process carrier into the signed candidate record', () => {
  const foundation = fs.readFileSync(
    path.join(ROOT, 'supabase/canonical-v2-foundation.sql'),
    'utf8',
  );
  const processStart = foundation.indexOf(
    "IF adapter_identifier = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' THEN",
  );
  const normalisation = foundation.indexOf(
    "'schema_version', 'PRODUCT_CANDIDATE_RESULT_RECORD/V1'",
    processStart,
  );
  const insert = foundation.indexOf(
    'INSERT INTO canonical_v2_staging.product_candidate_results', normalisation,
  );
  assert.ok(processStart !== -1 && normalisation > processStart && insert > normalisation);
  const record = foundation.slice(normalisation, insert);
  assert.match(record, /'complete_write_set', p_write_set/);
  assert.match(record, /'process_phrasebook_result_identity'/);
  assert.match(record, /content_id\(\s*'PRODUCT_CANDIDATE_RESULT_RECORD\/V1', p_write_set/);
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

test('records the Stage 3 SQL correction boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      '.github/phase-allowlists/wp-p8-agreement-writer-sql-stage3-correction-v1.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.phase,
    'WP-P8-AGREEMENT-WRITER-SQL-STAGE3-CORRECTION-V1',
  );
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-agreement-writer-sql-stage3-correction-v1.json',
    'sql/optionA/step0b-canonical-writer-by-contract.sql',
    'supabase/canonical-v2-foundation.sql',
    'supabase/canonical-v2-product-candidate-result-writer.sql',
    'tests/canonical-v2-writer-envelope-integrity-sql.test.js',
    'tests/canonical-v2-writer-object-integrity-sql.test.js',
    'tests/canonical-v2-product-candidate-result-writer.test.js',
  ]);
});
