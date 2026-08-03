#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalV2StagingRuntime } from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const {
  buildM3StagingCandidatePreflight,
} = require('../lib/canonical-v2/m3-staging-candidate-preflight');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-m3-candidate-preflight-',
  operationLabel: 'M3 isolated staging candidate preflight',
  bounds: { maxSqlBytes: 8 * 1024 * 1024 },
});

function usage() {
  throw new Error('Usage: node scripts/canonical-v2-m3-staging-candidate-preflight.mjs --manifest <path> [--dry-run|--verify]');
}

function parseArgs(argv) {
  let mode = '--dry-run';
  let manifestPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run' || value === '--verify') mode = value;
    else if (value === '--manifest') manifestPath = argv[++index] || null;
    else usage();
  }
  if (!manifestPath) usage();
  return { mode, manifestPath: resolve(ROOT, manifestPath) };
}

function sqlWriterCall(plan) {
  return `SELECT public.canonical_v2_write(
    'staging',
    ${runtime.sqlText('DEAL_SCOPE_RUN')},
    ${runtime.sqlText(plan.idempotency_key)},
    ${runtime.sqlText(plan.input_digest)},
    ${runtime.sqlJson(plan.write_set)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${runtime.sqlJson(plan.receipt)}
  ) AS result;`;
}

function verifyRollbackSafe(plan) {
  const rows = runtime.runSql(sqlWriterCall(plan), { commit: false });
  if (rows.length !== 1 || !rows[0]?.result) {
    throw new Error(`M3 candidate ${plan.candidate_key} did not return one writer receipt.`);
  }
  if (rows[0].result.receiptId !== plan.receipt.receiptId
    || rows[0].result.inputDigest !== plan.input_digest
    || rows[0].result.status !== 'COMMITTED'
    || rows[0].result.replayed !== false) {
    throw new Error(`M3 candidate ${plan.candidate_key} did not produce its sealed first-write receipt.`);
  }
  const after = runtime.runSql(`SELECT NOT EXISTS (
    SELECT 1
    FROM canonical_v2_staging.write_receipts
    WHERE operation=${runtime.sqlText('DEAL_SCOPE_RUN')}
      AND idempotency_key=${runtime.sqlText(plan.idempotency_key)}
      AND input_digest=${runtime.sqlText(plan.input_digest)}
      AND receipt_id=${runtime.sqlText(plan.receipt.receiptId)}
  ) AS receipt_absent;`, { commit: false, readOnly: true });
  if (after.length !== 1 || after[0]?.receipt_absent !== true) {
    throw new Error(`M3 candidate ${plan.candidate_key} rollback did not remove its writer receipt.`);
  }
  return Object.freeze({
    candidate_key: plan.candidate_key,
    writer_receipt_id: plan.receipt.receiptId,
    transaction_outcome: 'ROLLED_BACK',
    rollback_verified: true,
    durable_rows_written: 0,
  });
}

try {
  const { mode, manifestPath } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const preflight = buildM3StagingCandidatePreflight(manifest);
  let verification = [];
  if (mode === '--verify') {
    runtime.guardProject();
    verification = preflight.plans.map(verifyRollbackSafe);
  }
  process.stdout.write(`${JSON.stringify({
    mode,
    staging_project: mode === '--verify' ? runtime.project.ref : null,
    authority_scope: 'ROLLBACK_ONLY_ISOLATED_STAGING',
    durable_write_authority: 'NONE',
    verification,
    preflight,
  })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'M3 staging candidate preflight failed.'}\n`);
  process.exitCode = 1;
}
