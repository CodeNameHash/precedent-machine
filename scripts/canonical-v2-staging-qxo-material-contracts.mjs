#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  DEAL_ADMISSION_ID,
  DEAL_KEY,
  buildQxoMaterialContractsSlice,
} = require('../lib/canonical-v2/qxo-material-contracts-slice');
const {
  PROVISIONAL_CORPUS_RELEASE_ID,
  PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST,
  QXO_MATERIAL_COMBINED_CANDIDATE_SEED,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const SOURCES = Object.freeze([
  Object.freeze({
    role: 'AGREEMENT',
    sourceOrdinal: 0,
    retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
    response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
    source_admission_manifest_id: 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
  }),
  Object.freeze({
    role: 'DEAL_VALUE',
    sourceOrdinal: 1,
    retrieval_url_sha256: '0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442',
    response_bytes_sha256: '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827',
    source_admission_manifest_id: '8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c',
  }),
]);
const IDEMPOTENCY_KEY = 'QXO_MATERIAL_CONTRACTS_DEAL_SCOPE_V1';
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
const MAX_DATABASE_RESULT_BYTES = 12 * 1024 * 1024;
const BOOTSTRAP_CORPUS_RELEASE_ID = contentId('CORPUS_RELEASE_BOOTSTRAP/V1', {
  schema_version: 'QXO_MATERIAL_CONTRACTS_RELEASE_ID_BOOTSTRAP/V1',
  governed_deal_key: DEAL_KEY,
});

const EXPECTED_SEMANTIC_CLOSURE_ID = 'a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5';
const EXPECTED_INCOMPLETE_ROW_SERVING_KEY = '45a7c43499e9a8429f1b0a19871c0e952c85cb3e684e222cbd506259c15f2500';
if (canonicalJson(SOURCES.map((source) => source.source_admission_manifest_id))
    !== canonicalJson(QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS)) {
  throw new Error('The runner source admissions do not match the combined candidate seed.');
}

let stage = 'STARTUP';

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
  if (!line) return 'Canonical QXO material-contract database operation failed.';
  const diagnostic = /(?:ERROR|DETAIL|HINT):/i.test(line)
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i))
    : line;
  return diagnostic
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-material-contracts-'));
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
      maxBuffer: MAX_DATABASE_RESULT_BYTES * 2,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    if (Buffer.byteLength(result.stdout, 'utf8') > MAX_DATABASE_RESULT_BYTES) {
      throw new Error('Canonical QXO material-contract database response exceeded its bounded limit.');
    }
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) throw new Error('Supabase returned no rows array.');
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_material_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function readInputs() {
  const sourceCases = SOURCES.map((source) => `WHEN retrieval_url_sha256=${sqlText(source.retrieval_url_sha256)}
      AND response_bytes_sha256=${sqlText(source.response_bytes_sha256)} THEN ${sqlText(source.role)}`);
  const sourcePredicate = SOURCES.map((source) => `(retrieval_url_sha256=${sqlText(source.retrieval_url_sha256)}
      AND response_bytes_sha256=${sqlText(source.response_bytes_sha256)})`).join(' OR ');
  const rows = runSql(`SELECT jsonb_build_object(
    'captures', (SELECT coalesce(jsonb_object_agg(source_role, canonical_payload), '{}'::jsonb)
      FROM (
        SELECT CASE ${sourceCases.join('\n        ')} END AS source_role, canonical_payload
        FROM canonical_v2_staging.intake_capture_receipts
        WHERE ${sourcePredicate}
      ) exact_sources),
    'capture_count', (SELECT count(*) FROM canonical_v2_staging.intake_capture_receipts
      WHERE ${sourcePredicate}),
    'stored_deal', (SELECT canonical_payload FROM canonical_v2_staging.deals
      WHERE deal_key=${sqlText(DEAL_KEY)}),
    'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging')
  ) AS inputs;`, { readOnly: true });
  const inputs = rows.length === 1 ? rows[0]?.inputs : null;
  if (!inputs || Number(inputs.capture_count) !== SOURCES.length
    || Object.keys(inputs.captures || {}).sort().join('|') !== SOURCES.map((source) => source.role).sort().join('|')) {
    throw new Error('The two exact admitted QXO source captures must each exist exactly once.');
  }
  if (!inputs.stored_deal
    || inputs.stored_deal.deal_key !== DEAL_KEY
    || inputs.stored_deal.deal_admission_id !== DEAL_ADMISSION_ID
    || inputs.stored_deal.document_hash !== SOURCES[0].response_bytes_sha256) {
    throw new Error('The stored QXO deal admission has drifted.');
  }
  if (!inputs.active_pointer) throw new Error('The staging active release pointer is missing.');
  return inputs;
}

