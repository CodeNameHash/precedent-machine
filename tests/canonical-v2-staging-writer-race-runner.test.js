const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-writer-race.mjs',
  'utf8',
);

test('writer race acceptance is isolated, handshake-driven and removes temporary rows', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /CANONICAL_WRITE_INPUT\/V1/);
  assert.match(source, /Sealed V1 writer receipt did not replay read-only/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /pg_try_advisory_xact_lock/);
  assert.match(source, /post-insert lock/);
  assert.match(source, /SET LOCAL lock_timeout='25s'/);
  assert.match(source, /SET LOCAL statement_timeout='30s'/);
  assert.match(source, /ROLLBACK;/);
  assert.match(source, /\bCOMMIT;/);
  assert.match(source, /result\.elapsedMs < 7000/);
  assert.match(source, /idempotency key already names different canonical input/);
  assert.match(source, /freshCapture\([\s\S]*new Date\(baseTimestamp \+ 3000\)/);
  assert.match(source, /cleanupCommittedHolder/);
  assert.match(source, /DELETE FROM canonical_v2_staging\.write_receipts/);
  assert.match(source, /DELETE FROM canonical_v2_staging\.intake_capture_receipts/);
  assert.match(source, /deleted_receipts <> 1 OR deleted_captures <> 1/);
  assert.match(source, /finally \{[\s\S]*cleanupCommittedHolder/);
  assert.doesNotMatch(source, /await delay\(8000\)/);
  assert.doesNotMatch(source, /SET canonical_payload = canonical_payload/);
});
