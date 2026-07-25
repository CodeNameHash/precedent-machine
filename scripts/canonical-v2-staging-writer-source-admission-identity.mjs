#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalV2StagingRuntime } from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  buildSecEdgarIntakeCapture,
} = require('../lib/canonical-v2/sec-edgar-intake-capture');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const {
  buildSourceArtifactChunks,
} = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-admission-identity-',
  operationLabel: 'Canonical writer source admission identity acceptance',
  bounds: {
    statementTimeoutMs: 60_000,
    processTimeoutMs: 90_000,
    maxSqlBytes: 4 * 1024 * 1024,
    maxResponseBytes: 4 * 1024 * 1024,
    maxProcessBufferBytes: 6 * 1024 * 1024,
  },
});

function identified(domain, idKey, body, forcedId) {
  return {
    ...body,
    [idKey]: forcedId || contentId(domain, body),
  };
}

function receiptFor({
  operation,
  idempotencyKey,
  inputDigest,
  publishableObjectCount,
}) {
  const body = {
    operation,
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  return {
    receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', body),
    ...body,
  };
}

function requestFor({
  operation,
  idempotencyKey,
  writeSet,
  publishableObjectCount,
}) {
  const residuals = [];
  const quarantines = [];
  const inputDigest = buildCanonicalWriteInputDigest({
    operation,
    idempotencyKey,
    writeSet,
    residuals,
    quarantines,
  });
  return {
    operation,
    idempotencyKey,
    inputDigest,
    writeSet,
    residuals,
    quarantines,
    receipt: receiptFor({
      operation,
      idempotencyKey,
      inputDigest,
      publishableObjectCount,
    }),
  };
}

function writerCall(request) {
  return `public.canonical_v2_write(
    'staging',
    ${runtime.sqlText(request.operation)},
    ${runtime.sqlText(request.idempotencyKey)},
    ${runtime.sqlText(request.inputDigest)},
    ${runtime.sqlJson(request.writeSet)},
    ${runtime.sqlJson(request.residuals)},
    ${runtime.sqlJson(request.quarantines)},
    ${runtime.sqlJson(request.receipt)}
  )`;
}

function forgedId(label, nonce) {
  return contentId('CANONICAL_V2_STAGING_FORGED_ADMISSION_ID_PROBE/V1', {
    label,
    nonce,
  });
}

function resignAdmissionClosure({
  capture,
  baseConversion,
  baseVerification,
  baseBundle,
  overrides = {},
}) {
  const conversionBody = { ...baseConversion };
  delete conversionBody.canonical_text_id;
  const conversionIdentityBody = {
    source_response_content_id: conversionBody.source_response_content_id,
    converter_digest: conversionBody.converter_digest,
    converter_config_digest: conversionBody.converter_config_digest,
    canonical_text_sha256: conversionBody.canonical_text_sha256,
    canonical_text_byte_length: conversionBody.canonical_text_byte_length,
    source_map_digest: conversionBody.source_map_digest,
  };
  const conversion = {
    ...conversionBody,
    canonical_text_id: overrides.canonicalTextId
      || contentId('SEC_CANONICAL_TEXT/V2', conversionIdentityBody),
  };

  const verificationBody = {
    ...baseVerification,
    canonical_text_id: conversion.canonical_text_id,
  };
  delete verificationBody.verification_manifest_id;
  const verification = identified(
    'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
    'verification_manifest_id',
    verificationBody,
    overrides.verificationManifestId,
  );

  const immutableBody = {
    ...baseBundle.immutable_source_document,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verification.verification_manifest_id,
  };
  delete immutableBody.immutable_source_document_id;
  const immutable = identified(
    'IMMUTABLE_SOURCE_DOCUMENT/V2',
    'immutable_source_document_id',
    immutableBody,
    overrides.immutableSourceDocumentId,
  );

  const baseAdmission = baseBundle.source_admission_manifest;
  const coverageProofBody = {
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
    admitted_intervals: baseAdmission.admitted_intervals,
    excluded_intervals: baseAdmission.excluded_intervals,
    discrepancy_count: baseAdmission.discrepancy_count,
  };
  const admissionBody = {
    ...baseAdmission,
    immutable_source_document_id: immutable.immutable_source_document_id,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verification.verification_manifest_id,
    coverage_proof_digest: overrides.coverageProofDigest
      || contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', coverageProofBody),
  };
  delete admissionBody.source_admission_manifest_id;
  const admission = identified(
    'SOURCE_ADMISSION_MANIFEST/V2',
    'source_admission_manifest_id',
    admissionBody,
    overrides.sourceAdmissionManifestId,
  );

  const preparationSlotBody = {
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
  };
  const preparationBody = {
    ...baseBundle.source_admission_preparation_receipt,
    preparation_slot_id: overrides.preparationSlotId
      || contentId('SOURCE_ADMISSION_PREPARATION_SLOT/V1', preparationSlotBody),
    immutable_source_document_id: immutable.immutable_source_document_id,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verification.verification_manifest_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
  };
  delete preparationBody.source_admission_preparation_receipt_id;
  const preparation = identified(
    'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1',
    'source_admission_preparation_receipt_id',
    preparationBody,
    overrides.preparationReceiptId,
  );

  const semanticBody = {
    ...baseBundle.semantic_extraction_input_envelope,
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verification.verification_manifest_id,
  };
  delete semanticBody.semantic_extraction_input_envelope_id;
  const semantic = identified(
    'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    'semantic_extraction_input_envelope_id',
    semanticBody,
    overrides.semanticInputId,
  );

  const bundleBody = {
    schema_version: 'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    source_admission_preparation_receipt: preparation,
    semantic_extraction_input_envelope: semantic,
  };
  const bundle = identified(
    'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
    'verified_sec_source_admission_bundle_id',
    bundleBody,
    overrides.bundleId,
  );
  return {
    conversion,
    verification,
    bundle,
  };
}

function fixture(nonce, label, overrides = {}) {
  const url = `https://www.sec.gov/Archives/edgar/data/1/${nonce}-${label}.htm`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: contentId(
      'CANONICAL_V2_STAGING_ADMISSION_RETRIEVAL_POLICY_PROBE/V1',
      { nonce, label },
    ),
    redirect_count: 0,
    response_bytes: Buffer.from(
      `<html><body><p>Source admission identity ${nonce} ${label}.</p></body></html>`,
      'utf8',
    ),
  });
  const baseConversion = convertSecHtmlToCanonicalText(capture);
  const baseVerification = verifySecHtmlCanonicalText({
    capture,
    conversion: baseConversion,
  });
  const baseBundle = buildVerifiedSecSourceAdmission({
    capture,
    conversion: baseConversion,
    verification: baseVerification,
  });
  const chain = resignAdmissionClosure({
    capture,
    baseConversion,
    baseVerification,
    baseBundle,
    overrides,
  });
  const artifact = buildSourceArtifactChunks(chain.conversion);
  const captureReference = {
    schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_response_content_id: capture.source_response_content_id,
  };
  const prefix = `source-admission-identity-${nonce}-${label}`;
  const intakeRequest = requestFor({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `${prefix}-intake`,
    writeSet: { intake_capture: capture },
    publishableObjectCount: 1,
  });
  const artifactRequests = artifact.chunks.map((chunk) => requestFor({
    operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
    idempotencyKey: `${prefix}-artifact-${chunk.chunk_ordinal}`,
    writeSet: {
      source_artifact_manifest: artifact.manifest,
      source_artifact_chunk: chunk,
    },
    publishableObjectCount: 2,
  }));
  const prepareRequest = requestFor({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `${prefix}-prepare`,
    writeSet: {
      capture_reference: captureReference,
      conversion_artifact_manifest: artifact.manifest,
      verification: chain.verification,
      source_admission_bundle: chain.bundle,
    },
    publishableObjectCount: 6,
  });
  return {
    label,
    capture,
    artifact,
    ...chain,
    intakeRequest,
    artifactRequests,
    prepareRequest,
  };
}

