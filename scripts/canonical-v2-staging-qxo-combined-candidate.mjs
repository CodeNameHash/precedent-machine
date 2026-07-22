#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { buildFixtureCandidateRelease, validateCandidateReleaseBundle } = require('../lib/canonical-v2/candidate-release');
const { importCandidateRelease, rollbackInactiveCandidateRelease } = require('../lib/canonical-v2/candidate-release-import');
const { recheckCandidateInputHead, selectTrustedCandidateInputs } = require('../lib/canonical-v2/candidate-input-authority');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildQxoCapitalisationServingSlice } = require('../lib/canonical-v2/qxo-capitalisation-serving-slice');
const { buildQxoNoShopActionsServingSlice } = require('../lib/canonical-v2/qxo-no-shop-actions-serving-slice');
const { buildQxoNoShopRematchServingSlice } = require('../lib/canonical-v2/qxo-no-shop-rematch-serving-slice');
const { buildQxoNoShopServingSlice } = require('../lib/canonical-v2/qxo-no-shop-serving-slice');
const { buildQxoMaterialContractsSlice } = require('../lib/canonical-v2/qxo-material-contracts-slice');
const {
  PROVISIONAL_CORPUS_RELEASE_ID,
  QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2,
  QXO_MATERIAL_CORPUS_RELEASE_ID_V2,
  QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2,
  QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS,
  buildQxoMaterialCombinedCandidateSeedV2,
  qxoMaterialCombinedCandidateReleaseId,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const { buildQxoReviewedCapitalisationSlice } = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { buildQxoAdmittedNoShopActionsSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice');
const { buildQxoAdmittedNoShopRematchSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-rematch-slice');
const { buildQxoAdmittedNoShopNoticeSlice } = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const DEAL_KEY = 'deal:qxo-topbuild';
const SOURCE_ADMISSION_ID = 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819';
const DEAL_VALUE_SOURCE_ADMISSION_ID = '8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const CAPITALISATION_CLOSURE_ID = 'cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596';
const NO_SHOP_CLOSURE_ID = '944c18cb24c5684c04eb3d2c9cae57f932c144790492bc1619ccd566d57a8a3e';
const ACTIONS_CLOSURE_ID = '89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b';
const REMATCH_CLOSURE_ID = 'dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8';
const MATERIAL_CLOSURE_ID = 'a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5';
const MATERIAL_METRIC_KEY = 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE';
const LEGACY_MATERIAL_CANDIDATE_MANIFEST_ID = '6e12a944361efe8c487e735c47cf6e9a9b25e98a49b85e31d7c80ba3fd05a78d';
const MATERIAL_INCOMPLETE_ROW_SERVING_KEY = '437f3b439417ded9691c061880f7325dff3a7e85d2b71870f12cd7d7aadbcb34';
const RELEASE_CONFIGS = Object.freeze({
  BASE: Object.freeze({
    corpusReleaseId: 'fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36',
    candidateManifestId: '620bcbba3b072f1a475989adad9e4ce708b4fce288fa59036e549dc82544b48d',
    servingNamespaceId: 'cb2d9e9db4e059b28d29f60012d25efec77b3eda2d33cf9911c434bcbb667b44',
  }),
  ACTIONS: Object.freeze({
    corpusReleaseId: '91cdee1d2cca11fdaa7141069c3daf9d048deabdbe36573bb214cafc7cf34430',
    candidateManifestId: 'db29af6e548def369bee9c2fbe2be16959078f9461746caa1854f4eeceaea43c',
    servingNamespaceId: '3ab6ca118c32bad5d5e9ce662a7c3f7cc06cddda03b7c717cccd6ed9dfa10a65',
  }),
  REMATCH: Object.freeze({
    corpusReleaseId: 'd9157984ee4948046c3cf7d3195cb0136502cdf739fc24dfd05d0ae7c60f1f5a',
    candidateManifestId: 'a9cbb8810053d13ad76efcffc769ddf83ed22d1cb446493967f281489182d0b2',
    servingNamespaceId: 'efa8f7c2643448ad9380a4a16556d76f09879809c1d21e49f479e8cf070f204d',
  }),
  MATERIAL: Object.freeze({
    corpusReleaseId: QXO_MATERIAL_CORPUS_RELEASE_ID_V2,
    candidateManifestId: '65d5afe597f48fa095176e941803fabeafc71922195b120a3d05bfc50f9276f1',
    servingNamespaceId: 'bd6715c4a8f0a75194b568fef10ee118fb63612e82b2ad90da0d0e0ef985bb9b',
  }),
});
const MAX_GRAPH_READ_BYTES = 4 * 1024 * 1024;
let currentStage = 'STARTUP';

function includesActions() {
  return mode.startsWith('--actions-') || mode.startsWith('--rematch-') || mode.startsWith('--material-');
}

function includesRematch() {
  return mode.startsWith('--rematch-') || mode.startsWith('--material-');
}

function includesMaterial() {
  return mode.startsWith('--material-');
}

function releaseConfig() {
  if (includesMaterial()) return RELEASE_CONFIGS.MATERIAL;
  if (includesRematch()) return RELEASE_CONFIGS.REMATCH;
  return includesActions() ? RELEASE_CONFIGS.ACTIONS : RELEASE_CONFIGS.BASE;
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
  if (!line) return 'Canonical QXO combined candidate database operation failed.';
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-combined-candidate-'));
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
      maxBuffer: 6 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    if (Buffer.byteLength(result.stdout, 'utf8') > MAX_GRAPH_READ_BYTES) {
      throw new Error('Canonical QXO combined graph read exceeded its bounded response limit.');
    }
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) throw new Error('Supabase returned no rows array.');
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_combined_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlRpcClient({ commit = false } = {}) {
  return {
    rpc(name, params) {
      let call;
      if (name === 'canonical_v2_select_candidate_inputs') {
        call = `public.canonical_v2_select_candidate_inputs(${sqlText(params.p_environment)}, ${sqlText(params.p_contract_fingerprint)})`;
      } else if (name === 'canonical_v2_recheck_candidate_input_head') {
        call = `public.canonical_v2_recheck_candidate_input_head(${sqlText(params.p_environment)}, ${sqlText(params.p_contract_fingerprint)}, ${sqlText(params.p_expected_candidate_input_head_id)}, ${sqlText(params.p_expected_candidate_input_head_payload_digest)})`;
      } else if (name === 'canonical_v2_import_candidate_release') {
        call = `public.canonical_v2_import_candidate_release('staging', ${sqlJson(params.p_import_plan)})`;
      } else if (name === 'canonical_v2_rollback_inactive_candidate_release') {
        call = `public.canonical_v2_rollback_inactive_candidate_release(
          'staging',
          ${sqlText(params.p_candidate_manifest_id)},
          ${sqlText(params.p_corpus_release_id)},
          ${sqlText(params.p_serving_namespace_id)},
          ${sqlText(params.p_candidate_release_import_plan_id)}
        )`;
      } else {
        return Promise.resolve({ data: null, error: { message: 'Unsupported canonical RPC.' } });
      }
      try {
        const rows = runSql(`SELECT ${call} AS result;`, { commit });
        return Promise.resolve({ data: rows[0]?.result ?? null, error: null });
      } catch (error) {
        return Promise.resolve({ data: null, error: { message: error.message } });
      }
    },
  };
}

function graphCollection(closureId, table, identity) {
  return `(SELECT coalesce(jsonb_agg(canonical_payload ORDER BY ${identity}), '[]'::jsonb)
    FROM canonical_v2_staging.${table} WHERE closure_id='${closureId}')`;
}

function readGraph() {
  const rows = runSql(`SELECT jsonb_build_object(
  'immutable_source_document', immutable.canonical_payload,
  'source_admission_manifest', admission.canonical_payload,
  'semantic_extraction_input_envelope', envelope.canonical_payload,
  'conversion', conversion.canonical_payload,
  'deal_value_source', (SELECT jsonb_build_object(
    'immutable_source_document', deal_value_immutable.canonical_payload,
    'source_admission_manifest', deal_value_admission.canonical_payload,
    'semantic_extraction_input_envelope', deal_value_envelope.canonical_payload,
    'conversion', deal_value_conversion.canonical_payload
  )
    FROM canonical_v2_staging.source_admission_manifests deal_value_admission
    JOIN canonical_v2_staging.immutable_source_documents deal_value_immutable
      ON deal_value_immutable.immutable_source_document_id=
        deal_value_admission.canonical_payload->>'immutable_source_document_id'
    JOIN canonical_v2_staging.semantic_extraction_input_envelopes deal_value_envelope
      ON deal_value_envelope.source_admission_manifest_id=deal_value_admission.source_admission_manifest_id
    JOIN canonical_v2_staging.canonical_text_conversions deal_value_conversion
      ON deal_value_conversion.canonical_text_id=deal_value_admission.canonical_payload->>'canonical_text_id'
    WHERE deal_value_admission.source_admission_manifest_id='${DEAL_VALUE_SOURCE_ADMISSION_ID}'),
  'deal', deal.canonical_payload,
  'capitalisation', jsonb_build_object(
    'excerpts', ${graphCollection(CAPITALISATION_CLOSURE_ID, 'excerpts', 'excerpt_id')},
    'provisions', ${graphCollection(CAPITALISATION_CLOSURE_ID, 'provision_instances', 'provision_instance_id')},
    'components', ${graphCollection(CAPITALISATION_CLOSURE_ID, 'provision_components', 'provision_component_id')},
    'claims', ${graphCollection(CAPITALISATION_CLOSURE_ID, 'claim_revisions', 'claim_revision_id')},
    'relationships', ${graphCollection(CAPITALISATION_CLOSURE_ID, 'relationship_revisions', 'relationship_revision_id')},
    'receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_CAPITALISATION_DEAL_SCOPE_V1')
  ),
  'no_shop', jsonb_build_object(
    'excerpts', ${graphCollection(NO_SHOP_CLOSURE_ID, 'excerpts', 'excerpt_id')},
    'provisions', ${graphCollection(NO_SHOP_CLOSURE_ID, 'provision_instances', 'provision_instance_id')},
    'components', ${graphCollection(NO_SHOP_CLOSURE_ID, 'provision_components', 'provision_component_id')},
    'claims', ${graphCollection(NO_SHOP_CLOSURE_ID, 'claim_revisions', 'claim_revision_id')},
    'relationships', ${graphCollection(NO_SHOP_CLOSURE_ID, 'relationship_revisions', 'relationship_revision_id')},
    'receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_NO_SHOP_NOTICE_DEAL_SCOPE_V1')
  ),
  'actions', jsonb_build_object(
    'excerpts', ${graphCollection(ACTIONS_CLOSURE_ID, 'excerpts', 'excerpt_id')},
    'provisions', ${graphCollection(ACTIONS_CLOSURE_ID, 'provision_instances', 'provision_instance_id')},
    'components', ${graphCollection(ACTIONS_CLOSURE_ID, 'provision_components', 'provision_component_id')},
    'claims', ${graphCollection(ACTIONS_CLOSURE_ID, 'claim_revisions', 'claim_revision_id')},
    'relationships', ${graphCollection(ACTIONS_CLOSURE_ID, 'relationship_revisions', 'relationship_revision_id')},
    'receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_NO_SHOP_ACTIONS_DEAL_SCOPE_V1')
  ),
  'rematch', jsonb_build_object(
    'excerpts', ${graphCollection(REMATCH_CLOSURE_ID, 'excerpts', 'excerpt_id')},
    'provisions', ${graphCollection(REMATCH_CLOSURE_ID, 'provision_instances', 'provision_instance_id')},
    'components', ${graphCollection(REMATCH_CLOSURE_ID, 'provision_components', 'provision_component_id')},
    'claims', ${graphCollection(REMATCH_CLOSURE_ID, 'claim_revisions', 'claim_revision_id')},
    'relationships', ${graphCollection(REMATCH_CLOSURE_ID, 'relationship_revisions', 'relationship_revision_id')},
    'receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_NO_SHOP_REMATCH_DEAL_SCOPE_V1')
  ),
  'material', jsonb_build_object(
    'excerpts', ${graphCollection(MATERIAL_CLOSURE_ID, 'excerpts', 'excerpt_id')},
    'provisions', ${graphCollection(MATERIAL_CLOSURE_ID, 'provision_instances', 'provision_instance_id')},
    'components', ${graphCollection(MATERIAL_CLOSURE_ID, 'provision_components', 'provision_component_id')},
    'claims', ${graphCollection(MATERIAL_CLOSURE_ID, 'claim_revisions', 'claim_revision_id')},
    'relationships', ${graphCollection(MATERIAL_CLOSURE_ID, 'relationship_revisions', 'relationship_revision_id')},
    'open_world_candidates', ${graphCollection(MATERIAL_CLOSURE_ID, 'open_world_candidates', 'candidate_id')},
    'open_world_candidate_occurrences', ${graphCollection(MATERIAL_CLOSURE_ID, 'open_world_candidate_occurrences', 'open_world_candidate_occurrence_id')},
    'open_world_evidence_references', ${graphCollection(MATERIAL_CLOSURE_ID, 'open_world_evidence_references', 'evidence_reference_id')},
    'open_world_candidate_dispositions', ${graphCollection(MATERIAL_CLOSURE_ID, 'open_world_candidate_dispositions', 'final_disposition_id')},
    'open_world_primitives', ${graphCollection(MATERIAL_CLOSURE_ID, 'open_world_primitives', 'primitive_id')},
    'semantic_impact_closures', ${graphCollection(MATERIAL_CLOSURE_ID, 'semantic_impact_closures', 'semantic_impact_closure_id')},
    'reviewed_source_specific_rows', ${graphCollection(MATERIAL_CLOSURE_ID, 'reviewed_source_specific_rows', 'reviewed_source_specific_row_serving_key')},
    'incomplete_canonical_result_rows', ${graphCollection(MATERIAL_CLOSURE_ID, 'incomplete_canonical_result_rows', 'incomplete_result_review_row_serving_key')},
    'receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_MATERIAL_CONTRACTS_DEAL_SCOPE_V1')
  ),
  'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers
    WHERE environment='staging')
) AS graph
FROM canonical_v2_staging.source_admission_manifests admission
JOIN canonical_v2_staging.immutable_source_documents immutable
  ON immutable.immutable_source_document_id=admission.canonical_payload->>'immutable_source_document_id'
JOIN canonical_v2_staging.semantic_extraction_input_envelopes envelope
  ON envelope.source_admission_manifest_id=admission.source_admission_manifest_id
JOIN canonical_v2_staging.canonical_text_conversions conversion
  ON conversion.canonical_text_id=admission.canonical_payload->>'canonical_text_id'
JOIN canonical_v2_staging.deals deal ON deal.deal_key='${DEAL_KEY}'
WHERE admission.source_admission_manifest_id='${SOURCE_ADMISSION_ID}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.graph) throw new Error('The exact admitted QXO combined graph must resolve once.');
  return rows[0].graph;
}

function sortBy(rows, key) {
  return [...rows].sort((left, right) => left[key].localeCompare(right[key]));
}

function assertFamilyParity({ graph, slice, closureId, label }) {
  const close = (rows) => rows.map((row) => ({ ...row, closure_id: closureId }));
  const expected = {
    excerpts: sortBy(close(Object.values(slice.excerpts)), 'excerpt_id'),
    provisions: sortBy(close(slice.provisions), 'provision_instance_id'),
    components: sortBy(close(slice.components), 'provision_component_id'),
    claims: sortBy(close(slice.claims), 'claim_revision_id'),
    relationships: sortBy(close(slice.relationships), 'relationship_revision_id'),
  };
  for (const key of ['excerpts', 'provisions', 'components', 'claims', 'relationships']) {
    if (canonicalJson(graph[key]) !== canonicalJson(expected[key])) {
      throw new Error(`Stored QXO ${label} ${key} do not match the reviewed admitted graph.`);
    }
  }
  const publishableCount = Object.values(expected).reduce((count, rows) => count + rows.length, 0);
  if (graph.receipt?.status !== 'COMMITTED'
    || graph.receipt?.operation !== 'DEAL_SCOPE_RUN'
    || graph.receipt?.publishableObjectCount !== publishableCount) {
    throw new Error(`Stored QXO ${label} semantic receipt is incomplete.`);
  }
}

function assertMaterialParity({ graph, slice }) {
  const collections = Object.freeze({
    excerpts: 'excerpt_id',
    provisions: 'provision_instance_id',
    components: 'provision_component_id',
    claims: 'claim_revision_id',
    relationships: 'relationship_revision_id',
    open_world_candidates: 'candidate_id',
    open_world_candidate_occurrences: 'open_world_candidate_occurrence_id',
    open_world_evidence_references: 'evidence_reference_id',
    open_world_candidate_dispositions: 'final_disposition_id',
    open_world_primitives: 'primitive_id',
    semantic_impact_closures: 'semantic_impact_closure_id',
    reviewed_source_specific_rows: 'reviewed_source_specific_row_serving_key',
    incomplete_canonical_result_rows: 'incomplete_result_review_row_serving_key',
  });
  let publishableCount = 0;
  for (const [key, identity] of Object.entries(collections)) {
    const expected = sortBy(slice.semantic_write_set[key], identity);
    publishableCount += expected.length;
    if (canonicalJson(graph[key]) !== canonicalJson(expected)) {
      throw new Error(`Stored QXO material-contract ${key} do not match the reviewed multi-source graph.`);
    }
  }
  if (graph.receipt?.status !== 'COMMITTED'
    || graph.receipt?.operation !== 'DEAL_SCOPE_RUN'
    || graph.receipt?.publishableObjectCount !== publishableCount) {
    throw new Error('Stored QXO material-contract semantic receipt is incomplete.');
  }
}

function releaseIds({
  contractBundle,
  capitalisationSlice,
  noShopSlice,
  actionsSlice,
  rematchSlice,
  materialSlice,
}) {
  if (includesMaterial()) {
    const candidateSeed = buildQxoMaterialCombinedCandidateSeedV2({
      contractFingerprint: contractBundle.fingerprint,
      materialReviewedMappingId: materialSlice.reviewed_mapping.reviewed_mapping_id,
      servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
      queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    });
    const corpusReleaseId = qxoMaterialCombinedCandidateReleaseId(candidateSeed);
    if (canonicalJson(candidateSeed) !== canonicalJson(QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2)
      || contentId('QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V2', candidateSeed)
        !== QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2
      || corpusReleaseId !== QXO_MATERIAL_CORPUS_RELEASE_ID_V2) {
      throw new Error('QXO material combined candidate seed identity has drifted.');
    }
    return {
      corpusReleaseId,
      servingNamespaceId: contentId('SERVING_NAMESPACE/V2', {
        schema_version: 'QXO_MATERIAL_COMBINED_SERVING_NAMESPACE/V2',
        governed_deal_key: DEAL_KEY,
        corpus_release_id: corpusReleaseId,
        candidate_seed_digest: QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2,
        serving_projection_version: SERVING_PROJECTION_VERSION_V2,
        query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
      }),
    };
  }
  const actionMappings = includesActions() ? [actionsSlice.reviewed_mapping.reviewed_mapping_id] : [];
  const actionClosures = includesActions() ? [ACTIONS_CLOSURE_ID] : [];
  const rematchMappings = includesRematch() ? [rematchSlice.reviewed_mapping.reviewed_mapping_id] : [];
  const rematchClosures = includesRematch() ? [REMATCH_CLOSURE_ID] : [];
  const seed = {
    schema_version: includesRematch()
      ? 'QXO_COMBINED_REMATCH_CANDIDATE_SEED/V1'
      : includesActions()
        ? 'QXO_COMBINED_ACTIONS_CANDIDATE_SEED/V1'
        : 'QXO_COMBINED_CANDIDATE_SEED/V1',
    contract_fingerprint: contractBundle.fingerprint,
    source_admission_manifest_id: SOURCE_ADMISSION_ID,
    semantic_closure_ids: [
      CAPITALISATION_CLOSURE_ID,
      NO_SHOP_CLOSURE_ID,
      ...actionClosures,
      ...rematchClosures,
    ].sort(),
    reviewed_mapping_ids: [
      capitalisationSlice.reviewed_mapping.reviewed_mapping_id,
      noShopSlice.reviewed_mapping.reviewed_mapping_id,
      ...actionMappings,
      ...rematchMappings,
    ].sort(),
    tier_c_policy: 'EXPLICIT_RESULT_NOT_COMPARABLE_PENDING_FREEZE_GATE',
  };
  return {
    corpusReleaseId: contentId('CORPUS_RELEASE/V1', seed),
    servingNamespaceId: contentId('SERVING_NAMESPACE/V1', {
      schema_version: includesRematch()
        ? 'QXO_COMBINED_REMATCH_SERVING_NAMESPACE/V1'
        : includesActions()
          ? 'QXO_COMBINED_ACTIONS_SERVING_NAMESPACE/V1'
          : 'QXO_COMBINED_SERVING_NAMESPACE/V1',
      contract_fingerprint: contractBundle.fingerprint,
      governed_deal_key: DEAL_KEY,
      reviewed_mapping_ids: seed.reviewed_mapping_ids,
    }),
  };
}

async function buildCandidate() {
  currentStage = 'COMPILE_CONTRACT';
  const contractBundle = compileFixtureContract();
  currentStage = 'READ_GRAPH';
  const graph = readGraph();
  currentStage = 'BUILD_SOURCE_CONTEXT';
  const sourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: graph.immutable_source_document,
    source_admission_manifest: graph.source_admission_manifest,
    semantic_extraction_input_envelope: graph.semantic_extraction_input_envelope,
    conversion: graph.conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
  });
  if (!graph.deal_value_source) throw new Error('The exact admitted QXO deal-value source chain is missing.');
  const dealValueSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: graph.deal_value_source.immutable_source_document,
    source_admission_manifest: graph.deal_value_source.source_admission_manifest,
    semantic_extraction_input_envelope: graph.deal_value_source.semantic_extraction_input_envelope,
    conversion: graph.deal_value_source.conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 1,
  });
  if (canonicalJson([
    sourceContext.source_admission_manifest_id,
    dealValueSourceContext.source_admission_manifest_id,
  ]) !== canonicalJson(QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS)) {
    throw new Error('The two admitted QXO source chains do not match the pinned material candidate seed.');
  }
  const deal = {
    deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    document_hash: sourceContext.document_hash,
  };
  if (canonicalJson(graph.deal) !== canonicalJson(deal)) throw new Error('Stored QXO deal admission has drifted.');
  currentStage = 'BUILD_REVIEWED_SLICES';
  const capitalisationSlice = buildQxoReviewedCapitalisationSlice({ sourceContext, contractBundle });
  const noShopSlice = buildQxoAdmittedNoShopNoticeSlice({ sourceContext, contractBundle });
  const actionsSlice = buildQxoAdmittedNoShopActionsSlice({ sourceContext, contractBundle });
  const rematchSlice = buildQxoAdmittedNoShopRematchSlice({ sourceContext, contractBundle });
  const materialProbe = includesMaterial() ? buildQxoMaterialContractsSlice({
    agreementSourceContext: sourceContext,
    agreementSourceAdmission: graph.source_admission_manifest,
    dealValueSourceContext,
    dealValueSourceAdmission: graph.deal_value_source.source_admission_manifest,
    contractBundle,
    corpusReleaseId: PROVISIONAL_CORPUS_RELEASE_ID,
  }) : null;
  currentStage = 'VERIFY_GRAPH_PARITY';
  assertFamilyParity({ graph: graph.capitalisation, slice: capitalisationSlice, closureId: CAPITALISATION_CLOSURE_ID, label: 'capitalisation' });
  assertFamilyParity({ graph: graph.no_shop, slice: noShopSlice, closureId: NO_SHOP_CLOSURE_ID, label: 'no-shop' });
  if (includesActions()) {
    assertFamilyParity({ graph: graph.actions, slice: actionsSlice, closureId: ACTIONS_CLOSURE_ID, label: 'no-shop actions' });
  }
  if (includesRematch()) {
    assertFamilyParity({ graph: graph.rematch, slice: rematchSlice, closureId: REMATCH_CLOSURE_ID, label: 'no-shop subsequent match' });
  }
  if (materialProbe) assertMaterialParity({ graph: graph.material, slice: materialProbe });
  currentStage = 'BUILD_RELEASE_IDENTITIES';
  const { corpusReleaseId, servingNamespaceId } = releaseIds({
    contractBundle,
    capitalisationSlice,
    noShopSlice,
    actionsSlice,
    rematchSlice,
    materialSlice: materialProbe,
  });
  currentStage = 'BUILD_SERVING_SLICES';
  const dealDimensions = {
    buyer: 'QXO',
    sector: null,
    merger_form: null,
    adviser_firms: [],
    lawyers: [],
    announce_year: null,
    deal_value_usd: null,
  };
  const capitalisationServing = buildQxoCapitalisationServingSlice({
    sourceContext,
    sourceAdmission: graph.source_admission_manifest,
    slice: capitalisationSlice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions,
  });
  const noShopServing = buildQxoNoShopServingSlice({
    sourceContext,
    sourceAdmission: graph.source_admission_manifest,
    slice: noShopSlice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions,
  });
  const actionsServing = includesActions() ? buildQxoNoShopActionsServingSlice({
    sourceContext,
    sourceAdmission: graph.source_admission_manifest,
    slice: actionsSlice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions,
  }) : null;
  const rematchServing = includesRematch() ? buildQxoNoShopRematchServingSlice({
    sourceContext,
    sourceAdmission: graph.source_admission_manifest,
    slice: rematchSlice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions,
  }) : null;
  const materialSlice = includesMaterial() ? buildQxoMaterialContractsSlice({
    agreementSourceContext: sourceContext,
    agreementSourceAdmission: graph.source_admission_manifest,
    dealValueSourceContext,
    dealValueSourceAdmission: graph.deal_value_source.source_admission_manifest,
    contractBundle,
    corpusReleaseId,
  }) : null;
  if (materialProbe && materialSlice.reviewed_mapping.reviewed_mapping_id
      !== materialProbe.reviewed_mapping.reviewed_mapping_id) {
    throw new Error('QXO material reviewed mapping depends on its release identity.');
  }
  if (capitalisationServing.release_readiness.status !== 'READY_FOR_CANDIDATE_RELEASE'
    || noShopServing.release_readiness.status !== 'READY_FOR_CANDIDATE_RELEASE'
    || (actionsServing && actionsServing.release_readiness.status !== 'READY_FOR_CANDIDATE_RELEASE')
    || (rematchServing && rematchServing.release_readiness.status !== 'READY_FOR_CANDIDATE_RELEASE')) {
    throw new Error('The QXO combined serving slices are not release-ready.');
  }
  currentStage = 'SELECT_CORRECTION_AUTHORITY';
  const authoritySelection = await selectTrustedCandidateInputs({
    client: sqlRpcClient(),
    contract_bundle: contractBundle,
  });
  currentStage = 'BUILD_CANDIDATE_RELEASE';
  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    ...(includesMaterial() ? {
      serving_projection_binding: {
        serving_projection_version: SERVING_PROJECTION_VERSION_V2,
        query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
      },
    } : {}),
    members: [
      ...capitalisationServing.candidate_release_members,
      ...noShopServing.candidate_release_members,
      ...(actionsServing?.candidate_release_members || []),
      ...(rematchServing?.candidate_release_members || []),
      ...(materialSlice ? [materialSlice.candidate_release_member] : []),
    ],
    correction_authority_selection: authoritySelection,
    deal_directory_entries: [{ application_deal_id: APPLICATION_DEAL_ID, governed_deal_key: DEAL_KEY }],
  });
  currentStage = 'VALIDATE_CANDIDATE_RELEASE';
  validateCandidateReleaseBundle(release);
  if (includesMaterial()) {
    const materialRowKey = materialSlice.incomplete_shared_row.row_serving_key;
    if (release.market_observations.length !== 8
      || release.market_exclusions.length !== 2
      || release.shared_rows.length !== 9
      || release.incomplete_canonical_rows?.length !== 1
      || release.query_records.length !== 8
      || release.exact_detail_packages.length !== 9
      || (MATERIAL_INCOMPLETE_ROW_SERVING_KEY !== null
        && materialRowKey !== MATERIAL_INCOMPLETE_ROW_SERVING_KEY)
      || release.query_records.some((record) => record.row_serving_key === materialRowKey)
      || release.market_observations.some((observation) => observation.metric_key === MATERIAL_METRIC_KEY)
      || release.market_exclusions.filter((exclusion) => exclusion.metric_key === MATERIAL_METRIC_KEY).length !== 1) {
      throw new Error('QXO material candidate release partitions are not exact.');
    }
  }
  const expected = releaseConfig();
  if ((expected.corpusReleaseId !== null
      && release.manifest.corpus_release_id !== expected.corpusReleaseId)
    || (expected.candidateManifestId !== null
      && release.manifest.candidate_release_manifest_id !== expected.candidateManifestId)
    || (expected.servingNamespaceId !== null
      && release.manifest.serving_namespace_id !== expected.servingNamespaceId)) {
    throw new Error(`QXO combined candidate release identity has drifted: ${JSON.stringify({
      expected,
      actual: {
        corpusReleaseId: release.manifest.corpus_release_id,
        candidateManifestId: release.manifest.candidate_release_manifest_id,
        servingNamespaceId: release.manifest.serving_namespace_id,
        materialIncompleteRowServingKey: includesMaterial()
          ? materialSlice.incomplete_shared_row.row_serving_key
          : null,
        roots: release.manifest.roots,
        correctionInputSealId: release.manifest.correction_input_seal_id,
      },
    })}`);
  }
  return {
    contractBundle,
    graph,
    sourceContext,
    capitalisationSlice,
    noShopSlice,
    actionsSlice,
    rematchSlice,
    materialSlice,
    dealValueSourceContext,
    capitalisationServing,
    noShopServing,
    actionsServing,
    rematchServing,
    authoritySelection,
    release,
  };
}

function readCandidateState(release) {
  const id = release.manifest.corpus_release_id;
  const rows = runSql(`SELECT jsonb_build_object(
  'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${id}'),
  'projection_version', (SELECT projection_version FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${id}'),
  'query_projection_contract_digest', (SELECT query_projection_contract_digest FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${id}'),
  'legacy_material_release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases
    WHERE corpus_release_id='${PROVISIONAL_CORPUS_RELEASE_ID}'
      AND candidate_manifest_id='${LEGACY_MATERIAL_CANDIDATE_MANIFEST_ID}'),
  'correction_input_seals', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_input_seals WHERE corpus_release_id='${id}'),
  'correction_discharges', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_discharges WHERE corpus_release_id='${id}'),
  'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='${id}'),
  'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='${id}'),
  'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='${id}'),
  'shared_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${id}'),
  'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id='${id}' AND canonical_payload->>'row_kind'='CANONICAL_RESULT'),
  'incomplete_canonical_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id='${id}' AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
  'selected_deal_shared_rows', (SELECT count(*)
    FROM canonical_v2_staging.deal_serving_directory directory
    JOIN canonical_v2_staging.shared_serving_rows row
      ON row.corpus_release_id=directory.corpus_release_id
      AND row.governed_deal_key=directory.governed_deal_key
    WHERE directory.corpus_release_id='${id}' AND directory.application_deal_id='${APPLICATION_DEAL_ID}'),
  'material_query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id='${id}' AND metric_key='${MATERIAL_METRIC_KEY}'
      AND canonical_payload->>'row_kind'='CANONICAL_RESULT'),
  'material_incomplete_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id='${id}' AND metric_key='${MATERIAL_METRIC_KEY}'
      AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
  'material_review_row_keys', (SELECT coalesce(jsonb_agg(row_serving_key ORDER BY row_serving_key), '[]'::jsonb)
    FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id='${id}' AND metric_key='${MATERIAL_METRIC_KEY}'
      AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
  'material_market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations
    WHERE corpus_release_id='${id}' AND metric_key='${MATERIAL_METRIC_KEY}'),
  'material_market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions
    WHERE corpus_release_id='${id}' AND metric_key='${MATERIAL_METRIC_KEY}'),
  'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='${id}'),
  'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts
    WHERE corpus_release_id='${id}' AND import_state='IMPORTED_COMPLETE'),
  'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers
    WHERE environment='staging')
) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('QXO combined candidate state could not be read.');
  return rows[0].state;
}

