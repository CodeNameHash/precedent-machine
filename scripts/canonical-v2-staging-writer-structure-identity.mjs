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
  sha256Hex,
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
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
} = require('../lib/canonical-v2/definition-graph');
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
  buildExcerpt,
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

function spanWithinExcerpt({ context, excerpt, needle, label }) {
  const firstIndex = excerpt.exact_text.indexOf(needle);
  if (firstIndex < 0
    || excerpt.exact_text.indexOf(needle, firstIndex + needle.length) >= 0) {
    throw new Error(`${label} must occur exactly once in its reviewed QXO excerpt.`);
  }
  const absoluteStart = excerpt.absolute_start
    + Buffer.byteLength(excerpt.exact_text.slice(0, firstIndex), 'utf8');
  return buildSemanticSpan(
    context,
    absoluteStart,
    absoluteStart + Buffer.byteLength(needle, 'utf8'),
  );
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
  const rawTerm = 'De Minimis Inaccuracies';
  const definitionBody = 'any inaccuracies that individually or in the aggregate are de minimis relative to the total fully diluted equity capitalization of the Company or Parent, as the case may be';
  const termSpan = spanWithinExcerpt({
    context,
    excerpt: slice.excerpts.de_minimis_definition,
    needle: rawTerm,
    label: 'QXO De Minimis declaration term',
  });
  const bodySpan = spanWithinExcerpt({
    context,
    excerpt: slice.excerpts.de_minimis_definition,
    needle: definitionBody,
    label: 'QXO De Minimis definition body',
  });
  const operativeUseSpan = spanWithinExcerpt({
    context,
    excerpt: slice.excerpts.tier_b,
    needle: rawTerm,
    label: 'QXO De Minimis operative use',
  });
  const definitionCue = buildDefinitionCue({
    source: context,
    termSpan,
    bodySpans: [bodySpan],
    rawTerm,
    syntacticRole: 'NESTED_INLINE',
    ordinal: 0,
  });
  const definitionUses = [
    buildDefinitionUseCue({
      source: context,
      definitionCue,
      useSpan: operativeUseSpan,
      useRole: 'OPERATIVE_REFERENCE',
      ordinal: 0,
    }),
    buildDefinitionUseCue({
      source: context,
      definitionCue,
      useSpan: termSpan,
      useRole: 'DECLARATION_REFERENCE',
      ordinal: 1,
    }),
  ];
  const semanticGraph = {
    ...buildValidatedDefinitionGraph({
      source: context,
      definitionCues: [definitionCue],
      definitionUseCues: definitionUses,
    }),
    closure_id: closureId,
  };
  const close = (rows) => rows.map((row) => ({ ...row, closure_id: closureId }));
  const writeSet = {
    source_references: [buildAdmittedSourceReference(context)],
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: dealAdmissionId,
      document_hash: context.document_hash,
    },
    excerpts: close(Object.values(slice.excerpts)),
    validated_semantic_graphs: [semanticGraph],
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
    semanticGraph,
  };
}