function prerequisiteSql(item) {
  return [
    item.intakeRequest,
    ...item.artifactRequests,
  ].map((request) => `PERFORM ${writerCall(request)};`).join('\n');
}

function admissionRowsExistSql(item, exactPayloads = false) {
  const immutable = item.bundle.immutable_source_document;
  const admission = item.bundle.source_admission_manifest;
  const preparation = item.bundle.source_admission_preparation_receipt;
  const semantic = item.bundle.semantic_extraction_input_envelope;
  const payload = (value) => (
    exactPayloads ? ` AND canonical_payload=${runtime.sqlJson(value)}` : ''
  );
  return `EXISTS (
      SELECT 1 FROM canonical_v2_staging.canonical_text_conversions
      WHERE canonical_text_id=${runtime.sqlText(item.conversion.canonical_text_id)}
        ${payload(item.conversion)}
    )
    OR EXISTS (
      SELECT 1 FROM canonical_v2_staging.canonical_text_verification_manifests
      WHERE verification_manifest_id=${
  runtime.sqlText(item.verification.verification_manifest_id)
}
        ${payload(item.verification)}
    )
    OR EXISTS (
      SELECT 1 FROM canonical_v2_staging.immutable_source_documents
      WHERE immutable_source_document_id=${
  runtime.sqlText(immutable.immutable_source_document_id)
}
        ${payload(immutable)}
    )
    OR EXISTS (
      SELECT 1 FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id=${
  runtime.sqlText(admission.source_admission_manifest_id)
}
        ${payload(admission)}
    )
    OR EXISTS (
      SELECT 1 FROM canonical_v2_staging.source_admission_preparation_receipts
      WHERE source_admission_preparation_receipt_id=${
  runtime.sqlText(preparation.source_admission_preparation_receipt_id)
}
        ${payload(preparation)}
    )
    OR EXISTS (
      SELECT 1 FROM canonical_v2_staging.semantic_extraction_input_envelopes
      WHERE semantic_extraction_input_envelope_id=${
  runtime.sqlText(semantic.semantic_extraction_input_envelope_id)
}
        ${payload(semantic)}
    )`;
}

