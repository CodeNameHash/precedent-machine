const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const canonicalStart = sql.indexOf(
  'CREATE OR REPLACE FUNCTION canonical_v2_staging.canonical_json',
);
const contentIdStart = sql.indexOf(
  'CREATE OR REPLACE FUNCTION canonical_v2_staging.content_id',
);
const firstTable = sql.indexOf('CREATE TABLE IF NOT EXISTS', contentIdStart);
const canonicalBlock = sql.slice(canonicalStart, contentIdStart);
const contentIdBlock = sql.slice(contentIdStart, firstTable);
const writerStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_write');
const writerBegin = sql.indexOf('\nBEGIN\n', writerStart);
const writerValidationEnd = sql.indexOf('PERFORM pg_advisory_xact_lock', writerBegin);
const envelopeValidation = sql.slice(writerBegin, writerValidationEnd);

test('canonical JSON is private, recursive and deterministic for governed JSON', () => {
  assert.notEqual(canonicalStart, -1);
  assert.match(canonicalBlock, /RETURNS text[\s\S]*LANGUAGE plpgsql/);
  assert.match(canonicalBlock, /IMMUTABLE[\s\S]*STRICT[\s\S]*PARALLEL SAFE/);
  assert.match(canonicalBlock, /SET search_path = pg_catalog/);
  assert.match(
    canonicalBlock,
    /ORDER BY element\.ordinal[\s\S]*jsonb_array_elements\(value\)[\s\S]*WITH ORDINALITY/,
  );
  assert.match(
    canonicalBlock,
    /ORDER BY entry\.key COLLATE "C"[\s\S]*jsonb_each\(value\)/,
  );
  assert.match(
    canonicalBlock,
    /canonical_v2_staging\.canonical_json\(element\.value\)/,
  );
  assert.match(
    canonicalBlock,
    /canonical_v2_staging\.canonical_json\(entry\.value\)/,
  );
  assert.doesNotMatch(canonicalBlock, /pg_catalog\.coalesce/);
  assert.match(
    canonicalBlock,
    /jsonb_object_keys\(value\)[\s\S]*octet_length\(object_key\.key\)[\s\S]*char_length\(object_key\.key\)[\s\S]*object keys must be ASCII/,
  );
  assert.equal(
    canonicalJson([1.0, { z: false, a: 'x' }]),
    '[1,{"a":"x","z":false}]',
  );
});