function structuralSnapshot(fixture) {
  const excerptIds = fixture.writeSet.excerpts.map(
    (row) => runtime.sqlText(row.excerpt_id),
  ).join(',');
  const provisionIds = fixture.writeSet.provisions.map(
    (row) => runtime.sqlText(row.provision_instance_id),
  ).join(',');
  const componentIds = fixture.writeSet.components.map(
    (row) => runtime.sqlText(row.provision_component_id),
  ).join(',');
  const claimIds = fixture.writeSet.claims.map(
    (row) => runtime.sqlText(row.claim_revision_id),
  ).join(',');
  const relationshipIds = fixture.writeSet.relationships.map(
    (row) => runtime.sqlText(row.relationship_revision_id),
  ).join(',');
  return runtime.runSql(
    `SELECT 'excerpt' AS kind, excerpt_id AS object_id,
       canonical_payload_digest
     FROM canonical_v2_staging.excerpts
     WHERE excerpt_id IN (${excerptIds})
     UNION ALL
     SELECT 'provision', provision_instance_id,
       canonical_payload_digest
     FROM canonical_v2_staging.provision_instances
     WHERE provision_instance_id IN (${provisionIds})
     UNION ALL
     SELECT 'component', provision_component_id, canonical_payload_digest
     FROM canonical_v2_staging.provision_components
     WHERE provision_component_id IN (${componentIds})
     UNION ALL
     SELECT 'claim', claim_revision_id, canonical_payload_digest
     FROM canonical_v2_staging.claim_revisions
     WHERE claim_revision_id IN (${claimIds})
     UNION ALL
     SELECT 'relationship', relationship_revision_id,
       canonical_payload_digest
     FROM canonical_v2_staging.relationship_revisions
     WHERE relationship_revision_id IN (${relationshipIds})
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
       FROM canonical_v2_staging.claim_revisions
        WHERE claim_revision_id IN (${
  fixture.writeSet.claims.map(
    (row) => runtime.sqlText(row.claim_revision_id),
  ).join(',')
})) AS claim_count,
       (SELECT count(*)::integer
        FROM canonical_v2_staging.relationship_revisions
        WHERE relationship_revision_id IN (${
  fixture.writeSet.relationships.map(
    (row) => runtime.sqlText(row.relationship_revision_id),
  ).join(',')
})) AS relationship_count,
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
    || audit.claim_count !== fixture.writeSet.claims.length
    || audit.relationship_count !== fixture.writeSet.relationships.length
    || audit.provision_mismatch_count !== 0
    || audit.component_mismatch_count !== 0) {
    throw new Error('Existing structural rows failed the content-addressed identity audit.');
  }
  return audit;
}

function exactStructuralRowsSql(writeSet) {
  const excerpts = writeSet.excerpts.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.excerpts
    WHERE excerpt_id=${runtime.sqlText(row.excerpt_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
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
  const claims = writeSet.claims.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.claim_revisions
    WHERE claim_revision_id=${runtime.sqlText(row.claim_revision_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
  const relationships = writeSet.relationships.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.relationship_revisions
    WHERE relationship_revision_id=${
  runtime.sqlText(row.relationship_revision_id)
}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
  const semanticGraphs = writeSet.validated_semantic_graphs.map((row) => `EXISTS (
    SELECT 1 FROM canonical_v2_staging.validated_semantic_graphs
    WHERE validated_semantic_graph_id=${
  runtime.sqlText(row.validated_semantic_graph_id)
}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`);
  return [
    ...excerpts,
    ...semanticGraphs,
    ...provisions,
    ...components,
    ...claims,
    ...relationships,
  ].join(' AND ') || 'true';
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

function identifyExcerpt(row) {
  return {
    ...row,
    excerpt_id: contentId('EXCERPT/V1', {
      excerpt_definition_key: row.excerpt_definition_key,
      excerpt_definition_version: row.excerpt_definition_version,
      excerpt_definition_payload_digest: row.excerpt_definition_payload_digest,
      ordered_component_assignments: row.ordered_component_assignments,
      excerpt_purpose: row.excerpt_purpose,
      transformation_or_redaction_version:
        row.transformation_or_redaction_version,
      output_text_hash: row.output_text_hash,
    }),
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

function claimRevisionPayload(row) {
  return {
    claim_occurrence_id: row.claim_occurrence_id,
    subject_occurrence_id: row.subject_occurrence_id,
    claim_definition_key: row.claim_definition_key,
    claim_definition_version: row.claim_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_value: row.raw_value,
    canonical_value: row.canonical_value,
    unit: row.unit,
    day_basis: row.day_basis,
    denominator: row.denominator,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    evidence_ids: row.evidence_ids,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    extraction_version: row.extraction_version,
    normalisation_version: row.normalisation_version,
    derivation_version: row.derivation_version,
  };
}

function resignClaimRevision(row) {
  return {
    ...row,
    claim_revision_id: contentId(
      'CLAIM_REVISION/V1',
      claimRevisionPayload(row),
    ),
  };
}

function identifyClaim(row) {
  const claimOccurrenceId = contentId('CLAIM_OCCURRENCE/V1', {
    subject_occurrence_id: row.subject_occurrence_id,
    claim_definition_key: row.claim_definition_key,
    claim_definition_version: row.claim_definition_version,
    ordinal: row.ordinal,
  });
  const evidence = row.evidence.map((edge, ordinal) => ({
    ...edge,
    schema_version: 'CLAIM_EVIDENCE/V1',
    claim_evidence_id: contentId('CLAIM_EVIDENCE/V1', {
      occurrence_id: claimOccurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    }),
    ordinal,
  }));
  return resignClaimRevision({
    ...row,
    claim_occurrence_id: claimOccurrenceId,
    evidence,
    evidence_ids: evidence.map((edge) => edge.claim_evidence_id),
  });
}

function relationshipRevisionPayload(row) {
  return {
    relationship_occurrence_id: row.relationship_occurrence_id,
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_scope: row.raw_scope,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    target_occurrence_ids: row.target_occurrence_ids,
    effect: row.effect,
    evidence_ids: row.evidence_ids,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    resolver_version: row.resolver_version,
  };
}

function resignRelationshipRevision(row) {
  return {
    ...row,
    relationship_revision_id: contentId(
      'RELATIONSHIP_REVISION/V1',
      relationshipRevisionPayload(row),
    ),
  };
}

function identifyRelationship(row) {
  const relationshipOccurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
  });
  const evidence = row.evidence.map((edge, ordinal) => ({
    ...edge,
    schema_version: 'RELATIONSHIP_EVIDENCE/V1',
    relationship_evidence_id: contentId('RELATIONSHIP_EVIDENCE/V1', {
      occurrence_id: relationshipOccurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    }),
    ordinal,
  }));
  return resignRelationshipRevision({
    ...row,
    relationship_occurrence_id: relationshipOccurrenceId,
    evidence,
    evidence_ids: evidence.map((edge) => edge.relationship_evidence_id),
  });
}

function cueIdentityPayload(row) {
  return {
    document_hash: row.document_hash,
    canonical_text_id: row.canonical_text_id,
    source_anchor_id: row.source_anchor_id,
    term_span_id: row.term_span_id,
    body_span_ids: row.body_span_ids,
    raw_term_digest: row.raw_term_digest,
    syntactic_role: row.syntactic_role,
    source_order_ordinal: row.source_order_ordinal,
  };
}

function resignDefinitionCue(row) {
  return {
    ...row,
    definition_cue_id: contentId(
      'DEFINITION_CUE/V1',
      cueIdentityPayload(row),
    ),
  };
}

function useIdentityPayload(row) {
  return {
    document_hash: row.document_hash,
    canonical_text_id: row.canonical_text_id,
    definition_cue_id: row.definition_cue_id,
    use_span_id: row.use_span_id,
    use_role: row.use_role,
    source_order_ordinal: row.source_order_ordinal,
  };
}

function resignDefinitionUse(row) {
  return {
    ...row,
    definition_use_cue_id: contentId(
      'DEFINITION_USE_CUE/V1',
      useIdentityPayload(row),
    ),
  };
}

function resignSemanticGraph(row) {
  return {
    ...row,
    validated_semantic_graph_id: contentId(
      'VALIDATED_SEMANTIC_GRAPH/V1',
      {
        document_hash: row.document_hash,
        canonical_text_id: row.canonical_text_id,
        definition_cue_ids: row.definition_cue_ids,
        definition_use_cue_ids: row.definition_use_cue_ids,
      },
    ),
  };
}

function replaceDefinitionCue(graph, cue) {
  const candidate = structuredClone(graph);
  const priorCueId = candidate.definition_cues[0].definition_cue_id;
  candidate.definition_cues[0] = cue;
  candidate.definition_cue_ids = [cue.definition_cue_id];
  candidate.definition_use_cues = candidate.definition_use_cues.map((use) => (
    resignDefinitionUse({
      ...use,
      definition_cue_id: use.definition_cue_id === priorCueId
        ? cue.definition_cue_id
        : use.definition_cue_id,
    })
  ));
  candidate.definition_use_cue_ids = candidate.definition_use_cues.map(
    (use) => use.definition_use_cue_id,
  );
  return resignSemanticGraph(candidate);
}

function replaceDefinitionUse(graph, index, use) {
  const candidate = structuredClone(graph);
  candidate.definition_use_cues[index] = use;
  candidate.definition_use_cue_ids = candidate.definition_use_cues.map(
    (entry) => entry.definition_use_cue_id,
  );
  return resignSemanticGraph(candidate);
}

function graphOnlyWriteSet(writeSet, graph) {
  const candidate = Object.fromEntries(
    Object.entries(writeSet).map(([key, value]) => (
      COLLECTIONS.includes(key) ? [key, []] : [key, structuredClone(value)]
    )),
  );
  candidate.validated_semantic_graphs = [graph];
  return candidate;
}

function withExcerpt(writeSet, originalId, excerpt) {
  const candidate = structuredClone(writeSet);
  const index = candidate.excerpts.findIndex(
    (row) => row.excerpt_id === originalId,
  );
  candidate.excerpts[index] = excerpt;
  return candidate;
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

function withClaim(writeSet, originalId, claim) {
  const candidate = structuredClone(writeSet);
  const index = candidate.claims.findIndex(
    (row) => row.claim_revision_id === originalId,
  );
  candidate.claims[index] = claim;
  return candidate;
}

function withRelationship(writeSet, originalId, relationship) {
  const candidate = structuredClone(writeSet);
  const index = candidate.relationships.findIndex(
    (row) => row.relationship_revision_id === originalId,
  );
  candidate.relationships[index] = relationship;
  return candidate;
}

function mutatedSemanticGraphExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.validated_semantic_graphs
    WHERE validated_semantic_graph_id=${
  runtime.sqlText(row.validated_semantic_graph_id)
}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`;
}

function mutatedExcerptExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.excerpts
    WHERE excerpt_id=${runtime.sqlText(row.excerpt_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`;
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

function mutatedClaimExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.claim_revisions
    WHERE claim_revision_id=${runtime.sqlText(row.claim_revision_id)}
      AND canonical_payload=${runtime.sqlJson(row)}
  )`;
}

function mutatedRelationshipExists(row) {
  return `EXISTS (
    SELECT 1 FROM canonical_v2_staging.relationship_revisions
    WHERE relationship_revision_id=${
  runtime.sqlText(row.relationship_revision_id)
}
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
  malformedObject,
  objectKind,
  idempotencyKey,
}) {
  const target = {
    validated_semantic_graphs: {
      table: 'validated_semantic_graphs',
      idColumn: 'validated_semantic_graph_id',
      idField: 'validated_semantic_graph_id',
      expectedMessage:
        'DEAL_SCOPE_RUN validated semantic graph identity, child identity or source bytes are invalid',
      label: 'validated semantic graph',
    },
    excerpts: {
      table: 'excerpts',
      idColumn: 'excerpt_id',
      idField: 'excerpt_id',
      expectedMessage:
        'DEAL_SCOPE_RUN excerpt identity or source bytes are invalid',
      label: 'excerpt',
    },
    provisions: {
      table: 'provision_instances',
      idColumn: 'provision_instance_id',
      idField: 'provision_instance_id',
      expectedMessage:
        'DEAL_SCOPE_RUN provision identity or source lineage is invalid',
      label: 'provision',
    },
    claims: {
      table: 'claim_revisions',
      idColumn: 'claim_revision_id',
      idField: 'claim_revision_id',
      expectedMessage:
        'DEAL_SCOPE_RUN claim identity, state or evidence lineage is invalid',
      label: 'claim',
    },
    relationships: {
      table: 'relationship_revisions',
      idColumn: 'relationship_revision_id',
      idField: 'relationship_revision_id',
      expectedMessage:
        'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid',
      label: 'relationship',
    },
  }[objectKind];
  if (!target) throw new Error(`Unsupported malformed persisted kind: ${objectKind}`);
  const objectId = malformedObject[target.idField];
  const emptyWriteSet = Object.fromEntries(
    Object.entries(fixture.writeSet).map(([key, value]) => (
      COLLECTIONS.includes(key) ? [key, []] : [key, structuredClone(value)]
    )),
  );
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
       INSERT INTO canonical_v2_staging.${target.table}(
         ${target.idColumn},
         closure_id,
         canonical_payload
       ) VALUES (
         ${runtime.sqlText(objectId)},
         ${runtime.sqlText(malformedObject.closure_id)},
         ${runtime.sqlJson(malformedObject)}
       );
       SELECT canonical_payload_digest
       INTO seeded_digest
       FROM canonical_v2_staging.${target.table}
       WHERE ${target.idColumn}=${
  runtime.sqlText(objectId)
};
       reference := jsonb_build_object(
         'schema_version', 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
         'object_kind', ${runtime.sqlText(objectKind)},
         'object_id', ${runtime.sqlText(objectId)},
         'stored_closure_id', ${runtime.sqlText(malformedObject.closure_id)},
         'canonical_payload_digest', seeded_digest,
         'validation_closure_id', ${runtime.sqlText(malformedObject.closure_id)}
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
         RAISE EXCEPTION ${
  runtime.sqlText(`malformed persisted ${target.label} was accepted`)
};
       EXCEPTION
         WHEN SQLSTATE '23514' THEN
           GET STACKED DIAGNOSTICS
             observed_message = MESSAGE_TEXT,
             observed_sqlstate = RETURNED_SQLSTATE;
           IF observed_sqlstate IS DISTINCT FROM '23514'
             OR observed_message IS DISTINCT FROM ${
  runtime.sqlText(target.expectedMessage)
}
           THEN
             RAISE;
           END IF;
       END;
       IF EXISTS (
         SELECT 1 FROM canonical_v2_staging.write_receipts
         WHERE operation='DEAL_SCOPE_RUN'
           AND idempotency_key=${runtime.sqlText(idempotencyKey)}
       ) THEN
         RAISE EXCEPTION ${
  runtime.sqlText(`malformed persisted ${target.label} wrote a receipt`)
};
       END IF;
     END
     $persisted_structure$;`,
  );
  const [rolledBack] = runtime.runSql(
    `SELECT
       NOT EXISTS (
         SELECT 1 FROM canonical_v2_staging.${target.table}
         WHERE ${target.idColumn}=${
  runtime.sqlText(objectId)
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
    throw new Error(`Malformed persisted ${target.label} probe left staging residue.`);
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
  const emptyGraph = {
    ...buildValidatedDefinitionGraph({
      source: fixture.context,
      definitionCues: [],
      definitionUseCues: [],
    }),
    closure_id: contentId(
      'CANONICAL_V2_EMPTY_GRAPH_ACCEPTANCE_CLOSURE/V1',
      { nonce },
    ),
  };
  const emptyGraphRequest = requestFor({
    idempotencyKey: `semantic-graph-empty-valid-${nonce}`,
    writeSet: graphOnlyWriteSet(fixture.writeSet, emptyGraph),
  });
  assertValidReplay({
    request: emptyGraphRequest,
    exactRowsSql: exactStructuralRowsSql(
      graphOnlyWriteSet(fixture.writeSet, emptyGraph),
    ),
    label: 'valid empty semantic graph',
    rowAbsentSql: `NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.validated_semantic_graphs
      WHERE validated_semantic_graph_id=${
  runtime.sqlText(emptyGraph.validated_semantic_graph_id)
}
    )`,
  });
  const finalCodePoint = Array.from(
    fixture.context.canonical_text.text,
  ).at(-1);
  const eofSpan = buildSemanticSpan(
    fixture.context,
    fixture.context.canonical_text_byte_length
      - Buffer.byteLength(finalCodePoint, 'utf8'),
    fixture.context.canonical_text_byte_length,
  );
  const eofUse = resignDefinitionUse({
    ...fixture.semanticGraph.definition_use_cues[0],
    use_span_id: eofSpan.semantic_span_id,
    use_span: eofSpan,
  });
  const eofGraph = replaceDefinitionUse(
    fixture.semanticGraph,
    0,
    eofUse,
  );
  const eofGraphRequest = requestFor({
    idempotencyKey: `semantic-graph-eof-valid-${nonce}`,
    writeSet: graphOnlyWriteSet(fixture.writeSet, eofGraph),
  });
  assertValidReplay({
    request: eofGraphRequest,
    exactRowsSql: exactStructuralRowsSql(
      graphOnlyWriteSet(fixture.writeSet, eofGraph),
    ),
    label: 'valid semantic graph use ending at source EOF',
    rowAbsentSql: `NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.validated_semantic_graphs
      WHERE validated_semantic_graph_id=${
  runtime.sqlText(eofGraph.validated_semantic_graph_id)
}
    )`,
  });

  const baseExcerpt = fixture.writeSet.excerpts[0];
  const baseProvision = fixture.writeSet.provisions[0];
  const baseComponent = fixture.writeSet.components[0];
  const baseClaim = fixture.writeSet.claims.find(
    (row) => row.evidence.length >= 2,
  );
  const absentClaim = fixture.writeSet.claims.find(
    (row) => row.state === 'ABSENT',
  );
  const baseRelationship = fixture.writeSet.relationships.find(
    (row) => row.evidence.length >= 2
      && row.target_occurrence_ids.length >= 1,
  );
  const baseGraph = fixture.semanticGraph;
  if (!baseClaim || !absentClaim || !baseRelationship
    || !baseGraph || baseGraph.definition_cues.length !== 1
    || baseGraph.definition_use_cues.length !== 2) {
    throw new Error('QXO fixture lacks the required semantic acceptance probes.');
  }
  const baseCue = baseGraph.definition_cues[0];
  const forgedGraphId = {
    ...baseGraph,
    validated_semantic_graph_id: contentId(
      'CANONICAL_V2_FORGED_SEMANTIC_GRAPH_ID/V1',
      { nonce },
    ),
  };
  const forgedCueFormula = replaceDefinitionCue(baseGraph, {
    ...baseCue,
    definition_cue_id: contentId(
      'CANONICAL_V2_FORGED_DEFINITION_CUE_ID/V1',
      { nonce },
    ),
  });
  const forgedUseFormula = structuredClone(baseGraph);
  forgedUseFormula.definition_use_cues[0].definition_use_cue_id = contentId(
    'CANONICAL_V2_FORGED_DEFINITION_USE_ID/V1',
    { nonce },
  );
  forgedUseFormula.definition_use_cue_ids =
    forgedUseFormula.definition_use_cues.map(
      (use) => use.definition_use_cue_id,
    );
  const resignedForgedUseFormula = resignSemanticGraph(forgedUseFormula);
  const forgedTermSpanId = contentId(
    'CANONICAL_V2_FORGED_DEFINITION_TERM_SPAN/V1',
    { nonce },
  );
  const forgedTermSpanGraph = replaceDefinitionCue(
    baseGraph,
    resignDefinitionCue({
      ...baseCue,
      source_anchor_id: forgedTermSpanId,
      term_span_id: forgedTermSpanId,
      term_span: {
        ...baseCue.term_span,
        semantic_span_id: forgedTermSpanId,
      },
    }),
  );
  const inventedRawTerm = 'Invented De Minimis Standard';
  const inventedRawTermGraph = replaceDefinitionCue(
    baseGraph,
    resignDefinitionCue({
      ...baseCue,
      raw_term: inventedRawTerm,
      raw_term_digest: contentId(
        'RAW_DEFINITION_TERM/V1',
        inventedRawTerm,
      ),
    }),
  );
  const reversedUseOrderGraph = resignSemanticGraph({
    ...structuredClone(baseGraph),
    definition_use_cues: [...baseGraph.definition_use_cues].reverse(),
    definition_use_cue_ids: [...baseGraph.definition_use_cue_ids].reverse(),
  });
  const unknownCueUseGraph = structuredClone(baseGraph);
  unknownCueUseGraph.definition_use_cues[0] = resignDefinitionUse({
    ...unknownCueUseGraph.definition_use_cues[0],
    definition_cue_id: contentId(
      'CANONICAL_V2_UNKNOWN_DEFINITION_CUE/V1',
      { nonce },
    ),
  });
  unknownCueUseGraph.definition_use_cue_ids =
    unknownCueUseGraph.definition_use_cues.map(
      (use) => use.definition_use_cue_id,
    );
  const resignedUnknownCueUseGraph = resignSemanticGraph(
    unknownCueUseGraph,
  );
  const wrongGraphDocumentHash = contentId(
    'CANONICAL_V2_UNADMITTED_GRAPH_DOCUMENT/V1',
    { nonce },
  );
  const wrongDocumentCue = resignDefinitionCue({
    ...baseCue,
    document_hash: wrongGraphDocumentHash,
  });
  const wrongDocumentUses = baseGraph.definition_use_cues.map((use) => (
    resignDefinitionUse({
      ...use,
      document_hash: wrongGraphDocumentHash,
      definition_cue_id: wrongDocumentCue.definition_cue_id,
    })
  ));
  const wrongDocumentGraph = resignSemanticGraph({
    ...structuredClone(baseGraph),
    document_hash: wrongGraphDocumentHash,
    definition_cues: [wrongDocumentCue],
    definition_cue_ids: [wrongDocumentCue.definition_cue_id],
    definition_use_cues: wrongDocumentUses,
    definition_use_cue_ids: wrongDocumentUses.map(
      (use) => use.definition_use_cue_id,
    ),
  });
  const extraCueFieldGraph = replaceDefinitionCue(baseGraph, {
    ...baseCue,
    unbound_definition_value: true,
  });
  const invalidGeometryGraph = replaceDefinitionCue(
    baseGraph,
    resignDefinitionCue({
      ...baseCue,
      body_span_ids: [baseCue.term_span.semantic_span_id],
      body_spans: [baseCue.term_span],
    }),
  );
  const oversizedCueIdGraph = resignSemanticGraph({
    ...structuredClone(baseGraph),
    definition_cue_ids: Array(4097).fill(baseCue.definition_cue_id),
  });
  const scalarBodySpansGraph = replaceDefinitionCue(baseGraph, {
    ...baseCue,
    body_span_ids: [],
    body_spans: 'not-a-body-span-array',
  });
  const scalarCueIdsGraph = {
    ...structuredClone(baseGraph),
    definition_cue_ids: 'not-a-cue-id-array',
  };
  const scalarGraphWriteSet = graphOnlyWriteSet(
    fixture.writeSet,
    baseGraph,
  );
  scalarGraphWriteSet.validated_semantic_graphs = [7];
  const scalarCueGraph = {
    ...structuredClone(baseGraph),
    definition_cues: [7],
  };
  const scalarUseGraph = {
    ...structuredClone(baseGraph),
    definition_use_cues: [7],
  };
  const scalarSpanGraph = structuredClone(baseGraph);
  scalarSpanGraph.definition_use_cues[0].use_span = 7;
  const graphContinuation = continuationOffset(
    fixture.context.canonical_text.text,
    0,
    fixture.context.canonical_text_byte_length,
    'QXO semantic graph source',
  );
  const canonicalBytes = Buffer.from(
    fixture.context.canonical_text.text,
    'utf8',
  );
  const continuationSpan = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: fixture.context.canonical_text_id,
    absolute_start: graphContinuation,
    absolute_end: graphContinuation + 1,
    semantic_span_id: contentId('SEMANTIC_SPAN/V1', {
      schema_version: 'SEMANTIC_SPAN/V1',
      canonical_text_id: fixture.context.canonical_text_id,
      absolute_start: graphContinuation,
      absolute_end: graphContinuation + 1,
    }),
    exact_bytes_digest: sha256Hex(
      canonicalBytes.subarray(graphContinuation, graphContinuation + 1),
    ),
  };
  const continuationUse = resignDefinitionUse({
    ...baseGraph.definition_use_cues[0],
    use_span_id: continuationSpan.semantic_span_id,
    use_span: continuationSpan,
  });
  const splitUtf8Graph = replaceDefinitionUse(
    baseGraph,
    0,
    continuationUse,
  );
  const aggregateOverflowGraphs = Array.from(
    { length: 5 },
    (_, index) => ({
      ...structuredClone(baseGraph),
      validated_semantic_graph_id: contentId(
        'CANONICAL_V2_AGGREGATE_GRAPH_OVERFLOW/V1',
        { nonce, index },
      ),
      definition_cue_ids: [],
      definition_use_cue_ids: [],
      definition_cues: Array(4096).fill({ body_spans: [] }),
      definition_use_cues: [],
      closure_id: contentId(
        'CANONICAL_V2_AGGREGATE_GRAPH_OVERFLOW_CLOSURE/V1',
        { nonce, index },
      ),
    }),
  );
  const aggregateOverflowWriteSet = graphOnlyWriteSet(
    fixture.writeSet,
    aggregateOverflowGraphs[0],
  );
  aggregateOverflowWriteSet.validated_semantic_graphs =
    aggregateOverflowGraphs;
  const aggregateBodyOverflowGraphs = Array.from(
    { length: 5 },
    (_, index) => ({
      ...structuredClone(baseGraph),
      validated_semantic_graph_id: contentId(
        'CANONICAL_V2_AGGREGATE_BODY_OVERFLOW/V1',
        { nonce, index },
      ),
      definition_cue_ids: [],
      definition_use_cue_ids: [],
      definition_cues: [{
        body_spans: Array(4096).fill({}),
      }],
      definition_use_cues: [],
      closure_id: contentId(
        'CANONICAL_V2_AGGREGATE_BODY_OVERFLOW_CLOSURE/V1',
        { nonce, index },
      ),
    }),
  );
  const aggregateBodyOverflowWriteSet = graphOnlyWriteSet(
    fixture.writeSet,
    aggregateBodyOverflowGraphs[0],
  );
  aggregateBodyOverflowWriteSet.validated_semantic_graphs =
    aggregateBodyOverflowGraphs;
  const aggregateTopLevelIdOverflowGraphs = Array.from(
    { length: 5 },
    (_, index) => ({
      ...structuredClone(baseGraph),
      validated_semantic_graph_id: contentId(
        'CANONICAL_V2_AGGREGATE_GRAPH_ID_OVERFLOW/V1',
        { nonce, index },
      ),
      definition_cue_ids: Array(4096).fill(baseCue.definition_cue_id),
      definition_use_cue_ids: [],
      definition_cues: [],
      definition_use_cues: [],
      closure_id: contentId(
        'CANONICAL_V2_AGGREGATE_GRAPH_ID_OVERFLOW_CLOSURE/V1',
        { nonce, index },
      ),
    }),
  );
  const aggregateTopLevelIdOverflowWriteSet = graphOnlyWriteSet(
    fixture.writeSet,
    aggregateTopLevelIdOverflowGraphs[0],
  );
  aggregateTopLevelIdOverflowWriteSet.validated_semantic_graphs =
    aggregateTopLevelIdOverflowGraphs;
  const aggregateBodyIdOverflowGraphs = Array.from(
    { length: 5 },
    (_, index) => ({
      ...structuredClone(baseGraph),
      validated_semantic_graph_id: contentId(
        'CANONICAL_V2_AGGREGATE_BODY_ID_OVERFLOW/V1',
        { nonce, index },
      ),
      definition_cue_ids: [baseCue.definition_cue_id],
      definition_use_cue_ids: [],
      definition_cues: [{
        ...structuredClone(baseCue),
        body_span_ids: Array(4096).fill(
          baseCue.body_spans[0].semantic_span_id,
        ),
      }],
      definition_use_cues: [],
      closure_id: contentId(
        'CANONICAL_V2_AGGREGATE_BODY_ID_OVERFLOW_CLOSURE/V1',
        { nonce, index },
      ),
    }),
  );
  const aggregateBodyIdOverflowWriteSet = graphOnlyWriteSet(
    fixture.writeSet,
    aggregateBodyIdOverflowGraphs[0],
  );
  aggregateBodyIdOverflowWriteSet.validated_semantic_graphs =
    aggregateBodyIdOverflowGraphs;
  const excerptMessage =
    'DEAL_SCOPE_RUN excerpt identity or source bytes are invalid';
  const forgedExcerptId = {
    ...baseExcerpt,
    excerpt_id: contentId(
      'CANONICAL_V2_FORGED_EXCERPT_ID/V1',
      { nonce },
    ),
  };
  const wrongSourceExcerpt = {
    ...baseExcerpt,
    source_occurrence_id: contentId(
      'CANONICAL_V2_FORGED_EXCERPT_SOURCE_OCCURRENCE/V1',
      { nonce },
    ),
  };
  const extraFieldExcerpt = {
    ...baseExcerpt,
    unbound_excerpt_value: true,
  };
  const alteredText = `${baseExcerpt.exact_text} [forged]`;
  const alteredTextHash = sha256Hex(Buffer.from(alteredText, 'utf8'));
  const alteredBytesExcerpt = identifyExcerpt({
    ...baseExcerpt,
    exact_text: alteredText,
    exact_bytes_digest: alteredTextHash,
    output_text_hash: alteredTextHash,
  });
  const excerptContinuation = continuationOffset(
    fixture.context.canonical_text.text,
    0,
    fixture.context.canonical_text_byte_length,
    'QXO canonical text',
  );
  const splitExcerptSpanId = contentId('SEMANTIC_SPAN/V1', {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: baseExcerpt.canonical_text_id,
    absolute_start: excerptContinuation,
    absolute_end: excerptContinuation + 1,
  });
  const emptyHash = sha256Hex(Buffer.alloc(0));
  const invalidUtf8Excerpt = identifyExcerpt({
    ...baseExcerpt,
    absolute_start: excerptContinuation,
    absolute_end: excerptContinuation + 1,
    ordered_component_assignments: [{
      component_slot_key: 'PRIMARY',
      governed_slot_ordinal: 0,
      semantic_span_id: splitExcerptSpanId,
    }],
    exact_text: '',
    exact_bytes_digest: emptyHash,
    output_text_hash: emptyHash,
  });
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
  const forgedClaimRevision = {
    ...baseClaim,
    claim_revision_id: contentId(
      'CANONICAL_V2_FORGED_CLAIM_REVISION/V1',
      { nonce },
    ),
  };
  const wrongSubjectClaim = identifyClaim({
    ...baseClaim,
    subject_occurrence_id: contentId(
      'CANONICAL_V2_UNRESOLVED_CLAIM_SUBJECT/V1',
      { nonce },
    ),
  });
  const forgedClaimEvidence = structuredClone(baseClaim);
  forgedClaimEvidence.evidence[0].claim_evidence_id = contentId(
    'CANONICAL_V2_FORGED_CLAIM_EVIDENCE/V1',
    { nonce },
  );
  forgedClaimEvidence.evidence_ids[0] =
    forgedClaimEvidence.evidence[0].claim_evidence_id;
  const resignedForgedClaimEvidence = resignClaimRevision(
    forgedClaimEvidence,
  );
  const alternativeExcerpt = fixture.writeSet.excerpts.find(
    (row) => row.excerpt_id !== baseClaim.evidence[0].excerpt_id,
  );
  const wrongExcerptClaim = identifyClaim({
    ...baseClaim,
    evidence: baseClaim.evidence.map((edge, index) => (
      index === 0
        ? { ...edge, excerpt_id: alternativeExcerpt.excerpt_id }
        : edge
    )),
  });
  const reversedEvidenceClaim = identifyClaim({
    ...baseClaim,
    evidence: [...baseClaim.evidence].reverse(),
  });
  const extraFieldClaim = {
    ...baseClaim,
    unbound_claim_value: true,
  };
  const unboundEvidenceClaim = identifyClaim({
    ...baseClaim,
    evidence: baseClaim.evidence.map((edge, index) => (
      index === 0 ? { ...edge, unbound_evidence_value: true } : edge
    )),
  });
  const assertedAbsentClaim = resignClaimRevision({
    ...absentClaim,
    raw_value: 'invented absence value',
  });
  const incompleteAbsentScopeClaim = resignClaimRevision({
    ...absentClaim,
    scope: {
      required_interval_ids: absentClaim.scope.required_interval_ids,
      examined_interval_ids: absentClaim.scope.examined_interval_ids,
    },
  });
  const nonArrayEvidenceClaim = {
    ...baseClaim,
    evidence: 'not-an-evidence-array',
  };
  const numericApplicabilityRuleClaim = resignClaimRevision({
    ...absentClaim,
    state: 'NOT_APPLICABLE',
    scope: null,
    applicability: {
      rule: 7,
      source_fact_ids: [contentId(
        'CANONICAL_V2_APPLICABILITY_SOURCE_FACT/V1',
        { nonce },
      )],
    },
  });
  const unresolvedDenominatorClaim = identifyClaim({
    ...baseClaim,
    denominator: {
      value: '1',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [contentId(
        'CANONICAL_V2_UNRESOLVED_DENOMINATOR_SOURCE/V1',
        { nonce },
      )],
    },
  });
  const forgedRelationshipRevision = {
    ...baseRelationship,
    relationship_revision_id: contentId(
      'CANONICAL_V2_FORGED_RELATIONSHIP_REVISION/V1',
      { nonce },
    ),
  };
  const wrongSourceRelationship = identifyRelationship({
    ...baseRelationship,
    source_occurrence_id: contentId(
      'CANONICAL_V2_UNRESOLVED_RELATIONSHIP_SOURCE/V1',
      { nonce },
    ),
  });
  const wrongTargetRelationship = identifyRelationship({
    ...baseRelationship,
    target_occurrence_ids: baseRelationship.target_occurrence_ids.map(
      (targetId, index) => (
        index === 0
          ? contentId(
            'CANONICAL_V2_UNRESOLVED_RELATIONSHIP_TARGET/V1',
            { nonce },
          )
          : targetId
      ),
    ),
  });
  const forgedRelationshipEvidence = structuredClone(baseRelationship);
  forgedRelationshipEvidence.evidence[0].relationship_evidence_id = contentId(
    'CANONICAL_V2_FORGED_RELATIONSHIP_EVIDENCE/V1',
    { nonce },
  );
  forgedRelationshipEvidence.evidence_ids[0] =
    forgedRelationshipEvidence.evidence[0].relationship_evidence_id;
  const resignedForgedRelationshipEvidence = resignRelationshipRevision(
    forgedRelationshipEvidence,
  );
  const alternativeRelationshipExcerpt = fixture.writeSet.excerpts.find(
    (row) => row.excerpt_id !== baseRelationship.evidence[0].excerpt_id,
  );
  const wrongExcerptRelationship = identifyRelationship({
    ...baseRelationship,
    evidence: baseRelationship.evidence.map((edge, index) => (
      index === 0
        ? { ...edge, excerpt_id: alternativeRelationshipExcerpt.excerpt_id }
        : edge
    )),
  });
  const reversedEvidenceRelationship = identifyRelationship({
    ...baseRelationship,
    evidence: [...baseRelationship.evidence].reverse(),
  });
  const extraFieldRelationship = {
    ...baseRelationship,
    unbound_relationship_value: true,
  };
  const unboundRelationshipEvidence = identifyRelationship({
    ...baseRelationship,
    evidence: baseRelationship.evidence.map((edge, index) => (
      index === 0 ? { ...edge, unbound_evidence_value: true } : edge
    )),
  });
  const nonArrayRelationshipEvidence = resignRelationshipRevision({
    ...baseRelationship,
    evidence: 'forged',
    evidence_ids: [],
  });
  const missingEffectRelationship = resignRelationshipRevision({
    ...baseRelationship,
    effect: null,
  });
  const scalarEffectRelationship = resignRelationshipRevision({
    ...baseRelationship,
    effect: 'forged',
  });
  const nonPresentAssertedRelationship = resignRelationshipRevision({
    ...baseRelationship,
    state: 'NOT_EXAMINED',
    not_examined: {
      reason: 'ADVERSARIAL_STATE_PROBE',
      intended_scope: 'QXO capitalisation relationship',
    },
  });

  const provisionMessage =
    'DEAL_SCOPE_RUN provision identity or source lineage is invalid';
  // PLAN.md Step 4A1 split DEAL_SCOPE_RUN's single provision check into two:
  // shape first (two branches, one per schema_version, so a partyless
  // STRUCTURAL_PROVISION_INSTANCE/V1 is no longer rejected as malformed),
  // then identity and lineage once shape passes. The two failures now carry
  // distinct messages, which was half the point -- the old single message
  // blamed lineage for what was actually a shape rejection, and anyone
  // hitting it debugged the wrong thing.
  //
  // Two probes below mutate SHAPE rather than identity and therefore now
  // stop at the first check. This script pins the exact message and
  // re-raises on any mismatch, so leaving them on provisionMessage would
  // have failed the next staging run for a reason that has nothing to do
  // with staging. Found by adversarial review of a8da3989, which caught that
  // the change updated tests/ and the schema digest pin but not this
  // operational consumer.
  const provisionShapeMessage =
    'DEAL_SCOPE_RUN provision shape is invalid';
  const componentMessage =
    'DEAL_SCOPE_RUN component identity or parent lineage is invalid';
  const claimMessage =
    'DEAL_SCOPE_RUN claim identity, state or evidence lineage is invalid';
  const relationshipMessage =
    'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid';
  const graphMessage =
    'DEAL_SCOPE_RUN validated semantic graph identity, child identity or source bytes are invalid';
  const probes = [
    {
      label: 'forged validated semantic graph identity',
      row: forgedGraphId,
      writeSet: graphOnlyWriteSet(fixture.writeSet, forgedGraphId),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed forged definition cue identity',
      row: forgedCueFormula,
      writeSet: graphOnlyWriteSet(fixture.writeSet, forgedCueFormula),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed forged definition use identity',
      row: resignedForgedUseFormula,
      writeSet: graphOnlyWriteSet(
        fixture.writeSet,
        resignedForgedUseFormula,
      ),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed forged embedded semantic span identity',
      row: forgedTermSpanGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, forgedTermSpanGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed definition term not present in source',
      row: inventedRawTermGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, inventedRawTermGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed definition uses outside canonical order',
      row: reversedUseOrderGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, reversedUseOrderGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed definition use linked to an unknown cue',
      row: resignedUnknownCueUseGraph,
      writeSet: graphOnlyWriteSet(
        fixture.writeSet,
        resignedUnknownCueUseGraph,
      ),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'fully re-signed graph on an unadmitted document',
      row: wrongDocumentGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, wrongDocumentGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'unbound definition cue field',
      row: extraCueFieldGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, extraCueFieldGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 're-signed nested definition with invalid geometry',
      row: invalidGeometryGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, invalidGeometryGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph exceeding the governed child bound',
      row: oversizedCueIdGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, oversizedCueIdGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph with a scalar body-span collection',
      row: scalarBodySpansGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, scalarBodySpansGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph with a scalar cue-id collection',
      row: scalarCueIdsGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, scalarCueIdsGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'scalar validated semantic graph node',
      row: baseGraph,
      writeSet: scalarGraphWriteSet,
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph with a scalar definition cue node',
      row: scalarCueGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, scalarCueGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph with a scalar definition use node',
      row: scalarUseGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, scalarUseGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph with a scalar embedded span node',
      row: scalarSpanGraph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, scalarSpanGraph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph span splitting a UTF-8 code point',
      row: splitUtf8Graph,
      writeSet: graphOnlyWriteSet(fixture.writeSet, splitUtf8Graph),
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph request exceeding the aggregate child bound',
      row: aggregateOverflowGraphs[0],
      writeSet: aggregateOverflowWriteSet,
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph request exceeding the aggregate body-span bound',
      row: aggregateBodyOverflowGraphs[0],
      writeSet: aggregateBodyOverflowWriteSet,
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph request exceeding the aggregate top-level identifier bound',
      row: aggregateTopLevelIdOverflowGraphs[0],
      writeSet: aggregateTopLevelIdOverflowWriteSet,
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'semantic graph request exceeding the aggregate body identifier bound',
      row: aggregateBodyIdOverflowGraphs[0],
      writeSet: aggregateBodyIdOverflowWriteSet,
      expectedMessage: graphMessage,
      exists: mutatedSemanticGraphExists,
    },
    {
      label: 'forged excerpt identity',
      row: forgedExcerptId,
      writeSet: withExcerpt(
        fixture.writeSet,
        baseExcerpt.excerpt_id,
        forgedExcerptId,
      ),
      expectedMessage: excerptMessage,
      exists: mutatedExcerptExists,
    },
    {
      label: 'excerpt on the wrong source occurrence',
      row: wrongSourceExcerpt,
      writeSet: withExcerpt(
        fixture.writeSet,
        baseExcerpt.excerpt_id,
        wrongSourceExcerpt,
      ),
      expectedMessage: excerptMessage,
      exists: mutatedExcerptExists,
    },
    {
      label: 'unbound excerpt field',
      row: extraFieldExcerpt,
      writeSet: withExcerpt(
        fixture.writeSet,
        baseExcerpt.excerpt_id,
        extraFieldExcerpt,
      ),
      expectedMessage: excerptMessage,
      exists: mutatedExcerptExists,
    },
    {
      label: 're-signed excerpt bytes not present in source',
      row: alteredBytesExcerpt,
      writeSet: withExcerpt(
        fixture.writeSet,
        baseExcerpt.excerpt_id,
        alteredBytesExcerpt,
      ),
      expectedMessage: excerptMessage,
      exists: mutatedExcerptExists,
    },
    {
      label: 'excerpt splitting a UTF-8 code point',
      row: invalidUtf8Excerpt,
      writeSet: withExcerpt(
        fixture.writeSet,
        baseExcerpt.excerpt_id,
        invalidUtf8Excerpt,
      ),
      expectedMessage: excerptMessage,
      exists: mutatedExcerptExists,
    },
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
      expectedMessage: provisionShapeMessage,
      // shape mutation, not identity: stops at Step 4A1's first check
      exists: mutatedProvisionExists,
    },
    {
      label: 'whitespace-only provision concept',
      row: whitespaceConceptProvision,
      writeSet: withProvision(fixture.writeSet, whitespaceConceptProvision),
      expectedMessage: provisionShapeMessage,
      // shape mutation, not identity: stops at Step 4A1's first check
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
    {
      label: 'forged claim revision identity',
      row: forgedClaimRevision,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        forgedClaimRevision,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 're-signed claim on an unresolved subject',
      row: wrongSubjectClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        wrongSubjectClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 're-signed forged claim evidence identity',
      row: resignedForgedClaimEvidence,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        resignedForgedClaimEvidence,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 're-signed claim evidence against the wrong excerpt',
      row: wrongExcerptClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        wrongExcerptClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 're-signed claim evidence outside canonical source order',
      row: reversedEvidenceClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        reversedEvidenceClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'unbound claim field',
      row: extraFieldClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        extraFieldClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'unbound claim evidence field',
      row: unboundEvidenceClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        unboundEvidenceClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'absent claim asserting a value',
      row: assertedAbsentClaim,
      writeSet: withClaim(
        fixture.writeSet,
        absentClaim.claim_revision_id,
        assertedAbsentClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'absent claim with incomplete scope authority',
      row: incompleteAbsentScopeClaim,
      writeSet: withClaim(
        fixture.writeSet,
        absentClaim.claim_revision_id,
        incompleteAbsentScopeClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'claim with non-array evidence',
      row: nonArrayEvidenceClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        nonArrayEvidenceClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 're-signed applicability with a non-string rule',
      row: numericApplicabilityRuleClaim,
      writeSet: withClaim(
        fixture.writeSet,
        absentClaim.claim_revision_id,
        numericApplicabilityRuleClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'claim with unresolved denominator lineage',
      row: unresolvedDenominatorClaim,
      writeSet: withClaim(
        fixture.writeSet,
        baseClaim.claim_revision_id,
        unresolvedDenominatorClaim,
      ),
      expectedMessage: claimMessage,
      exists: mutatedClaimExists,
    },
    {
      label: 'forged relationship revision identity',
      row: forgedRelationshipRevision,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        forgedRelationshipRevision,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 're-signed relationship on an unresolved source',
      row: wrongSourceRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        wrongSourceRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 're-signed relationship on an unresolved target',
      row: wrongTargetRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        wrongTargetRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 're-signed forged relationship evidence identity',
      row: resignedForgedRelationshipEvidence,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        resignedForgedRelationshipEvidence,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'relationship evidence against the wrong excerpt',
      row: wrongExcerptRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        wrongExcerptRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'relationship evidence outside canonical source order',
      row: reversedEvidenceRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        reversedEvidenceRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'unbound relationship field',
      row: extraFieldRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        extraFieldRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'unbound relationship evidence field',
      row: unboundRelationshipEvidence,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        unboundRelationshipEvidence,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'non-array relationship evidence',
      row: nonArrayRelationshipEvidence,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        nonArrayRelationshipEvidence,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'present relationship without an effect',
      row: missingEffectRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        missingEffectRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'present relationship with an untyped scalar effect',
      row: scalarEffectRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        scalarEffectRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
    },
    {
      label: 'non-present relationship asserting targets and an effect',
      row: nonPresentAssertedRelationship,
      writeSet: withRelationship(
        fixture.writeSet,
        baseRelationship.relationship_revision_id,
        nonPresentAssertedRelationship,
      ),
      expectedMessage: relationshipMessage,
      exists: mutatedRelationshipExists,
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

  const zeroLengthExcerptClosureId = contentId(
    'CANONICAL_V2_ZERO_LENGTH_EXCERPT_CLOSURE/V1',
    { nonce },
  );
  const zeroLengthExcerpt = {
    ...buildExcerpt({
      source: fixture.context,
      span: buildSemanticSpan(
        fixture.context,
        excerptContinuation,
        excerptContinuation,
      ),
    }),
    closure_id: zeroLengthExcerptClosureId,
  };
  const zeroLengthExcerptWriteSet = Object.fromEntries(
    Object.entries(fixture.writeSet).map(([key, value]) => (
      COLLECTIONS.includes(key) ? [key, []] : [key, structuredClone(value)]
    )),
  );
  zeroLengthExcerptWriteSet.excerpts = [zeroLengthExcerpt];
  const zeroLengthExcerptRequest = requestFor({
    idempotencyKey: `excerpt-identity-zero-length-${nonce}`,
    writeSet: zeroLengthExcerptWriteSet,
  });
  assertValidReplay({
    request: zeroLengthExcerptRequest,
    exactRowsSql: exactStructuralRowsSql(zeroLengthExcerptWriteSet),
    label: 'zero-length continuation-offset excerpt',
    rowAbsentSql: `NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.excerpts
      WHERE excerpt_id=${runtime.sqlText(zeroLengthExcerpt.excerpt_id)}
    )`,
  });

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

  const malformedExcerptClosureId = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_EXCERPT_CLOSURE/V1',
    { nonce },
  );
  const malformedPersistedExcerpt = {
    ...zeroLengthExcerpt,
    closure_id: malformedExcerptClosureId,
    exact_bytes_digest: contentId(
      'CANONICAL_V2_MALFORMED_PERSISTED_EXCERPT_BYTES/V1',
      { nonce },
    ),
  };
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: malformedPersistedExcerpt,
    objectKind: 'excerpts',
    idempotencyKey: `excerpt-identity-malformed-persisted-${nonce}`,
  });

  const malformedGraphClosureId = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_GRAPH_CLOSURE/V1',
    { nonce },
  );
  const malformedPersistedGraph = {
    ...inventedRawTermGraph,
    closure_id: malformedGraphClosureId,
  };
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: malformedPersistedGraph,
    objectKind: 'validated_semantic_graphs',
    idempotencyKey: `graph-identity-malformed-persisted-${nonce}`,
  });
  const unsafeOrdinalGraphClosureId = contentId(
    'CANONICAL_V2_UNSAFE_PERSISTED_GRAPH_ORDINAL_CLOSURE/V1',
    { nonce },
  );
  const unsafeOrdinalPersistedGraph = structuredClone(baseGraph);
  unsafeOrdinalPersistedGraph.definition_cues[0].source_order_ordinal = 1.5;
  unsafeOrdinalPersistedGraph.closure_id = unsafeOrdinalGraphClosureId;
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: unsafeOrdinalPersistedGraph,
    objectKind: 'validated_semantic_graphs',
    idempotencyKey: `graph-identity-unsafe-ordinal-persisted-${nonce}`,
  });
  const fractionalBodyIdGraphClosureId = contentId(
    'CANONICAL_V2_FRACTIONAL_PERSISTED_BODY_ID_CLOSURE/V1',
    { nonce },
  );
  const fractionalBodyIdPersistedGraph = structuredClone(baseGraph);
  fractionalBodyIdPersistedGraph.definition_cues[0].body_span_ids = [1.5];
  fractionalBodyIdPersistedGraph.closure_id =
    fractionalBodyIdGraphClosureId;
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: fractionalBodyIdPersistedGraph,
    objectKind: 'validated_semantic_graphs',
    idempotencyKey: `graph-identity-fractional-body-id-persisted-${nonce}`,
  });
  const fractionalGraphIdClosureId = contentId(
    'CANONICAL_V2_FRACTIONAL_PERSISTED_GRAPH_ID_CLOSURE/V1',
    { nonce },
  );
  const fractionalGraphIdPersistedGraph = structuredClone(baseGraph);
  fractionalGraphIdPersistedGraph.definition_use_cue_ids = [1.5];
  fractionalGraphIdPersistedGraph.closure_id = fractionalGraphIdClosureId;
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: fractionalGraphIdPersistedGraph,
    objectKind: 'validated_semantic_graphs',
    idempotencyKey: `graph-identity-fractional-graph-id-persisted-${nonce}`,
  });
  const nonAsciiGraphIdClosureId = contentId(
    'CANONICAL_V2_NON_ASCII_PERSISTED_GRAPH_ID_CLOSURE/V1',
    { nonce },
  );
  const nonAsciiGraphIdPersistedGraph = structuredClone(baseGraph);
  nonAsciiGraphIdPersistedGraph.definition_cue_ids = [{
    'proposition-é': 'source-backed',
  }];
  nonAsciiGraphIdPersistedGraph.closure_id = nonAsciiGraphIdClosureId;
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: nonAsciiGraphIdPersistedGraph,
    objectKind: 'validated_semantic_graphs',
    idempotencyKey: `graph-identity-non-ascii-graph-id-persisted-${nonce}`,
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
    malformedObject: malformedPersistedProvision,
    objectKind: 'provisions',
    idempotencyKey: `structure-identity-malformed-persisted-${nonce}`,
  });

  const malformedClaimClosureId = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_CLAIM_CLOSURE/V1',
    { nonce },
  );
  const malformedPersistedClaim = identifyClaim({
    ...baseClaim,
    ordinal: baseClaim.ordinal + 1000,
    closure_id: malformedClaimClosureId,
  });
  malformedPersistedClaim.evidence[0].claim_evidence_id = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_CLAIM_EVIDENCE/V1',
    { nonce },
  );
  malformedPersistedClaim.evidence_ids[0] =
    malformedPersistedClaim.evidence[0].claim_evidence_id;
  const resignedMalformedPersistedClaim = resignClaimRevision(
    malformedPersistedClaim,
  );
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: resignedMalformedPersistedClaim,
    objectKind: 'claims',
    idempotencyKey: `claim-identity-malformed-persisted-${nonce}`,
  });

  const malformedRelationshipClosureId = contentId(
    'CANONICAL_V2_MALFORMED_PERSISTED_RELATIONSHIP_CLOSURE/V1',
    { nonce },
  );
  const malformedPersistedRelationship = identifyRelationship({
    ...baseRelationship,
    ordinal: baseRelationship.ordinal + 1000,
    closure_id: malformedRelationshipClosureId,
  });
  malformedPersistedRelationship.evidence[0].relationship_evidence_id =
    contentId(
      'CANONICAL_V2_MALFORMED_PERSISTED_RELATIONSHIP_EVIDENCE/V1',
      { nonce },
    );
  malformedPersistedRelationship.evidence_ids[0] =
    malformedPersistedRelationship.evidence[0].relationship_evidence_id;
  const resignedMalformedPersistedRelationship = resignRelationshipRevision(
    malformedPersistedRelationship,
  );
  assertMalformedPersistedReferenceRejected({
    fixture,
    malformedObject: resignedMalformedPersistedRelationship,
    objectKind: 'relationships',
    idempotencyKey: `relationship-identity-malformed-persisted-${nonce}`,
  });

  process.stdout.write(
    `Canonical graph, excerpt and structural identity acceptance passed across ${
      fixture.writeSet.validated_semantic_graphs.length
    } semantic graph, ${
      fixture.writeSet.excerpts.length
    } excerpts, ${
      audit.provision_count
    } provisions, ${audit.component_count} components and ${
      audit.claim_count
    } claims and ${audit.relationship_count} relationships.\n`,
  );
}

main();
