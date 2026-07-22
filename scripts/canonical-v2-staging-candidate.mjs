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
const {
  activateCandidateRelease,
  buildCandidateReleaseImportPlan,
  importCandidateRelease,
} = require('../lib/canonical-v2/candidate-release-import');
const {
  validateActiveReleasePointer,
} = require('../lib/canonical-v2/candidate-release');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, '..');
const EXPECTED_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const EXPECTED_CANDIDATE = Object.freeze({
  contract_fingerprint: '7a869d03bbfd0adc9992f61b2c579fb6d82506755bcf4e8d5116442c4462aa50',
  corpus_release_id: '87ca3f3cd4122d61bcc1c4d4fc2de856de07f99b09f093c6b5f7106dcd0bcc2d',
  candidate_manifest_id: '651dd66a9372a0720a4e464b93cbc3286520f9a5c84dac696a639149a946822d',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  import_plan_id: '1af2c5fd06e62d901ef25b33e33c90e27b9e8a137e1bd7480b79712e318eeee6',
});
const EXPECTED_COUNTS = Object.freeze({
  deal_directory_records: 2,
  market_observations: 14,
  market_exclusions: 0,
  query_records: 14,
  source_specific_records: 1,
  exact_detail_packages: 15,
  validated_semantic_graph_records: 1,
});
const EXPECTED_PRIOR_POINTER = Object.freeze({
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V1',
  environment: 'staging',
  generation: 3,
  corpus_release_id: 'c742c053756c5f4591a414e52e176eb1018d7dafb0d82b134f5d00047ea37463',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  candidate_release_manifest_id: 'bc113b3d44438c650236fa9c30ff5bd4af49c428c6486bfb28f6cadf32d92463',
  previous_pointer_id: 'ac09fb72eb306394c8bbcaec978fb827229e279aa5490a80de01c9491146628a',
  pointer_id: '1e58cc335c0dbc4bd09ef47af623a7f867d18a47ecc9fb8898d921dc15c2aa6e',
  canonical_payload_digest: '36f4cc0c88787fcfc07dc6d51e4f2e11230f9990f0d3c980111d4c0c29d5a8e2',
});
const EXPECTED_ACTIVE_POINTER = Object.freeze({
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V1',
  environment: 'staging',
  generation: 4,
  corpus_release_id: EXPECTED_CANDIDATE.corpus_release_id,
  serving_namespace_id: EXPECTED_CANDIDATE.serving_namespace_id,
  candidate_release_manifest_id: EXPECTED_CANDIDATE.candidate_manifest_id,
  previous_pointer_id: EXPECTED_PRIOR_POINTER.pointer_id,
  pointer_id: '736be39f3bff400ce3d694eaa89ee12b925c5251eac9ca1d275482191179d6fd',
  canonical_payload_digest: '3d2224d555a49b36d160dec652a8e65230001b84b44fb6e18c35a61acd84eb2b',
});

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readLinkedProject() {
  const ref = readFileSync(join(REPOSITORY_ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  const metadata = JSON.parse(readFileSync(
    join(REPOSITORY_ROOT, 'supabase', '.temp', 'linked-project.json'),
    'utf8',
  ));
  if (ref !== EXPECTED_PROJECT.ref
    || metadata.ref !== EXPECTED_PROJECT.ref
    || metadata.name !== EXPECTED_PROJECT.name) {
    fail(`Refusing to run outside ${EXPECTED_PROJECT.name} (${EXPECTED_PROJECT.ref}).`);
  }
}

function buildPinnedCandidate() {
  const fixture = buildMultiDealCandidateReleaseFixture();
  const plan = buildCandidateReleaseImportPlan({ release: fixture.release });
  const actual = {
    contract_fingerprint: fixture.release.manifest.contract_fingerprint,
    corpus_release_id: fixture.release.manifest.corpus_release_id,
    candidate_manifest_id: fixture.release.manifest.candidate_release_manifest_id,
    serving_namespace_id: fixture.release.manifest.serving_namespace_id,
    import_plan_id: plan.candidate_release_import_plan_id,
  };
  if (canonicalJson(actual) !== canonicalJson(EXPECTED_CANDIDATE)
    || canonicalJson(plan.expected_counts) !== canonicalJson(EXPECTED_COUNTS)) {
    fail('Refusing to import because the reviewed multi-deal candidate identity has drifted.');
  }
  return { fixture, plan };
}

function asSqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$canonical_${sha256(json).slice(0, 16)}$`;
  if (json.includes(tag)) fail('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function parseQueryResult(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('Supabase returned a non-JSON query response.');
  }
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error('Supabase query response has no rows array.');
  }
  return payload.rows;
}

function runSql(sql, { commit = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-staging-candidate-'));
  const file = join(directory, commit ? 'commit.sql' : 'rollback.sql');
  writeFileSync(
    file,
    `BEGIN;\nSET LOCAL statement_timeout = '20000ms';\n${sql}\n${commit ? 'COMMIT;' : 'ROLLBACK;'}\n`,
    { mode: 0o600 },
  );
  try {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--linked', '--file', file, '--output', 'json'],
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (result.status !== 0) {
      const diagnostic = (result.stderr || '').trim().split('\n').slice(-3).join('\n');
      throw new Error(diagnostic || 'Supabase query failed.');
    }
    return parseQueryResult(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readState() {
  const rows = runSql(`
    SELECT jsonb_build_object(
      'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'source_specific_records', (SELECT count(*) FROM canonical_v2_staging.reviewed_source_specific_serving_rows WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'validated_semantic_graph_records', (SELECT count(*) FROM canonical_v2_staging.candidate_release_semantic_graphs WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}' AND import_state = 'IMPORTED_COMPLETE'),
      'active_pointer', (SELECT canonical_payload FROM canonical_v2_staging.active_corpus_release_pointers WHERE environment = 'staging')
    ) AS state;
  `);
  if (rows.length !== 1 || !rows[0].state) throw new Error('Canonical staging state could not be read.');
  return rows[0].state;
}

function assertImported(state) {
  const expected = {
    release_records: 1,
    ...EXPECTED_COUNTS,
    complete_receipts: 1,
  };
  for (const [key, count] of Object.entries(expected)) {
    if (Number(state[key]) !== count) throw new Error(`Canonical staging ${key} count is ${state[key]}, expected ${count}.`);
  }
}

function sqlRpcClient({ commit }) {
  return {
    rpc(name, params) {
      let call;
      if (name === 'canonical_v2_import_candidate_release') {
        call = `public.canonical_v2_import_candidate_release('staging', ${asSqlJson(params.p_import_plan)})`;
      } else if (name === 'canonical_v2_activate_candidate_release') {
        call = `public.canonical_v2_activate_candidate_release('staging', ${asSqlJson(params.p_expected_current_pointer)}, ${asSqlJson(params.p_next_pointer)})`;
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

async function dryRun(release) {
  const before = readState();
  const result = await importCandidateRelease({ client: sqlRpcClient({ commit: false }), release });
  const after = readState();
  if (canonicalJson(before) !== canonicalJson(after)) {
    throw new Error('Dry-run changed canonical staging state.');
  }
  process.stdout.write(`Dry-run validated and rolled back multi-deal candidate ${result.plan.candidate_release_import_plan_id}.\n`);
}

async function importRelease(release) {
  const result = await importCandidateRelease({ client: sqlRpcClient({ commit: true }), release });
  const state = readState();
  assertImported(state);
  process.stdout.write(`Imported multi-deal candidate ${result.receipt.corpus_release_id}; complete receipt verified.\n`);
}

async function activateRelease(release) {
  const state = readState();
  assertImported(state);
  if (state.active_pointer) {
    validateActiveReleasePointer(state.active_pointer);
    if (canonicalJson(state.active_pointer) === canonicalJson(EXPECTED_ACTIVE_POINTER)) {
      process.stdout.write(`Multi-deal candidate is already active at generation ${state.active_pointer.generation}.\n`);
      return;
    }
    if (canonicalJson(state.active_pointer) !== canonicalJson(EXPECTED_PRIOR_POINTER)) {
      throw new Error('Refusing to replace an unexpected active staging release.');
    }
  } else {
    throw new Error('Refusing to activate without the pinned prior release.');
  }
  const activated = await activateCandidateRelease({
    client: sqlRpcClient({ commit: true }),
    currentPointer: EXPECTED_PRIOR_POINTER,
    release,
  });
  const after = readState();
  if (canonicalJson(activated.pointer) !== canonicalJson(EXPECTED_ACTIVE_POINTER)
    || canonicalJson(after.active_pointer) !== canonicalJson(EXPECTED_ACTIVE_POINTER)) {
    throw new Error('Active staging pointer did not persist exactly.');
  }
  process.stdout.write(`Activated multi-deal candidate at staging generation ${activated.pointer.generation}.\n`);
}

function verifyState() {
  const state = readState();
  assertImported(state);
  validateActiveReleasePointer(state.active_pointer);
  if (canonicalJson(state.active_pointer) !== canonicalJson(EXPECTED_ACTIVE_POINTER)) {
    throw new Error('Canonical staging pointer is not the pinned multi-deal successor.');
  }
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--import', '--activate', '--verify'].includes(mode) || process.argv.length > 3) {
  fail('Usage: node scripts/canonical-v2-staging-candidate.mjs [--dry-run|--import|--activate|--verify]');
}
readLinkedProject();
const { fixture } = buildPinnedCandidate();

try {
  if (mode === '--dry-run') await dryRun(fixture.release);
  if (mode === '--import') await importRelease(fixture.release);
  if (mode === '--activate') await activateRelease(fixture.release);
  if (mode === '--verify') verifyState();
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical staging candidate command failed.');
}
