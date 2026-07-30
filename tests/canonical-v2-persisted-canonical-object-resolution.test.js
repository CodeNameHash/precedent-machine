const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPersistedCanonicalObjectRequests,
  resolvePersistedCanonicalWriteSet,
} = require('../lib/canonical-v2/persisted-canonical-object-resolution');

const ID = '1'.repeat(64);
const STORED_CLOSURE = '2'.repeat(64);
const VALIDATION_CLOSURE = '3'.repeat(64);
const PAYLOAD_DIGEST = '4'.repeat(64);

function writeSet() {
  return {
    excerpts: [{
      schema_version: 'EXCERPT/V1',
      excerpt_id: ID,
      text: 'Exact source text',
      closure_id: VALIDATION_CLOSURE,
    }],
    claims: [],
  };
}

function storedRow(overrides = {}) {
  return {
    input_ordinal: 0,
    object_kind: 'excerpts',
    object_id: ID,
    closure_id: STORED_CLOSURE,
    canonical_payload_digest: PAYLOAD_DIGEST,
    canonical_payload: {
      schema_version: 'EXCERPT/V1',
      excerpt_id: ID,
      text: 'Exact source text',
      closure_id: STORED_CLOSURE,
    },
    ...overrides,
  };
}

test('one prior object becomes one exact persisted reference', () => {
  const proposed = writeSet();
  const requests = buildPersistedCanonicalObjectRequests(proposed);
  const result = resolvePersistedCanonicalWriteSet({
    writeSet: proposed,
    requests,
    storedRows: [storedRow()],
  });
  assert.deepEqual(requests, [{
    input_ordinal: 0,
    object_kind: 'excerpts',
    object_id: ID,
  }]);
  assert.deepEqual(result.writeSet.excerpts, []);
  assert.equal(result.retainedObjectCount, 1);
  assert.deepEqual(result.writeSet.persisted_object_references, [{
    schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
    object_kind: 'excerpts',
    object_id: ID,
    stored_closure_id: STORED_CLOSURE,
    canonical_payload_digest: PAYLOAD_DIGEST,
    validation_closure_id: VALIDATION_CLOSURE,
  }]);
  assert.equal(
    result.retainedCanonicalObjects[0].canonical_payload.closure_id,
    STORED_CLOSURE,
  );
});

test('a missing stored object remains in the new write set', () => {
  const proposed = writeSet();
  const requests = buildPersistedCanonicalObjectRequests(proposed);
  const result = resolvePersistedCanonicalWriteSet({
    writeSet: proposed,
    requests,
    storedRows: [{
      input_ordinal: 0,
      object_kind: 'excerpts',
      object_id: ID,
      closure_id: null,
      canonical_payload_digest: null,
      canonical_payload: null,
    }],
  });
  assert.equal(result.writeSet.excerpts.length, 1);
  assert.deepEqual(result.writeSet.persisted_object_references, []);
  assert.equal(result.retainedObjectCount, 0);
});

test('semantic drift, reordered results and pre-resolved input fail closed', () => {
  const proposed = writeSet();
  const requests = buildPersistedCanonicalObjectRequests(proposed);
  assert.throws(
    () => resolvePersistedCanonicalWriteSet({
      writeSet: proposed,
      requests,
      storedRows: [storedRow({
        canonical_payload: {
          ...storedRow().canonical_payload,
          text: 'Different source text',
        },
      })],
    }),
    /conflicts beyond its closure/,
  );
  assert.throws(
    () => resolvePersistedCanonicalWriteSet({
      writeSet: proposed,
      requests,
      storedRows: [{ ...storedRow(), input_ordinal: 1 }],
    }),
    /changed canonical object order or identity/,
  );
  assert.throws(
    () => resolvePersistedCanonicalWriteSet({
      writeSet: { ...proposed, persisted_object_references: [] },
      requests,
      storedRows: [storedRow()],
    }),
    /requires an unresolved canonical writeSet/,
  );
});
