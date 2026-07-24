#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { buildMultiDealCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { queryCanonicalResultPage } = require('../lib/canonical-v2/query-result');
const {
  CASES,
  CONTRACT_FINGERPRINT,
  EXPECTED_AUTHORITY,
  EXPECTED_RELEASE,
  TEST_FILE,
  buildVerticalSliceAttestation,
} = require('../lib/canonical-v2/vertical-slice-attestation');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const PARAM_KEYS = Object.freeze([
  'p_environment', 'p_serving_namespace_id', 'p_corpus_release_id', 'p_contract_fingerprint',
  'p_query_semantics_digest', 'p_metric_key', 'p_metric_version', 'p_concept_key',
  'p_party_role', 'p_party_value', 'p_party_capacity', 'p_basis_key', 'p_sector', 'p_buyer',
  'p_merger_form', 'p_adviser_either', 'p_lawyer_either', 'p_year_from', 'p_year_to',
  'p_min_value_usd', 'p_max_value_usd', 'p_min_canonical_value', 'p_max_canonical_value',
  'p_fee_side', 'p_payer_capacity', 'p_payee_capacity', 'p_trigger_code',
  'p_payment_timing', 'p_trigger_condition', 'p_criterion_code',
  'p_contract_scope_code', 'p_cash_flow_direction_code', 'p_measurement_period_code',
  'p_comparison_operator', 'p_page_size', 'p_after_governed_deal_key', 'p_after_row_serving_key',
]);

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

function parseRows(stdout) {
  const payload = JSON.parse(stdout);
  if (!Array.isArray(payload?.rows)) throw new Error('Supabase returned no rows array.');
  return payload.rows;
}

function safeDiagnostic(output) {
  const line = String(output || '').split('\n').find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item));
  return line
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i)).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    : 'Canonical P1 staging evidence query failed.';
}

