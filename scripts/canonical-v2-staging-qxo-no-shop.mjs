#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAdmittedSemanticSourceContext, buildAdmittedSourceReference } = require('../lib/canonical-v2/admitted-semantic-source');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildQxoAdmittedNoShopNoticeSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice');
const { buildQxoAdmittedNoShopActionsSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice');
const { buildQxoAdmittedNoShopRematchSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-rematch-slice');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const SOURCE = Object.freeze({
  retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const DEAL_KEY = 'deal:qxo-topbuild';
const FAMILY_CONFIGS = Object.freeze({
  NOTICE: Object.freeze({
    idempotencyKey: 'QXO_NO_SHOP_NOTICE_DEAL_SCOPE_V1',
    closureDomain: 'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE/V1',
    expectedDealAdmissionId: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    expectedSourceAdmissionId: 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
    expectedReviewedMappingId: 'f2eee0397926cac5e6042e93d002ddc6790d5b2bafdd9adbccb460d16081d7c5',
    expectedClosureId: '944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e',
    attestationSchema: 'QXO_NO_SHOP_DEAL_SCOPE_STAGING_ATTESTATION/V1',
  }),
  ACTIONS: Object.freeze({
    idempotencyKey: 'QXO_NO_SHOP_ACTIONS_DEAL_SCOPE_V1',
    closureDomain: 'QXO_NO_SHOP_ACTIONS_SEMANTIC_CLOSURE/V1',
    expectedDealAdmissionId: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    expectedSourceAdmissionId: 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
    expectedReviewedMappingId: '633cf0ff19c762125f51df2d2b36da182a61d23ea7193ef8e2898134dc980f1b',
    expectedClosureId: '89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b',
    attestationSchema: 'QXO_NO_SHOP_ACTIONS_DEAL_SCOPE_STAGING_ATTESTATION/V1',
  }),
  REMATCH: Object.freeze({
    idempotencyKey: 'QXO_NO_SHOP_REMATCH_DEAL_SCOPE_V1',
    closureDomain: 'QXO_NO_SHOP_REMATCH_SEMANTIC_CLOSURE/V1',
    expectedDealAdmissionId: '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f',
    expectedSourceAdmissionId: 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
    expectedReviewedMappingId: 'c5e168edd134b80f9310fd831e86d950a43e1329dc2903c869e51ec0f4d42322',
    expectedClosureId: 'dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8',
    attestationSchema: 'QXO_NO_SHOP_REMATCH_DEAL_SCOPE_STAGING_ATTESTATION/V1',
  }),
});
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;

function familyConfig() {
  if (mode.startsWith('--actions-')) return FAMILY_CONFIGS.ACTIONS;
  if (mode.startsWith('--rematch-')) return FAMILY_CONFIGS.REMATCH;
  return FAMILY_CONFIGS.NOTICE;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(ROOT, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  if (!line) return 'Canonical QXO no-shop database operation failed.';
  const diagnostic = /(?:ERROR|DETAIL|HINT):/i.test(line)
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i))
    : line;
  return diagnostic
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-no-shop-'));
  const file = join(directory, commit ? 'commit.sql' : 'query.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='60000ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) throw new Error('Supabase returned no rows array.');
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readCapture() {
  const rows = runSql(`SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${SOURCE.retrieval_url_sha256}'
  AND response_bytes_sha256='${SOURCE.response_bytes_sha256}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.canonical_payload) {
    throw new Error('The exact QXO SEC intake capture must exist exactly once.');
  }
  return rows[0].canonical_payload;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_no_shop_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

async function buildWrite() {
  const config = familyConfig();
  const contractBundle = compileFixtureContract();
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id: sourceAdmissionBundle.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const sourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: sourceAdmissionBundle.immutable_source_document,
    source_admission_manifest: sourceAdmissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: sourceAdmissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  const slice = config === FAMILY_CONFIGS.ACTIONS
    ? buildQxoAdmittedNoShopActionsSlice({ sourceContext, contractBundle })
    : config === FAMILY_CONFIGS.REMATCH
      ? buildQxoAdmittedNoShopRematchSlice({ sourceContext, contractBundle })
      : buildQxoAdmittedNoShopNoticeSlice({ sourceContext, contractBundle });
  const closureId = contentId(config.closureDomain, {
    deal_admission_id: dealAdmissionId,
    source_admission_manifest_id: sourceContext.source_admission_manifest_id,
    reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
  });
  if (dealAdmissionId !== config.expectedDealAdmissionId
    || sourceContext.source_admission_manifest_id !== config.expectedSourceAdmissionId
    || (config.expectedReviewedMappingId !== null
      && slice.reviewed_mapping.reviewed_mapping_id !== config.expectedReviewedMappingId)
    || (config.expectedClosureId !== null && closureId !== config.expectedClosureId)) {
    throw new Error('The admitted QXO no-shop semantic identity has drifted.');
  }
  const close = (rows) => rows.map((row) => ({ ...row, closure_id: closureId }));
  const writeSet = {
    source_references: [buildAdmittedSourceReference(sourceContext)],
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: dealAdmissionId,
      document_hash: sourceContext.document_hash,
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
  };

  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'QXO_SEC_INTAKE_PREREQUISITE',
    writeSet: { intake_capture: capture },
  });
  for (const chunk of artifact.chunks) {
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `QXO_SEC_SOURCE_ARTIFACT_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: {
        source_artifact_manifest: artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
  await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'QXO_SEC_SOURCE_ADMISSION_V2',
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: capture.intake_capture_receipt_id,
        source_response_content_id: capture.source_response_content_id,
      },
      conversion_artifact_manifest: artifact.manifest,
      verification,
      source_admission_bundle: sourceAdmissionBundle,
    },
  });
  const input = { operation: 'DEAL_SCOPE_RUN', idempotencyKey: config.idempotencyKey, writeSet };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  return {
    ...input,
    inputDigest: dryRun.inputDigest,
    receipt: committed.receipt,
    closureId,
    sourceContext,
    slice,
  };
}

