#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalV2StagingRuntime } from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  buildSecEdgarIntakeCapture,
} = require('../lib/canonical-v2/sec-edgar-intake-capture');
const {
  buildSourceArtifactChunks,
} = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-object-identity-',
  operationLabel: 'Canonical writer object identity acceptance',
  bounds: {
    statementTimeoutMs: 30_000,
    processTimeoutMs: 45_000,
    maxSqlBytes: 1024 * 1024,
  },
});

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

function assertRejectedBeforePersistence({
  request,
  expectedMessage,
  objectExistsSql,
  label,
}) {
  runtime.runSql(
    `DO $identity_probe$
     DECLARE
       observed_message text;
       observed_sqlstate text;
     BEGIN
       BEGIN
         PERFORM ${writerCall(request)};
         RAISE EXCEPTION ${runtime.sqlText(`${label} was accepted`)};
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
       IF (${objectExistsSql})
         OR EXISTS (
           SELECT 1
           FROM canonical_v2_staging.write_receipts
           WHERE operation=${runtime.sqlText(request.operation)}
             AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
         ) THEN
         RAISE EXCEPTION ${runtime.sqlText(`${label} persisted a row`)};
       END IF;
     END
     $identity_probe$;`,
  );
}

function assertValidReplay({
  request,
  objectExistsSql,
  label,
}) {
  runtime.runSql(
    `DO $valid_replay$
     DECLARE
       first_result jsonb;
       replay_result jsonb;
     BEGIN
       first_result := ${writerCall(request)};
       replay_result := ${writerCall(request)};
       IF first_result->>'replayed' IS DISTINCT FROM 'false'
         OR replay_result->>'replayed' IS DISTINCT FROM 'true'
         OR NOT (${objectExistsSql})
         OR NOT EXISTS (
           SELECT 1
           FROM canonical_v2_staging.write_receipts
           WHERE operation=${runtime.sqlText(request.operation)}
             AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
             AND input_digest=${runtime.sqlText(request.inputDigest)}
             AND receipt_id=${runtime.sqlText(request.receipt.receiptId)}
         ) THEN
         RAISE EXCEPTION ${runtime.sqlText(`${label} did not commit and replay exactly`)};
       END IF;
     END
     $valid_replay$;`,
  );

  const [state] = runtime.runSql(
    `SELECT
       NOT (${objectExistsSql}) AS object_rolled_back,
       NOT EXISTS (
         SELECT 1
         FROM canonical_v2_staging.write_receipts
         WHERE operation=${runtime.sqlText(request.operation)}
           AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
       ) AS receipt_rolled_back;`,
    { readOnly: true },
  );
  if (state?.object_rolled_back !== true || state?.receipt_rolled_back !== true) {
    throw new Error(`${label} rollback did not remove its temporary staging rows.`);
  }
}

