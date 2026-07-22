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
  contract_fingerprint: '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d',
  corpus_release_id: 'b9dcc82ea59a82af3b04719b8e0b9d55609ebf058013d86d54bf82bf3caed6ee',
  candidate_manifest_id: 'c2247c4367fafe321ff27e2b5a8db02809463ea2af000e92cd91a6a5d9867092',
  correction_input_seal_id: '0aaf9b2198e82bba4dc45b36100bb322b1091a70634f2cac5693f536e3c8b754',
  correction_input_root: 'b63df4508e533baff18392ac451ba05db01d4517fdd73f015dcbb2c56f5f9ab3',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  import_plan_id: '35a9b1413736021fcde56eac68b096f061ad2618b365b842725163704a7db6ee',
});
const EXPECTED_COUNTS = Object.freeze({
  correction_input_seal_records: 1,
  correction_discharge_records: 0,
  deal_directory_records: 2,
  market_observations: 14,
  market_exclusions: 0,
  query_records: 14,
  source_specific_records: 1,
  exact_detail_packages: 15,
  validated_semantic_graph_records: 1,
});
const EXPECTED_PRIOR_POINTER = Object.freeze({
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V2',
  environment: 'staging',
  generation: 6,
  corpus_release_id: 'fda4083648dcc7fabaf5c2fe8f14a2c01486e4ca23de6305c250dda84bf2c44c',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
  candidate_release_manifest_id: 'c6f47aefdf8106a1d1d576b03d4f4d42d91f2b670b11bd42c99a31a97fe793bc',
  correction_input_seal_id: '0aaf9b2198e82bba4dc45b36100bb322b1091a70634f2cac5693f536e3c8b754',
  correction_input_root: 'b63df4508e533baff18392ac451ba05db01d4517fdd73f015dcbb2c56f5f9ab3',
  previous_pointer_id: '4c5919a74ec9c4c3d6e0e50e985f8f36ccfe6e8f39d47bd5d56f8f093705c6d5',
  pointer_id: '398c6210a6a0358fc2c735c457a1c6c485ce04694154d7807fad920519f4e715',
  canonical_payload_digest: '880e3f6e2706bd34f11904784c4f105d494b14f2adc972072431bac0884112d0',
});
const EXPECTED_ACTIVE_POINTER = Object.freeze({
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V2',
  environment: 'staging',
  generation: 7,
  corpus_release_id: EXPECTED_CANDIDATE.corpus_release_id,
  serving_namespace_id: EXPECTED_CANDIDATE.serving_namespace_id,
  candidate_release_manifest_id: EXPECTED_CANDIDATE.candidate_manifest_id,
  correction_input_seal_id: EXPECTED_CANDIDATE.correction_input_seal_id,
  correction_input_root: EXPECTED_CANDIDATE.correction_input_root,
  previous_pointer_id: EXPECTED_PRIOR_POINTER.pointer_id,
  pointer_id: '15a0e13f45ad596d468b9cfa2878a456ac56c3b84d15a185c0a96dca5ef022a1',
  canonical_payload_digest: 'cd48ef76f1e6055380d404fbd8bc179fb728452819d8b7d5b0f55d1c123bcc43',
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
    correction_input_seal_id: fixture.release.manifest.correction_input_seal_id,
    correction_input_root: fixture.release.manifest.roots.correction_input_root,
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
      'release_correction_input_seal_id', (SELECT correction_input_seal_id FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'release_correction_input_root', (SELECT correction_input_root FROM canonical_v2_staging.fixture_corpus_releases WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'correction_input_seal_records', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_input_seals WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'stored_correction_input_seal_id', (SELECT correction_input_seal_id FROM canonical_v2_staging.candidate_release_correction_input_seals WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'stored_correction_input_root', (SELECT correction_input_root FROM canonical_v2_staging.candidate_release_correction_input_seals WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'correction_discharge_records', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_discharges WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'query_records', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'source_specific_records', (SELECT count(*) FROM canonical_v2_staging.reviewed_source_specific_serving_rows WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'exact_detail_packages', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'validated_semantic_graph_records', (SELECT count(*) FROM canonical_v2_staging.candidate_release_semantic_graphs WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}'),
      'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}' AND import_state = 'IMPORTED_COMPLETE'),
      'receipt_correction_input_seal_id', (SELECT correction_input_seal_id FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}' AND import_state = 'IMPORTED_COMPLETE'),
      'receipt_correction_input_root', (SELECT correction_input_root FROM canonical_v2_staging.candidate_release_import_receipts WHERE corpus_release_id = '${EXPECTED_CANDIDATE.corpus_release_id}' AND import_state = 'IMPORTED_COMPLETE'),
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
  for (const key of [
    'release_correction_input_seal_id',
    'stored_correction_input_seal_id',
    'receipt_correction_input_seal_id',
  ]) {
    if (state[key] !== EXPECTED_CANDIDATE.correction_input_seal_id) {
      throw new Error(`Canonical staging ${key} does not match the reviewed correction seal.`);
    }
  }
  for (const key of [
    'release_correction_input_root',
    'stored_correction_input_root',
    'receipt_correction_input_root',
  ]) {
    if (state[key] !== EXPECTED_CANDIDATE.correction_input_root) {
      throw new Error(`Canonical staging ${key} does not match the reviewed correction root.`);
    }
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
