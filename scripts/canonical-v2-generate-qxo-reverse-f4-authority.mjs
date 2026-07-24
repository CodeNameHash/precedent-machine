#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildQxoReverseF4AuthorityGenesis,
} = require('../lib/canonical-v2/qxo-reverse-f4-authority');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'sql', 'qxo-reverse-f4');

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_f4_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function writerSql(genesis) {
  return `SELECT public.canonical_v2_write(
  'staging',
  '${genesis.operation}',
  '${genesis.idempotency_key}',
  '${genesis.input_digest}',
  ${sqlJson(genesis.write_set)},
  '[]'::jsonb,
  '[]'::jsonb,
  ${sqlJson(genesis.receipt)}
) AS authority_result;`;
}

function verificationSql(genesis) {
  const head = genesis.candidate_input_head;
  return `DO $qxo_f4_authority_gate$
BEGIN
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging'
        AND contract_fingerprint='${head.contract_fingerprint}'
        AND candidate_input_head_id='${head.candidate_input_head_id}'
        AND candidate_input_head_payload_digest='${head.canonical_payload_digest}') <> 1 THEN
    RAISE EXCEPTION 'the exact F4 candidate-input head is missing';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.write_receipts
      WHERE operation='${genesis.operation}'
        AND idempotency_key='${genesis.idempotency_key}'
        AND input_digest='${genesis.input_digest}'
        AND receipt_id='${genesis.receipt.receiptId}'
        AND canonical_payload=${sqlJson(genesis.receipt)}) <> 1 THEN
    RAISE EXCEPTION 'the exact F4 correction-authority receipt is missing';
  END IF;
END;
$qxo_f4_authority_gate$;`;
}

function transaction(genesis, commit) {
  return `BEGIN;
SET LOCAL statement_timeout='20000ms';
${writerSql(genesis)}
${verificationSql(genesis)}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`;
}

const genesis = buildQxoReverseF4AuthorityGenesis();
const attestation = Object.freeze({
  schema_version: 'QXO_REVERSE_F4_AUTHORITY_GENESIS_ATTESTATION/V1',
  contract_fingerprint: genesis.contract_bundle.fingerprint,
  correction_discharge_map_id: genesis.correction_discharge_map.correction_discharge_map_id,
  correction_discharge_map_payload_digest:
    genesis.correction_discharge_map.canonical_payload_digest,
  candidate_input_head_id: genesis.candidate_input_head.candidate_input_head_id,
  candidate_input_head_payload_digest: genesis.candidate_input_head.canonical_payload_digest,
  candidate_input_event_id: genesis.candidate_input_event.candidate_input_event_id,
  candidate_input_event_payload_digest: genesis.candidate_input_event.canonical_payload_digest,
  input_digest: genesis.input_digest,
  receipt_id: genesis.receipt.receiptId,
  status: 'INACTIVE_STAGING_AUTHORITY_ONLY',
});

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(
  join(OUTPUT_DIR, '01-f4-authority-genesis-dry-run.sql'),
  transaction(genesis, false),
);
writeFileSync(
  join(OUTPUT_DIR, '02-f4-authority-genesis-apply.sql'),
  transaction(genesis, true),
);
writeFileSync(
  join(OUTPUT_DIR, 'AUTHORITY-ATTESTATION.json'),
  `${canonicalJson(attestation)}\n`,
);
process.stdout.write(`${canonicalJson(attestation)}\n`);