function assertImported(state, release) {
  const expected = {
    release_records: 1,
    correction_input_seals: 1,
    correction_discharges: release.correction_discharges.length,
    deal_directory_records: release.deal_directory_records.length,
    market_observations: release.market_observations.length,
    market_exclusions: release.market_exclusions.length,
    shared_rows: release.shared_rows.length,
    query_records: release.query_records.length,
    incomplete_canonical_records: release.incomplete_canonical_rows?.length || 0,
    exact_detail_packages: release.exact_detail_packages.length,
    complete_receipts: 1,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (Number(state[key]) !== value) throw new Error(`QXO combined candidate ${key} is ${state[key]}, expected ${value}.`);
  }
  if (includesMaterial() && (
    state.projection_version !== SERVING_PROJECTION_VERSION_V2
    || state.query_projection_contract_digest !== QUERY_PROJECTION_CONTRACT_DIGEST_V2
    || Number(state.legacy_material_release_records) !== 1
  )) throw new Error('QXO material v2 projection binding or immutable v1 predecessor has drifted.');
  if (includesMaterial() && (
    Number(state.selected_deal_shared_rows) !== 9
    || Number(state.material_query_records) !== 0
    || Number(state.material_incomplete_records) !== 1
    || canonicalJson(state.material_review_row_keys) !== canonicalJson([MATERIAL_INCOMPLETE_ROW_SERVING_KEY])
    || Number(state.material_market_observations) !== 0
    || Number(state.material_market_exclusions) !== 1
  )) throw new Error('QXO material selected-deal Review or market-query exclusion has drifted.');
}

