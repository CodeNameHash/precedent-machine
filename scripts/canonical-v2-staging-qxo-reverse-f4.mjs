#!/usr/bin/env node

import https from 'node:https';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { validateSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const {
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const {
  QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_RICH_DEAL_DIMENSIONS,
  QXO_RICH_DEAL_DIMENSIONS_DIGEST,
} = require('../lib/canonical-v2/qxo-reverse-candidate-identity');
const {
  buildQxoReverseF4AuthorityGenesis,
} = require('../lib/canonical-v2/qxo-reverse-f4-authority');
const {
  buildQxoReverseF4Candidate,
} = require('../lib/canonical-v2/qxo-reverse-f4-candidate');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'sql', 'qxo-reverse-f4', 'generated');
const DEAL_KEY = 'deal:qxo-topbuild';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const REVERSE_DEAL_SCOPE_KEY = 'QXO_TWO_SIDED_TERMINATION_FEE_F4_DEAL_SCOPE_V1';
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
const MAX_SEMANTIC_GATE_BYTES = 768 * 1024;
const MAX_IMPORT_PLAN_BYTES = 768 * 1024;
const MAX_IMPORT_STATEMENT_BYTES = 800 * 1024;
const MAX_GENERATED_SQL_FILE_BYTES = 1536 * 1024;
const MAX_PACKET_BYTES = 6 * 1024 * 1024;
const F1_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const F2_FINGERPRINT = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';
const EXPECTED_F1_HEAD = Object.freeze({
  id: '47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf',
  digest: '6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47',
});
const EXPECTED_F2_HEAD = Object.freeze({
  id: '614bb1f8162c5bf2f4c7c857c7701025390fd9cd33a4c4d711dc359a664d427a',
  digest: 'bedabdc3f0a46eb500d3165e0b1be5b26036ac494949d9118b3999696a762868',
});
const EXPECTED_F3_HEAD = Object.freeze({
  id: '9e55ff718243a0bbea32ac33d8888788c121ac94d9b3f89ec6697d9d4953344a',
  digest: '5591958f2112aed92f374cd51073958fe0ec448d0923aab6157a3fc64f8e21d0',
});
const EXPECTED_F2_RELEASE = Object.freeze({
  corpus_release_id: '1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6',
  serving_namespace_id: 'd7f2f04068d9dcac2793def3a7854d953e6419601b274269ac4f4f8b8d8160f2',
  candidate_manifest_id: '9c93546cb60d03977c2d15bda851154a6104cad04a7df2581c4bb3c90ca5a906',
});
const EXPECTED_ACTIVE = Object.freeze({
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V2',
  environment: 'staging',
  pointer_id: 'eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b',
  corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  candidate_release_manifest_id: '4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98',
  correction_input_seal_id: '7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd',
  correction_input_root: 'aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012',
  previous_pointer_id: '15a0e13f45ad596d468b9cfa2878a456ac56c3b84d15a185c0a96dca5ef022a1',
  generation: 8,
  canonical_payload_digest: '08e39195cf12156204fa9d129e438ae5dd89a27b35024f91645c9937b4105c69',
});
const SOURCES = Object.freeze({
  agreement: Object.freeze({
    url: 'https://www.sec.gov/Archives/edgar/data/1633931/000110465926045245/bld-20260418xex2d1.htm',
    retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
    response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
    response_byte_length: 958459,
    source_admission_manifest_id: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS[0],
  }),
  dealValue: Object.freeze({
    url: 'https://www.sec.gov/Archives/edgar/data/1633931/000110465926045245/bld-20260418xex99d1.htm',
    retrieval_url_sha256: '0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442',
    response_bytes_sha256: '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827',
    response_byte_length: 151092,
    source_admission_manifest_id: QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS[1],
  }),
});
const RETRIEVAL_HEADERS = Object.freeze({
  'User-Agent': 'Deal Corpus canonical intake bengoodchild@gmail.com',
  Accept: 'text/html',
  'Accept-Encoding': 'identity',
});

function fail(error) {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
  process.exit(1);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_f4_${sha256(json).slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function fetchExact(url) {
  return new Promise((resolveFetch, reject) => {
    const request = https.get(url, { headers: RETRIEVAL_HEADERS }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolveFetch(Buffer.concat(chunks)));
    });
    request.on('error', reject);
    request.setTimeout(30000, () => request.destroy(new Error('SEC retrieval timed out.')));
  });
}

async function reconstructCapture(pin, pastedPayload) {
  if (!pastedPayload || typeof pastedPayload !== 'object'
    || 'response_bytes_base64' in pastedPayload) {
    throw new TypeError('Block 00 must supply capture metadata without response bytes.');
  }
  const bytes = await fetchExact(pin.url);
  if (bytes.length !== pin.response_byte_length || sha256(bytes) !== pin.response_bytes_sha256) {
    throw new TypeError(`SEC bytes for ${pin.url} do not match their pinned identity.`);
  }
  const capture = { ...pastedPayload, response_bytes_base64: bytes.toString('base64') };
  validateSecEdgarIntakeCapture(capture);
  if (capture.retrieval_url_sha256 !== pin.retrieval_url_sha256
    || capture.response_bytes_sha256 !== pin.response_bytes_sha256
    || capture.response_byte_length !== pin.response_byte_length) {
    throw new TypeError(`Reconstructed capture for ${pin.url} is not the admitted source.`);
  }
  return capture;
}

function admissionChain(capture, pin) {
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  if (bundle.source_admission_manifest.source_admission_manifest_id
      !== pin.source_admission_manifest_id) {
    throw new TypeError(`Re-derived admission for ${pin.url} has drifted.`);
  }
  return {
    capture,
    conversion,
    verification,
    bundle,
    artifact: buildSourceArtifactChunks(conversion),
  };
}

function sourceContext(chain, sourceOrdinal) {
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: chain.bundle.immutable_source_document,
    source_admission_manifest: chain.bundle.source_admission_manifest,
    semantic_extraction_input_envelope: chain.bundle.semantic_extraction_input_envelope,
    conversion: chain.conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
  });
}