function prepareSource({ capture, source }) {
  if (capture.retrieval_url_sha256 !== source.retrieval_url_sha256
    || capture.response_bytes_sha256 !== source.response_bytes_sha256) {
    throw new Error(`The exact ${source.role} source capture has drifted.`);
  }
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  if (sourceAdmissionBundle.source_admission_manifest.source_admission_manifest_id
    !== source.source_admission_manifest_id) {
    throw new Error(`The exact ${source.role} source admission identity has drifted.`);
  }
  const artifact = buildSourceArtifactChunks(conversion);
  const sourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: sourceAdmissionBundle.immutable_source_document,
    source_admission_manifest: sourceAdmissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: sourceAdmissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: source.sourceOrdinal,
  });
  return { capture, source, conversion, verification, sourceAdmissionBundle, artifact, sourceContext };
}

async function admitSourceInMemory(writer, prepared) {
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `QXO_MATERIAL_CONTRACTS_${prepared.source.role}_INTAKE_PREREQUISITE`,
    writeSet: { intake_capture: prepared.capture },
  });
  for (const chunk of prepared.artifact.chunks) {
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `QXO_MATERIAL_CONTRACTS_${prepared.source.role}_ARTIFACT_${prepared.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: {
        source_artifact_manifest: prepared.artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
  await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `QXO_MATERIAL_CONTRACTS_${prepared.source.role}_SOURCE_ADMISSION`,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: prepared.capture.intake_capture_receipt_id,
        source_response_content_id: prepared.capture.source_response_content_id,
      },
      conversion_artifact_manifest: prepared.artifact.manifest,
      verification: prepared.verification,
      source_admission_bundle: prepared.sourceAdmissionBundle,
    },
  });
}

function semanticClosureId(writeSet) {
  const closures = new Set(Object.entries(writeSet)
    .filter(([key, value]) => !['source_references', 'deal'].includes(key) && Array.isArray(value))
    .flatMap(([, rows]) => rows.map((row) => row.closure_id)));
  if (closures.size !== 1) throw new Error('The QXO material-contract write set must have one semantic closure.');
  return [...closures][0];
}

async function buildWrite(inputs) {
  const contractBundle = compileFixtureContract();
  const prepared = SOURCES.map((source) => prepareSource({ capture: inputs.captures[source.role], source }));
  const agreement = prepared[0];
  const dealValue = prepared[1];
  const sliceInputs = {
    agreementSourceContext: agreement.sourceContext,
    dealValueSourceContext: dealValue.sourceContext,
    agreementSourceAdmission: agreement.sourceAdmissionBundle.source_admission_manifest,
    dealValueSourceAdmission: dealValue.sourceAdmissionBundle.source_admission_manifest,
    contractBundle,
  };
  const probeSlice = buildQxoMaterialContractsSlice({
    ...sliceInputs,
    corpusReleaseId: BOOTSTRAP_CORPUS_RELEASE_ID,
  });
  if (contractBundle.fingerprint !== QXO_MATERIAL_COMBINED_CANDIDATE_SEED.contract_fingerprint
    || probeSlice.reviewed_mapping.reviewed_mapping_id
      !== QXO_MATERIAL_COMBINED_CANDIDATE_SEED.material_reviewed_mapping_id) {
    throw new Error('The source-backed material review no longer matches the pinned combined candidate seed.');
  }
  const slice = buildQxoMaterialContractsSlice({
    ...sliceInputs,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
  });
  if (slice.reviewed_mapping.reviewed_mapping_id !== probeSlice.reviewed_mapping.reviewed_mapping_id) {
    throw new Error('The material reviewed mapping must not depend on its candidate release identity.');
  }
  const writeSet = {
    ...JSON.parse(JSON.stringify(slice.semantic_write_set)),
    deal: inputs.stored_deal,
  };
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  for (const source of prepared) await admitSourceInMemory(writer, source);
  const input = { operation: 'DEAL_SCOPE_RUN', idempotencyKey: IDEMPOTENCY_KEY, writeSet };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  const closureId = semanticClosureId(writeSet);
  if (closureId !== EXPECTED_SEMANTIC_CLOSURE_ID
    || writeSet.incomplete_canonical_result_rows[0].incomplete_result_review_row_serving_key
      !== EXPECTED_INCOMPLETE_ROW_SERVING_KEY) {
    throw new Error('The pinned QXO material-contract semantic or serving identity has drifted.');
  }
  return {
    ...input,
    inputDigest: dryRun.inputDigest,
    receipt: committed.receipt,
    contractBundle,
    prepared,
    slice,
    closureId,
    provisionalCorpusReleaseSeed: QXO_MATERIAL_COMBINED_CANDIDATE_SEED,
    provisionalCorpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
  };
}

function writerSql(write) {
  return `SELECT public.canonical_v2_write(
    'staging', 'DEAL_SCOPE_RUN', ${sqlText(IDEMPOTENCY_KEY)}, ${sqlText(write.inputDigest)},
    ${sqlJson(write.writeSet)}, '[]'::jsonb, '[]'::jsonb, ${sqlJson(write.receipt)}
  ) AS result;`;
}

const COLLECTION_TABLES = Object.freeze({
  excerpts: 'excerpts',
  validated_semantic_graphs: 'validated_semantic_graphs',
  provisions: 'provision_instances',
  components: 'provision_components',
  claims: 'claim_revisions',
  relationships: 'relationship_revisions',
  open_world_candidates: 'open_world_candidates',
  open_world_candidate_occurrences: 'open_world_candidate_occurrences',
  open_world_evidence_references: 'open_world_evidence_references',
  open_world_candidate_dispositions: 'open_world_candidate_dispositions',
  open_world_primitives: 'open_world_primitives',
  semantic_impact_closures: 'semantic_impact_closures',
  reviewed_source_specific_rows: 'reviewed_source_specific_rows',
  incomplete_canonical_result_rows: 'incomplete_canonical_result_rows',
});

function readState(write) {
  const countFields = Object.entries(COLLECTION_TABLES).map(([key, table]) => (
    `${sqlText(key)}, (SELECT count(*) FROM canonical_v2_staging.${table} WHERE closure_id=${sqlText(write.closureId)})`
  ));
  const rows = runSql(`SELECT jsonb_build_object(
    'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging'),
    'deal_matches', EXISTS (SELECT 1 FROM canonical_v2_staging.deals
      WHERE deal_key=${sqlText(DEAL_KEY)} AND canonical_payload=${sqlJson(write.writeSet.deal)}),
    'source_admission_count', (SELECT count(*) FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id IN (${SOURCES.map((source) => sqlText(source.source_admission_manifest_id)).join(', ')})),
    'counts', jsonb_build_object(${countFields.join(',\n      ')}),
    'receipt_matches', EXISTS (SELECT 1 FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key=${sqlText(IDEMPOTENCY_KEY)}
        AND input_digest=${sqlText(write.inputDigest)} AND receipt_id=${sqlText(write.receipt.receiptId)})
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('QXO material-contract semantic state could not be read.');
  return rows[0].state;
}

