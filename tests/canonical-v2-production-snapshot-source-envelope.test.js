const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SNAPSHOT_PROJECT_NAME,
  SNAPSHOT_PROJECT_REF,
  SOURCE_KIND,
  SOURCE_TABLE,
  buildProductionSnapshotSourceEnvelope,
  validateProductionSnapshotSourceEnvelope,
  verifyProductionSnapshotSourceEnvelope,
} = require('../lib/canonical-v2/production-snapshot-source-envelope');

function row(overrides = {}) {
  return {
    id: '1f3f7ea8-0f0b-4b64-8c2c-fb79c40c4431',
    updated_at: '2026-07-01T14:12:30.123Z',
    metadata: {
      full_text: 'The Company shall not solicit an Acquisition Proposal. £10 million.',
      source_url: 'https://snapshot.invalid/package?id=qxo&token=do-not-expose',
    },
    ...overrides,
  };
}

function build(sourceRow = row(), extra = {}) {
  return buildProductionSnapshotSourceEnvelope({
    project_ref: SNAPSHOT_PROJECT_REF,
    project_name: SNAPSHOT_PROJECT_NAME,
    source_table: SOURCE_TABLE,
    row: sourceRow,
    ...extra,
  });
}

test('binds one hard-pinned snapshot row to exact legacy-derived UTF-8 source bytes', () => {
  const sourceRow = row();
  const envelope = build(sourceRow);
  assert.equal(validateProductionSnapshotSourceEnvelope(envelope), true);
  assert.equal(verifyProductionSnapshotSourceEnvelope({ envelope, row: sourceRow }), true);
  assert.equal(envelope.immutable_source.source_kind, SOURCE_KIND);
  assert.equal(envelope.source_fidelity.promotable_to_original_source, false);
  assert.equal(envelope.exact_utf8_byte_length, Buffer.byteLength(sourceRow.metadata.full_text, 'utf8'));
  assert.equal(envelope.exact_utf8_bytes_sha256, envelope.immutable_source.document_hash);
  assert.doesNotMatch(JSON.stringify(envelope), /do-not-expose/);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.immutable_source));
});

test('accepts a closed immutable snapshot marker only when updated_at is absent', () => {
  const sourceRow = row({ updated_at: undefined });
  const marker = { schema_version: 'IMMUTABLE_SNAPSHOT_MARKER/V1', marker_id: 'a'.repeat(64) };
  const envelope = build(sourceRow, { immutable_snapshot_marker: marker });
  assert.equal(envelope.row_revision.revision_type, 'IMMUTABLE_SNAPSHOT_MARKER');
  assert.equal(verifyProductionSnapshotSourceEnvelope({
    envelope,
    row: sourceRow,
    immutable_snapshot_marker: marker,
  }), true);
  assert.throws(() => build(sourceRow), /exactly one/);
  assert.throws(() => build(row(), { immutable_snapshot_marker: marker }), /exactly one/);
  assert.throws(() => build(sourceRow, {
    immutable_snapshot_marker: { ...marker, invented: true },
  }), /closed type/);
});

test('refuses production, unpinned projects and any source path other than metadata.full_text', () => {
  assert.throws(() => buildProductionSnapshotSourceEnvelope({
    project_ref: 'tzulhdasmioeechxapdy',
    project_name: SNAPSHOT_PROJECT_NAME,
    source_table: SOURCE_TABLE,
    row: row(),
  }), /production project reads are forbidden/);
  assert.throws(() => buildProductionSnapshotSourceEnvelope({
    project_ref: SNAPSHOT_PROJECT_REF,
    project_name: 'lookalike-project',
    source_table: SOURCE_TABLE,
    row: row(),
  }), /hard-pinned/);
  assert.throws(() => buildProductionSnapshotSourceEnvelope({
    project_ref: SNAPSHOT_PROJECT_REF,
    project_name: SNAPSHOT_PROJECT_NAME,
    source_table: 'public.provisions',
    row: row(),
  }), /hard-pinned/);
});

test('refuses missing, empty, internally mutated and changed snapshot text', () => {
  assert.throws(() => build(row({ metadata: {} })), /full_text/);
  assert.throws(() => build(row({ metadata: { full_text: ' ', source_url: 'https://x.invalid' } })), /full_text/);
  assert.throws(() => build(row({ metadata: { full_text: 'text' } })), /source_url/);

  const sourceRow = row();
  const envelope = build(sourceRow);
  const changedBytes = { ...envelope, exact_utf8_byte_length: envelope.exact_utf8_byte_length + 1 };
  assert.throws(() => validateProductionSnapshotSourceEnvelope(changedBytes), /bytes, length or lineage/);
  const changedRow = row({ metadata: { ...sourceRow.metadata, full_text: `${sourceRow.metadata.full_text}!` } });
  assert.throws(() => verifyProductionSnapshotSourceEnvelope({ envelope, row: changedRow }), /no longer matches/);
  const changedUrl = row({ metadata: { ...sourceRow.metadata, source_url: 'https://snapshot.invalid/other' } });
  assert.throws(() => verifyProductionSnapshotSourceEnvelope({ envelope, row: changedUrl }), /no longer matches/);
});
