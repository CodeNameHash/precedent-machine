#!/usr/bin/env node

// Option A generator for the QXO termination candidate under F2.
// SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md (read it first).
//
// Ben cannot run anything locally: he executes paste-ready SQL in the
// staging Supabase SQL Editor (project sjumbznveyyiizhwvixj). This script
// NEVER contacts Supabase. It consumes the JSON that Block 00
// (sql/optionA/00-read-lineage.sql) returns, reconstructs the two admitted
// SEC captures byte-for-byte (fetching the SEC documents live and verifying
// their pinned hashes), re-derives the full admission lineage, verifies
// EVERY pinned identity (any mismatch aborts — the paste-back cannot smuggle
// fabricated lineage past the content-id chain), rebuilds all six family
// slices under the versioned F2 contract, builds the candidate release and
// import plan, and writes the ordered paste files into
// sql/optionA/generated/ together with a digest attestation on stdout.
//
// Usage: node scripts/canonical-v2-staging-qxo-termination-optionA.mjs <block00-output.json>
//
// The input file is the JSON object produced by Block 00: {
//   "agreement_capture": <canonical_payload minus response_bytes_base64>,
//   "deal_value_capture": <canonical_payload minus response_bytes_base64>,
//   "active_pointer": <active_corpus_release_pointers.canonical_payload>
// }
//
// Correction authority: the candidate-input head chain is per-contract-
// fingerprint and staging's F2 head is the deterministic empty generation-1
// genesis (sql/optionA/01-f2-authority-genesis-apply.sql). The generator
// rebuilds that exact authority locally — no paste-back needed — and the
// import SQL rechecks the head IN the import transaction, so a drifted head
// aborts the paste.