function assertAbsent(state) {
  for (const key of [
    'release_records',
    'correction_input_seals',
    'correction_discharges',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
    'query_records',
    'incomplete_canonical_records',
    'exact_detail_packages',
    'complete_receipts',
  ]) if (Number(state[key]) !== 0) throw new Error(`QXO combined candidate ${key} remains after rollback.`);
  if (includesMaterial() && Number(state.legacy_material_release_records) !== 1) {
    throw new Error('QXO material v2 rollback changed its immutable v1 predecessor.');
  }
}

async function recheck(authoritySelection) {
  await recheckCandidateInputHead({
    client: sqlRpcClient(),
    candidate_input_head: authoritySelection.candidate_input_head,
  });
}

function attestation(candidate, mode, rollbackRehearsed = false) {
  const actionClosures = includesActions() ? [ACTIONS_CLOSURE_ID] : [];
  const actionMappings = includesActions()
    ? [candidate.actionsSlice.reviewed_mapping.reviewed_mapping_id]
    : [];
  const rematchClosures = includesRematch() ? [REMATCH_CLOSURE_ID] : [];
  const rematchMappings = includesRematch()
    ? [candidate.rematchSlice.reviewed_mapping.reviewed_mapping_id]
    : [];
  const materialClosures = includesMaterial() ? [MATERIAL_CLOSURE_ID] : [];
  const materialMappings = includesMaterial()
    ? [candidate.materialSlice.reviewed_mapping.reviewed_mapping_id]
    : [];
  return {
    schema_version: includesMaterial()
      ? 'QXO_MATERIAL_COMBINED_CANDIDATE_STAGING_ATTESTATION/V1'
      : includesRematch()
        ? 'QXO_COMBINED_REMATCH_CANDIDATE_STAGING_ATTESTATION/V1'
      : includesActions()
        ? 'QXO_COMBINED_ACTIONS_CANDIDATE_STAGING_ATTESTATION/V1'
        : 'QXO_COMBINED_CANDIDATE_STAGING_ATTESTATION/V1',
    environment: 'staging',
    mode,
    corpus_release_id: candidate.release.manifest.corpus_release_id,
    candidate_release_manifest_id: candidate.release.manifest.candidate_release_manifest_id,
    serving_namespace_id: candidate.release.manifest.serving_namespace_id,
    serving_projection_version: includesMaterial() ? SERVING_PROJECTION_VERSION_V2 : 'canonical-v2-serving/v1',
    query_projection_contract_digest: includesMaterial() ? QUERY_PROJECTION_CONTRACT_DIGEST_V2 : null,
    source_admission_manifest_id: candidate.sourceContext.source_admission_manifest_id,
    source_admission_manifest_ids: includesMaterial()
      ? QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS
      : [candidate.sourceContext.source_admission_manifest_id],
    semantic_closure_ids: [
      CAPITALISATION_CLOSURE_ID,
      NO_SHOP_CLOSURE_ID,
      ...actionClosures,
      ...rematchClosures,
      ...materialClosures,
    ].sort(),
    reviewed_mapping_ids: [
      candidate.capitalisationSlice.reviewed_mapping.reviewed_mapping_id,
      candidate.noShopSlice.reviewed_mapping.reviewed_mapping_id,
      ...actionMappings,
      ...rematchMappings,
      ...materialMappings,
    ].sort(),
    observations: candidate.release.market_observations.length,
    exclusions: candidate.release.market_exclusions.length,
    shared_rows: candidate.release.shared_rows.length,
    incomplete_canonical_rows: candidate.release.incomplete_canonical_rows?.length || 0,
    material_incomplete_row_serving_key: includesMaterial()
      ? candidate.materialSlice.incomplete_shared_row.row_serving_key
      : null,
    query_records: candidate.release.query_records.length,
    exact_detail_packages: candidate.release.exact_detail_packages.length,
    active_pointer_unchanged: true,
    rollback_rehearsed: rollbackRehearsed,
  };
}

