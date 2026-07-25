#!/usr/bin/env node

import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createCanonicalV2StagingRuntime } from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_HOLD_SECONDS = 20;
const HANDSHAKE_NAMESPACE = 812_644_201;
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-writer-race-',
  operationLabel: 'Canonical writer race acceptance',
  bounds: {
    statementTimeoutMs: 30_000,
    processTimeoutMs: 40_000,
    maxSqlBytes: 4 * 1024 * 1024,
    maxResponseBytes: 4 * 1024 * 1024,
    maxProcessBufferBytes: 6 * 1024 * 1024,
  },
});

function receiptFor({ idempotencyKey, inputDigest }) {
  const body = {
    operation: 'INTAKE_CAPTURE',
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: 1,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  return {
    receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', body),
    ...body,
  };
}

function requestFor(capture, idempotencyKey) {
  const writeSet = { intake_capture: capture };
  const residuals = [];
  const quarantines = [];
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey,
    writeSet,
    residuals,
    quarantines,
  });
  return {
    operation: 'INTAKE_CAPTURE',
    idempotencyKey,
    inputDigest,
    writeSet,
    residuals,
    quarantines,
    receipt: receiptFor({ idempotencyKey, inputDigest }),
  };
}

function writerSql(request) {
  return `SELECT public.canonical_v2_write(
    'staging',
    'INTAKE_CAPTURE',
    ${runtime.sqlText(request.idempotencyKey)},
    ${runtime.sqlText(request.inputDigest)},
    ${runtime.sqlJson(request.writeSet)},
    ${runtime.sqlJson(request.residuals)},
    ${runtime.sqlJson(request.quarantines)},
    ${runtime.sqlJson(request.receipt)}
  ) AS result;`;
}

function spawnSql(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-writer-race-session-'));
  const file = join(directory, 'session.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  const child = spawn(
    'supabase',
    ['--workdir', ROOT, 'db', 'query', '--linked', '--file', file],
    {
      cwd: ROOT,
      encoding: 'utf8',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return {
    child,
    result: new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Canonical writer race session exceeded 45 seconds.'));
      }, 45_000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (status) => {
        clearTimeout(timer);
        rmSync(directory, { recursive: true, force: true });
        resolveResult({ status, stdout, stderr });
      });
    }),
  };
}

async function waitForHolderLock(handshakeKey) {
  const deadline = Date.now() + 18_000;
  await delay(4000);
  while (Date.now() < deadline) {
    const [row] = runtime.runSql(
      `SELECT NOT pg_try_advisory_xact_lock(
         ${HANDSHAKE_NAMESPACE},
         ${handshakeKey}
       ) AS holder_ready;`,
      { readOnly: true },
    );
    if (row?.holder_ready === true) return;
    await delay(100);
  }
  throw new Error('Canonical writer race holder did not reach its post-insert lock.');
}

