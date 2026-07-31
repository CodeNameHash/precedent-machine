#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, '..');
const OUTPUT_ROOT = join(REPOSITORY_ROOT, 'sql', 'optionA');
const F1_CONTRACT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const F1_HEAD = '47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf';
const F1_HEAD_DIGEST = '6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47';
const FUNCTIONS = Object.freeze([
  {
    output: 'step0b-canonical-writer-by-contract.sql',
    source: 'supabase/canonical-v2-foundation.sql',
    marker: 'CREATE OR REPLACE FUNCTION public.canonical_v2_write(',
    digest: 'c248c7c14df38f1a8bfcbac507f553599a9284c31820d18c2d01df5c8a736f2c',
    dependencies: Object.freeze([
      Object.freeze({
        source: 'supabase/canonical-v2-foundation.sql',
        marker: 'CREATE OR REPLACE FUNCTION canonical_v2_staging.canonical_json(',
        digest: '69088248539e99c13b8344cd9a5e78ce7729f1a7b47f5595bec0c83cb2e7b95c',
      }),
      Object.freeze({
        source: 'supabase/canonical-v2-foundation.sql',
        marker: 'CREATE OR REPLACE FUNCTION canonical_v2_staging.content_id(',
        digest: '04da1eab5614a2ff3bd9057cfd1f20a19c5a816def10676b4736a1e13e826a91',
      }),
      Object.freeze({
        source: 'supabase/canonical-v2-foundation.sql',
        marker: 'CREATE OR REPLACE FUNCTION canonical_v2_staging.validate_process_phrasebook_product_carrier(',
        digest: '54509f126399703a8bcbecafa656542581bfaa30170a477b89f46282b48eed30',
      }),
      Object.freeze({
        source: 'supabase/canonical-v2-foundation.sql',
        marker: 'CREATE OR REPLACE FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(',
        digest: 'a9a5bb27f403d3a566a9f608ed8a0df74fda5c35416d89657e62db2518b45e9a',
      }),
    ]),
    suffix: `REVOKE ALL ON FUNCTION canonical_v2_staging.canonical_json(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.content_id(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.validate_process_phrasebook_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;`,
  },
  {
    output: 'step0c-candidate-import-by-contract.sql',
    source: 'supabase/canonical-v2-serving.sql',
    marker: 'CREATE OR REPLACE FUNCTION public.canonical_v2_import_candidate_release(',
    digest: '5a41c1aa8555d297f1bb2c96bc80b04e538536b7771d6c15617bdd7a259a7a5d',
  },
  {
    output: 'step0d-candidate-activation-by-contract.sql',
    source: 'supabase/canonical-v2-serving.sql',
    marker: 'CREATE OR REPLACE FUNCTION public.canonical_v2_activate_candidate_release(',
    digest: '53578257036aa9e5d0c8b6eb2f200a44d04e014a070ccb2334a56fd8775c1734',
  },
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function extractFunction({ source, marker, digest }) {
  const governed = readFileSync(join(REPOSITORY_ROOT, source), 'utf8');
  const start = governed.indexOf(marker);
  const end = governed.indexOf('\n$$;', start);
  if (start < 0 || end < 0) throw new Error(`Unable to extract ${marker} from ${source}.`);
  const statement = governed.slice(start, end + 4);
  const actualDigest = sha256(statement);
  if (actualDigest !== digest) {
    throw new Error(`${marker} digest changed: expected ${digest}, received ${actualDigest}.`);
  }
  return statement;
}

function transaction(body) {
  return `BEGIN;\nSET LOCAL statement_timeout='120000ms';\n${body}\nCOMMIT;\n`;
}

const primaryKeyMigration = transaction(`DO $authority_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging'
      AND contract_fingerprint='${F1_CONTRACT}'
      AND candidate_input_head_id='${F1_HEAD}'
      AND candidate_input_head_payload_digest='${F1_HEAD_DIGEST}'
  ) THEN
    RAISE EXCEPTION 'pinned F1 candidate input head is missing before authority partition migration';
  END IF;
  IF EXISTS (
    SELECT environment, contract_fingerprint
    FROM canonical_v2_staging.candidate_input_heads
    GROUP BY environment, contract_fingerprint HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'candidate input heads are not unique by environment and contract';
  END IF;
END;
$authority_preflight$;

ALTER TABLE canonical_v2_staging.candidate_input_heads
  DROP CONSTRAINT IF EXISTS candidate_input_heads_pkey;
ALTER TABLE canonical_v2_staging.candidate_input_heads
  ADD CONSTRAINT candidate_input_heads_pkey
  PRIMARY KEY (environment, contract_fingerprint);

DO $authority_partition_assert$
DECLARE
  primary_key_columns name[];
BEGIN
  SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)
  INTO primary_key_columns
  FROM pg_constraint constraint_record
  CROSS JOIN LATERAL unnest(constraint_record.conkey) WITH ORDINALITY
    AS key_column(attnum, ordinality)
  JOIN pg_attribute attribute
    ON attribute.attrelid = constraint_record.conrelid
   AND attribute.attnum = key_column.attnum
  WHERE constraint_record.conrelid = 'canonical_v2_staging.candidate_input_heads'::regclass
    AND constraint_record.contype = 'p';
  IF primary_key_columns IS DISTINCT FROM ARRAY['environment', 'contract_fingerprint']::name[] THEN
    RAISE EXCEPTION 'candidate input head authority partition key is not exact';
  END IF;
END;
$authority_partition_assert$;`);

const finalVerification = transaction(`DO $authority_definition_assert$
DECLARE
  primary_key_columns name[];
  writer_definition text := pg_get_functiondef('public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  importer_definition text := pg_get_functiondef('public.canonical_v2_import_candidate_release(text,jsonb)'::regprocedure);
  activation_definition text := pg_get_functiondef('public.canonical_v2_activate_candidate_release(text,jsonb,jsonb)'::regprocedure);
BEGIN
  SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)
  INTO primary_key_columns
  FROM pg_constraint constraint_record
  CROSS JOIN LATERAL unnest(constraint_record.conkey) WITH ORDINALITY
    AS key_column(attnum, ordinality)
  JOIN pg_attribute attribute
    ON attribute.attrelid = constraint_record.conrelid
   AND attribute.attnum = key_column.attnum
  WHERE constraint_record.conrelid = 'canonical_v2_staging.candidate_input_heads'::regclass
    AND constraint_record.contype = 'p';
  IF primary_key_columns IS DISTINCT FROM ARRAY['environment', 'contract_fingerprint']::name[] THEN
    RAISE EXCEPTION 'candidate input head authority partition key is not exact';
  END IF;
  IF writer_definition NOT LIKE '%environment = next_candidate_input_head->>''environment''%'
    OR writer_definition NOT LIKE '%contract_fingerprint = next_candidate_input_head->>''contract_fingerprint''%' THEN
    RAISE EXCEPTION 'canonical writer is not contract-partitioned';
  END IF;
  IF importer_definition NOT LIKE '%current_head.contract_fingerprint = contract_id%' THEN
    RAISE EXCEPTION 'candidate importer is not contract-partitioned';
  END IF;
  IF activation_definition NOT LIKE '%current_head.contract_fingerprint = imported_input_contract_fingerprint%' THEN
    RAISE EXCEPTION 'candidate activation is not contract-partitioned';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='${F1_CONTRACT}'
        AND candidate_input_head_id='${F1_HEAD}'
        AND candidate_input_head_payload_digest='${F1_HEAD_DIGEST}') <> 1 THEN
    RAISE EXCEPTION 'authority partition migration moved the pinned F1 head';
  END IF;
END;
$authority_definition_assert$;`);

const generated = new Map([
  ['step0a-candidate-input-heads-by-contract.sql', primaryKeyMigration],
  ...FUNCTIONS.map((definition) => {
    const statements = [
      ...(definition.dependencies || []),
      definition,
    ].map((item) => (
      `-- Governed function SHA-256: ${item.digest}\n${extractFunction(item)}`
    ));
    if (definition.suffix) statements.push(definition.suffix);
    return [definition.output, transaction(statements.join('\n\n'))];
  }),
  ['step0e-verify-authority-partition.sql', finalVerification],
]);

const mode = process.argv[2] || '--check';
if (!['--write', '--check'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/canonical-v2-optiona-authority-partition.mjs [--write|--check]');
}
mkdirSync(OUTPUT_ROOT, { recursive: true });
for (const [filename, expected] of generated) {
  const path = join(OUTPUT_ROOT, filename);
  if (mode === '--write') {
    writeFileSync(path, expected);
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`${filename} does not equal its governed deterministic output.`);
  }
}
process.stdout.write(`${mode === '--write' ? 'Wrote' : 'Verified'} ${generated.size} Option A authority-partition files.\n`);
