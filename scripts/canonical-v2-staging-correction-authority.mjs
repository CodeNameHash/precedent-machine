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
  buildCandidateInputEvent,
  buildCandidateInputHead,
  buildCorrectionDischargeMap,
  recheckCandidateInputHead,
  selectTrustedCandidateInputs,
} = require('../lib/canonical-v2/candidate-input-authority');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, '..');
const EXPECTED_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const EXPECTED_CONTRACT_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const OPERATION = 'FIXTURE_CORRECTION_AUTHORITY';
const IDEMPOTENCY_KEY = 'canonical-v2-empty-correction-authority-genesis-v1';

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

function buildGenesis() {
  const contractBundle = compileFixtureContract();
  if (contractBundle.fingerprint !== EXPECTED_CONTRACT_FINGERPRINT) {
    fail('Refusing to bootstrap because the frozen contract fingerprint has drifted.');
  }
  const correctionDischargeMap = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: [],
  });
  const candidateInputHead = buildCandidateInputHead({
    environment: 'staging',
    generation: 1,
    correction_discharge_map: correctionDischargeMap,
    previous_candidate_input_head_id: null,
  });
  const candidateInputEvent = buildCandidateInputEvent({
    predecessor_candidate_input_head: null,
    predecessor_correction_discharge_map: null,
    successor_candidate_input_head: candidateInputHead,
    successor_correction_discharge_map: correctionDischargeMap,
  });
  const writeSet = {
    correction_authority_materialisations: [],
    correction_discharge_map: correctionDischargeMap,
    candidate_input_event: candidateInputEvent,
    expected_candidate_input_head: null,
    next_candidate_input_head: candidateInputHead,
  };
  const inputDigest = contentId('CANONICAL_WRITE_INPUT/V1', {
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    writeSet,
  });
  const receiptBody = {
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: 3,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  const receipt = {
    receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody),
    ...receiptBody,
  };
  return Object.freeze({
    contractBundle,
    correctionDischargeMap,
    candidateInputHead,
    candidateInputEvent,
    writeSet,
    inputDigest,
    receipt,
  });
}

function asSqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$canonical_${sha256(json).slice(0, 16)}$`;
  if (json.includes(tag)) fail('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function asSqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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

function safeDatabaseDiagnostic(stderr) {
  const line = String(stderr || '').split('\n').map((item) => item.trim()).find((item) => (
    /(?:ERROR|DETAIL|HINT):/i.test(item)
  ));
  if (!line) return 'Canonical staging authority query failed.';
  const diagnosticStart = line.search(/(?:ERROR|DETAIL|HINT):/i);
  return line.slice(diagnosticStart)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/(?:password|secret|token|key)=[^\s]+/gi, '$1=[redacted]');
}

function runSql(sql, { commit = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-correction-authority-'));
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
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30000,
      },
    );
    if (result.status !== 0) {
      throw new Error(safeDatabaseDiagnostic(`${result.stderr || ''}\n${result.stdout || ''}`));
    }
    return parseQueryResult(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readCurrentHead() {
  const rows = runSql(`
    SELECT head_version.canonical_payload AS current_candidate_input_head
    FROM canonical_v2_staging.candidate_input_heads current_head
    JOIN canonical_v2_staging.candidate_input_head_versions head_version
      ON head_version.candidate_input_head_id = current_head.candidate_input_head_id
      AND head_version.candidate_input_head_payload_digest
        = current_head.candidate_input_head_payload_digest
    WHERE current_head.singleton_key = 'CURRENT';
  `);
  if (rows.length > 1) throw new Error('Canonical staging has more than one current candidate input head.');
  return rows[0]?.current_candidate_input_head || null;
}

function sqlRpcClient() {
  return {
    rpc(name, params) {
      let call;
      if (name === 'canonical_v2_select_candidate_inputs') {
        call = `public.canonical_v2_select_candidate_inputs(${asSqlText(params.p_environment)}, ${asSqlText(params.p_contract_fingerprint)})`;
      } else if (name === 'canonical_v2_recheck_candidate_input_head') {
        call = `public.canonical_v2_recheck_candidate_input_head(${asSqlText(params.p_environment)}, ${asSqlText(params.p_contract_fingerprint)}, ${asSqlText(params.p_expected_candidate_input_head_id)}, ${asSqlText(params.p_expected_candidate_input_head_payload_digest)})`;
      } else {
        return Promise.resolve({ data: null, error: { message: 'Unsupported canonical authority RPC.' } });
      }
      try {
        const rows = runSql(`SELECT ${call} AS result;`);
        return Promise.resolve({ data: rows[0]?.result ?? null, error: null });
      } catch {
        return Promise.resolve({ data: null, error: { message: 'Canonical staging authority RPC failed.' } });
      }
    },
  };
}

function genesisWriteSql(genesis) {
  const writeCall = `public.canonical_v2_write(
    'staging',
    '${OPERATION}',
    ${asSqlText(IDEMPOTENCY_KEY)},
    ${asSqlText(genesis.inputDigest)},
    ${asSqlJson(genesis.writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${asSqlJson(genesis.receipt)}
  )`;
  const selectorCall = `public.canonical_v2_select_candidate_inputs(
    'staging',
    ${asSqlText(genesis.contractBundle.fingerprint)}
  )`;
  const recheckCall = `public.canonical_v2_recheck_candidate_input_head(
    'staging',
    ${asSqlText(genesis.contractBundle.fingerprint)},
    ${asSqlText(genesis.candidateInputHead.candidate_input_head_id)},
    ${asSqlText(genesis.candidateInputHead.canonical_payload_digest)}
  )`;
  return `
    WITH written AS MATERIALIZED (
      SELECT ${writeCall} AS receipt
    ), selected AS MATERIALIZED (
      SELECT ${selectorCall} AS selection
      FROM written
    ), rechecked AS MATERIALIZED (
      SELECT ${recheckCall} AS recheck
      FROM selected
    )
    SELECT jsonb_build_object(
      'receipt', written.receipt,
      'selection', selected.selection,
      'recheck', rechecked.recheck
    ) AS authority_result
    FROM written
    CROSS JOIN selected
    CROSS JOIN rechecked;
  `;
}

async function validateSelectionPayload({ genesis, selection, recheck }) {
  const selected = await selectTrustedCandidateInputs({
    client: { rpc: () => ({ data: selection, error: null }) },
    contract_bundle: genesis.contractBundle,
  });
  if (selected.active_correction_application_ids.length !== 0
    || selected.correction_materialisations.length !== 0
    || canonicalJson(selected.candidate_input_head) !== canonicalJson(genesis.candidateInputHead)) {
    throw new Error('Staging correction authority genesis did not select exactly.');
  }
  await recheckCandidateInputHead({
    client: { rpc: () => ({ data: recheck, error: null }) },
    candidate_input_head: genesis.candidateInputHead,
  });
}

async function writeGenesis(genesis, { commit }) {
  const rows = runSql(genesisWriteSql(genesis), { commit });
  const result = rows[0]?.authority_result;
  if (rows.length !== 1
    || !result
    || result.receipt?.receiptId !== genesis.receipt.receiptId) {
    throw new Error('Canonical writer did not return the deterministic authority receipt.');
  }
  await validateSelectionPayload({
    genesis,
    selection: result.selection,
    recheck: result.recheck,
  });
}

async function verifyCurrentAuthority(genesis) {
  const selected = await selectTrustedCandidateInputs({
    client: sqlRpcClient(),
    contract_bundle: genesis.contractBundle,
  });
  await recheckCandidateInputHead({
    client: sqlRpcClient(),
    candidate_input_head: selected.candidate_input_head,
  });
  return selected;
}

async function dryRun(genesis) {
  const before = readCurrentHead();
  if (before) {
    const selected = await verifyCurrentAuthority(genesis);
    process.stdout.write(`Current candidate input authority generation ${selected.candidate_input_head.generation} verified; no genesis write attempted.\n`);
    return;
  }
  await writeGenesis(genesis, { commit: false });
  if (readCurrentHead() !== null) {
    throw new Error('Dry-run changed canonical staging authority state.');
  }
  process.stdout.write(`Dry-run validated and rolled back correction authority genesis ${genesis.candidateInputHead.candidate_input_head_id}.\n`);
}

async function applyGenesis(genesis) {
  const before = readCurrentHead();
  if (before) {
    const selected = await verifyCurrentAuthority(genesis);
    process.stdout.write(`Current candidate input authority generation ${selected.candidate_input_head.generation} verified; existing head was not replaced.\n`);
    return;
  }
  await writeGenesis(genesis, { commit: true });
  const selected = await verifyCurrentAuthority(genesis);
  if (canonicalJson(selected.candidate_input_head) !== canonicalJson(genesis.candidateInputHead)) {
    throw new Error('Committed correction authority genesis differs from the deterministic head.');
  }
  process.stdout.write(`Committed and verified correction authority genesis ${genesis.candidateInputHead.candidate_input_head_id}.\n`);
}

async function verify(genesis) {
  if (!readCurrentHead()) throw new Error('No current candidate input authority exists in staging.');
  const selected = await verifyCurrentAuthority(genesis);
  process.stdout.write(`Verified candidate input authority generation ${selected.candidate_input_head.generation}, map ${selected.correction_discharge_map.correction_discharge_map_id}.\n`);
}

const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length > 3) {
  fail('Usage: node scripts/canonical-v2-staging-correction-authority.mjs [--dry-run|--apply|--verify]');
}
readLinkedProject();
const genesis = buildGenesis();

try {
  if (mode === '--dry-run') await dryRun(genesis);
  if (mode === '--apply') await applyGenesis(genesis);
  if (mode === '--verify') await verify(genesis);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical staging correction authority command failed.');
}
