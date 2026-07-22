#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const {
  importCandidateRelease,
  rollbackInactiveCandidateRelease,
} = require('../lib/canonical-v2/candidate-release-import');
const {
  recheckCandidateInputHead,
  selectTrustedCandidateInputs,
} = require('../lib/canonical-v2/candidate-input-authority');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoCapitalisationServingSlice,
} = require('../lib/canonical-v2/qxo-capitalisation-serving-slice');
const {
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const DEAL_KEY = 'deal:qxo-topbuild';
const SOURCE_ADMISSION_ID = 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const SEMANTIC_CLOSURE_ID = 'cbb678180ec9951f12741a77a58f7ec03a6bebffbdc6e5d9fbea6add9beea596';
const EXPECTED_CORPUS_RELEASE_ID = 'd8630dc4dc8fc0a4d88d1e473cf111063b9e71ebc2f0616418236ec2e2f8d4f8';
const EXPECTED_CANDIDATE_MANIFEST_ID = '2d85d6a990292023e5a9249d1b39acfc89512a72b14e58c79c5e4b660fd9cdf9';
const EXPECTED_SERVING_NAMESPACE_ID = '4e6495edaef5005885278927d445701d4e38e04fea87dd91031f70887e12063d';
const MAX_GRAPH_READ_BYTES = 4 * 1024 * 1024;
let currentStage = 'STARTUP';

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
  if (!line) return 'Canonical QXO candidate database operation failed.';
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-candidate-'));
  const file = join(directory, commit ? 'commit.sql' : 'query.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='60000ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
  try {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--linked', '--file', file, '--output', 'json'],
      { cwd: ROOT, encoding: 'utf8', timeout: 90000, maxBuffer: 6 * 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    if (Buffer.byteLength(result.stdout, 'utf8') > MAX_GRAPH_READ_BYTES) {
      throw new Error('Canonical QXO graph read exceeded its bounded response limit.');
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
  const tag = `$qxo_candidate_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
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

function readGraph() {
  const rows = runSql(`SELECT jsonb_build_object(
  'immutable_source_document', immutable.canonical_payload,
  'source_admission_manifest', admission.canonical_payload,
  'semantic_extraction_input_envelope', envelope.canonical_payload,
  'conversion', conversion.canonical_payload,
  'deal', deal.canonical_payload,
  'excerpts', (SELECT coalesce(jsonb_agg(canonical_payload ORDER BY excerpt_id), '[]'::jsonb)
    FROM canonical_v2_staging.excerpts WHERE closure_id='${SEMANTIC_CLOSURE_ID}'),
  'provisions', (SELECT coalesce(jsonb_agg(canonical_payload ORDER BY provision_instance_id), '[]'::jsonb)
    FROM canonical_v2_staging.provision_instances WHERE closure_id='${SEMANTIC_CLOSURE_ID}'),
  'components', (SELECT coalesce(jsonb_agg(canonical_payload ORDER BY provision_component_id), '[]'::jsonb)
    FROM canonical_v2_staging.provision_components WHERE closure_id='${SEMANTIC_CLOSURE_ID}'),
  'claims', (SELECT coalesce(jsonb_agg(canonical_payload ORDER BY claim_revision_id), '[]'::jsonb)
    FROM canonical_v2_staging.claim_revisions WHERE closure_id='${SEMANTIC_CLOSURE_ID}'),
  'relationships', (SELECT coalesce(jsonb_agg(canonical_payload ORDER BY relationship_revision_id), '[]'::jsonb)
    FROM canonical_v2_staging.relationship_revisions WHERE closure_id='${SEMANTIC_CLOSURE_ID}'),
  'semantic_receipt', (SELECT canonical_payload FROM canonical_v2_staging.write_receipts
    WHERE operation='DEAL_SCOPE_RUN' AND idempotency_key='QXO_CAPITALISATION_DEAL_SCOPE_V1'),
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
JOIN canonical_v2_staging.deals deal
  ON deal.deal_key='${DEAL_KEY}'
WHERE admission.source_admission_manifest_id='${SOURCE_ADMISSION_ID}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.graph) {
    throw new Error('The exact admitted QXO semantic graph must resolve once.');
  }
  return rows[0].graph;
}

function sortBy(rows, key) {
  return [...rows].sort((left, right) => left[key].localeCompare(right[key]));
}

function assertGraphParity(graph, sourceContext, slice, contractBundle) {
  const closure = (rows) => rows.map((row) => ({ ...row, closure_id: SEMANTIC_CLOSURE_ID }));
  const expected = {
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: DEAL_ADMISSION_ID,
      document_hash: sourceContext.document_hash,
    },
    excerpts: sortBy(closure(Object.values(slice.excerpts)), 'excerpt_id'),
    provisions: sortBy(closure(slice.provisions), 'provision_instance_id'),
    components: sortBy(closure(slice.components), 'provision_component_id'),
    claims: sortBy(closure(slice.claims), 'claim_revision_id'),
    relationships: sortBy(closure(slice.relationships), 'relationship_revision_id'),
  };
  for (const key of ['deal', 'excerpts', 'provisions', 'components', 'claims', 'relationships']) {
    if (canonicalJson(graph[key]) !== canonicalJson(expected[key])) {
      throw new Error(`Stored QXO ${key} do not match the reviewed admitted graph.`);
    }
  }
  const expectedPublishableCount = expected.excerpts.length
    + expected.provisions.length
    + expected.components.length
    + expected.claims.length
    + expected.relationships.length;
  if (graph.semantic_receipt?.status !== 'COMMITTED'
    || graph.semantic_receipt?.operation !== 'DEAL_SCOPE_RUN'
    || graph.semantic_receipt?.publishableObjectCount !== expectedPublishableCount
    || sourceContext.deal_admission_id !== DEAL_ADMISSION_ID
    || !contractBundle.fingerprint) {
    throw new Error('Stored QXO semantic receipt or deal admission is incomplete.');
  }
}

function releaseIds({ contractBundle, slice }) {
  const seed = {
    schema_version: 'QXO_CAPITALISATION_CANDIDATE_SEED/V1',
    contract_fingerprint: contractBundle.fingerprint,
    source_admission_manifest_id: SOURCE_ADMISSION_ID,
    semantic_closure_id: SEMANTIC_CLOSURE_ID,
    reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
    tier_c_policy: 'EXPLICIT_RESULT_NOT_COMPARABLE_PENDING_FREEZE_GATE',
  };
  return {
    corpusReleaseId: contentId('CORPUS_RELEASE/V1', seed),
    servingNamespaceId: contentId('SERVING_NAMESPACE/V1', {
      schema_version: 'QXO_CAPITALISATION_SERVING_NAMESPACE/V1',
      contract_fingerprint: contractBundle.fingerprint,
      governed_deal_key: DEAL_KEY,
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
  currentStage = 'BUILD_REVIEWED_SLICE';
  const slice = buildQxoReviewedCapitalisationSlice({ sourceContext, contractBundle });
  currentStage = 'VERIFY_GRAPH_PARITY';
  assertGraphParity(graph, sourceContext, slice, contractBundle);
  currentStage = 'BUILD_RELEASE_IDENTITIES';
  const { corpusReleaseId, servingNamespaceId } = releaseIds({ contractBundle, slice });
  currentStage = 'BUILD_SERVING_SLICE';
  const serving = buildQxoCapitalisationServingSlice({
    sourceContext,
    sourceAdmission: graph.source_admission_manifest,
    slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: {
      buyer: 'QXO',
      sector: null,
      merger_form: null,
      adviser_firms: [],
      lawyers: [],
      announce_year: null,
      deal_value_usd: null,
    },
  });
  if (serving.release_readiness.status !== 'READY_FOR_CANDIDATE_RELEASE') {
    throw new Error('The QXO capitalisation serving slice is not release-ready.');
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
    members: serving.candidate_release_members,
    correction_authority_selection: authoritySelection,
    deal_directory_entries: [{
      application_deal_id: APPLICATION_DEAL_ID,
      governed_deal_key: DEAL_KEY,
    }],
  });
  currentStage = 'VALIDATE_CANDIDATE_RELEASE';
  validateCandidateReleaseBundle(release);
  if (release.manifest.corpus_release_id !== EXPECTED_CORPUS_RELEASE_ID
    || release.manifest.candidate_release_manifest_id !== EXPECTED_CANDIDATE_MANIFEST_ID
    || release.manifest.serving_namespace_id !== EXPECTED_SERVING_NAMESPACE_ID) {
    throw new Error('QXO candidate release identity has drifted from its rollback-first attestation.');
  }
  return { contractBundle, graph, sourceContext, slice, serving, authoritySelection, release };
}

function readCandidateState(release) {
  const id = release.manifest.corpus_release_id;
  const rows = runSql(`SELECT jsonb_build_object(
  'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id='${id}'),
  'correction_input_seals', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_input_seals WHERE corpus_release_id='${id}'),
  'correction_discharges', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_discharges WHERE corpus_release_id='${id}'),
  'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id='${id}'),
  'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id='${id}'),
  'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id='${id}'),
  'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id='${id}'),
  'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id='${id}'),
  'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts
    WHERE corpus_release_id='${id}' AND import_state='IMPORTED_COMPLETE'),
  'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers
    WHERE environment='staging')
) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('QXO candidate state could not be read.');
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
    query_records: release.query_records.length,
    exact_detail_packages: release.exact_detail_packages.length,
    complete_receipts: 1,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (Number(state[key]) !== value) throw new Error(`QXO candidate ${key} is ${state[key]}, expected ${value}.`);
  }
}

function assertAbsent(state) {
  for (const key of [
    'release_records',
    'correction_input_seals',
    'correction_discharges',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'query_records',
    'exact_detail_packages',
    'complete_receipts',
  ]) {
    if (Number(state[key]) !== 0) throw new Error(`QXO candidate ${key} remains after rollback.`);
  }
}

async function recheck(authoritySelection) {
  await recheckCandidateInputHead({
    client: sqlRpcClient(),
    candidate_input_head: authoritySelection.candidate_input_head,
  });
}

function attestation(candidate, mode, rollbackRehearsed = false) {
  return {
    schema_version: 'QXO_CAPITALISATION_CANDIDATE_STAGING_ATTESTATION/V1',
    environment: 'staging',
    mode,
    corpus_release_id: candidate.release.manifest.corpus_release_id,
    candidate_release_manifest_id: candidate.release.manifest.candidate_release_manifest_id,
    serving_namespace_id: candidate.release.manifest.serving_namespace_id,
    source_admission_manifest_id: candidate.sourceContext.source_admission_manifest_id,
    semantic_closure_id: SEMANTIC_CLOSURE_ID,
    reviewed_mapping_id: candidate.slice.reviewed_mapping.reviewed_mapping_id,
    observations: candidate.release.market_observations.length,
    exclusions: candidate.release.market_exclusions.length,
    shared_rows: candidate.release.shared_rows.length,
    exact_detail_packages: candidate.release.exact_detail_packages.length,
    active_pointer_unchanged: true,
    rollback_rehearsed: rollbackRehearsed,
  };
}

const mode = process.argv[2];
if (!['--dry-run', '--import', '--verify', '--rehearse-rollback'].includes(mode)
  || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-capitalisation-candidate.mjs --dry-run|--import|--verify|--rehearse-rollback');
}

try {
  currentStage = 'GUARD_PROJECT';
  guardProject();
  const candidate = await buildCandidate();
  currentStage = 'READ_CANDIDATE_STATE';
  const before = readCandidateState(candidate.release);
  if (mode === '--verify') {
    assertImported(before, candidate.release);
  } else if (mode === '--rehearse-rollback') {
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
      throw new Error('QXO candidate rollback moved the active staging release pointer.');
    }
    currentStage = 'RECHECK_AUTHORITY_FOR_REIMPORT';
    await recheck(candidate.authoritySelection);
    currentStage = 'REIMPORT_ROLLED_BACK_CANDIDATE';
    await importCandidateRelease({ client: sqlRpcClient({ commit: true }), release: candidate.release });
    currentStage = 'VERIFY_REIMPORTED_CANDIDATE';
    const reimported = readCandidateState(candidate.release);
    assertImported(reimported, candidate.release);
    if (canonicalJson(reimported.active_pointer) !== canonicalJson(before.active_pointer)) {
      throw new Error('QXO candidate reimport moved the active staging release pointer.');
    }
  } else {
    currentStage = 'RECHECK_AUTHORITY_FOR_ROLLBACK';
    await recheck(candidate.authoritySelection);
    currentStage = 'ROLLBACK_IMPORT';
    await importCandidateRelease({ client: sqlRpcClient(), release: candidate.release });
    currentStage = 'VERIFY_ROLLBACK';
    const afterRollback = readCandidateState(candidate.release);
    if (canonicalJson(before) !== canonicalJson(afterRollback)) {
      throw new Error('Rollback-first QXO candidate import changed staging state.');
    }
    if (mode === '--import') {
      currentStage = 'RECHECK_AUTHORITY_FOR_IMPORT';
      await recheck(candidate.authoritySelection);
      currentStage = 'IMPORT_CANDIDATE';
      await importCandidateRelease({ client: sqlRpcClient({ commit: true }), release: candidate.release });
      currentStage = 'VERIFY_IMPORTED_CANDIDATE';
      const imported = readCandidateState(candidate.release);
      assertImported(imported, candidate.release);
      if (canonicalJson(imported.active_pointer) !== canonicalJson(before.active_pointer)) {
        throw new Error('QXO candidate import moved the active staging release pointer.');
      }
    }
  }
  process.stdout.write(`${canonicalJson(attestation(
    candidate,
    mode === '--import'
      ? 'IMPORTED_INACTIVE'
      : mode === '--verify'
        ? 'VERIFIED_INACTIVE'
        : mode === '--rehearse-rollback'
          ? 'ROLLED_BACK_AND_REIMPORTED'
          : 'ROLLED_BACK',
    mode === '--rehearse-rollback',
  ))}\n`);
} catch (error) {
  fail(error instanceof Error
    ? `${currentStage}: ${error.message}`
    : `${currentStage}: Canonical QXO candidate run failed.`);
}
