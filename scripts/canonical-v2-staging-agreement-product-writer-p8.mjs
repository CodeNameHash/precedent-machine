#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  buildCanonicalWriteReceipt,
  CanonicalWriterError,
  createCanonicalWriter,
  InMemoryCanonicalRepository,
} = require('../lib/canonical-v2/canonical-writer');
const {
  compileAgreementCandidateProductMaterialisation,
} = require('../lib/canonical-v2/agreement-candidate-product-materialisation');
const {
  buildAgreementCandidateEnvelopeCarrier,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  authority,
  evaluationEvidence,
  familyInput,
} = require('../tests/fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs');

const OPERATION = 'PRODUCT_RESULT_CANDIDATE_RUN';
const STAGING_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const PROFILES = Object.freeze([
  'CAPITALISATION_BRING_DOWN_V3',
  'IOC_CAPEX_RESTRICTION_V1',
]);
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-agreement-product-writer-p8-',
  operationLabel: 'P8 Agreement Product writer staging proof',
  bounds: {
    maxSqlBytes: 6 * 1024 * 1024,
    maxProcessBufferBytes: 8 * 1024 * 1024,
    maxResponseBytes: 1024 * 1024,
  },
});

function idempotencyKey(profile) {
  return `P8_AGREEMENT_PRODUCT_WRITER_${profile}_V1`;
}

function buildFixture(profile) {
  const { input: authorityInput, context: authorityContext } = authority();
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
  const writeSet = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
    domain_carrier: buildAgreementCandidateEnvelopeCarrier(
      prepared.envelopeValue,
      materialisation,
    ),
  });
  return {
    profile,
    contractBundle: envelopeInput.family_input.contract_bundle,
    materialisation,
    writeSet,
    validation: validateProductCandidateResultWriteSet(writeSet),
  };
}

function requestFor({ fixture, idempotencyKey: key }) {
  const residuals = [];
  const quarantines = [];
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: OPERATION,
    idempotencyKey: key,
    writeSet: fixture.writeSet,
    residuals,
    quarantines,
  });
  return {
    idempotencyKey: key,
    inputDigest,
    receipt: buildCanonicalWriteReceipt({
      operation: OPERATION,
      idempotencyKey: key,
      inputDigest,
      validation: fixture.validation,
    }),
  };
}

async function proveLocalWriter(fixtures) {
  for (const fixture of fixtures) {
    const key = idempotencyKey(fixture.profile);
    const other = fixtures.find((entry) => entry.profile !== fixture.profile);
    const repository = new InMemoryCanonicalRepository();
    const writer = createCanonicalWriter({
      repository,
      contractBundle: fixture.contractBundle,
    });
    const dryRun = await writer.write({
      operation: OPERATION,
      idempotencyKey: key,
      dryRun: true,
      writeSet: fixture.writeSet,
    });
    const commit = await writer.write({
      operation: OPERATION,
      idempotencyKey: key,
      writeSet: fixture.writeSet,
    });
    const replay = await writer.write({
      operation: OPERATION,
      idempotencyKey: key,
      writeSet: fixture.writeSet,
    });
    let conflictRejected = false;
    try {
      await writer.write({
        operation: OPERATION,
        idempotencyKey: key,
        writeSet: other.writeSet,
      });
    } catch (error) {
      conflictRejected = error instanceof CanonicalWriterError
        && error.code === 'IDEMPOTENCY_CONFLICT';
    }
    const snapshot = repository.snapshot();
    if (
      dryRun.dryRun !== true
      || commit.replayed !== false
      || replay.replayed !== true
      || !conflictRejected
      || snapshot.productCandidateResults.length !== 1
      || snapshot.receipts.length !== 1
      || commit.receipt.inputDigest !== dryRun.inputDigest
    ) {
      throw new Error(`Local ${fixture.profile} writer proof failed closed.`);
    }
    fixture.request = {
      idempotencyKey: key,
      inputDigest: dryRun.inputDigest,
      receipt: commit.receipt,
    };
  }
}

function stateSql() {
  return `
SELECT
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_candidate_results)
    AS candidate_result_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.write_receipts
   WHERE operation = ${runtime.sqlText(OPERATION)})
    AS candidate_write_receipt_count,
  (SELECT canonical_payload
   FROM canonical_v2_staging.active_corpus_release_pointers
   WHERE environment = 'staging') AS active_pointer;`;
}

function writerCall(fixture, request) {
  return `public.canonical_v2_write(
    'staging',
    ${runtime.sqlText(OPERATION)},
    ${runtime.sqlText(request.idempotencyKey)},
    ${runtime.sqlText(request.inputDigest)},
    ${runtime.sqlJson(fixture.writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${runtime.sqlJson(request.receipt)}
  )`;
}