async function reverseWriterRequest({ build, chains }) {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({
    repository,
    contractBundle: build.contract_bundle,
  });
  for (const [name, intakeKey, admissionKey] of [
    ['agreement', 'QXO_SEC_EDGAR_ORIGINAL_V1', 'QXO_SEC_SOURCE_ADMISSION_V2'],
    ['dealValue', 'QXO_DEAL_VALUE_SEC_INTAKE_V1', 'QXO_DEAL_VALUE_SEC_SOURCE_ADMISSION_V1'],
  ]) {
    const chain = chains[name];
    await writer.write({
      operation: 'INTAKE_CAPTURE',
      idempotencyKey: intakeKey,
      writeSet: { intake_capture: chain.capture },
    });
    for (const chunk of chain.artifact.chunks) {
      await writer.write({
        operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
        idempotencyKey: `QXO_REVERSE_F4_${name}_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
        writeSet: {
          source_artifact_manifest: chain.artifact.manifest,
          source_artifact_chunk: chunk,
        },
      });
    }
    await writer.write({
      operation: 'PREPARE_SOURCE_ADMISSION',
      idempotencyKey: admissionKey,
      writeSet: {
        capture_reference: {
          schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
          intake_capture_receipt_id: chain.capture.intake_capture_receipt_id,
          source_response_content_id: chain.capture.source_response_content_id,
        },
        conversion_artifact_manifest: chain.artifact.manifest,
        verification: chain.verification,
        source_admission_bundle: chain.bundle,
      },
    });
  }
  const terminationFeeWriteSet = build.serving_slices.termination_fee_semantic_write_set;
  const input = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: REVERSE_DEAL_SCOPE_KEY,
    writeSet: terminationFeeWriteSet,
  };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  const residuals = committed.validation.residuals;
  const quarantines = committed.validation.quarantines;
  const sql = `SELECT public.canonical_v2_write(
  'staging', 'DEAL_SCOPE_RUN', '${REVERSE_DEAL_SCOPE_KEY}', '${dryRun.inputDigest}',
  ${sqlJson(input.writeSet)}, ${sqlJson(residuals)}, ${sqlJson(quarantines)},
  ${sqlJson(committed.receipt)}
) AS result;`;
  if (Buffer.byteLength(sql, 'utf8') > MAX_WRITER_REQUEST_BYTES) {
    throw new TypeError('The reverse-fee semantic write exceeds its bounded transport limit.');
  }
  return Object.freeze({
    sql,
    input_digest: dryRun.inputDigest,
    receipt: committed.receipt,
    write_set: input.writeSet,
    residuals,
    quarantines,
  });
}

function activePointerPredicate() {
  return `environment='staging'
      AND generation=${EXPECTED_ACTIVE.generation}
      AND pointer_id='${EXPECTED_ACTIVE.pointer_id}'
      AND corpus_release_id='${EXPECTED_ACTIVE.corpus_release_id}'
      AND serving_namespace_id='${EXPECTED_ACTIVE.serving_namespace_id}'
      AND candidate_manifest_id='${EXPECTED_ACTIVE.candidate_release_manifest_id}'
      AND correction_input_seal_id='${EXPECTED_ACTIVE.correction_input_seal_id}'
      AND correction_input_root='${EXPECTED_ACTIVE.correction_input_root}'
      AND previous_pointer_id='${EXPECTED_ACTIVE.previous_pointer_id}'
      AND canonical_payload_digest='${EXPECTED_ACTIVE.canonical_payload_digest}'
      AND canonical_payload=${sqlJson(EXPECTED_ACTIVE)}`;
}

function transaction(body, commit) {
  return `BEGIN;
SET LOCAL statement_timeout='120000ms';
${body}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`;
}

function recheckSql(head) {
  return `SELECT public.canonical_v2_recheck_candidate_input_head(
  'staging',
  '${head.contract_fingerprint}',
  '${head.candidate_input_head_id}',
  '${head.canonical_payload_digest}'
) AS recheck;`;
}

function semanticWriteGateSql(writerRequest, { allowAbsent = false } = {}) {
  const rowsByTable = {
    validated_semantic_graphs: {
      rows: writerRequest.write_set.validated_semantic_graphs,
      identity: 'validated_semantic_graph_id',
    },
    excerpts: { rows: writerRequest.write_set.excerpts, identity: 'excerpt_id' },
    provision_instances: { rows: writerRequest.write_set.provisions, identity: 'provision_instance_id' },
    provision_components: { rows: writerRequest.write_set.components, identity: 'provision_component_id' },
    claim_revisions: { rows: writerRequest.write_set.claims, identity: 'claim_revision_id' },
    relationship_revisions: {
      rows: writerRequest.write_set.relationships,
      identity: 'relationship_revision_id',
    },
    open_world_candidates: {
      rows: writerRequest.write_set.open_world_candidates,
      identity: 'candidate_id',
    },
    open_world_candidate_occurrences: {
      rows: writerRequest.write_set.open_world_candidate_occurrences,
      identity: 'open_world_candidate_occurrence_id',
    },
    open_world_evidence_references: {
      rows: writerRequest.write_set.open_world_evidence_references,
      identity: 'evidence_reference_id',
    },
    open_world_candidate_dispositions: {
      rows: writerRequest.write_set.open_world_candidate_dispositions,
      identity: 'final_disposition_id',
    },
    open_world_primitives: {
      rows: writerRequest.write_set.open_world_primitives,
      identity: 'primitive_id',
    },
    semantic_impact_closures: {
      rows: writerRequest.write_set.semantic_impact_closures,
      identity: 'semantic_impact_closure_id',
    },
    reviewed_source_specific_rows: {
      rows: writerRequest.write_set.reviewed_source_specific_rows,
      identity: 'reviewed_source_specific_row_serving_key',
    },
    incomplete_canonical_result_rows: {
      rows: writerRequest.write_set.incomplete_canonical_result_rows,
      identity: 'incomplete_result_review_row_serving_key',
    },
    residuals: { rows: writerRequest.residuals, identity: 'residual_id' },
    quarantines: { rows: writerRequest.quarantines, identity: 'quarantine_id' },
  };
  const closureIds = [...new Set(
    Object.values(rowsByTable).flatMap(({ rows }) => rows.map((row) => row.closure_id)),
  )].sort();
  if (closureIds.length < 1) {
    throw new TypeError('The reverse-fee semantic write has no governed publication closure.');
  }
  const closureIdSql = closureIds.map((closureId) => `'${closureId}'`).join(',');
  const existingClosureIds = closureIds.filter(
    (closureId) => QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS.includes(closureId),
  );
  const newClosureIds = closureIds.filter((closureId) => !existingClosureIds.includes(closureId));
  const exactTableCheck = (
    table,
    rows,
    identity,
    selectedClosureIds,
    label,
    { allowAdditionalRows = false } = {},
  ) => {
    const selectedRows = rows.filter((row) => selectedClosureIds.includes(row.closure_id));
    const selectedClosureIdSql = selectedClosureIds.map((closureId) => `'${closureId}'`).join(',');
    const exhaustiveCheck = allowAdditionalRows ? '' : `(SELECT count(*)
      FROM canonical_v2_staging.${table}
      WHERE closure_id=ANY(ARRAY[${selectedClosureIdSql}]::text[])) <> ${selectedRows.length}
    OR `;
    return `
  IF ${exhaustiveCheck}(SELECT count(*)
      FROM jsonb_array_elements(${sqlJson(selectedRows)}) expected(value)
      JOIN canonical_v2_staging.${table} stored
        ON stored.${identity}=expected.value->>'${identity}'
       AND stored.closure_id=expected.value->>'closure_id'
       AND stored.canonical_payload=expected.value
       AND stored.canonical_payload_digest=canonical_v2_staging.payload_digest(expected.value)
      WHERE stored.closure_id=ANY(ARRAY[${selectedClosureIdSql}]::text[]))
        <> ${selectedRows.length} THEN
    RAISE EXCEPTION '${label}: ${table}';
  END IF;`;
  };
  const newClosureChecks = Object.entries(rowsByTable).map(([table, { rows, identity }]) => (
    exactTableCheck(
      table,
      rows,
      identity,
      newClosureIds,
      'corrected fee semantic payload set mismatch',
    )
  )).join('');
  const predecessorChecks = existingClosureIds.length === 0 ? '' : Object.entries(rowsByTable)
    .map(([table, { rows, identity }]) => exactTableCheck(
      table,
      rows,
      identity,
      existingClosureIds,
      'shared predecessor semantic payload set mismatch',
      { allowAdditionalRows: true },
    ))
    .join('');
  const exactChecks = `${predecessorChecks}${newClosureChecks}`;
  const newClosureIdSql = newClosureIds.map((closureId) => `'${closureId}'`).join(',');
  const noRowsCheck = Object.keys(rowsByTable).map((table) => `
      OR EXISTS (SELECT 1 FROM canonical_v2_staging.${table}
        WHERE closure_id=ANY(ARRAY[${newClosureIdSql}]::text[]))`).join('');
  if (newClosureIds.length < 1) {
    throw new TypeError('The reverse-fee semantic write has no new publication closure.');
  }
  const sql = `DO $qxo_reverse_semantic_gate$
DECLARE
  receipt_count integer;
  exact_receipt_count integer;
BEGIN
  SELECT count(*) INTO receipt_count
  FROM canonical_v2_staging.write_receipts
  WHERE operation='DEAL_SCOPE_RUN'
    AND idempotency_key='${REVERSE_DEAL_SCOPE_KEY}';
  SELECT count(*) INTO exact_receipt_count
  FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN'
        AND idempotency_key='${REVERSE_DEAL_SCOPE_KEY}'
        AND input_digest='${writerRequest.input_digest}'
        AND receipt_id='${writerRequest.receipt.receiptId}'
        AND canonical_payload=${sqlJson(writerRequest.receipt)};
  IF receipt_count=0 THEN
    IF ${allowAbsent ? 'FALSE' : 'TRUE'} THEN
      RAISE EXCEPTION 'the exact corrected fee semantic receipt is missing';
    END IF;
${predecessorChecks}
    IF FALSE${noRowsCheck} THEN
      RAISE EXCEPTION 'corrected fee semantic rows exist without their exact receipt';
    END IF;
  ELSIF receipt_count<>1 OR exact_receipt_count<>1 THEN
    RAISE EXCEPTION 'the corrected fee semantic receipt conflicts with the frozen request';
  ELSE${exactChecks}
  END IF;
END;
$qxo_reverse_semantic_gate$;`;
  if (Buffer.byteLength(sql, 'utf8') > MAX_SEMANTIC_GATE_BYTES) {
    throw new TypeError('The exact reverse-fee semantic gate exceeds its bounded transport limit.');
  }
  return sql;
}

function exactReleasePartitionGateSql(build) {
  const plan = build.import_plan;
  const releaseId = build.corpus_release_id;
  const namespaceId = build.serving_namespace_id;
  const partitions = [
    {
      table: 'candidate_release_correction_input_seals',
      rows: [plan.correction_input_seal_record],
      identity: 'correction_input_seal_id',
    },
    {
      table: 'candidate_release_correction_discharges',
      rows: plan.correction_discharge_records,
      identity: 'correction_discharge_id',
    },
    {
      table: 'market_observations',
      rows: plan.market_observations,
      identity: 'market_observation_serving_key',
    },
    {
      table: 'market_metric_slot_exclusions',
      rows: plan.market_exclusions,
      identity: 'exclusion_serving_key',
    },
    {
      table: 'shared_serving_rows',
      rows: [...plan.query_records, ...plan.incomplete_canonical_records],
      identity: 'row_serving_key',
    },
    {
      table: 'reviewed_source_specific_serving_rows',
      rows: plan.source_specific_records,
      identity: 'row_serving_key',
    },
    {
      table: 'exact_detail_serving_packages',
      rows: plan.exact_detail_packages,
      identity: 'row_serving_key',
    },
    {
      table: 'candidate_release_semantic_graphs',
      rows: plan.validated_semantic_graph_records,
      identity: 'validated_semantic_graph_id',
    },
    {
      table: 'deal_serving_directory',
      rows: plan.deal_directory_records,
      identity: 'deal_serving_directory_record_id',
      hasCanonicalPayload: false,
    },
  ];
  const checks = partitions.map(({
    table,
    rows,
    identity,
    hasCanonicalPayload = true,
  }) => {
    if (rows.length === 0) {
      return `
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.${table}
      WHERE serving_namespace_id='${namespaceId}'
        AND corpus_release_id='${releaseId}') THEN
    RAISE EXCEPTION 'unexpected F4 rows in empty partition: ${table}';
  END IF;`;
    }
    return `
  IF (SELECT count(*) FROM canonical_v2_staging.${table}
      WHERE serving_namespace_id='${namespaceId}'
        AND corpus_release_id='${releaseId}') <> ${rows.length}
    OR (SELECT count(*)
      FROM jsonb_array_elements(${sqlJson(rows)}) expected(value)
      JOIN canonical_v2_staging.${table} stored
        ON stored.${identity}=expected.value->>'${identity}'
       AND stored.serving_namespace_id=expected.value->>'serving_namespace_id'
       AND stored.corpus_release_id=expected.value->>'corpus_release_id'
       AND stored.contract_fingerprint=expected.value->>'contract_fingerprint'
       ${hasCanonicalPayload
    ? `AND stored.canonical_payload=expected.value->'canonical_payload'`
    : `AND stored.application_deal_id=(expected.value->>'application_deal_id')::uuid
       AND stored.governed_deal_key=expected.value->>'governed_deal_key'
       AND stored.deal_admission_id=expected.value->>'deal_admission_id'`}
       AND stored.canonical_payload_digest=expected.value->>'canonical_payload_digest'
      WHERE stored.serving_namespace_id='${namespaceId}'
        AND stored.corpus_release_id='${releaseId}') <> ${rows.length} THEN
    RAISE EXCEPTION 'exact F4 release payload set mismatch: ${table}';
  END IF;`;
  }).join('');
  const authority = plan.candidate_input_authority;
  return `DO $qxo_f4_exact_partitions$
BEGIN${checks}
  IF (SELECT count(*)
      FROM canonical_v2_staging.candidate_release_import_receipts receipt
      WHERE receipt.candidate_manifest_id='${plan.release_record.candidate_manifest_id}'
        AND receipt.corpus_release_id='${releaseId}'
        AND receipt.serving_namespace_id='${namespaceId}'
        AND receipt.correction_input_seal_id='${plan.release_record.correction_input_seal_id}'
        AND receipt.correction_input_root='${plan.release_record.correction_input_root}'
        AND receipt.candidate_input_contract_fingerprint='${authority.contract_fingerprint}'
        AND receipt.candidate_input_head_id='${authority.candidate_input_head_id}'
        AND receipt.candidate_input_head_payload_digest='${authority.candidate_input_head_payload_digest}'
        AND receipt.correction_discharge_map_id='${authority.correction_discharge_map_id}'
        AND receipt.correction_discharge_map_payload_digest='${authority.correction_discharge_map_payload_digest}'
        AND receipt.candidate_release_import_plan_id='${plan.candidate_release_import_plan_id}'
        AND receipt.import_state='IMPORTED_COMPLETE'
        AND receipt.expected_counts=${sqlJson(plan.expected_counts)}) <> 1 THEN
    RAISE EXCEPTION 'the exact F4 import receipt is missing or incomplete';
  END IF;
END;
$qxo_f4_exact_partitions$;`;
}

function verifyBeforeSql(build, genesis, writerRequest) {
  const releaseId = build.corpus_release_id;
  const exactGatedReusedClosures = new Set(
    Object.values(writerRequest.write_set)
      .filter(Array.isArray)
      .flatMap((rows) => rows.map((row) => row?.closure_id).filter(Boolean))
      .filter((closureId) => QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS.includes(closureId)),
  );
  const predecessorProvisionAnchorClosureIds = QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS
    .filter((closureId) => !exactGatedReusedClosures.has(closureId));
  if (predecessorProvisionAnchorClosureIds.length < 1) {
    throw new TypeError('The F4 packet has no predecessor provision anchors.');
  }
  return `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
${semanticWriteGateSql(writerRequest, { allowAbsent: true })}
DO $qxo_f4_before$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE ${activePointerPredicate()}) <> 1 THEN
    RAISE EXCEPTION 'the active staging pointer is not the exact pinned F1 pointer';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='${F1_FINGERPRINT}'
        AND candidate_input_head_id='${EXPECTED_F1_HEAD.id}'
        AND candidate_input_head_payload_digest='${EXPECTED_F1_HEAD.digest}') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='${F2_FINGERPRINT}'
        AND candidate_input_head_id='${EXPECTED_F2_HEAD.id}'
        AND candidate_input_head_payload_digest='${EXPECTED_F2_HEAD.digest}') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c'
        AND candidate_input_head_id='${EXPECTED_F3_HEAD.id}'
        AND candidate_input_head_payload_digest='${EXPECTED_F3_HEAD.digest}') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='${genesis.contract_bundle.fingerprint}'
        AND candidate_input_head_id='${genesis.candidate_input_head.candidate_input_head_id}'
        AND candidate_input_head_payload_digest='${genesis.candidate_input_head.canonical_payload_digest}') <> 1 THEN
    RAISE EXCEPTION 'an F1, F2, F3 or F4 candidate-input authority head is not exact';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='${EXPECTED_F2_RELEASE.corpus_release_id}'
        AND candidate_manifest_id='${EXPECTED_F2_RELEASE.candidate_manifest_id}'
        AND canonical_payload->>'serving_namespace_id'='${EXPECTED_F2_RELEASE.serving_namespace_id}') <> 1 THEN
    RAISE EXCEPTION 'the exact inactive F2 predecessor release is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='${releaseId}') THEN
    RAISE EXCEPTION 'the F4 release already exists';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['${predecessorProvisionAnchorClosureIds.join("','")}']::text[]) required(closure_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM canonical_v2_staging.provision_instances item
      WHERE item.closure_id=required.closure_id
    )
  ) THEN
    RAISE EXCEPTION 'a required predecessor QXO semantic closure is missing';
  END IF;