function exactAdmissionRowsSql(item) {
  const expressions = admissionRowsExistSql(item, true)
    .split('\n    OR ')
    .map((expression) => `(${expression})`);
  return expressions.join('\n      AND ');
}

function validAcceptanceSql(item) {
  return `${prerequisiteSql(item)}
  first_result := ${writerCall(item.prepareRequest)};
  replay_result := ${writerCall(item.prepareRequest)};
  IF first_result->>'replayed' IS DISTINCT FROM 'false'
    OR replay_result->>'replayed' IS DISTINCT FROM 'true'
    OR NOT (${exactAdmissionRowsSql(item)})
    OR NOT EXISTS (
      SELECT 1
      FROM canonical_v2_staging.write_receipts
      WHERE operation='PREPARE_SOURCE_ADMISSION'
        AND idempotency_key=${runtime.sqlText(item.prepareRequest.idempotencyKey)}
        AND input_digest=${runtime.sqlText(item.prepareRequest.inputDigest)}
        AND receipt_id=${runtime.sqlText(item.prepareRequest.receipt.receiptId)}
    ) THEN
    RAISE EXCEPTION 'valid source admission did not commit and replay exactly';
  END IF;`;
}

function forgedAcceptanceSql(item, expectedMessage) {
  return `${prerequisiteSql(item)}
  BEGIN
    PERFORM ${writerCall(item.prepareRequest)};
    RAISE EXCEPTION ${runtime.sqlText(`${item.label} was accepted`)};
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      GET STACKED DIAGNOSTICS
        observed_message = MESSAGE_TEXT,
        observed_sqlstate = RETURNED_SQLSTATE;
      IF observed_sqlstate IS DISTINCT FROM '23514'
        OR observed_message IS DISTINCT FROM ${runtime.sqlText(expectedMessage)} THEN
        RAISE;
      END IF;
  END;
  IF (${admissionRowsExistSql(item)})
    OR EXISTS (
      SELECT 1
      FROM canonical_v2_staging.write_receipts
      WHERE operation='PREPARE_SOURCE_ADMISSION'
        AND idempotency_key=${runtime.sqlText(item.prepareRequest.idempotencyKey)}
    ) THEN
    RAISE EXCEPTION ${runtime.sqlText(`${item.label} persisted an admission row`)};
  END IF;`;
}

