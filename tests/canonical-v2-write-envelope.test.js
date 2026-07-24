const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  CANONICAL_WRITE_INPUT_DOMAIN,
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');

function fixture(overrides = {}) {
  return {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: 'envelope-fixture',
    writeSet: { deal: { deal_key: 'fixture' }, claims: [] },
    residuals: [],
    quarantines: [],
    ...overrides,
  };
}

test('canonical writer V2 digest binds every persisted output collection', () => {
  assert.equal(CANONICAL_WRITE_INPUT_DOMAIN, 'CANONICAL_WRITE_INPUT/V2');
  const baseline = buildCanonicalWriteInputDigest(fixture());
  assert.notEqual(
    baseline,
    buildCanonicalWriteInputDigest(fixture({
      residuals: [{ residual_id: 'a', closure_id: 'c', reason_code: 'UNKNOWN' }],
    })),
  );
  assert.notEqual(
    baseline,
    buildCanonicalWriteInputDigest(fixture({
      quarantines: [{ quarantine_id: 'q', closure_id: 'c', reason_code: 'UNKNOWN' }],
    })),
  );
  assert.notEqual(
    baseline,
    buildCanonicalWriteInputDigest(fixture({
      writeSet: { deal: { deal_key: 'fixture' }, claims: [{ claim_revision_id: 'x' }] },
    })),
  );
});

test('canonical writer V2 digest is key-order deterministic and rejects open envelopes', () => {
  const first = buildCanonicalWriteInputDigest(fixture({
    writeSet: { claims: [], deal: { deal_key: 'fixture' } },
  }));
  const second = buildCanonicalWriteInputDigest(fixture());
  assert.equal(first, second);
  assert.throws(
    () => buildCanonicalWriteInputDigest(fixture({ residuals: {} })),
    /exact closed persistence envelope/,
  );
});

test('canonical writer V2 rejects values PostgreSQL cannot canonicalise identically', () => {
  for (const value of [
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => buildCanonicalWriteInputDigest(fixture({
        writeSet: { deal: { deal_key: 'fixture', unsafe: value }, claims: [] },
      })),
      /JavaScript-safe integers/,
    );
  }
  assert.throws(
    () => buildCanonicalWriteInputDigest(fixture({
      writeSet: { deal: { deal_key: 'fixture' }, claims: [], 'café': true },
    })),
    /object keys must be ASCII/,
  );
  for (const value of ['nul\u0000value', '\ud800']) {
    assert.throws(
      () => buildCanonicalWriteInputDigest(fixture({
        writeSet: { deal: { deal_key: value }, claims: [] },
      })),
      /NUL|paired Unicode surrogates/,
    );
  }
  assert.doesNotThrow(
    () => buildCanonicalWriteInputDigest(fixture({
      writeSet: { deal: { deal_key: 'unicode-é-😀' }, claims: [] },
    })),
  );
  assert.throws(
    () => buildCanonicalWriteInputDigest(fixture({
      writeSet: { deal: { deal_key: 'fixture' }, claims: new Array(1) },
    })),
    /arrays must be dense/,
  );
});

test('new authoritative writer inputs use V2 and SQL retains only sealed V1 replay', () => {
  const writer = fs.readFileSync('lib/canonical-v2/canonical-writer.js', 'utf8');
  const envelope = fs.readFileSync('lib/canonical-v2/canonical-write-envelope.js', 'utf8');
  const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
  assert.doesNotMatch(writer, /CANONICAL_WRITE_INPUT\/V1/);
  assert.doesNotMatch(envelope, /CANONICAL_WRITE_INPUT\/V1/);
  assert.equal((sql.match(/CANONICAL_WRITE_INPUT\/V1/g) || []).length, 1);
  assert.match(sql, /legacy canonical write input can only replay an existing receipt/);
});