END;
$qxo_f4_before$;
SELECT jsonb_build_object(
  'active_release', (SELECT corpus_release_id FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'f4_release_absent', (SELECT count(*)=0 FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${releaseId}'),
  'reverse_write_receipts', (SELECT count(*) FROM canonical_v2_staging.write_receipts WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='${REVERSE_DEAL_SCOPE_KEY}')
) AS before_state;
ROLLBACK;
`;
}

function verifyAfterSql(build, writerRequest) {
  const release = build.release;
  const plan = build.import_plan;
  return `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
${semanticWriteGateSql(writerRequest)}
${exactReleasePartitionGateSql(build)}
DO $qxo_f4_after$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE ${activePointerPredicate()}) <> 1 THEN
    RAISE EXCEPTION 'the inactive F4 import changed the active pointer';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND candidate_manifest_id='${release.manifest.candidate_release_manifest_id}'
        AND contract_fingerprint='${release.manifest.contract_fingerprint}'
        AND canonical_payload=${sqlJson(release.manifest)}
        AND canonical_payload_digest='${release.manifest.canonical_payload_digest}') <> 1 THEN
    RAISE EXCEPTION 'the exact inactive F4 release is missing';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='${build.corpus_release_id}') <> 10
    OR (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='${build.corpus_release_id}') <> 2
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${build.corpus_release_id}') <> 11
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='${build.corpus_release_id}') <> 11
    OR (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='${build.corpus_release_id}') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND candidate_release_import_plan_id='${plan.candidate_release_import_plan_id}'
        AND import_state='IMPORTED_COMPLETE') <> 1 THEN
    RAISE EXCEPTION 'the F4 release partitions or import receipt are not exact';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.market_observations
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND canonical_payload->'dimensions'=${sqlJson(QXO_RICH_DEAL_DIMENSIONS)}) <> 10
    OR (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND canonical_payload->'dimensions'=${sqlJson(QXO_RICH_DEAL_DIMENSIONS)}) <> 2 THEN
    RAISE EXCEPTION 'one or more F4 metric slots lost the reviewed QXO dimensions';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND metric_key='SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE') <> 1
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id='${build.corpus_release_id}'
        AND metric_key='BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE') <> 1 THEN
    RAISE EXCEPTION 'the two-sided termination-fee serving result is incomplete';
  END IF;