function auditExistingRows() {
  const [audit] = runtime.runSql(
    `SELECT
       (SELECT count(*)::integer
        FROM canonical_v2_staging.canonical_text_conversions) AS conversion_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.canonical_text_verification_manifests)
          AS verification_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.immutable_source_documents
        WHERE canonical_payload->>'schema_version'='IMMUTABLE_SOURCE_DOCUMENT/V2')
          AS immutable_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_admission_manifests
        WHERE canonical_payload->>'schema_version'='SOURCE_ADMISSION_MANIFEST/V2')
          AS admission_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_admission_preparation_receipts)
          AS preparation_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.semantic_extraction_input_envelopes)
          AS semantic_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.canonical_text_conversions AS stored
        LEFT JOIN canonical_v2_staging.intake_capture_receipts AS capture
          ON capture.intake_capture_receipt_id=stored.intake_capture_receipt_id
        WHERE capture.intake_capture_receipt_id IS NULL
          OR capture.source_response_content_id IS DISTINCT FROM
            stored.source_response_content_id
          OR stored.canonical_text_id IS DISTINCT FROM
            stored.canonical_payload->>'canonical_text_id'
          OR stored.intake_capture_receipt_id IS DISTINCT FROM
            stored.canonical_payload->>'intake_capture_receipt_id'
          OR stored.source_response_content_id IS DISTINCT FROM
            stored.canonical_payload->>'source_response_content_id'
          OR stored.canonical_text_sha256 IS DISTINCT FROM
            stored.canonical_payload->>'canonical_text_sha256'
          OR stored.canonical_text_byte_length::text IS DISTINCT FROM
            stored.canonical_payload->>'canonical_text_byte_length'
          OR stored.canonical_text_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SEC_CANONICAL_TEXT/V2',
              jsonb_build_object(
                'source_response_content_id',
                  stored.canonical_payload->'source_response_content_id',
                'converter_digest', stored.canonical_payload->'converter_digest',
                'converter_config_digest',
                  stored.canonical_payload->'converter_config_digest',
                'canonical_text_sha256',
                  stored.canonical_payload->'canonical_text_sha256',
                'canonical_text_byte_length',
                  stored.canonical_payload->'canonical_text_byte_length',
                'source_map_digest', stored.canonical_payload->'source_map_digest'
              )
            )) AS conversion_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.canonical_text_verification_manifests AS stored
        WHERE stored.verification_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'verification_manifest_id'
          OR stored.canonical_text_id IS DISTINCT FROM
            stored.canonical_payload->>'canonical_text_id'
          OR stored.intake_capture_receipt_id IS DISTINCT FROM
            stored.canonical_payload->>'intake_capture_receipt_id'
          OR stored.verification_manifest_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
            stored.canonical_payload - 'verification_manifest_id'
            )) AS verification_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.immutable_source_documents AS stored
        LEFT JOIN canonical_v2_staging.intake_capture_receipts AS capture
          ON capture.intake_capture_receipt_id=
            stored.canonical_payload->>'intake_capture_receipt_id'
        LEFT JOIN canonical_v2_staging.canonical_text_conversions AS conversion
          ON conversion.canonical_text_id=
            stored.canonical_payload->>'canonical_text_id'
        LEFT JOIN canonical_v2_staging.canonical_text_verification_manifests AS verification
          ON verification.verification_manifest_id=
            stored.canonical_payload->>'verification_manifest_id'
        WHERE stored.canonical_payload->>'schema_version'='IMMUTABLE_SOURCE_DOCUMENT/V2'
          AND (
            capture.intake_capture_receipt_id IS NULL
            OR conversion.canonical_text_id IS NULL
            OR verification.verification_manifest_id IS NULL
            OR stored.canonical_payload->>'source_response_content_id'
              IS DISTINCT FROM capture.source_response_content_id
            OR stored.canonical_payload->>'source_response_content_id'
              IS DISTINCT FROM conversion.source_response_content_id
            OR stored.canonical_payload->>'canonical_text_sha256'
              IS DISTINCT FROM conversion.canonical_text_sha256
            OR stored.canonical_payload->>'canonical_text_byte_length'
              IS DISTINCT FROM conversion.canonical_text_byte_length::text
            OR verification.canonical_text_id IS DISTINCT FROM
              conversion.canonical_text_id
            OR verification.intake_capture_receipt_id IS DISTINCT FROM
              capture.intake_capture_receipt_id
            OR stored.immutable_source_document_id IS DISTINCT FROM
              stored.canonical_payload->>'immutable_source_document_id'
            OR stored.immutable_source_document_id IS DISTINCT FROM
              canonical_v2_staging.content_id(
                'IMMUTABLE_SOURCE_DOCUMENT/V2',
                stored.canonical_payload - 'immutable_source_document_id'
              )
          )) AS immutable_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_admission_manifests AS stored
        LEFT JOIN canonical_v2_staging.immutable_source_documents AS immutable
          ON immutable.immutable_source_document_id=
            stored.canonical_payload->>'immutable_source_document_id'
        LEFT JOIN canonical_v2_staging.canonical_text_conversions AS conversion
          ON conversion.canonical_text_id=stored.canonical_payload->>'canonical_text_id'
        LEFT JOIN canonical_v2_staging.canonical_text_verification_manifests AS verification
          ON verification.verification_manifest_id=
            stored.canonical_payload->>'verification_manifest_id'
        WHERE stored.canonical_payload->>'schema_version'='SOURCE_ADMISSION_MANIFEST/V2'
          AND (
            immutable.immutable_source_document_id IS NULL
            OR conversion.canonical_text_id IS NULL
            OR verification.verification_manifest_id IS NULL
            OR immutable.canonical_payload->>'canonical_text_id'
              IS DISTINCT FROM conversion.canonical_text_id
            OR immutable.canonical_payload->>'verification_manifest_id'
              IS DISTINCT FROM verification.verification_manifest_id
            OR immutable.canonical_payload->>'source_response_content_id'
              IS DISTINCT FROM conversion.source_response_content_id
            OR stored.canonical_payload->>'source_response_content_id'
              IS DISTINCT FROM
                immutable.canonical_payload->>'source_response_content_id'
            OR stored.canonical_payload->>'source_response_content_id'
              IS DISTINCT FROM conversion.source_response_content_id
            OR verification.canonical_text_id IS DISTINCT FROM
              conversion.canonical_text_id
            OR stored.source_admission_manifest_id IS DISTINCT FROM
              stored.canonical_payload->>'source_admission_manifest_id'
            OR stored.canonical_payload->>'coverage_proof_digest' IS DISTINCT FROM
              canonical_v2_staging.content_id(
                'SOURCE_ADMISSION_COVERAGE_PROOF/V2',
                jsonb_build_object(
                  'canonical_text_id', stored.canonical_payload->'canonical_text_id',
                  'canonical_text_byte_length',
                    conversion.canonical_payload->'canonical_text_byte_length',
                  'source_map_digest', conversion.canonical_payload->'source_map_digest',
                  'admitted_intervals', stored.canonical_payload->'admitted_intervals',
                  'excluded_intervals', stored.canonical_payload->'excluded_intervals',
                  'discrepancy_count', stored.canonical_payload->'discrepancy_count'
                )
              )
            OR stored.source_admission_manifest_id IS DISTINCT FROM
              canonical_v2_staging.content_id(
                'SOURCE_ADMISSION_MANIFEST/V2',
                stored.canonical_payload - 'source_admission_manifest_id'
              )
          )
        ) AS admission_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_admission_preparation_receipts AS stored
        LEFT JOIN canonical_v2_staging.immutable_source_documents AS immutable
          ON immutable.immutable_source_document_id=
            stored.canonical_payload->>'immutable_source_document_id'
        LEFT JOIN canonical_v2_staging.source_admission_manifests AS admission
          ON admission.source_admission_manifest_id=
            stored.canonical_payload->>'source_admission_manifest_id'
        LEFT JOIN canonical_v2_staging.canonical_text_verification_manifests AS verification
          ON verification.verification_manifest_id=
            stored.canonical_payload->>'verification_manifest_id'
        WHERE immutable.immutable_source_document_id IS NULL
          OR admission.source_admission_manifest_id IS NULL
          OR verification.verification_manifest_id IS NULL
          OR stored.immutable_source_document_id IS DISTINCT FROM
            stored.canonical_payload->>'immutable_source_document_id'
          OR stored.source_admission_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'source_admission_manifest_id'
          OR stored.verification_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'verification_manifest_id'
          OR stored.canonical_payload->>'canonical_text_id'
            IS DISTINCT FROM immutable.canonical_payload->>'canonical_text_id'
          OR stored.canonical_payload->>'canonical_text_id'
            IS DISTINCT FROM admission.canonical_payload->>'canonical_text_id'
          OR stored.canonical_payload->>'canonical_text_id'
            IS DISTINCT FROM verification.canonical_text_id
          OR stored.source_admission_preparation_receipt_id IS DISTINCT FROM
            stored.canonical_payload->>'source_admission_preparation_receipt_id'
          OR stored.canonical_payload->>'preparation_slot_id' IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SOURCE_ADMISSION_PREPARATION_SLOT/V1',
              jsonb_build_object(
                'intake_capture_receipt_id',
                  immutable.canonical_payload->'intake_capture_receipt_id',
                'source_admission_manifest_id',
                  stored.canonical_payload->'source_admission_manifest_id'
              )
            )
          OR stored.source_admission_preparation_receipt_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1',
              stored.canonical_payload - 'source_admission_preparation_receipt_id'
            )) AS preparation_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.semantic_extraction_input_envelopes AS stored
        LEFT JOIN canonical_v2_staging.immutable_source_documents AS immutable
          ON immutable.immutable_source_document_id=
            stored.canonical_payload->>'immutable_source_document_id'
        LEFT JOIN canonical_v2_staging.source_admission_manifests AS admission
          ON admission.source_admission_manifest_id=
            stored.canonical_payload->>'source_admission_manifest_id'
        LEFT JOIN canonical_v2_staging.canonical_text_verification_manifests AS verification
          ON verification.verification_manifest_id=
            stored.canonical_payload->>'verification_manifest_id'
        LEFT JOIN canonical_v2_staging.canonical_text_conversions AS conversion
          ON conversion.canonical_text_id=
            stored.canonical_payload->>'canonical_text_id'
        WHERE immutable.immutable_source_document_id IS NULL
          OR admission.source_admission_manifest_id IS NULL
          OR verification.verification_manifest_id IS NULL
          OR conversion.canonical_text_id IS NULL
          OR stored.immutable_source_document_id IS DISTINCT FROM
            stored.canonical_payload->>'immutable_source_document_id'
          OR stored.source_admission_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'source_admission_manifest_id'
          OR stored.verification_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'verification_manifest_id'
          OR stored.canonical_text_id IS DISTINCT FROM
            stored.canonical_payload->>'canonical_text_id'
          OR stored.canonical_payload->>'canonical_text_sha256'
            IS DISTINCT FROM conversion.canonical_text_sha256
          OR stored.canonical_payload->>'canonical_text_byte_length'
            IS DISTINCT FROM conversion.canonical_text_byte_length::text
          OR stored.semantic_extraction_input_envelope_id IS DISTINCT FROM
            stored.canonical_payload->>'semantic_extraction_input_envelope_id'
          OR stored.semantic_extraction_input_envelope_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
              stored.canonical_payload - 'semantic_extraction_input_envelope_id'
            )) AS semantic_mismatch_count;`,
    { readOnly: true },
  );
  const countKeys = [
    'conversion_count',
    'verification_count',
    'immutable_count',
    'admission_count',
    'preparation_count',
    'semantic_count',
  ];
  const mismatchKeys = [
    'conversion_mismatch_count',
    'verification_mismatch_count',
    'immutable_mismatch_count',
    'admission_mismatch_count',
    'preparation_mismatch_count',
    'semantic_mismatch_count',
  ];
  if (!audit
    || countKeys.some((key) => audit[key] < 1)
    || mismatchKeys.some((key) => audit[key] !== 0)) {
    throw new Error('Existing source-admission rows failed the identity audit.');
  }
  return audit;
}