const mode = process.argv[2];
const invocation = Object.freeze({
  '--dry-run': 'DRY_RUN',
  '--import': 'IMPORT',
  '--verify': 'VERIFY',
  '--rehearse-rollback': 'REHEARSE_ROLLBACK',
  '--actions-dry-run': 'DRY_RUN',
  '--actions-import': 'IMPORT',
  '--actions-verify': 'VERIFY',
  '--actions-rehearse-rollback': 'REHEARSE_ROLLBACK',
  '--rematch-dry-run': 'DRY_RUN',
  '--rematch-import': 'IMPORT',
  '--rematch-verify': 'VERIFY',
  '--rematch-rehearse-rollback': 'REHEARSE_ROLLBACK',
  '--material-dry-run': 'DRY_RUN',
  '--material-import': 'IMPORT',
  '--material-verify': 'VERIFY',
  '--material-rehearse-rollback': 'REHEARSE_ROLLBACK',
});
if (!invocation[mode] || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-combined-candidate.mjs --dry-run|--import|--verify|--rehearse-rollback|--actions-dry-run|--actions-import|--actions-verify|--actions-rehearse-rollback|--rematch-dry-run|--rematch-import|--rematch-verify|--rematch-rehearse-rollback|--material-dry-run|--material-import|--material-verify|--material-rehearse-rollback');
}