function readOnlySql(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-p1-'));
  const file = join(directory, 'evidence.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;\nSET LOCAL statement_timeout='5000ms';\n${sql}\nCOMMIT;\n`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    return parseRows(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readState() {
  const rows = readOnlySql(`
    SELECT jsonb_build_object(
      'active_release', jsonb_build_object(
        'generation', active.generation,
        'corpus_release_id', active.corpus_release_id,
        'serving_namespace_id', active.serving_namespace_id,
        'candidate_manifest_id', active.candidate_manifest_id,
        'correction_input_seal_id', active.correction_input_seal_id,
        'correction_input_root', active.correction_input_root,
        'candidate_release_import_plan_id', active.candidate_release_import_plan_id
      ),
      'authority', jsonb_build_object(
        'input_generation', head.input_generation,
        'candidate_input_head_id', head.candidate_input_head_id,
        'candidate_input_head_payload_digest', head.candidate_input_head_payload_digest,
        'correction_discharge_map_id', head.correction_discharge_map_id,
        'correction_discharge_map_payload_digest', head.correction_discharge_map_payload_digest
      ),
      'binding_ok',
        release.contract_fingerprint = '${CONTRACT_FINGERPRINT}'
        AND receipt.import_state = 'IMPORTED_COMPLETE'
        AND receipt.corpus_release_id = active.corpus_release_id
        AND receipt.serving_namespace_id = active.serving_namespace_id
        AND receipt.correction_input_seal_id = active.correction_input_seal_id
        AND receipt.correction_input_root = active.correction_input_root
        AND receipt.candidate_input_head_id = head.candidate_input_head_id
        AND receipt.candidate_input_head_payload_digest = head.candidate_input_head_payload_digest
        AND receipt.correction_discharge_map_id = head.correction_discharge_map_id
        AND receipt.correction_discharge_map_payload_digest = head.correction_discharge_map_payload_digest
        AND map.correction_discharge_map_payload_digest = head.correction_discharge_map_payload_digest
    ) AS state
    FROM canonical_v2_staging.active_corpus_release_pointers active
    JOIN canonical_v2_staging.fixture_corpus_releases release
      ON release.corpus_release_id = active.corpus_release_id
    JOIN canonical_v2_staging.candidate_release_import_receipts receipt
      ON receipt.candidate_manifest_id = active.candidate_manifest_id
      AND receipt.candidate_release_import_plan_id = active.candidate_release_import_plan_id
    JOIN canonical_v2_staging.candidate_input_heads head
      ON head.singleton_key = 'CURRENT'
      AND head.environment = active.environment
      AND head.contract_fingerprint = release.contract_fingerprint
    JOIN canonical_v2_staging.correction_discharge_maps map
      ON map.correction_discharge_map_id = head.correction_discharge_map_id
    WHERE active.environment = 'staging';
  `);
  if (rows.length !== 1 || rows[0].state?.binding_ok !== true) {
    throw new Error('The active release is not exactly bound to its import receipt and candidate authority.');
  }
  const state = rows[0].state;
  if (canonicalJson(state.active_release) !== canonicalJson(EXPECTED_RELEASE)
    || canonicalJson(state.authority) !== canonicalJson(EXPECTED_AUTHORITY)) {
    throw new Error('The active staging release or candidate authority has drifted.');
  }
  return state;
}

function sqlLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryRpc(params) {
  const rows = readOnlySql(`SELECT public.canonical_v2_query_page(
    ${PARAM_KEYS.map((key) => sqlLiteral(params[key])).join(',\n    ')}
  ) AS result;`);
  if (rows.length !== 1 || !rows[0].result) throw new Error('The bounded query RPC returned no page.');
  return rows[0].result;
}

function queryRequest() {
  const fixture = buildMultiDealCandidateReleaseFixture();
  if (fixture.corpusReleaseId !== EXPECTED_RELEASE.corpus_release_id) {
    throw new Error('The reviewed P1 fixture release has drifted.');
  }
  const row = fixture.release.shared_rows.find((item) => (
    item.row_kind === 'CANONICAL_RESULT'
      && item.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS'
      && item.governed_deal_key === 'deal:landos-abbvie'
  ));
  const market = row?.canonical_result.market_context;
  if (!market) throw new Error('The reviewed P1 query seed is missing.');
  return {
    serving_namespace_id: EXPECTED_RELEASE.serving_namespace_id,
    corpus_release_id: EXPECTED_RELEASE.corpus_release_id,
    contract_fingerprint: CONTRACT_FINGERPRINT,
    intent: 'MARKET_RANGE',
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  };
}

async function collectStagingEvidence() {
  const before = readState();
  const cacheStore = new Map();
  let calls = 0;
  const client = { rpc(name, params) {
    if (name !== 'canonical_v2_query_page' || ++calls > 1) return Promise.resolve({ data: null, error: true });
    return Promise.resolve({ data: queryRpc(params), error: null });
  } };
  const cache = {
    async get(key) { return cacheStore.get(key) || null; },
    async set(key, value) { cacheStore.set(key, value); },
  };
  const first = await queryCanonicalResultPage({ client, cache, request: queryRequest() });
  const second = await queryCanonicalResultPage({ client, cache, request: queryRequest() });
  const after = readState();
  if (canonicalJson(before) !== canonicalJson(after) || calls !== 1) {
    throw new Error('Staging state changed or the market read exceeded one RPC.');
  }
  return {
    schema_version: 'P1_STAGING_EVIDENCE/V1',
    environment: 'staging',
    project_ref: PROJECT.ref,
    contract_fingerprint: CONTRACT_FINGERPRINT,
    active_release: before.active_release,
    authority: before.authority,
    query: {
      rpc_name: 'canonical_v2_query_page',
      rpc_call_count: calls,
      first_read: first.cache,
      second_read: second.cache,
      page_size: first.request.page_size,
      page_count: first.result.page_count,
      total_count: first.result.total_count,
      returned_row_keys: first.result.rows.map((row) => row.row_serving_key),
    },
    state_unchanged: true,
  };
}

function localExecution() {
  const result = spawnSync(process.execPath, ['--test', TEST_FILE], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error('The exact P1 vertical-slice test failed.');
  return {
    schema_version: 'P1_LOCAL_EXECUTION/V1',
    test_file: TEST_FILE,
    test_file_sha256: createHash('sha256').update(readFileSync(join(ROOT, TEST_FILE))).digest('hex'),
    command: ['node', '--test', TEST_FILE],
    exit_code: 0,
    case_keys: CASES,
  };
}

if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--verify')) {
  fail('Usage: node scripts/canonical-v2-staging-p1-evidence.mjs [--verify]');
}

try {
  guardProject();
  const attestation = buildVerticalSliceAttestation({
    local_execution: localExecution(),
    staging_evidence: await collectStagingEvidence(),
  });
  const stored = JSON.parse(readFileSync(
    join(ROOT, 'tests/fixtures/canonical-v2/p1-vertical-slice-attestation.json'),
    'utf8',
  ));
  if (canonicalJson(attestation) !== canonicalJson(stored)) {
    throw new Error('The reproduced P1 attestation differs from the immutable reviewed evidence.');
  }
  process.stdout.write(`${canonicalJson(attestation)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical P1 evidence collection failed.');
}