function assertNoResidue(nonce, items) {
  const values = (property) => (
    items.map(property).map(runtime.sqlText).join(', ')
  );
  const [state] = runtime.runSql(
    `SELECT
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.intake_capture_receipts
         WHERE intake_capture_receipt_id IN (${
  values((item) => item.capture.intake_capture_receipt_id)
})
       ) AS intake_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.source_artifact_manifests
         WHERE artifact_manifest_id IN (${
  values((item) => item.artifact.manifest.artifact_manifest_id)
})
       ) AS manifests_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.source_artifact_chunks
         WHERE artifact_manifest_id IN (${
  values((item) => item.artifact.manifest.artifact_manifest_id)
})
       ) AS chunks_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.canonical_text_conversions
         WHERE canonical_text_id IN (${values((item) => item.conversion.canonical_text_id)})
       ) AS conversions_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.canonical_text_verification_manifests
         WHERE verification_manifest_id IN (${
  values((item) => item.verification.verification_manifest_id)
})
       ) AS verifications_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.immutable_source_documents
         WHERE immutable_source_document_id IN (${
  values((item) => item.bundle.immutable_source_document.immutable_source_document_id)
})
       ) AS immutable_sources_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.source_admission_manifests
         WHERE source_admission_manifest_id IN (${
  values((item) => item.bundle.source_admission_manifest.source_admission_manifest_id)
})
       ) AS admissions_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.source_admission_preparation_receipts
         WHERE source_admission_preparation_receipt_id IN (${
  values((item) => (
    item.bundle.source_admission_preparation_receipt
      .source_admission_preparation_receipt_id
  ))
})
       ) AS preparations_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.semantic_extraction_input_envelopes
         WHERE semantic_extraction_input_envelope_id IN (${
  values((item) => (
    item.bundle.semantic_extraction_input_envelope
      .semantic_extraction_input_envelope_id
  ))
})
       ) AS semantic_inputs_absent,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.write_receipts
         WHERE idempotency_key LIKE ${
  runtime.sqlText(`source-admission-identity-${nonce}-%`)
}
       ) AS receipts_absent;`,
    { readOnly: true },
  );
  if (!state || Object.values(state).some((value) => value !== true)) {
    throw new Error('Source admission identity acceptance left staging residue.');
  }
}