END;
$qxo_f4_after$;
SELECT jsonb_build_object(
  'active_release', (SELECT corpus_release_id FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'inactive_f4_release', '${build.corpus_release_id}',
  'shared_rows', 11,
  'market_observations', 10,
  'market_exclusions', 2,
  'reverse_semantic_receipt', '${writerRequest.receipt.receiptId}'
) AS after_state;
ROLLBACK;
`;
}

function rollbackSql(build, commit) {
  return transaction(`SELECT public.canonical_v2_rollback_inactive_candidate_release(
  'staging',
  '${build.release.manifest.candidate_release_manifest_id}',
  '${build.corpus_release_id}',
  '${build.serving_namespace_id}',
  '${build.import_plan.candidate_release_import_plan_id}'
) AS rollback_result;`, commit);
}

function importCandidateSql(build) {
  const sql = `SELECT public.canonical_v2_import_candidate_release(
  'staging', ${sqlJson(build.import_plan)}
) AS import_result;`;
  if (Buffer.byteLength(JSON.stringify(build.import_plan), 'utf8') > MAX_IMPORT_PLAN_BYTES) {
    throw new TypeError('The F4 import plan exceeds its bounded transport limit.');
  }
  if (Buffer.byteLength(sql, 'utf8') > MAX_IMPORT_STATEMENT_BYTES) {
    throw new TypeError('The F4 import statement exceeds its bounded transport limit.');
  }
  return sql;
}

function verifyRollbackSql(build, writerRequest) {
  return `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
${semanticWriteGateSql(writerRequest)}
DO $qxo_f4_rollback_after$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE ${activePointerPredicate()}) <> 1 THEN
    RAISE EXCEPTION 'the F4 rollback changed the active staging pointer';
  END IF;
  IF EXISTS (SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_import_receipts
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.market_observations
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.market_metric_slot_exclusions
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.reviewed_source_specific_serving_rows
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.exact_detail_serving_packages
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_semantic_graphs
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.deal_serving_directory
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_correction_input_seals
      WHERE corpus_release_id='${build.corpus_release_id}')
    OR EXISTS (SELECT 1 FROM canonical_v2_staging.candidate_release_correction_discharges
      WHERE corpus_release_id='${build.corpus_release_id}') THEN
    RAISE EXCEPTION 'the inactive F4 serving partition was not removed exactly';
  END IF;