try {
  currentStage = 'GUARD_PROJECT';
  guardProject();
  if ([
    releaseConfig().corpusReleaseId,
    releaseConfig().candidateManifestId,
    releaseConfig().servingNamespaceId,
    ...(includesMaterial() ? [MATERIAL_INCOMPLETE_ROW_SERVING_KEY] : []),
  ].some((identity) => identity === null) && invocation[mode] !== 'DRY_RUN') {
    throw new Error('The combined candidate identities must be pinned before staging mutation.');
  }
  const candidate = await buildCandidate();
  currentStage = 'READ_CANDIDATE_STATE';
  const before = readCandidateState(candidate.release);
  if (invocation[mode] === 'VERIFY') {
    assertImported(before, candidate.release);
  } else if (invocation[mode] === 'REHEARSE_ROLLBACK') {
    assertImported(before, candidate.release);
    currentStage = 'ROLLBACK_IMPORTED_CANDIDATE';
    await rollbackInactiveCandidateRelease({
      client: sqlRpcClient({ commit: true }),
      release: candidate.release,
    });
    currentStage = 'VERIFY_CANDIDATE_ABSENT';
    const absent = readCandidateState(candidate.release);
    assertAbsent(absent);
    if (canonicalJson(absent.active_pointer) !== canonicalJson(before.active_pointer)) {
      throw new Error('QXO combined candidate rollback moved the active staging release pointer.');
    }
    currentStage = 'RECHECK_AUTHORITY_FOR_REIMPORT';
    await recheck(candidate.authoritySelection);
    currentStage = 'REIMPORT_ROLLED_BACK_CANDIDATE';
    await importCandidateRelease({
      client: sqlRpcClient({ commit: true }),
      release: candidate.release,
    });
    currentStage = 'VERIFY_REIMPORTED_CANDIDATE';
    const reimported = readCandidateState(candidate.release);
    assertImported(reimported, candidate.release);
    if (canonicalJson(reimported.active_pointer) !== canonicalJson(before.active_pointer)) {
      throw new Error('QXO combined candidate reimport moved the active staging release pointer.');
    }
  } else {
    currentStage = 'RECHECK_AUTHORITY_FOR_ROLLBACK';
    await recheck(candidate.authoritySelection);
    currentStage = 'ROLLBACK_IMPORT';
    await importCandidateRelease({
      client: sqlRpcClient(),
      release: candidate.release,
    });
    currentStage = 'VERIFY_ROLLBACK';
    const afterRollback = readCandidateState(candidate.release);
    if (canonicalJson(before) !== canonicalJson(afterRollback)) {
      throw new Error('Rollback-first QXO combined candidate import changed staging state.');
    }
    if (invocation[mode] === 'IMPORT') {
      currentStage = 'RECHECK_AUTHORITY_FOR_IMPORT';
      await recheck(candidate.authoritySelection);
      currentStage = 'IMPORT_CANDIDATE';
      await importCandidateRelease({
        client: sqlRpcClient({ commit: true }),
        release: candidate.release,
      });
      currentStage = 'VERIFY_IMPORTED_CANDIDATE';
      const imported = readCandidateState(candidate.release);
      assertImported(imported, candidate.release);
      if (canonicalJson(imported.active_pointer) !== canonicalJson(before.active_pointer)) {
        throw new Error('QXO combined candidate import moved the active staging release pointer.');
      }
    }
  }
  process.stdout.write(`${canonicalJson(attestation(
    candidate,
    invocation[mode] === 'IMPORT'
      ? 'IMPORTED_INACTIVE'
      : invocation[mode] === 'VERIFY'
        ? 'VERIFIED_INACTIVE'
        : invocation[mode] === 'REHEARSE_ROLLBACK'
          ? 'ROLLED_BACK_AND_REIMPORTED'
          : 'ROLLED_BACK',
    invocation[mode] === 'REHEARSE_ROLLBACK',
  ))}\n`);
} catch (error) {
  fail(error instanceof Error
    ? `${currentStage}: ${error.message}`
    : `${currentStage}: Canonical QXO combined candidate run failed.`);
}