function auditExistingRows() {
  const [audit] = runtime.runSql(
    `SELECT
       (SELECT count(*)::integer
        FROM canonical_v2_staging.intake_capture_receipts) AS intake_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_artifact_manifests) AS manifest_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_artifact_chunks) AS chunk_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.intake_capture_receipts AS stored
        WHERE stored.source_response_content_id IS DISTINCT FROM
            stored.canonical_payload->>'source_response_content_id'
          OR stored.intake_capture_receipt_id IS DISTINCT FROM
            stored.canonical_payload->>'intake_capture_receipt_id'
          OR stored.source_response_content_id IS DISTINCT FROM
          canonical_v2_staging.content_id(
            'SEC_HTTP_RESPONSE_CONTENT/V1',
            jsonb_build_object(
              'authority_representation',
                stored.canonical_payload->'authority_representation',
              'response_content_type',
                stored.canonical_payload->'response_content_type',
              'response_bytes_sha256',
                stored.canonical_payload->'response_bytes_sha256',
              'response_byte_length',
                stored.canonical_payload->'response_byte_length'
            )
          )
          OR stored.intake_capture_receipt_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'INTAKE_CAPTURE_RECEIPT/V1',
              stored.canonical_payload - 'intake_capture_receipt_id'
            )) AS intake_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_artifact_manifests AS stored
        WHERE stored.artifact_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'artifact_manifest_id'
          OR stored.artifact_manifest_id IS DISTINCT FROM
          canonical_v2_staging.content_id(
            'SOURCE_ARTIFACT_MANIFEST/V1',
            stored.canonical_payload - 'artifact_manifest_id'
          )) AS manifest_mismatch_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.source_artifact_chunks AS stored
        WHERE stored.artifact_manifest_id IS DISTINCT FROM
            stored.canonical_payload->>'artifact_manifest_id'
          OR stored.chunk_ordinal IS DISTINCT FROM
            (stored.canonical_payload->>'chunk_ordinal')::integer
          OR stored.chunk_id IS DISTINCT FROM stored.canonical_payload->>'chunk_id'
          OR stored.chunk_id IS DISTINCT FROM
          canonical_v2_staging.content_id(
            'SOURCE_ARTIFACT_CHUNK/V1',
            stored.canonical_payload - 'chunk_id'
          )) AS chunk_mismatch_count;`,
    { readOnly: true },
  );
  if (!audit
    || audit.intake_count < 1
    || audit.manifest_count < 1
    || audit.chunk_count < 1
    || audit.intake_mismatch_count !== 0
    || audit.manifest_mismatch_count !== 0
    || audit.chunk_mismatch_count !== 0) {
    throw new Error('Existing source-ingress rows failed the content-addressed identity audit.');
  }
  return audit;
}

function forgedId(label, nonce) {
  return contentId('CANONICAL_V2_STAGING_FORGED_ID_PROBE/V1', {
    label,
    nonce,
  });
}

