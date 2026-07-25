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
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
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
  buildProvisionComponent,
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-structure-identity-',
  operationLabel: 'Canonical writer structure identity acceptance',
  bounds: {
    statementTimeoutMs: 60_000,
    processTimeoutMs: 90_000,
    maxSqlBytes: 4 * 1024 * 1024,
    maxResponseBytes: 4 * 1024 * 1024,
    maxProcessBufferBytes: 6 * 1024 * 1024,
  },
});

const SOURCE = Object.freeze({
  retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const DEAL_KEY = 'deal:qxo-topbuild';
const COLLECTIONS = Object.freeze([
  'excerpts',
  'validated_semantic_graphs',
  'provisions',
  'components',
  'claims',
  'relationships',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
  'incomplete_canonical_result_rows',
]);

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

function requestFor({ idempotencyKey, writeSet }) {
  const operation = 'DEAL_SCOPE_RUN';
  const residuals = [];
  const quarantines = [];
  const inputDigest = buildCanonicalWriteInputDigest({
    operation,
    idempotencyKey,
    writeSet,
    residuals,
    quarantines,
  });
  const publishableObjectCount = COLLECTIONS.reduce(
    (total, key) => total + writeSet[key].length,
    0,
  );
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

function readCapture() {
  const rows = runtime.runSql(
    `SELECT canonical_payload
     FROM canonical_v2_staging.intake_capture_receipts
     WHERE retrieval_url_sha256=${runtime.sqlText(SOURCE.retrieval_url_sha256)}
       AND response_bytes_sha256=${runtime.sqlText(SOURCE.response_bytes_sha256)}
     LIMIT 2;`,
    { readOnly: true },
  );
  if (rows.length !== 1 || !rows[0]?.canonical_payload) {
    throw new Error('The exact QXO SEC intake capture must exist exactly once.');
  }
  return rows[0].canonical_payload;
}

function buildFixture() {
  const contractBundle = compileFixtureContract();
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      bundle.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const context = buildAdmittedSemanticSourceContext({
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope: bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  const slice = buildQxoReviewedCapitalisationSlice({
    sourceContext: context,
    contractBundle,
  });
  const closureId = contentId('QXO_CAPITALISATION_SEMANTIC_CLOSURE/V1', {
    deal_admission_id: dealAdmissionId,
    source_admission_manifest_id: context.source_admission_manifest_id,
    reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
  });
  const close = (rows) => rows.map((row) => ({ ...row, closure_id: closureId }));
  const writeSet = {
    source_references: [buildAdmittedSourceReference(context)],
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: dealAdmissionId,
      document_hash: context.document_hash,
    },
    excerpts: close(Object.values(slice.excerpts)),
    validated_semantic_graphs: [],
    provisions: close(slice.provisions),
    components: close(slice.components),
    claims: close(slice.claims),
    relationships: close(slice.relationships),
    open_world_candidates: [],
    open_world_candidate_occurrences: [],
    open_world_evidence_references: [],
    open_world_candidate_dispositions: [],
    open_world_primitives: [],
    semantic_impact_closures: [],
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: [],
  };
  const parent = writeSet.provisions.find((row) => row.concept_key === 'REP-T-CAP');
  const siblings = writeSet.components.filter(
    (row) => row.parent_provision_instance_id === parent.provision_instance_id
      && row.component_key === 'REPRESENTATION_LIMB',
  );
  return {
    contractBundle,
    context,
    writeSet,
    parent,
    siblings,
  };
}

function structuralSnapshot(fixture) {
  const provisionIds = fixture.writeSet.provisions.map(
    (row) => runtime.sqlText(row.provision_instance_id),
  ).join(',');
  const componentIds = fixture.writeSet.components.map(
    (row) => runtime.sqlText(row.provision_component_id),
  ).join(',');
  return runtime.runSql(
    `SELECT 'provision' AS kind, provision_instance_id AS object_id,
       canonical_payload_digest
     FROM canonical_v2_staging.provision_instances
     WHERE provision_instance_id IN (${provisionIds})
     UNION ALL
     SELECT 'component', provision_component_id, canonical_payload_digest
     FROM canonical_v2_staging.provision_components
     WHERE provision_component_id IN (${componentIds})
     ORDER BY kind, object_id;`,
    { readOnly: true },
  );
}

function auditExistingRows(fixture) {
  const provisionIds = fixture.writeSet.provisions.map(
    (row) => runtime.sqlText(row.provision_instance_id),
  ).join(',');
  const componentIds = fixture.writeSet.components.map(
    (row) => runtime.sqlText(row.provision_component_id),
  ).join(',');
  const [audit] = runtime.runSql(
    `WITH provision_rows AS (
       SELECT
         stored.provision_instance_id,
         stored.canonical_payload AS payload,
         CASE
           WHEN stored.canonical_payload->>'absolute_start'
             ~ '^(0|[1-9][0-9]{0,15})$'
           THEN (stored.canonical_payload->>'absolute_start')::bigint
         END AS absolute_start,
         CASE
           WHEN stored.canonical_payload->>'absolute_end'
             ~ '^(0|[1-9][0-9]{0,15})$'
           THEN (stored.canonical_payload->>'absolute_end')::bigint
         END AS absolute_end
       FROM canonical_v2_staging.provision_instances stored
       WHERE stored.provision_instance_id IN (${provisionIds})
     ),
     component_rows AS (
       SELECT
         stored.provision_component_id,
         stored.canonical_payload AS payload,
         CASE
           WHEN stored.canonical_payload->>'absolute_start'
             ~ '^(0|[1-9][0-9]{0,15})$'
           THEN (stored.canonical_payload->>'absolute_start')::bigint
         END AS absolute_start,
         CASE
           WHEN stored.canonical_payload->>'absolute_end'
             ~ '^(0|[1-9][0-9]{0,15})$'
           THEN (stored.canonical_payload->>'absolute_end')::bigint
         END AS absolute_end
       FROM canonical_v2_staging.provision_components stored
       WHERE stored.provision_component_id IN (${componentIds})
     )
     SELECT
       (SELECT count(*)::integer FROM provision_rows) AS provision_count,
       (SELECT count(*)::integer FROM component_rows) AS component_count,
       (SELECT count(*)::integer
        FROM provision_rows stored
        LEFT JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id=stored.payload->>'canonical_text_id'
        LEFT JOIN canonical_v2_staging.immutable_source_documents immutable
          ON immutable.canonical_payload->>'canonical_text_id'
            = stored.payload->>'canonical_text_id'
        WHERE NOT (stored.payload ?& ARRAY[
            'schema_version', 'source_occurrence_id', 'canonical_text_id',
            'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
            'party', 'ordinal', 'source_anchor_id', 'provision_instance_id',
            'closure_id'
          ])
          OR stored.payload - ARRAY[
            'schema_version', 'source_occurrence_id', 'canonical_text_id',
            'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
            'party', 'ordinal', 'source_anchor_id', 'provision_instance_id',
            'closure_id'
          ]::text[] <> '{}'::jsonb
          OR stored.payload->>'schema_version' IS DISTINCT FROM
            'PROVISION_INSTANCE/V1'
          OR NOT ((stored.payload->'party') ?& ARRAY['role', 'value', 'capacity'])
          OR (stored.payload->'party')
            - ARRAY['role', 'value', 'capacity']::text[] <> '{}'::jsonb
          OR conversion.canonical_text_id IS NULL
          OR immutable.immutable_source_document_id IS NULL
          OR stored.absolute_start IS NULL
          OR stored.absolute_end IS NULL
          OR stored.absolute_start > stored.absolute_end
          OR stored.absolute_end > conversion.canonical_text_byte_length
          OR stored.payload->>'document_hash' IS DISTINCT FROM
            immutable.canonical_payload->>'response_bytes_sha256'
          OR stored.payload->>'source_occurrence_id' IS DISTINCT FROM
            ${runtime.sqlText(fixture.context.source_occurrence_id)}
          OR stored.payload->>'source_anchor_id' IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SEMANTIC_SPAN/V1',
              jsonb_build_object(
                'schema_version', 'SEMANTIC_SPAN/V1',
                'canonical_text_id', stored.payload->'canonical_text_id',
                'absolute_start', stored.payload->'absolute_start',
                'absolute_end', stored.payload->'absolute_end'
              )
            )
          OR stored.provision_instance_id IS DISTINCT FROM
            stored.payload->>'provision_instance_id'
          OR stored.provision_instance_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'PROVISION_INSTANCE/V1',
              jsonb_build_object(
                'schema_version', stored.payload->'schema_version',
                'source_occurrence_id', stored.payload->'source_occurrence_id',
                'canonical_text_id', stored.payload->'canonical_text_id',
                'document_hash', stored.payload->'document_hash',
                'absolute_start', stored.payload->'absolute_start',
                'absolute_end', stored.payload->'absolute_end',
                'concept_key', stored.payload->'concept_key',
                'party', stored.payload->'party',
                'ordinal', stored.payload->'ordinal'
              )
            )) AS provision_mismatch_count,
       (SELECT count(*)::integer
        FROM component_rows stored
        LEFT JOIN canonical_v2_staging.provision_instances parent
          ON parent.provision_instance_id=
            stored.payload->>'parent_provision_instance_id'
        LEFT JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id=stored.payload->>'canonical_text_id'
        WHERE NOT (stored.payload ?& ARRAY[
            'schema_version', 'parent_provision_instance_id', 'canonical_text_id',
            'absolute_start', 'absolute_end', 'component_key', 'ordinal',
            'source_anchor_id', 'provision_component_id', 'closure_id'
          ])
          OR stored.payload - ARRAY[
            'schema_version', 'parent_provision_instance_id', 'canonical_text_id',
            'absolute_start', 'absolute_end', 'component_key', 'ordinal',
            'source_anchor_id', 'provision_component_id', 'closure_id'
          ]::text[] <> '{}'::jsonb
          OR stored.payload->>'schema_version' IS DISTINCT FROM
            'PROVISION_COMPONENT/V1'
          OR parent.provision_instance_id IS NULL
          OR conversion.canonical_text_id IS NULL
          OR stored.absolute_start IS NULL
          OR stored.absolute_end IS NULL
          OR stored.absolute_start > stored.absolute_end
          OR stored.absolute_end > conversion.canonical_text_byte_length
          OR stored.payload->>'canonical_text_id' IS DISTINCT FROM
            parent.canonical_payload->>'canonical_text_id'
          OR stored.absolute_start <
            (parent.canonical_payload->>'absolute_start')::bigint
          OR stored.absolute_end >
            (parent.canonical_payload->>'absolute_end')::bigint
          OR stored.payload->>'source_anchor_id' IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'SEMANTIC_SPAN/V1',
              jsonb_build_object(
                'schema_version', 'SEMANTIC_SPAN/V1',
                'canonical_text_id', stored.payload->'canonical_text_id',
                'absolute_start', stored.payload->'absolute_start',
                'absolute_end', stored.payload->'absolute_end'
              )
            )
          OR stored.provision_component_id IS DISTINCT FROM
            stored.payload->>'provision_component_id'
          OR stored.provision_component_id IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'PROVISION_COMPONENT/V1',
              jsonb_build_object(
                'schema_version', stored.payload->'schema_version',
                'parent_provision_instance_id',
                  stored.payload->'parent_provision_instance_id',
                'canonical_text_id', stored.payload->'canonical_text_id',
                'absolute_start', stored.payload->'absolute_start',
                'absolute_end', stored.payload->'absolute_end',
                'component_key', stored.payload->'component_key',
                'ordinal', stored.payload->'ordinal'
              )
            )) AS component_mismatch_count;`,
    { readOnly: true },
  );
  if (!audit
    || audit.provision_count !== fixture.writeSet.provisions.length
    || audit.component_count !== fixture.writeSet.components.length
    || audit.provision_mismatch_count !== 0
    || audit.component_mismatch_count !== 0) {
    throw new Error('Existing structural rows failed the content-addressed identity audit.');
  }
  return audit;
}

function exactStructuralRowsSql(writeSet) {
  const provisions = writeSet.provisions.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.provision_instances
    WHERE provision_instance_id=${runtime.sqlText(row.provision_instance_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
  const components = writeSet.components.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.provision_components
    WHERE provision_component_id=${runtime.sqlText(row.provision_component_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
  return [...provisions, ...components].join(' AND ') || 'true';
}

function assertValidReplay({ request, exactRowsSql, label, rowAbsentSql = 'true' }) {
  runtime.runSql(
    `DO $valid_structure$
     DECLARE
       first_result jsonb;
       replay_result jsonb;
     BEGIN
       first_result := ${writerCall(request)};
       replay_result := ${writerCall(request)};
       IF first_result->>'replayed' IS DISTINCT FROM 'false'
         OR replay_result->>'replayed' IS DISTINCT FROM 'true'
         OR NOT (${exactRowsSql})
         OR NOT EXISTS (
           SELECT 1 FROM canonical_v2_staging.write_receipts
           WHERE operation='DEAL_SCOPE_RUN'
             AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
             AND input_digest=${runtime.sqlText(request.inputDigest)}
             AND receipt_id=${runtime.sqlText(request.receipt.receiptId)}
         ) THEN
         RAISE EXCEPTION ${runtime.sqlText(`${label} did not write and replay exactly`)};
       END IF;
     END
     $valid_structure$;`,
  );
  const [rolledBack] = runtime.runSql(
    `SELECT
       (${rowAbsentSql}) AS row_rolled_back,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.write_receipts
         WHERE operation='DEAL_SCOPE_RUN'
           AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
       ) AS receipt_rolled_back;`,
    { readOnly: true },
  );
  if (rolledBack?.row_rolled_back !== true
    || rolledBack?.receipt_rolled_back !== true) {
    throw new Error(`${label} rollback left staging residue.`);
  }
}

function assertRejected({
  request,
  expectedMessage,
  mutatedRowExistsSql,
  label,
}) {
  runtime.runSql(
    `DO $forged_structure$
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
       IF (${mutatedRowExistsSql})
         OR EXISTS (
           SELECT 1 FROM canonical_v2_staging.write_receipts
           WHERE operation='DEAL_SCOPE_RUN'
             AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
         ) THEN
         RAISE EXCEPTION ${runtime.sqlText(`${label} persisted state`)};
       END IF;
     END
     $forged_structure$;`,
  );
}

function identifyProvision(row) {
  const body = {
    schema_version: row.schema_version,
    source_occurrence_id: row.source_occurrence_id,
    canonical_text_id: row.canonical_text_id,
    document_hash: row.document_hash,
    absolute_start: row.absolute_start,
    absolute_end: row.absolute_end,
    concept_key: row.concept_key,
    party: row.party,
    ordinal: row.ordinal,
  };
  return {
    ...row,
    source_anchor_id: contentId('SEMANTIC_SPAN/V1', {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: row.canonical_text_id,
      absolute_start: row.absolute_start,
      absolute_end: row.absolute_end,
    }),
    provision_instance_id: contentId('PROVISION_INSTANCE/V1', body),
  };
}

function identifyComponent(row) {
  const body = {
    schema_version: row.schema_version,
    parent_provision_instance_id: row.parent_provision_instance_id,
    canonical_text_id: row.canonical_text_id,
    absolute_start: row.absolute_start,
    absolute_end: row.absolute_end,
    component_key: row.component_key,
    ordinal: row.ordinal,
  };
  return {
    ...row,
    source_anchor_id: contentId('SEMANTIC_SPAN/V1', {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: row.canonical_text_id,
      absolute_start: row.absolute_start,
      absolute_end: row.absolute_end,
    }),
    provision_component_id: contentId('PROVISION_COMPONENT/V1', body),
  };
}

function withProvision(writeSet, provision) {
  const candidate = structuredClone(writeSet);
  const index = candidate.provisions.findIndex(
    (row) => row.provision_instance_id
      === writeSet.provisions[0].provision_instance_id,
  );
  candidate.provisions[index] = provision;
  return candidate;
}

function withComponent(writeSet, originalId, component) {
  const candidate = structuredClone(writeSet);
  const index = candidate.components.findIndex(
    (row) => row.provision_component_id === originalId,
  );
  candidate.components[index] = component;
  return candidate;
}

function mutatedProvisionExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.provision_instances
    WHERE provision_instance_id=${runtime.sqlText(row.provision_instance_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`;
}

function mutatedComponentExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.provision_components
    WHERE provision_component_id=${runtime.sqlText(row.provision_component_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`;
}

function persistedParentReference(parent, validationClosureId) {
  const rows = runtime.runSql(
    `SELECT closure_id, canonical_payload_digest, canonical_payload
     FROM canonical_v2_staging.provision_instances
     WHERE provision_instance_id=${runtime.sqlText(parent.provision_instance_id)}
     LIMIT 2;`,
    { readOnly: true },
  );
  if (rows.length !== 1
    || canonicalJson(rows[0].canonical_payload) !== canonicalJson(parent)) {
    throw new Error('The exact QXO parent provision is not persisted once.');
  }
  return {
    schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
    object_kind: 'provisions',
    object_id: parent.provision_instance_id,
    stored_closure_id: rows[0].closure_id,
    canonical_payload_digest: rows[0].canonical_payload_digest,
    validation_closure_id: validationClosureId,
  };
}

function continuationOffset(text, start, end, label) {
  const bytes = Buffer.from(text, 'utf8');
  for (let offset = start; offset < end; offset += 1) {
    if (bytes[offset] >= 128 && bytes[offset] <= 191) return offset;
  }
  throw new Error(`${label} contains no multibyte continuation byte.`);
}

function assertMalformedPersistedReferenceRejected({
  fixture,
  malformedProvision,
  idempotencyKey,
}) {
  const emptyWriteSet = Object.fromEntries(
    Object.entries(fixture.writeSet).map(([key, value]) => (
      COLLECTIONS.includes(key) ? [key, []] : [key, structuredClone(value)]
    )),
  );
  const expectedMessage =
    'DEAL_SCOPE_RUN provision identity or source lineage is invalid';
  runtime.runSql(
    `DO $persisted_structure$
     DECLARE
       seeded_digest text;
       write_set jsonb := ${runtime.sqlJson(emptyWriteSet)};
       reference jsonb;
       input_digest text;
       receipt_body jsonb;
       receipt jsonb;
       observed_message text;
       observed_sqlstate text;
     BEGIN
       INSERT INTO canonical_v2_staging.provision_instances(
         provision_instance_id,
         closure_id,
         canonical_payload
       ) VALUES (
         ${runtime.sqlText(malformedProvision.provision_instance_id)},
         ${runtime.sqlText(malformedProvision.closure_id)},
         ${runtime.sqlJson(malformedProvision)}
       );
       SELECT canonical_payload_digest
       INTO seeded_digest
       FROM canonical_v2_staging.provision_instances
       WHERE provision_instance_id=${
  runtime.sqlText(malformedProvision.provision_instance_id)
};
       reference := jsonb_build_object(
         'schema_version', 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
         'object_kind', 'provisions',
         'object_id', ${runtime.sqlText(malformedProvision.provision_instance_id)},
         'stored_closure_id', ${runtime.sqlText(malformedProvision.closure_id)},
         'canonical_payload_digest', seeded_digest,
         'validation_closure_id', ${runtime.sqlText(malformedProvision.closure_id)}
       );
       write_set := write_set || jsonb_build_object(
         'persisted_object_references',
         jsonb_build_array(reference)
       );
       input_digest := canonical_v2_staging.content_id(
         'CANONICAL_WRITE_INPUT/V2',
         jsonb_build_object(
           'operation', 'DEAL_SCOPE_RUN',
           'idempotencyKey', ${runtime.sqlText(idempotencyKey)},
           'writeSet', write_set,
           'residuals', '[]'::jsonb,
           'quarantines', '[]'::jsonb
         )
       );
       receipt_body := jsonb_build_object(
         'operation', 'DEAL_SCOPE_RUN',
         'idempotencyKey', ${runtime.sqlText(idempotencyKey)},
         'inputDigest', input_digest,
         'status', 'COMMITTED',
         'publishableObjectCount', 0,
         'residualCount', 0,
         'quarantinedClosureCount', 0
       );
       receipt := receipt_body || jsonb_build_object(
         'receiptId',
         canonical_v2_staging.content_id(
           'CANONICAL_WRITE_RECEIPT/V1',
           receipt_body
         )
       );
       BEGIN
         PERFORM public.canonical_v2_write(
           'staging',
           'DEAL_SCOPE_RUN',
           ${runtime.sqlText(idempotencyKey)},
           input_digest,
           write_set,
           '[]'::jsonb,
           '[]'::jsonb,
           receipt
         );
         RAISE EXCEPTION 'malformed persisted provision was accepted';
       EXCEPTION
         WHEN SQLSTATE '23514' THEN
           GET STACKED DIAGNOSTICS
             observed_message = MESSAGE_TEXT,
             observed_sqlstate = RETURNED_SQLSTATE;
           IF observed_sqlstate IS DISTINCT FROM '23514'
             OR observed_message IS DISTINCT FROM ${runtime.sqlText(expectedMessage)}
           THEN
             RAISE;
           END IF;
       END;
       IF EXISTS (
         SELECT 1 FROM canonical_v2_staging.write_receipts
         WHERE operation='DEAL_SCOPE_RUN'
           AND idempotency_key=${runtime.sqlText(idempotencyKey)}
       ) THEN
         RAISE EXCEPTION 'malformed persisted provision wrote a receipt';
       END IF;
     END
     $persisted_structure$;`,
  );
  const [rolledBack] = runtime.runSql(
    `SELECT
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.provision_instances
         WHERE provision_instance_id=${
  runtime.sqlText(malformedProvision.provision_instance_id)
}
       ) AS seeded_row_rolled_back,
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.write_receipts
         WHERE operation='DEAL_SCOPE_RUN'
           AND idempotency_key=${runtime.sqlText(idempotencyKey)}
       ) AS receipt_rolled_back;`,
    { readOnly: true },
  );
  if (rolledBack?.seeded_row_rolled_back !== true
    || rolledBack?.receipt_rolled_back !== true) {
    throw new Error('Malformed persisted provision probe left staging residue.');
  }
}

function main() {
  runtime.guardProject();
  const fixture = buildFixture();
  const audit = auditExistingRows(fixture);
  const nonce = randomUUID();
  const before = structuralSnapshot(fixture);
  const validRequest = requestFor({
    idempotencyKey: `structure-identity-valid-${nonce}`,
    writeSet: fixture.writeSet,
  });
  assertValidReplay({
    request: validRequest,
    exactRowsSql: exactStructuralRowsSql(fixture.writeSet),
    label: 'valid structural identity',
  });
  if (canonicalJson(before) !== canonicalJson(structuralSnapshot(fixture))) {
    throw new Error('Valid structural replay changed existing QXO payload digests.');
  }

  const baseProvision = fixture.writeSet.provisions[0];
  const baseComponent = fixture.writeSet.components[0];
  const forgedProvisionId = {
    ...baseProvision,
    provision_instance_id: contentId(
      'CANONICAL_V2_FORGED_PROVISION_ID/V1',
      { nonce },
    ),
  };
  const forgedProvisionAnchor = {
    ...baseProvision,
    source_anchor_id: contentId(
      'CANONICAL_V2_FORGED_PROVISION_ANCHOR/V1',
      { nonce },
    ),
  };
  const wrongSourceProvision = identifyProvision({
    ...baseProvision,
    source_occurrence_id: contentId(
      'CANONICAL_V2_FORGED_SOURCE_OCCURRENCE/V1',
      { nonce },
    ),
  });
  const extraFieldProvision = {
    ...baseProvision,
    unbound_structural_value: true,
  };
  const whitespaceConceptProvision = identifyProvision({
    ...baseProvision,
    concept_key: '\t',
  });
  const provisionContinuation = continuationOffset(
    fixture.context.canonical_text.text,
    baseProvision.absolute_start,
    baseProvision.absolute_end,
    'QXO provision',
  );
  const invalidUtf8Provision = identifyProvision({
    ...baseProvision,
    absolute_start: provisionContinuation,
    absolute_end: provisionContinuation + 1,
  });
  const forgedComponentId = {
    ...baseComponent,
    provision_component_id: contentId(
      'CANONICAL_V2_FORGED_COMPONENT_ID/V1',
      { nonce },
    ),
  };
  const forgedComponentAnchor = {
    ...baseComponent,
    source_anchor_id: contentId(
      'CANONICAL_V2_FORGED_COMPONENT_ANCHOR/V1',
      { nonce },
    ),
  };
  if (fixture.parent.absolute_end >= fixture.context.canonical_text_byte_length) {
    throw new Error('QXO parent span has no admitted trailing byte for containment probe.');
  }
  const outsideParentComponent = identifyComponent({
    ...baseComponent,
    absolute_start: fixture.parent.absolute_end,
    absolute_end: fixture.parent.absolute_end + 1,
  });
  const wrongCanonicalComponent = identifyComponent({
    ...baseComponent,
    canonical_text_id: contentId(
      'CANONICAL_V2_FORGED_CANONICAL_TEXT/V1',
      { nonce },
    ),
  });
  const whitespaceComponent = identifyComponent({
    ...baseComponent,
    component_key: '\u00a0',
  });
  const componentContinuation = continuationOffset(
    fixture.context.canonical_text.text,
    fixture.parent.absolute_start,
    fixture.parent.absolute_end,
    'QXO component parent',
  );
  const invalidUtf8Component = identifyComponent({
    ...baseComponent,
    absolute_start: componentContinuation,
    absolute_end: componentContinuation + 1,
  });

  const provisionMessage =
    'DEAL_SCOPE_RUN provision identity or source lineage is invalid';
  const componentMessage =
    'DEAL_SCOPE_RUN component identity or parent lineage is invalid';
  const probes = [
    {
      label: 'forged provision identity',
      row: forgedProvisionId,
      writeSet: withProvision(fixture.writeSet, forgedProvisionId),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 'forged provision anchor',
      row: forgedProvisionAnchor,
      writeSet: withProvision(fixture.writeSet, forgedProvisionAnchor),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 're-signed wrong source occurrence',
      row: wrongSourceProvision,
      writeSet: withProvision(fixture.writeSet, wrongSourceProvision),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 'unbound provision field',
      row: extraFieldProvision,
      writeSet: withProvision(fixture.writeSet, extraFieldProvision),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 'whitespace-only provision concept',
      row: whitespaceConceptProvision,
      writeSet: withProvision(fixture.writeSet, whitespaceConceptProvision),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 'provision splitting a UTF-8 code point',
      row: invalidUtf8Provision,
      writeSet: withProvision(fixture.writeSet, invalidUtf8Provision),
      expectedMessage: provisionMessage,
      exists: mutatedProvisionExists,
    },
    {
      label: 'forged component identity',
      row: forgedComponentId,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        forgedComponentId,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
    {
      label: 'forged component anchor',
      row: forgedComponentAnchor,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        forgedComponentAnchor,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
    {
      label: 're-signed component outside parent',
      row: outsideParentComponent,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        outsideParentComponent,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
    {
      label: 're-signed component on unadmitted text',
      row: wrongCanonicalComponent,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        wrongCanonicalComponent,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
    {
      label: 'whitespace-only component key',
      row: whitespaceComponent,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        whitespaceComponent,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
    {
      label: 'component splitting a UTF-8 code point',
      row: invalidUtf8Component,
      writeSet: withComponent(
        fixture.writeSet,
        baseComponent.provision_component_id,
        invalidUtf8Component,
      ),
      expectedMessage: componentMessage,
      exists: mutatedComponentExists,
    },
  ];
  for (const [index, probe] of probes.entries()) {
    const request = requestFor({
      idempotencyKey: `structure-identity-forged-${index}-${nonce}`,
      writeSet: probe.writeSet,
    });
    assertRejected({
      request,
      expectedMessage: probe.expectedMessage,
      mutatedRowExistsSql: probe.exists(probe.row),
      label: probe.label,
    });
  }

  const successorClosureId = contentId(
    'CANONICAL_V2_PERSISTED_PARENT_SUCCESSOR_CLOSURE/V1',
    { nonce },
  );
  const zeroLengthContinuationSpan = buildSemanticSpan(
    fixture.context,
    componentContinuation,
    componentContinuation,
  );
  const successorComponent = {
    ...buildProvisionComponent({
      source: fixture.context,
      parentProvision: fixture.parent,
      span: zeroLengthContinuationSpan,
      componentKey: 'REPRESENTATION_LIMB',
      ordinal: fixture.siblings.length + 1,
      contractBundle: fixture.contractBundle,
    }),
    closure_id: successorClosureId,
  };
  const successorWriteSet = Object.fromEntries(
    Object.entries(fixture.writeSet).map(([key, value]) => (
      COLLECTIONS.includes(key) ? [key, []] : [key, structuredClone(value)]
    )),
  );
  successorWriteSet.persisted_object_references = [
    persistedParentReference(fixture.parent, successorClosureId),
  ];
  successorWriteSet.components = [successorComponent];
  const successorRequest = requestFor({
    idempotencyKey: `structure-identity-persisted-parent-${nonce}`,
    writeSet: successorWriteSet,
  });
  assertValidReplay({
    request: successorRequest,
    exactRowsSql: exactStructuralRowsSql(successorWriteSet),
    label: 'persisted parent with zero-length continuation-offset component',
    rowAbsentSql: `NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.provision_components
      WHERE provision_component_id=${
  runtime.sqlText(successorComponent.provision_component_id)
}
    )`,
  });

  const malformedClosureId = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_PROVISION_CLOSURE/V1',
    { nonce },
  );
  const malformedPersistedProvision = {
    ...identifyProvision({
      ...fixture.parent,
      ordinal: fixture.writeSet.provisions.filter(
        (row) => row.concept_key === fixture.parent.concept_key,
      ).length + 1,
      closure_id: malformedClosureId,
    }),
    source_anchor_id: contentId(
      'CANONICAL_V2_MALFORMED_PERSISTED_PROVISION_ANCHOR/V1',
      { nonce },
    ),
  };
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedProvision: malformedPersistedProvision,
    idempotencyKey: `structure-identity-malformed-persisted-${nonce}`,
  });

  process.stdout.write(
    `Canonical structural identity acceptance passed across ${
      audit.provision_count
    } provisions and ${audit.component_count} components.\n`,
  );
}

main();