function main() {
  runtime.guardProject();
  const audit = auditExistingRows();
  const nonce = randomUUID();
  const valid = fixture(nonce, 'valid');
  const validBaseBundle = buildVerifiedSecSourceAdmission({
    capture: valid.capture,
    conversion: valid.conversion,
    verification: valid.verification,
  });
  if (canonicalJson(valid.bundle) !== canonicalJson(validBaseBundle)) {
    throw new Error('Admission closure resigning changed the valid builder output.');
  }

  const probes = [
    {
      label: 'canonical-text',
      override: 'canonicalTextId',
      message: 'canonical text conversion identity does not match its payload',
    },
    {
      label: 'verification',
      override: 'verificationManifestId',
      message: 'canonical text verification identity does not match its payload',
    },
    {
      label: 'immutable-source',
      override: 'immutableSourceDocumentId',
      message: 'immutable source document identity does not match its payload',
    },
    {
      label: 'coverage-proof',
      override: 'coverageProofDigest',
      message: 'source admission coverage proof identity does not match its payload',
    },
    {
      label: 'admission-manifest',
      override: 'sourceAdmissionManifestId',
      message: 'source admission manifest identity does not match its payload',
    },
    {
      label: 'preparation-slot',
      override: 'preparationSlotId',
      message: 'source admission preparation slot identity does not match its payload',
    },
    {
      label: 'preparation-receipt',
      override: 'preparationReceiptId',
      message: 'source admission preparation receipt identity does not match its payload',
    },
    {
      label: 'semantic-input',
      override: 'semanticInputId',
      message: 'semantic extraction input envelope identity does not match its payload',
    },
    {
      label: 'bundle',
      override: 'bundleId',
      message: 'verified source admission bundle identity does not match its payload',
    },
  ].map((probe) => ({
    ...probe,
    item: fixture(nonce, probe.label, {
      [probe.override]: forgedId(probe.label, nonce),
    }),
  }));
  const items = [valid, ...probes.map((probe) => probe.item)];

  runtime.runSql(
    `DO $source_admission_identity$
     DECLARE
       first_result jsonb;
       replay_result jsonb;
       observed_message text;
       observed_sqlstate text;
     BEGIN
       ${validAcceptanceSql(valid)}
       ${probes.map((probe) => (
    forgedAcceptanceSql(probe.item, probe.message)
  )).join('\n')}
     END
     $source_admission_identity$;`,
  );
  assertNoResidue(nonce, items);

  process.stdout.write(
    `Canonical source-admission identity acceptance passed across ${
      audit.conversion_count
    } conversions and ${audit.admission_count} V2 admission manifests.\n`,
  );
}

main();