function conflictRequest(fixture, key) {
  return requestFor({ fixture, idempotencyKey: key });
}

function proveStagingWriter(fixtures, before) {
  const [first, second] = fixtures;
  const firstConflict = conflictRequest(second, idempotencyKey(first.profile));
  const secondConflict = conflictRequest(first, idempotencyKey(second.profile));
  const proofRows = runtime.runSql(`
DO $agreement_product_writer_p8$
DECLARE
  candidate_count_before integer;
  receipt_count_before integer;
  candidate_count_after integer;
  receipt_count_after integer;
  pointer_before jsonb;
  pointer_after jsonb;
  first_result jsonb;
  first_replay jsonb;
  second_result jsonb;
  second_replay jsonb;
BEGIN
  SELECT count(*)::integer INTO candidate_count_before
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_before
  FROM canonical_v2_staging.write_receipts
  WHERE operation = ${runtime.sqlText(OPERATION)};
  SELECT canonical_payload INTO pointer_before
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';

  first_result := ${writerCall(first, first.request)};
  first_replay := ${writerCall(first, first.request)};
  BEGIN
    PERFORM ${writerCall(second, firstConflict)};
    RAISE EXCEPTION 'first conflicting Agreement Product replay was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      IF position(
        'idempotency key already names different canonical input' in SQLERRM
      ) = 0 THEN RAISE; END IF;
  END;

  second_result := ${writerCall(second, second.request)};
  second_replay := ${writerCall(second, second.request)};
  BEGIN
    PERFORM ${writerCall(first, secondConflict)};
    RAISE EXCEPTION 'second conflicting Agreement Product replay was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      IF position(
        'idempotency key already names different canonical input' in SQLERRM
      ) = 0 THEN RAISE; END IF;
  END;

  SELECT count(*)::integer INTO candidate_count_after
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_after
  FROM canonical_v2_staging.write_receipts
  WHERE operation = ${runtime.sqlText(OPERATION)};
  SELECT canonical_payload INTO pointer_after
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';
  IF first_result->>'replayed' IS DISTINCT FROM 'false'
    OR first_replay->>'replayed' IS DISTINCT FROM 'true'
    OR second_result->>'replayed' IS DISTINCT FROM 'false'
    OR second_replay->>'replayed' IS DISTINCT FROM 'true'
    OR candidate_count_after <> candidate_count_before + 2
    OR receipt_count_after <> receipt_count_before + 2
    OR pointer_after IS DISTINCT FROM pointer_before
  THEN
    RAISE EXCEPTION 'Agreement Product writer staging proof failed closed';
  END IF;
END
$agreement_product_writer_p8$;
${stateSql()}`);
  const duringRollback = proofRows[0];
  if (
    !duringRollback
    || duringRollback.candidate_result_count !== before.candidate_result_count + 2
    || duringRollback.candidate_write_receipt_count
      !== before.candidate_write_receipt_count + 2
    || JSON.stringify(duringRollback.active_pointer) !== JSON.stringify(before.active_pointer)
  ) {
    throw new Error('Agreement Product writer rollback proof did not observe two temporary inserts.');
  }
}

async function main() {
  runtime.guardProject();
  if (runtime.project.ref !== STAGING_PROJECT_REF) {
    throw new Error('Agreement Product writer is not linked to the approved staging project.');
  }
  const fixtures = PROFILES.map(buildFixture);
  await proveLocalWriter(fixtures);
  const before = runtime.runSql(stateSql(), { readOnly: true })[0];
  if (!before) throw new Error('Agreement Product writer could not read staging state.');
  proveStagingWriter(fixtures, before);
  const after = runtime.runSql(stateSql(), { readOnly: true })[0];
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error('Forced rollback changed durable Agreement Product writer state.');
  }
  process.stdout.write(`${JSON.stringify({
    schema_version: 'AGREEMENT_PRODUCT_WRITER_STAGING_PROOF_P8/V1',
    project_ref: runtime.project.ref,
    execution_environment: 'staging',
    profiles: fixtures.map((fixture) => ({
      family_profile_id: fixture.profile,
      agreement_candidate_envelope_id:
        fixture.materialisation.agreement_candidate_envelope_id,
      candidate_product_result_id:
        fixture.validation.candidateRecord.candidate_product_result_id,
      writer_receipt_id: fixture.request.receipt.receiptId,
      local_dry_run: true,
      local_commit: true,
      local_exact_replay_no_op: true,
      local_conflicting_replay_rejected: true,
      staging_insert_count: 1,
      staging_exact_replay_no_op: true,
      staging_conflicting_replay_rejected: true,
    })),
    forced_rollback: true,
    candidate_rows_unchanged: true,
    receipt_rows_unchanged: true,
    active_pointer_unchanged: true,
    production_accessed: false,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