function writerSql(write) {
  const config = familyConfig();
  return `SELECT public.canonical_v2_write(
    'staging', 'DEAL_SCOPE_RUN', '${config.idempotencyKey}', '${write.inputDigest}',
    ${sqlJson(write.writeSet)}, '[]'::jsonb, '[]'::jsonb,
    ${sqlJson(write.receipt)}
  ) AS result;`;
}

function state(write) {
  const config = familyConfig();
  const rows = runSql(`SELECT jsonb_build_object(
    'deal', EXISTS (SELECT 1 FROM canonical_v2_staging.deals WHERE deal_key='${DEAL_KEY}' AND canonical_payload->>'deal_admission_id'='${write.sourceContext.deal_admission_id}'),
    'excerpts', (SELECT count(*) = ${write.writeSet.excerpts.length} FROM canonical_v2_staging.excerpts WHERE closure_id='${write.closureId}'),
    'provisions', (SELECT count(*) = ${write.writeSet.provisions.length} FROM canonical_v2_staging.provision_instances WHERE closure_id='${write.closureId}'),
    'components', (SELECT count(*) = ${write.writeSet.components.length} FROM canonical_v2_staging.provision_components WHERE closure_id='${write.closureId}'),
    'claims', (SELECT count(*) = ${write.writeSet.claims.length} FROM canonical_v2_staging.claim_revisions WHERE closure_id='${write.closureId}'),
    'relationships', (SELECT count(*) = ${write.writeSet.relationships.length} FROM canonical_v2_staging.relationship_revisions WHERE closure_id='${write.closureId}'),
    'write_receipt', EXISTS (SELECT 1 FROM canonical_v2_staging.write_receipts WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='${config.idempotencyKey}' AND input_digest='${write.inputDigest}' AND receipt_id='${write.receipt.receiptId}')
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('QXO no-shop semantic state could not be read.');
  return rows[0].state;
}

function assertCommitted(stateValue) {
  const missing = Object.entries(stateValue).filter(([, value]) => value !== true).map(([key]) => key);
  if (missing.length) throw new Error(`The QXO no-shop semantic transaction is incomplete: ${missing.join(', ')}.`);
}

function attestation(write, mode) {
  const config = familyConfig();
  return {
    schema_version: config.attestationSchema,
    environment: 'staging',
    mode,
    deal_admission_id: write.sourceContext.deal_admission_id,
    document_hash: write.sourceContext.document_hash,
    canonical_text_id: write.sourceContext.canonical_text_id,
    source_admission_manifest_id: write.sourceContext.source_admission_manifest_id,
    reviewed_mapping_id: write.slice.reviewed_mapping.reviewed_mapping_id,
    semantic_closure_id: write.closureId,
    provision_count: write.writeSet.provisions.length,
    component_count: write.writeSet.components.length,
    claim_count: write.writeSet.claims.length,
    relationship_count: write.writeSet.relationships.length,
    result_input_count: write.slice.resultInputs.length,
    writer_request_byte_length: Buffer.byteLength(writerSql(write), 'utf8'),
  };
}

const mode = process.argv[2];
const invocation = Object.freeze({
  '--dry-run': 'DRY_RUN',
  '--apply': 'APPLY',
  '--verify': 'VERIFY',
  '--actions-dry-run': 'DRY_RUN',
  '--actions-apply': 'APPLY',
  '--actions-verify': 'VERIFY',
  '--rematch-dry-run': 'DRY_RUN',
  '--rematch-apply': 'APPLY',
  '--rematch-verify': 'VERIFY',
});
if (!invocation[mode] || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop.mjs --dry-run|--apply|--verify|--actions-dry-run|--actions-apply|--actions-verify|--rematch-dry-run|--rematch-apply|--rematch-verify');
}

try {
  guardProject();
  const write = await buildWrite();
  if (Buffer.byteLength(writerSql(write), 'utf8') > MAX_WRITER_REQUEST_BYTES) {
    throw new Error('The QXO no-shop semantic writer request exceeds its bounded transport limit.');
  }
  if (invocation[mode] === 'VERIFY') {
    assertCommitted(state(write));
  } else {
    const before = state(write);
    runSql(writerSql(write));
    if (canonicalJson(before) !== canonicalJson(state(write))) {
      throw new Error('Rollback-first QXO no-shop semantic run changed staging state.');
    }
    if (invocation[mode] === 'APPLY') {
      runSql(writerSql(write), { commit: true });
      assertCommitted(state(write));
    }
  }
  process.stdout.write(`${canonicalJson(attestation(
    write,
    invocation[mode] === 'APPLY' ? 'COMMITTED' : invocation[mode] === 'VERIFY' ? 'VERIFIED' : 'ROLLED_BACK',
  ))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical QXO no-shop run failed.');
}