async function runBlockedWriter({ holderRequest, contenderRequest, handshakeKey }) {
  const holder = spawnSql(`BEGIN;
SET LOCAL statement_timeout='30s';
${writerSql(holderRequest)}
SELECT pg_advisory_xact_lock(${HANDSHAKE_NAMESPACE}, ${handshakeKey});
SELECT pg_sleep(${LOCK_HOLD_SECONDS});
COMMIT;
`);
  let contender;
  try {
    await waitForHolderLock(handshakeKey);
    const startedAt = Date.now();
    contender = spawnSql(`BEGIN;
SET LOCAL lock_timeout='25s';
SET LOCAL statement_timeout='30s';
${writerSql(contenderRequest)}
ROLLBACK;
`);
    const [holderResult, contenderResult] = await Promise.all([
      holder.result,
      contender.result,
    ]);
    return {
      holderResult,
      contenderResult,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const [holderOutcome, contenderOutcome] = await Promise.allSettled([
      holder.result,
      contender?.result,
    ]);
    if (holderOutcome.status === 'fulfilled'
      && holderOutcome.value.status === 0) {
      cleanupCommittedHolder(holderRequest);
    }
    if (contenderOutcome.status === 'rejected') {
      contender?.child.kill('SIGTERM');
    }
    throw error;
  }
}

function assertReceiptCount(idempotencyKey, expectedCount) {
  const [row] = runtime.runSql(
    `SELECT count(*)::integer AS receipt_count
     FROM canonical_v2_staging.write_receipts
     WHERE operation='INTAKE_CAPTURE'
       AND idempotency_key=${runtime.sqlText(idempotencyKey)};`,
    { readOnly: true },
  );
  if (row?.receipt_count !== expectedCount) {
    throw new Error('Race acceptance observed an unexpected writer receipt count.');
  }
}

function freshCapture(storedCapture, retrievedAt) {
  const body = {
    ...storedCapture,
    retrieved_at: retrievedAt,
  };
  delete body.intake_capture_receipt_id;
  return {
    ...body,
    intake_capture_receipt_id: contentId('INTAKE_CAPTURE_RECEIPT/V1', body),
  };
}

function cleanupCommittedHolder(request) {
  const capture = request.writeSet.intake_capture;
  const captureId = runtime.sqlText(capture.intake_capture_receipt_id);
  const capturePayload = runtime.sqlJson(capture);
  runtime.runSql(
    `DO $cleanup$
     DECLARE
       deleted_receipts integer;
       deleted_captures integer;
     BEGIN
       DELETE FROM canonical_v2_staging.write_receipts
       WHERE operation='INTAKE_CAPTURE'
         AND idempotency_key=${runtime.sqlText(request.idempotencyKey)}
         AND input_digest=${runtime.sqlText(request.inputDigest)}
         AND receipt_id=${runtime.sqlText(request.receipt.receiptId)};
       GET DIAGNOSTICS deleted_receipts = ROW_COUNT;
       DELETE FROM canonical_v2_staging.intake_capture_receipts
       WHERE intake_capture_receipt_id=${captureId}
         AND canonical_payload_storage_digest=
           canonical_v2_staging.payload_digest(${capturePayload});
       GET DIAGNOSTICS deleted_captures = ROW_COUNT;
       IF deleted_receipts <> 1 OR deleted_captures <> 1 THEN
         RAISE EXCEPTION 'race acceptance cleanup did not remove its exact temporary rows';
       END IF;
     END
     $cleanup$;`,
    { commit: true },
  );
}

function verifyLegacyReplay() {
  const rows = runtime.runSql(
    `SELECT
       receipt.operation,
       receipt.idempotency_key,
       receipt.input_digest,
       receipt.canonical_payload AS receipt,
       capture.canonical_payload AS capture
     FROM canonical_v2_staging.write_receipts AS receipt
     CROSS JOIN canonical_v2_staging.intake_capture_receipts AS capture
     WHERE receipt.operation='INTAKE_CAPTURE'
       AND receipt.input_digest=canonical_v2_staging.content_id(
         'CANONICAL_WRITE_INPUT/V1',
         jsonb_build_object(
           'operation', receipt.operation,
           'idempotencyKey', receipt.idempotency_key,
           'writeSet', jsonb_build_object('intake_capture', capture.canonical_payload)
         )
       )
     ORDER BY receipt.idempotency_key
     LIMIT 1;`,
    { readOnly: true },
  );
  if (rows.length !== 1) {
    throw new Error('Race acceptance requires one sealed V1 intake receipt.');
  }
  const [legacy] = rows;
  const [replay] = runtime.runSql(writerSql({
    operation: legacy.operation,
    idempotencyKey: legacy.idempotency_key,
    inputDigest: legacy.input_digest,
    writeSet: { intake_capture: legacy.capture },
    residuals: [],
    quarantines: [],
    receipt: legacy.receipt,
  }));
  if (replay?.result?.replayed !== true) {
    throw new Error('Sealed V1 writer receipt did not replay read-only.');
  }
}

async function main() {
  runtime.guardProject();
  verifyLegacyReplay();
  const [stored] = runtime.runSql(
    `SELECT canonical_payload
     FROM canonical_v2_staging.intake_capture_receipts
     ORDER BY intake_capture_receipt_id
     LIMIT 1;`,
    { readOnly: true },
  );
  if (!stored?.canonical_payload) {
    throw new Error('Race acceptance requires one existing isolated-staging intake receipt.');
  }

  const nonce = Date.now().toString(36);
  const baseTimestamp = Date.now() + 86_400_000;
  const sameCapture = freshCapture(
    stored.canonical_payload,
    new Date(baseTimestamp).toISOString(),
  );
  const conflictCapture = freshCapture(
    stored.canonical_payload,
    new Date(baseTimestamp + 2000).toISOString(),
  );
  const conflictIdempotencyKey = `writer-race-idempotency-conflict-${nonce}`;
  const cases = [
    {
      label: 'same',
      holderRequest: requestFor(sameCapture, `writer-race-holder-same-${nonce}`),
      contenderRequest: requestFor(sameCapture, `writer-race-contender-same-${nonce}`),
      handshakeKey: Math.floor(baseTimestamp % 2_000_000_000),
      expectIdempotencyConflict: false,
    },
    {
      label: 'idempotency-conflict',
      holderRequest: requestFor(conflictCapture, conflictIdempotencyKey),
      contenderRequest: requestFor(
        freshCapture(
          stored.canonical_payload,
          new Date(baseTimestamp + 3000).toISOString(),
        ),
        conflictIdempotencyKey,
      ),
      handshakeKey: Math.floor((baseTimestamp + 1) % 2_000_000_000),
      expectIdempotencyConflict: true,
    },
  ];

  for (const item of cases) {
    let holderCommitted = false;
    try {
      const result = await runBlockedWriter(item);
      holderCommitted = result.holderResult.status === 0;
      const contenderOutput = `${
        result.contenderResult.stdout
      }\n${result.contenderResult.stderr}`;
      if (!holderCommitted || result.elapsedMs < 7000) {
        throw new Error(`${item.label} race did not wait for the uncommitted winner.`);
      }
      if (item.expectIdempotencyConflict) {
        if (result.contenderResult.status === 0
          || !contenderOutput.includes(
            'idempotency key already names different canonical input',
          )) {
          throw new Error('Idempotency race did not fail closed after the winner committed.');
        }
      } else if (result.contenderResult.status !== 0) {
        throw new Error('Same-payload race did not replay safely after the winner committed.');
      }
      assertReceiptCount(item.holderRequest.idempotencyKey, 1);
      if (!item.expectIdempotencyConflict) {
        assertReceiptCount(item.contenderRequest.idempotencyKey, 0);
      }
    } finally {
      if (holderCommitted) cleanupCommittedHolder(item.holderRequest);
    }
    assertReceiptCount(item.holderRequest.idempotencyKey, 0);
  }

  process.stdout.write(
    'Canonical writer V1 replay, object convergence and idempotency race acceptance passed; temporary staging rows were removed.\n',
  );
}

await main();