import https from 'node:https';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { buildFixtureCandidateRelease, validateCandidateReleaseBundle } = require('../lib/canonical-v2/candidate-release');
const { buildCandidateReleaseImportPlan } = require('../lib/canonical-v2/candidate-release-import');
const { buildFixtureCandidateInputAuthority } = require('../__fixtures__/canonical-v2/candidate-input-authority');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV2 } = require('../lib/canonical-v2/contract-bundle');
const { validateSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const {
  PRIOR_QXO_SEMANTIC_CLOSURE_IDS,
  PROVISIONAL_CORPUS_RELEASE_ID,
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
  QXO_TERMINATION_CONTRACT_FINGERPRINT_V2,
  buildQxoTerminationCombinedCandidateSeed,
  qxoTerminationCombinedCandidateReleaseId,
  qxoTerminationCombinedServingNamespaceId,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const { buildQxoReviewedCapitalisationSlice } = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { buildQxoAdmittedNoShopActionsSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice');
const { buildQxoAdmittedNoShopRematchSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-rematch-slice');
const { buildQxoAdmittedNoShopNoticeSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice');
const { buildQxoCapitalisationServingSlice } = require('../lib/canonical-v2/qxo-capitalisation-serving-slice');
const { buildQxoNoShopActionsServingSlice } = require('../lib/canonical-v2/qxo-no-shop-actions-serving-slice');
const { buildQxoNoShopRematchServingSlice } = require('../lib/canonical-v2/qxo-no-shop-rematch-serving-slice');
const { buildQxoNoShopServingSlice } = require('../lib/canonical-v2/qxo-no-shop-serving-slice');
const { buildQxoMaterialContractsSlice } = require('../lib/canonical-v2/qxo-material-contracts-slice');
const { buildQxoTerminationFeeAdmittedSlice } = require('../lib/canonical-v2/qxo-termination-fee-admitted-slice');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'sql', 'optionA', 'generated');
const DEAL_KEY = 'deal:qxo-topbuild';
const APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const TERMINATION_DEAL_SCOPE_KEY = 'QXO_TERMINATION_FEE_DEAL_SCOPE_V1';
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
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
const CLOSURES = Object.freeze({
  capitalisation: 'cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596',
  noShop: '944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e',
  actions: '89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b',
  rematch: 'dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8',
  material: QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
});
// F1 head, pinned from docs/certification/evidence/P1-VERTICAL-SLICE-
// ATTESTATION.json — a Block 00 sanity value only.
const EXPECTED_F1_HEAD = Object.freeze({
  candidate_input_head_id: '47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf',
  candidate_input_head_payload_digest: '6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47',
});
// F2 head: the deterministic empty generation-1 genesis this packet seeds
// (sql/optionA/01-f2-authority-genesis-apply.sql). Recomputed at runtime and
// asserted against these pins before any SQL is emitted.
const EXPECTED_HEAD = Object.freeze({
  candidate_input_head_id: '614bb1f8162c5bf2f4c7c857c7701025390fd9cd33a4c4d711dc359a664d427a',
  candidate_input_head_payload_digest: 'bedabdc3f0a46eb500d3165e0b1be5b26036ac494949d9118b3999696a762868',
});
const EXPECTED_ACTIVE = Object.freeze({
  pointer: 'eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b',
  corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3',
  generation: 8,
});
const RETRIEVAL_POLICY_HEADERS = Object.freeze({
  'User-Agent': 'Deal Corpus canonical intake bengoodchild@gmail.com',
  Accept: 'text/html',
  'Accept-Encoding': 'identity',
});

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function fetchExact(url) {
  return new Promise((resolveFetch, reject) => {
    const request = https.get(url, { headers: RETRIEVAL_POLICY_HEADERS }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolveFetch(Buffer.concat(chunks)));
    });
    request.on('error', reject);
    request.setTimeout(30000, () => request.destroy(new Error('SEC retrieval timed out.')));
  });
}

async function reconstructCapture(pin, pastedPayload) {
  if (!pastedPayload || typeof pastedPayload !== 'object' || 'response_bytes_base64' in pastedPayload) {
    throw new Error('Each pasted capture must be canonical_payload minus response_bytes_base64.');
  }
  const bytes = await fetchExact(pin.url);
  if (bytes.length !== pin.response_byte_length || sha256(bytes) !== pin.response_bytes_sha256) {
    throw new Error(`SEC bytes for ${pin.url} do not match their pinned admission hashes.`);
  }
  const capture = { ...pastedPayload, response_bytes_base64: bytes.toString('base64') };
  validateSecEdgarIntakeCapture(capture);
  if (capture.retrieval_url_sha256 !== pin.retrieval_url_sha256
    || capture.response_bytes_sha256 !== pin.response_bytes_sha256
    || capture.response_byte_length !== pin.response_byte_length) {
    throw new Error(`Reconstructed capture for ${pin.url} does not match its pinned identity.`);
  }
  return capture;
}

function admissionChain(capture, pin) {
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  if (bundle.source_admission_manifest.source_admission_manifest_id !== pin.source_admission_manifest_id) {
    throw new Error(`Re-derived source admission for ${pin.url} does not match the staged manifest id.`);
  }
  const artifact = buildSourceArtifactChunks(conversion);
  return { conversion, verification, bundle, artifact };
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

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$optionA_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

async function terminationWriterRequest({ contractBundle, chains, termination }) {
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const prerequisites = [
    { operation: 'INTAKE_CAPTURE', idempotencyKey: 'QXO_SEC_EDGAR_ORIGINAL_V1', writeSet: { intake_capture: chains.agreement.capture } },
    { operation: 'INTAKE_CAPTURE', idempotencyKey: 'QXO_DEAL_VALUE_SEC_INTAKE_V1', writeSet: { intake_capture: chains.dealValue.capture } },
  ];
  for (const input of prerequisites) await writer.write(input);
  for (const [name, admissionKey] of [
    ['agreement', 'QXO_SEC_SOURCE_ADMISSION_V2'],
    ['dealValue', 'QXO_DEAL_VALUE_SEC_SOURCE_ADMISSION_V1'],
  ]) {
    const chain = chains[name];
    for (const chunk of chain.artifact.chunks) {
      await writer.write({
        operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
        idempotencyKey: `OPTION_A_${name}_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
        writeSet: { source_artifact_manifest: chain.artifact.manifest, source_artifact_chunk: chunk },
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
  const input = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: TERMINATION_DEAL_SCOPE_KEY,
    writeSet: termination.semantic_write_set,
  };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  const sql = `SELECT public.canonical_v2_write(
  'staging', 'DEAL_SCOPE_RUN', '${TERMINATION_DEAL_SCOPE_KEY}', '${dryRun.inputDigest}',
  ${sqlJson(input.writeSet)}, '[]'::jsonb, '[]'::jsonb,
  ${sqlJson(committed.receipt)}
) AS result;`;
  if (Buffer.byteLength(sql, 'utf8') > MAX_WRITER_REQUEST_BYTES) {
    throw new Error('The termination DEAL_SCOPE_RUN writer request exceeds its bounded transport limit.');
  }
  return { sql, inputDigest: dryRun.inputDigest, receipt: committed.receipt };
}

function transaction(body, { commit }) {
  return `BEGIN;
SET LOCAL statement_timeout='120000ms';
${body}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`;
}

function recheckSql(contractFingerprint) {
  return `SELECT public.canonical_v2_recheck_candidate_input_head(
  'staging', '${contractFingerprint}',
  '${EXPECTED_HEAD.candidate_input_head_id}',
  '${EXPECTED_HEAD.candidate_input_head_payload_digest}'
) AS recheck;`;
}

function verifyBeforeSql(releaseId) {
  return `-- 01-verify-before: read-only preconditions. Every row of the result must
-- read exactly as the committed expectations in the runbook.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
SELECT jsonb_build_object(
  'active_pointer_generation', (SELECT generation FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'active_pointer_release', (SELECT canonical_payload->>'corpus_release_id' FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'f1_head_unmoved', (SELECT count(*)=1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging' AND contract_fingerprint='56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d'
      AND candidate_input_head_id='${EXPECTED_F1_HEAD.candidate_input_head_id}'
      AND candidate_input_head_payload_digest='${EXPECTED_F1_HEAD.candidate_input_head_payload_digest}'),
  'f2_head_seeded', (SELECT count(*)=1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging' AND contract_fingerprint='${QXO_TERMINATION_CONTRACT_FINGERPRINT_V2}'
      AND candidate_input_head_id='${EXPECTED_HEAD.candidate_input_head_id}'
      AND candidate_input_head_payload_digest='${EXPECTED_HEAD.candidate_input_head_payload_digest}'),
  'new_release_absent', (SELECT count(*)=0 FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${releaseId}'),
  'capitalisation_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${CLOSURES.capitalisation}'),
  'no_shop_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${CLOSURES.noShop}'),
  'actions_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${CLOSURES.actions}'),
  'rematch_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${CLOSURES.rematch}'),
  'material_graph', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${CLOSURES.material}'),
  'termination_write_absent', (SELECT count(*)=0 FROM canonical_v2_staging.write_receipts WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='${TERMINATION_DEAL_SCOPE_KEY}')
) AS before_state;
ROLLBACK;
`;
}

function verifyAfterSql({ releaseId, release, closureId }) {
  return `-- 06-verify-after: read-only post-import verification. Compare against the
-- expected values in the runbook (all counts must match; the active pointer
-- must be unchanged).
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
SELECT jsonb_build_object(
  'active_pointer_generation', (SELECT generation FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'active_pointer_release', (SELECT canonical_payload->>'corpus_release_id' FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment='staging'),
  'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${releaseId}'),
  'projection_version', (SELECT projection_version FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${releaseId}'),
  'shared_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${releaseId}'),
  'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${releaseId}' AND canonical_payload->>'row_kind'='CANONICAL_RESULT'),
  'incomplete_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${releaseId}' AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
  'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='${releaseId}'),
  'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='${releaseId}'),
  'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='${releaseId}'),
  'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='${releaseId}'),
  'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id='${releaseId}' AND import_state='IMPORTED_COMPLETE'),
  'termination_fee_row', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${releaseId}' AND metric_key='SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE'),
  'termination_graph_provisions', (SELECT count(*) FROM canonical_v2_staging.provision_instances WHERE closure_id='${closureId}'),
  'termination_graph_relationships', (SELECT count(*) FROM canonical_v2_staging.relationship_revisions WHERE closure_id='${closureId}')
) AS after_state;
ROLLBACK;
-- Expected: shared_rows=${release.shared_rows.length}, query_records=${release.query_records.length},
-- incomplete_records=${release.incomplete_canonical_rows?.length || 0}, market_observations=${release.market_observations.length},
-- market_exclusions=${release.market_exclusions.length}, exact_detail_packages=${release.exact_detail_packages.length},
-- deal_directory_records=${release.deal_directory_records.length}, complete_receipts=1,
-- termination_fee_row=1, termination_graph_provisions=7, termination_graph_relationships=6,
-- active pointer generation ${EXPECTED_ACTIVE.generation} / release ${EXPECTED_ACTIVE.corpus_release_id} (UNCHANGED).
`;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath || process.argv.length !== 3) {
    fail('Usage: node scripts/canonical-v2-staging-qxo-termination-optionA.mjs <block00-output.json>');
  }
  const pasted = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
  const contractBundle = compileFixtureContractV2();
  if (contractBundle.fingerprint !== QXO_TERMINATION_CONTRACT_FINGERPRINT_V2) {
    throw new Error('compileFixtureContractV2 no longer produces the pinned F2 fingerprint.');
  }

  process.stderr.write('Reconstructing admitted captures from SEC bytes + pasted lineage...\n');
  const agreementCapture = await reconstructCapture(SOURCES.agreement, pasted.agreement_capture);
  const dealValueCapture = await reconstructCapture(SOURCES.dealValue, pasted.deal_value_capture);
  const chains = {
    agreement: { capture: agreementCapture, ...admissionChain(agreementCapture, SOURCES.agreement) },
    dealValue: { capture: dealValueCapture, ...admissionChain(dealValueCapture, SOURCES.dealValue) },
  };
  const agreementContext = sourceContext(chains.agreement, 0);
  const dealValueContext = sourceContext(chains.dealValue, 1);

  process.stderr.write('Rebuilding the deterministic F2 correction authority...\n');
  const authoritySelection = buildFixtureCandidateInputAuthority({ contractBundle });
  if (authoritySelection.candidate_input_head.candidate_input_head_id !== EXPECTED_HEAD.candidate_input_head_id
    || authoritySelection.candidate_input_head.canonical_payload_digest !== EXPECTED_HEAD.candidate_input_head_payload_digest) {
    throw new Error('The recomputed F2 genesis head does not match its pinned identity. STOP: re-pin deliberately.');
  }
  if (pasted.active_pointer?.corpus_release_id !== EXPECTED_ACTIVE.corpus_release_id) {
    throw new Error('The active staging release is not the pinned F1 release. STOP and investigate.');
  }

  process.stderr.write('Rebuilding family slices under F2...\n');
  const capitalisationSlice = buildQxoReviewedCapitalisationSlice({ sourceContext: agreementContext, contractBundle });
  const noShopSlice = buildQxoAdmittedNoShopNoticeSlice({ sourceContext: agreementContext, contractBundle });
  const actionsSlice = buildQxoAdmittedNoShopActionsSlice({ sourceContext: agreementContext, contractBundle });
  const rematchSlice = buildQxoAdmittedNoShopRematchSlice({ sourceContext: agreementContext, contractBundle });
  const materialProbe = buildQxoMaterialContractsSlice({
    agreementSourceContext: agreementContext,
    agreementSourceAdmission: chains.agreement.bundle.source_admission_manifest,
    dealValueSourceContext: dealValueContext,
    dealValueSourceAdmission: chains.dealValue.bundle.source_admission_manifest,
    contractBundle,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
  });
  if (materialProbe.reviewed_mapping.reviewed_mapping_id !== QXO_MATERIAL_REVIEWED_MAPPING_ID) {
    throw new Error('The re-derived material reviewed mapping does not match its pinned identity.');
  }

  // The termination mapping needs no release identity; probe with a
  // provisional pair to fix the mapping id, then bind the real release.
  const terminationProbe = buildQxoTerminationFeeAdmittedSlice({
    agreementSourceContext: agreementContext,
    agreementSourceAdmission: chains.agreement.bundle.source_admission_manifest,
    dealValueSourceContext: dealValueContext,
    dealValueSourceAdmission: chains.dealValue.bundle.source_admission_manifest,
    contractBundle,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
    servingNamespaceId: contentId('SERVING_NAMESPACE/V1', 'qxo-termination-provisional-probe'),
  });
  const seed = buildQxoTerminationCombinedCandidateSeed({
    contractFingerprint: contractBundle.fingerprint,
    materialReviewedMappingId: materialProbe.reviewed_mapping.reviewed_mapping_id,
    terminationReviewedMappingId: terminationProbe.reviewed_mapping.reviewed_mapping_id,
    servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
    queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  });
  const corpusReleaseId = qxoTerminationCombinedCandidateReleaseId(seed);
  const servingNamespaceId = qxoTerminationCombinedServingNamespaceId(seed);

  const termination = buildQxoTerminationFeeAdmittedSlice({
    agreementSourceContext: agreementContext,
    agreementSourceAdmission: chains.agreement.bundle.source_admission_manifest,
    dealValueSourceContext: dealValueContext,
    dealValueSourceAdmission: chains.dealValue.bundle.source_admission_manifest,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  });
  if (termination.reviewed_mapping.reviewed_mapping_id !== terminationProbe.reviewed_mapping.reviewed_mapping_id) {
    throw new Error('The termination reviewed mapping depends on its release identity (it must not).');
  }
  const materialSlice = buildQxoMaterialContractsSlice({
    agreementSourceContext: agreementContext,
    agreementSourceAdmission: chains.agreement.bundle.source_admission_manifest,
    dealValueSourceContext: dealValueContext,
    dealValueSourceAdmission: chains.dealValue.bundle.source_admission_manifest,
    contractBundle,
    corpusReleaseId,
  });

  process.stderr.write('Rebuilding serving slices + release under F2...\n');
  const dealDimensions = {
    buyer: 'QXO',
    sector: null,
    merger_form: null,
    adviser_firms: [],
    lawyers: [],
    announce_year: null,
    deal_value_usd: null,
  };
  const servingArgs = (slice) => ({
    sourceContext: agreementContext,
    sourceAdmission: chains.agreement.bundle.source_admission_manifest,
    slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions,
  });
  const capitalisationServing = buildQxoCapitalisationServingSlice(servingArgs(capitalisationSlice));
  const noShopServing = buildQxoNoShopServingSlice(servingArgs(noShopSlice));
  const actionsServing = buildQxoNoShopActionsServingSlice(servingArgs(actionsSlice));
  const rematchServing = buildQxoNoShopRematchServingSlice(servingArgs(rematchSlice));

  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: [
      ...capitalisationServing.candidate_release_members,
      ...noShopServing.candidate_release_members,
      ...actionsServing.candidate_release_members,
      ...rematchServing.candidate_release_members,
      materialSlice.candidate_release_member,
      termination.candidate_release_member,
    ],
    correction_authority_selection: authoritySelection,
    deal_directory_entries: [{ application_deal_id: APPLICATION_DEAL_ID, governed_deal_key: DEAL_KEY }],
  });
  validateCandidateReleaseBundle(release);
  if (release.manifest.corpus_release_id !== corpusReleaseId
    || release.manifest.serving_namespace_id !== servingNamespaceId
    || release.market_observations.length !== 9
    || release.market_exclusions.length !== 2
    || release.shared_rows.length !== 10
    || (release.incomplete_canonical_rows?.length || 0) !== 1
    || release.query_records.length !== 9
    || release.exact_detail_packages.length !== 10) {
    throw new Error(`The F2 release partitions are not exact: ${JSON.stringify({
      observations: release.market_observations.length,
      exclusions: release.market_exclusions.length,
      shared_rows: release.shared_rows.length,
      incomplete: release.incomplete_canonical_rows?.length || 0,
      query_records: release.query_records.length,
      packages: release.exact_detail_packages.length,
    })}`);
  }

  const importPlan = buildCandidateReleaseImportPlan({ release });
  const writerRequest = await terminationWriterRequest({ contractBundle, chains, termination });

  process.stderr.write('Writing paste files...\n');
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = {
    '01-verify-before.sql': verifyBeforeSql(corpusReleaseId),
    '02-termination-deal-scope-dry-run.sql': transaction(writerRequest.sql, { commit: false }),
    '03-termination-deal-scope-apply.sql': transaction(writerRequest.sql, { commit: true }),
    '04-import-dry-run.sql': transaction(
      `${recheckSql(contractBundle.fingerprint)}
SELECT public.canonical_v2_import_candidate_release('staging', ${sqlJson(importPlan)}) AS import_result;`,
      { commit: false },
    ),
    '05-import-apply.sql': transaction(
      `${recheckSql(contractBundle.fingerprint)}
SELECT public.canonical_v2_import_candidate_release('staging', ${sqlJson(importPlan)}) AS import_result;`,
      { commit: true },
    ),
    '06-verify-after.sql': verifyAfterSql({
      releaseId: corpusReleaseId,
      release,
      closureId: termination.semantic_closure_id,
    }),
    '07-rollback-rehearsal.sql': `-- OPTIONAL rollback rehearsal (run ONLY if Ben decides to rehearse; the
-- import stays INACTIVE either way). Removes the inactive candidate; re-run
-- 04/05 afterwards to re-import.
${transaction(`SELECT public.canonical_v2_rollback_inactive_candidate_release(
  'staging',
  '${release.manifest.candidate_release_manifest_id}',
  '${corpusReleaseId}',
  '${servingNamespaceId}',
  '${importPlan.candidate_release_import_plan_id}'
) AS rollback_result;`, { commit: true })}`,
  };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(OUTPUT_DIR, name), body);
  }

  const attestation = {
    schema_version: 'QXO_TERMINATION_F2_OPTION_A_ATTESTATION/V1',
    contract_fingerprint: contractBundle.fingerprint,
    termination_reviewed_mapping_id: termination.reviewed_mapping.reviewed_mapping_id,
    termination_row_serving_key: termination.shared_row.row_serving_key,
    termination_semantic_closure_id: termination.semantic_closure_id,
    termination_deal_scope_input_digest: writerRequest.inputDigest,
    candidate_seed_digest: contentId('QXO_TERMINATION_COMBINED_CANDIDATE_SEED/V1', seed),
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    candidate_release_manifest_id: release.manifest.candidate_release_manifest_id,
    candidate_release_import_plan_id: importPlan.candidate_release_import_plan_id,
    correction_input_seal_id: release.manifest.correction_input_seal_id,
    prior_semantic_closure_ids: [...PRIOR_QXO_SEMANTIC_CLOSURE_IDS, QXO_MATERIAL_SEMANTIC_CLOSURE_ID].sort(),
    observations: release.market_observations.length,
    shared_rows: release.shared_rows.length,
    exact_detail_packages: release.exact_detail_packages.length,
    import_plan_bytes: Buffer.byteLength(canonicalJson(importPlan), 'utf8'),
    output_directory: 'sql/optionA/generated',
  };
  process.stdout.write(`${canonicalJson(attestation)}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.stack || error.message : 'Option A generation failed.'));