test('number encoding permits only JavaScript-safe integers', () => {
  assert.match(
    canonicalBlock,
    /numeric_value := \(value #>> '\{\}'\)::numeric/,
  );
  assert.match(
    canonicalBlock,
    /RETURN pg_catalog\.trim_scale\(numeric_value\)::text/,
  );
  assert.match(canonicalBlock, /abs\(numeric_value\) > 9007199254740991/);
  assert.match(
    canonicalBlock,
    /numeric_value <> pg_catalog\.trunc\(numeric_value\)/,
  );
  assert.match(
    canonicalBlock,
    /numbers must be JavaScript-safe integers[\s\S]*ERRCODE = '22003'/,
  );
  assert.doesNotMatch(
    canonicalBlock,
    /value_kind IN \('boolean', 'number'\)[\s\S]*RETURN value::text/,
  );
});

test('content IDs reproduce the exact domain-separated canonical byte frame', () => {
  assert.notEqual(contentIdStart, -1);
  assert.match(contentIdBlock, /RETURNS text[\s\S]*IMMUTABLE[\s\S]*PARALLEL SAFE/);
  assert.match(contentIdBlock, /domain IS NULL/);
  assert.match(contentIdBlock, /domain = ''/);
  assert.match(contentIdBlock, /domain IS DISTINCT FROM pg_catalog\.btrim\(domain\)/);
  assert.match(contentIdBlock, /octet_length\(domain\) > 160/);
  assert.match(contentIdBlock, /domain ~ '\[\[:cntrl:\]\]'/);
  assert.match(contentIdBlock, /payload IS NULL[\s\S]*content ID payload must be JSON/);
  assert.match(contentIdBlock, /convert_to\('CANONICAL_CONTENT_ID\/V1', 'UTF8'\)/);
  assert.equal((contentIdBlock.match(/decode\('00', 'hex'\)/g) || []).length, 2);
  assert.match(
    contentIdBlock,
    /octet_length\(domain_bytes\)::text[\s\S]*convert_to\(':', 'UTF8'\)[\s\S]*domain_bytes/,
  );
  assert.match(
    contentIdBlock,
    /canonical_v2_staging\.canonical_json\(payload\)/,
  );
  assert.match(contentIdBlock, /extensions\.digest\([\s\S]*'sha256'::text/);
  assert.equal(
    contentId('FIXTURE_DOMAIN/V1', {
      operation: 'DEAL_SCOPE_RUN',
      idempotencyKey: 'fixture-key',
      writeSet: { beta: [1, 2], alpha: null },
    }),
    'aee841c1f83d4cc574f049556c2bc090d2021696009e1aeb535abaf37858b288',
  );
});

test('writer authenticates input and receipt envelopes before lock, lookup or DML', () => {
  assert.match(
    envelopeValidation,
    /canonical_v2_staging\.content_id\([\s\S]*'CANONICAL_WRITE_INPUT\/V2'[\s\S]*jsonb_build_object\([\s\S]*'operation', p_operation,[\s\S]*'idempotencyKey', p_idempotency_key,[\s\S]*'writeSet', p_write_set,[\s\S]*'residuals', p_residuals,[\s\S]*'quarantines', p_quarantines/,
  );
  assert.match(
    envelopeValidation,
    /canonical writer input digest does not match the exact write envelope/,
  );
  assert.match(
    envelopeValidation,
    /pg_column_size\(p_write_set\)[\s\S]*pg_column_size\(p_residuals\)[\s\S]*pg_column_size\(p_quarantines\)[\s\S]*pg_column_size\(p_receipt\) > 4194304/,
  );
  assert.match(
    envelopeValidation,
    /jsonb_typeof\(p_receipt\) IS DISTINCT FROM 'object'/,
  );
  for (const key of [
    'receiptId',
    'operation',
    'idempotencyKey',
    'inputDigest',
    'status',
    'publishableObjectCount',
    'residualCount',
    'quarantinedClosureCount',
  ]) assert.match(envelopeValidation, new RegExp(`'${key}'`));
  assert.match(
    envelopeValidation,
    /p_receipt - ARRAY\[[\s\S]*\]::text\[\] <> '\{\}'::jsonb/,
  );
  assert.match(
    envelopeValidation,
    /canonical_v2_staging\.content_id\([\s\S]*'CANONICAL_WRITE_RECEIPT\/V1'[\s\S]*p_receipt - 'receiptId'/,
  );
  assert.match(
    envelopeValidation,
    /canonical writer receipt ID does not match its canonical body/,
  );
  const lookup = sql.indexOf('SELECT * INTO existing_receipt', writerBegin);
  const firstDml = sql.indexOf('INSERT INTO canonical_v2_staging', writerBegin);
  assert.ok(writerValidationEnd < lookup);
  assert.ok(writerValidationEnd < firstDml);
});

test('legacy V1 input is read-only compatibility for an exact sealed receipt', () => {
  const legacyDigest = sql.indexOf("'CANONICAL_WRITE_INPUT/V1'", writerBegin);
  const lock = sql.indexOf('PERFORM pg_advisory_xact_lock', writerBegin);
  const lookup = sql.indexOf('SELECT * INTO existing_receipt', lock);
  const exactReceipt = sql.indexOf(
    'existing_receipt.canonical_payload IS DISTINCT FROM p_receipt',
    lookup,
  );
  const replay = sql.indexOf(
    "input_envelope_version = 'V1' OR p_operation <> 'DEAL_SCOPE_RUN'",
    exactReceipt,
  );
  const rejectNew = sql.indexOf(
    'legacy canonical write input can only replay an existing receipt',
    replay,
  );
  const firstDml = sql.indexOf('INSERT INTO canonical_v2_staging', writerBegin);
  assert.ok(
    legacyDigest > writerBegin
      && legacyDigest < lock
      && lock < lookup
      && lookup < exactReceipt
      && exactReceipt < replay
      && replay < rejectNew
      && rejectNew < firstDml,
  );
});

test('writer exposes only the seven governed operations and no private helper', () => {
  const operationStart = sql.indexOf('IF p_operation NOT IN', writerBegin);
  const operationEnd = sql.indexOf(') THEN', operationStart);
  const operationAllowlist = sql.slice(operationStart, operationEnd);
  for (const operation of [
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN',
    'PRODUCT_RESULT_CANDIDATE_RUN',
  ]) assert.match(operationAllowlist, new RegExp(`'${operation}'`));
  assert.equal((operationAllowlist.match(/'[A-Z][A-Z0-9_]+'/g) || []).length, 7);
  assert.doesNotMatch(sql, /p_write_set->>'action' = 'VERIFY_WRITER_ENVELOPE'/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION canonical_v2_staging\.canonical_json\(jsonb\)[\s\S]*PUBLIC, anon, authenticated, service_role, canonical_v2_writer/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION canonical_v2_staging\.content_id\(text, jsonb\)[\s\S]*PUBLIC, anon, authenticated, service_role, canonical_v2_writer/,
  );
  assert.doesNotMatch(
    sql,
    /GRANT EXECUTE ON FUNCTION canonical_v2_staging\.(?:canonical_json|content_id)/,
  );
});