END;
$qxo_f4_rollback_after$;
SELECT jsonb_build_object(
  'active_release', (SELECT corpus_release_id FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'removed_inactive_f4_release', '${build.corpus_release_id}',
  'f4_release_rows', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${build.corpus_release_id}'),
  'f4_import_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id='${build.corpus_release_id}')
) AS rollback_state;
ROLLBACK;
`;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath || process.argv.length !== 3) {
    throw new TypeError(
      'Usage: node scripts/canonical-v2-staging-qxo-reverse-f4.mjs <block00-output.json>',
    );
  }
  const pasted = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
  if (canonicalJson(pasted.active_pointer) !== canonicalJson(EXPECTED_ACTIVE)) {
    throw new TypeError('Block 00 does not contain the exact active F1 staging pointer.');
  }
  const chains = {
    agreement: admissionChain(
      await reconstructCapture(SOURCES.agreement, pasted.agreement_capture),
      SOURCES.agreement,
    ),
    dealValue: admissionChain(
      await reconstructCapture(SOURCES.dealValue, pasted.deal_value_capture),
      SOURCES.dealValue,
    ),
  };
  const build = buildQxoReverseF4Candidate({
    agreementSourceContext: sourceContext(chains.agreement, 0),
    agreementSourceAdmission: chains.agreement.bundle.source_admission_manifest,
    dealValueSourceContext: sourceContext(chains.dealValue, 1),
    dealValueSourceAdmission: chains.dealValue.bundle.source_admission_manifest,
  });
  const genesis = buildQxoReverseF4AuthorityGenesis();
  if (canonicalJson(build.correction_authority_selection.candidate_input_head)
      !== canonicalJson(genesis.candidate_input_head)) {
    throw new TypeError('The candidate release did not capture the deterministic F4 authority head.');
  }
  const writerRequest = await reverseWriterRequest({ build, chains });
  const buyerTermination = build.serving_slices.reverse_termination;
  const sellerTermination = build.serving_slices.seller_termination;
  const reverseClosureId = buyerTermination.semantic_closure_id;
  const sellerClosureId = sellerTermination.semantic_closure_id;
  const semanticGate = semanticWriteGateSql(writerRequest);
  const importStatement = importCandidateSql(build);
  const files = {
    '03-verify-before.sql': verifyBeforeSql(build, genesis, writerRequest),
    '04-reverse-fee-deal-scope-dry-run.sql': transaction(
      `${recheckSql(genesis.candidate_input_head)}
${writerRequest.sql}
${semanticGate}`,
      false,
    ),
    '05-reverse-fee-deal-scope-apply.sql': transaction(
      `${recheckSql(genesis.candidate_input_head)}
${writerRequest.sql}
${semanticGate}`,
      true,
    ),
    '06-import-dry-run.sql': transaction(
      `${semanticGate}
${recheckSql(genesis.candidate_input_head)}
${importStatement}`,
      false,
    ),
    '07-import-apply.sql': transaction(
      `${semanticGate}
${recheckSql(genesis.candidate_input_head)}
${importStatement}`,
      true,
    ),
    '08-verify-after.sql': verifyAfterSql(build, writerRequest),
    '09-rollback-dry-run.sql': rollbackSql(build, false),
    '10-rollback-apply.sql': rollbackSql(build, true),
    '11-verify-rollback.sql': verifyRollbackSql(build, writerRequest),
  };
  const fileBytes = Object.fromEntries(
    Object.entries(files).map(([name, body]) => [name, Buffer.byteLength(body, 'utf8')]),
  );
  for (const [name, bytes] of Object.entries(fileBytes)) {
    if (bytes > MAX_GENERATED_SQL_FILE_BYTES) {
      throw new TypeError(`${name} exceeds the bounded generated SQL file limit.`);
    }
  }
  const packetBytes = Object.values(fileBytes).reduce((total, bytes) => total + bytes, 0);
  if (packetBytes > MAX_PACKET_BYTES) {
    throw new TypeError('The generated F4 SQL packet exceeds its bounded transport limit.');
  }
  const attestation = Object.freeze({
    schema_version: 'QXO_REVERSE_F4_INACTIVE_CANDIDATE_ATTESTATION/V1',
    contract_fingerprint: build.contract_bundle.fingerprint,
    candidate_seed_digest: contentId(
      'QXO_REVERSE_F4_COMBINED_CANDIDATE_SEED/V1',
      build.seed,
    ),
    deal_dimension_profile_digest: QXO_RICH_DEAL_DIMENSIONS_DIGEST,
    reverse_reviewed_mapping_id:
      buyerTermination.reviewed_mapping.reviewed_mapping_id,
    reverse_semantic_closure_id: reverseClosureId,
    reverse_row_serving_key: buyerTermination.shared_row.row_serving_key,
    reverse_relationships: buyerTermination.relationships.length,
    reverse_exact_detail_encoded_bytes:
      buyerTermination.exact_detail_package.detail_payloads[0].encoded_byte_length,
    seller_reviewed_mapping_id: sellerTermination.reviewed_mapping.reviewed_mapping_id,
    seller_semantic_closure_id: sellerClosureId,
    seller_row_serving_key: sellerTermination.shared_row.row_serving_key,
    seller_relationships: sellerTermination.relationships.length,
    seller_exact_detail_encoded_bytes:
      sellerTermination.exact_detail_package.detail_payloads[0].encoded_byte_length,
    reverse_deal_scope_input_digest: writerRequest.input_digest,
    corpus_release_id: build.corpus_release_id,
    serving_namespace_id: build.serving_namespace_id,
    candidate_release_manifest_id: build.release.manifest.candidate_release_manifest_id,
    candidate_release_import_plan_id: build.import_plan.candidate_release_import_plan_id,
    candidate_input_head_id: genesis.candidate_input_head.candidate_input_head_id,
    transport_bounds: Object.freeze({
      writer_request_bytes: Buffer.byteLength(writerRequest.sql, 'utf8'),
      semantic_gate_bytes: Buffer.byteLength(semanticGate, 'utf8'),
      import_plan_bytes: Buffer.byteLength(JSON.stringify(build.import_plan), 'utf8'),
      import_statement_bytes: Buffer.byteLength(importStatement, 'utf8'),
      generated_sql_file_bytes: Object.freeze(fileBytes),
      generated_sql_packet_bytes: packetBytes,
    }),
    observations: build.release.market_observations.length,
    exclusions: build.release.market_exclusions.length,
    shared_rows: build.release.shared_rows.length,
    query_records: build.release.query_records.length,
    exact_detail_packages: build.release.exact_detail_packages.length,
    status: 'GENERATED_INACTIVE_NOT_APPLIED',
  });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(OUTPUT_DIR, name), body);
  }
  writeFileSync(join(OUTPUT_DIR, 'ATTESTATION.json'), `${canonicalJson(attestation)}\n`);
  process.stdout.write(`${canonicalJson(attestation)}\n`);
}

main().catch(fail);