function main() {
  runtime.guardProject();
  const audit = auditExistingRows();
  const nonce = randomUUID();
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: `https://www.sec.gov/Archives/edgar/data/1/${nonce}.htm`,
    final_url: `https://www.sec.gov/Archives/edgar/data/1/${nonce}.htm`,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: contentId(
      'CANONICAL_V2_STAGING_RETRIEVAL_POLICY_PROBE/V1',
      { nonce },
    ),
    redirect_count: 0,
    response_bytes: Buffer.from(`<html><body>${nonce}</body></html>`, 'utf8'),
  });
  const artifact = buildSourceArtifactChunks({
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    canonical_text: `Object identity acceptance ${nonce}`,
  });
  const chunk = artifact.chunks[0];

  const forgedResponseContentId = forgedId('response-content', nonce);
  const responseBody = {
    ...capture,
    source_response_content_id: forgedResponseContentId,
  };
  delete responseBody.intake_capture_receipt_id;
  const forgedResponseCapture = {
    ...responseBody,
    intake_capture_receipt_id: contentId('INTAKE_CAPTURE_RECEIPT/V1', responseBody),
  };
  const forgedIntakeCapture = {
    ...capture,
    intake_capture_receipt_id: forgedId('intake-receipt', nonce),
  };
  const forgedManifestId = forgedId('artifact-manifest', nonce);
  const forgedManifest = {
    ...artifact.manifest,
    artifact_manifest_id: forgedManifestId,
  };
  const reboundChunkBody = {
    ...chunk,
    artifact_manifest_id: forgedManifestId,
  };
  delete reboundChunkBody.chunk_id;
  const reboundChunk = {
    ...reboundChunkBody,
    chunk_id: contentId('SOURCE_ARTIFACT_CHUNK/V1', reboundChunkBody),
  };
  const forgedChunkId = forgedId('artifact-chunk', nonce);
  const forgedChunk = {
    ...chunk,
    chunk_id: forgedChunkId,
  };

  const validIntakeRequest = requestFor({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `object-identity-valid-intake-${nonce}`,
    writeSet: { intake_capture: capture },
    publishableObjectCount: 1,
  });
  const validArtifactRequest = requestFor({
    operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
    idempotencyKey: `object-identity-valid-artifact-${nonce}`,
    writeSet: {
      source_artifact_manifest: artifact.manifest,
      source_artifact_chunk: chunk,
    },
    publishableObjectCount: 2,
  });

  const intakeExists = `EXISTS (
    SELECT 1
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE intake_capture_receipt_id=${runtime.sqlText(capture.intake_capture_receipt_id)}
  )`;
  const artifactExists = `EXISTS (
    SELECT 1
    FROM canonical_v2_staging.source_artifact_manifests
    WHERE artifact_manifest_id=${runtime.sqlText(artifact.manifest.artifact_manifest_id)}
  ) OR EXISTS (
    SELECT 1
    FROM canonical_v2_staging.source_artifact_chunks
    WHERE chunk_id=${runtime.sqlText(chunk.chunk_id)}
  )`;

  assertValidReplay({
    request: validIntakeRequest,
    objectExistsSql: intakeExists,
    label: 'valid intake identity',
  });
  assertValidReplay({
    request: validArtifactRequest,
    objectExistsSql: artifactExists,
    label: 'valid artifact identity',
  });

  const probes = [
    {
      label: 'forged response content identity',
      request: requestFor({
        operation: 'INTAKE_CAPTURE',
        idempotencyKey: `object-identity-forged-response-${nonce}`,
        writeSet: { intake_capture: forgedResponseCapture },
        publishableObjectCount: 1,
      }),
      expectedMessage:
        'intake capture content-addressed identity does not match its payload',
      objectExistsSql: `EXISTS (
        SELECT 1
        FROM canonical_v2_staging.intake_capture_receipts
        WHERE intake_capture_receipt_id=${
  runtime.sqlText(forgedResponseCapture.intake_capture_receipt_id)
}
           OR source_response_content_id=${runtime.sqlText(forgedResponseContentId)}
      )`,
    },
    {
      label: 'forged intake receipt identity',
      request: requestFor({
        operation: 'INTAKE_CAPTURE',
        idempotencyKey: `object-identity-forged-intake-${nonce}`,
        writeSet: { intake_capture: forgedIntakeCapture },
        publishableObjectCount: 1,
      }),
      expectedMessage:
        'intake capture content-addressed identity does not match its payload',
      objectExistsSql: `EXISTS (
        SELECT 1
        FROM canonical_v2_staging.intake_capture_receipts
        WHERE intake_capture_receipt_id=${
  runtime.sqlText(forgedIntakeCapture.intake_capture_receipt_id)
}
      )`,
    },
    {
      label: 'forged artifact manifest identity',
      request: requestFor({
        operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
        idempotencyKey: `object-identity-forged-manifest-${nonce}`,
        writeSet: {
          source_artifact_manifest: forgedManifest,
          source_artifact_chunk: reboundChunk,
        },
        publishableObjectCount: 2,
      }),
      expectedMessage:
        'source artifact manifest identity does not match its payload',
      objectExistsSql: `EXISTS (
        SELECT 1
        FROM canonical_v2_staging.source_artifact_manifests
        WHERE artifact_manifest_id=${runtime.sqlText(forgedManifestId)}
      ) OR EXISTS (
        SELECT 1
        FROM canonical_v2_staging.source_artifact_chunks
        WHERE chunk_id=${runtime.sqlText(reboundChunk.chunk_id)}
      )`,
    },
    {
      label: 'forged artifact chunk identity',
      request: requestFor({
        operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
        idempotencyKey: `object-identity-forged-chunk-${nonce}`,
        writeSet: {
          source_artifact_manifest: artifact.manifest,
          source_artifact_chunk: forgedChunk,
        },
        publishableObjectCount: 2,
      }),
      expectedMessage:
        'source artifact chunk identity does not match its payload',
      objectExistsSql: `EXISTS (
        SELECT 1
        FROM canonical_v2_staging.source_artifact_chunks
        WHERE chunk_id=${runtime.sqlText(forgedChunkId)}
      )`,
    },
  ];

  for (const probe of probes) assertRejectedBeforePersistence(probe);

  process.stdout.write(
    `Canonical source-ingress object identity acceptance passed across ${
      audit.intake_count
    } intake receipts, ${audit.manifest_count} manifests and ${
      audit.chunk_count
    } chunks.\n`,
  );
}

main();