function assertCommitted(write, stateValue) {
  if (stateValue.deal_matches !== true
    || Number(stateValue.source_admission_count) !== SOURCES.length
    || stateValue.receipt_matches !== true) {
    throw new Error('The QXO material-contract semantic prerequisites or receipt are incomplete.');
  }
  const mismatches = Object.keys(COLLECTION_TABLES).filter((key) => (
    Number(stateValue.counts?.[key]) !== write.writeSet[key].length
  ));
  if (mismatches.length) {
    throw new Error(`The QXO material-contract semantic transaction has incorrect counts: ${mismatches.join(', ')}.`);
  }
  if (Number(stateValue.counts.incomplete_canonical_result_rows) !== 1
    || Number(stateValue.counts.open_world_candidates) !== 1
    || Number(stateValue.counts.open_world_candidate_occurrences) !== 1
    || Number(stateValue.counts.open_world_candidate_dispositions) !== 1
    || Number(stateValue.counts.semantic_impact_closures) !== 1
    || Number(stateValue.counts.reviewed_source_specific_rows) !== 0) {
    throw new Error('The incomplete-result open-world closure is not exact.');
  }
}

function assertActivePointerUnchanged(before, after) {
  if (canonicalJson(before) !== canonicalJson(after)) {
    throw new Error('The QXO material-contract semantic run changed the active release pointer.');
  }
}

function attestation(write, mode, stateValue, writerRequestByteLength) {
  const expectedSemanticCounts = Object.fromEntries(
    Object.keys(COLLECTION_TABLES).map((key) => [key, write.writeSet[key].length]),
  );
  return {
    schema_version: 'QXO_MATERIAL_CONTRACTS_STAGING_ATTESTATION/V1',
    environment: 'staging',
    mode,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_admission_manifest_ids: SOURCES.map((source) => source.source_admission_manifest_id),
    provisional_corpus_release_id: write.provisionalCorpusReleaseId,
    provisional_corpus_release_seed_digest: PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST,
    semantic_closure_id: write.closureId,
    reviewed_mapping_id: write.slice.reviewed_mapping.reviewed_mapping_id,
    incomplete_result_review_row_serving_key:
      write.writeSet.incomplete_canonical_result_rows[0].incomplete_result_review_row_serving_key,
    metric_exclusion_reason: write.slice.projection.exclusion.exclusion_reason,
    expected_semantic_counts: expectedSemanticCounts,
    observed_semantic_counts: stateValue.counts,
    writer_request_byte_length: writerRequestByteLength,
    active_release_generation: stateValue.active_pointer.generation,
    active_pointer_unchanged: true,
  };
}

const invocation = Object.freeze({ '--dry-run': 'DRY_RUN', '--apply': 'APPLY', '--verify': 'VERIFY' });
const mode = process.argv[2];
async function main() {
  if (!invocation[mode] || process.argv.length !== 3) {
    fail('Usage: node scripts/canonical-v2-staging-qxo-material-contracts.mjs --dry-run|--apply|--verify');
  }
  try {
    stage = 'GUARD_PROJECT';
    guardProject();
    stage = 'READ_EXACT_INPUTS';
    const inputs = readInputs();
    const activePointerBefore = inputs.active_pointer;
    stage = 'BUILD_CANONICAL_WRITE';
    const write = await buildWrite(inputs);
    const sql = writerSql(write);
    const writerRequestByteLength = Buffer.byteLength(sql, 'utf8');
    if (writerRequestByteLength > MAX_WRITER_REQUEST_BYTES) {
      throw new Error('The QXO material-contract semantic writer request exceeds its bounded transport limit.');
    }
    stage = 'READ_INITIAL_STATE';
    const before = readState(write);
    assertActivePointerUnchanged(activePointerBefore, before.active_pointer);
    if (invocation[mode] === 'VERIFY') {
      stage = 'VERIFY_COMMITTED_STATE';
      assertCommitted(write, before);
    } else {
      stage = 'ROLLBACK_WRITER_REQUEST';
      runSql(sql);
      const rolledBack = readState(write);
      if (canonicalJson(before) !== canonicalJson(rolledBack)) {
        throw new Error('Rollback-first QXO material-contract semantic run changed staging state.');
      }
      if (invocation[mode] === 'APPLY') {
        stage = 'COMMIT_WRITER_REQUEST';
        runSql(sql, { commit: true });
      }
    }
    stage = 'VERIFY_FINAL_STATE';
    const after = readState(write);
    assertActivePointerUnchanged(activePointerBefore, after.active_pointer);
    if (invocation[mode] !== 'DRY_RUN') assertCommitted(write, after);
    process.stdout.write(`${canonicalJson(attestation(
      write,
      invocation[mode] === 'APPLY' ? 'COMMITTED' : invocation[mode] === 'VERIFY' ? 'VERIFIED' : 'ROLLED_BACK',
      after,
      writerRequestByteLength,
    ))}\n`);
  } catch (error) {
    fail(error instanceof Error ? `${stage}: ${error.message}` : `${stage}: QXO material-contract run failed.`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
