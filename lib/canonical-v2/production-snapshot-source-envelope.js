const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildImmutableSource, validateImmutableSource } = require('./source-structure');

const SNAPSHOT_PROJECT_REF = 'beddepjkshmgenhsrnno';
const SNAPSHOT_PROJECT_NAME = 'deal-corpus-canonical-v2-staging-snapshot';
const PRODUCTION_PROJECT_REF = 'tzulhdasmioeechxapdy';
const SOURCE_TABLE = 'public.deals';
const SOURCE_PATH = 'metadata.full_text';
const SOURCE_KIND = 'LEGACY_DERIVED_TEXT_UTF8';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_RE = /^[a-f0-9]{64}$/;

const SOURCE_FIDELITY = Object.freeze({
  schema_version: 'LEGACY_DERIVED_SOURCE_FIDELITY/V1',
  authority_class: 'LEGACY_DERIVED_TEXT',
  original_package_bytes_status: 'NOT_AVAILABLE_TO_THIS_ENVELOPE',
  promotable_to_original_source: false,
});
const ENVELOPE_KEYS = Object.freeze([
  'schema_version',
  'snapshot_project_ref',
  'snapshot_project_name',
  'source_table',
  'source_path',
  'governed_source_row_id',
  'row_revision',
  'metadata_source_url_sha256',
  'exact_utf8_bytes_sha256',
  'exact_utf8_byte_length',
  'source_fidelity',
  'immutable_source',
  'production_snapshot_source_envelope_id',
]);

class ProductionSnapshotSourceEnvelopeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProductionSnapshotSourceEnvelopeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProductionSnapshotSourceEnvelopeError(code, message);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function assertPinnedSource({ project_ref: ref, project_name: name, source_table: table } = {}) {
  if (ref === PRODUCTION_PROJECT_REF) fail('PRODUCTION_SOURCE_FORBIDDEN', 'production project reads are forbidden.');
  if (ref !== SNAPSHOT_PROJECT_REF || name !== SNAPSHOT_PROJECT_NAME || table !== SOURCE_TABLE) {
    fail('UNPINNED_SNAPSHOT_SOURCE', 'source must be the hard-pinned isolated snapshot project and table.');
  }
}

function rowRevision(row, immutableSnapshotMarker) {
  const hasUpdatedAt = typeof row.updated_at === 'string' && row.updated_at.length > 0;
  const hasMarker = immutableSnapshotMarker !== undefined;
  if (hasUpdatedAt === hasMarker) {
    fail('INVALID_SNAPSHOT_REVISION', 'provide exactly one row updated_at or immutable snapshot marker.');
  }
  if (hasUpdatedAt) {
    if (Number.isNaN(Date.parse(row.updated_at))) {
      fail('INVALID_SNAPSHOT_REVISION', 'row updated_at must be a valid timestamp.');
    }
    return Object.freeze({ revision_type: 'ROW_UPDATED_AT', updated_at: row.updated_at });
  }
  if (!plainObject(immutableSnapshotMarker)
    || canonicalJson(Object.keys(immutableSnapshotMarker).sort())
      !== canonicalJson(['schema_version', 'marker_id'].sort())
    || immutableSnapshotMarker.schema_version !== 'IMMUTABLE_SNAPSHOT_MARKER/V1'
    || !DIGEST_RE.test(immutableSnapshotMarker.marker_id || '')) {
    fail('INVALID_SNAPSHOT_REVISION', 'immutable snapshot marker does not match its closed type.');
  }
  return Object.freeze({
    revision_type: 'IMMUTABLE_SNAPSHOT_MARKER',
    marker: Object.freeze({ ...immutableSnapshotMarker }),
  });
}

function validateRevision(revision) {
  if (!plainObject(revision)) fail('INVALID_SNAPSHOT_REVISION', 'snapshot revision is required.');
  if (revision.revision_type === 'ROW_UPDATED_AT') {
    if (canonicalJson(Object.keys(revision).sort()) !== canonicalJson(['revision_type', 'updated_at'].sort())
      || typeof revision.updated_at !== 'string' || Number.isNaN(Date.parse(revision.updated_at))) {
      fail('INVALID_SNAPSHOT_REVISION', 'bound row updated_at is invalid.');
    }
    return;
  }
  if (revision.revision_type !== 'IMMUTABLE_SNAPSHOT_MARKER'
    || canonicalJson(Object.keys(revision).sort()) !== canonicalJson(['revision_type', 'marker'].sort())
    || !plainObject(revision.marker)
    || canonicalJson(Object.keys(revision.marker).sort())
      !== canonicalJson(['schema_version', 'marker_id'].sort())
    || revision.marker.schema_version !== 'IMMUTABLE_SNAPSHOT_MARKER/V1'
    || !DIGEST_RE.test(revision.marker.marker_id || '')) {
    fail('INVALID_SNAPSHOT_REVISION', 'bound immutable snapshot marker is invalid.');
  }
}

function sourceValues(row) {
  if (!plainObject(row) || !UUID_RE.test(row.id || '')) {
    fail('INVALID_SOURCE_ROW', 'governed source row id must be a UUID.');
  }
  if (!plainObject(row.metadata) || typeof row.metadata.full_text !== 'string'
    || row.metadata.full_text.trim().length === 0) {
    fail('MISSING_SOURCE_TEXT', 'metadata.full_text must contain legacy derived text.');
  }
  if (typeof row.metadata.source_url !== 'string' || row.metadata.source_url.trim().length === 0) {
    fail('MISSING_SOURCE_URL', 'metadata.source_url is required for hashed lineage.');
  }
  return {
    text: row.metadata.full_text,
    sourceUrlDigest: sha256Hex(Buffer.from(row.metadata.source_url, 'utf8')),
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function buildProductionSnapshotSourceEnvelope({
  project_ref,
  project_name,
  source_table,
  row,
  immutable_snapshot_marker,
} = {}) {
  assertPinnedSource({ project_ref, project_name, source_table });
  const { text, sourceUrlDigest } = sourceValues(row);
  const revision = rowRevision(row, immutable_snapshot_marker);
  const occurrenceKey = contentId('PRODUCTION_SNAPSHOT_SOURCE_OCCURRENCE/V1', {
    snapshot_project_ref: project_ref,
    source_table,
    governed_source_row_id: row.id,
    row_revision: revision,
  });
  const immutableSource = buildImmutableSource({
    sourceBytes: Buffer.from(text, 'utf8'),
    sourceKind: SOURCE_KIND,
    sourceOccurrenceKey: occurrenceKey,
  });
  const body = {
    schema_version: 'PRODUCTION_SNAPSHOT_SOURCE_ENVELOPE/V1',
    snapshot_project_ref: project_ref,
    snapshot_project_name: project_name,
    source_table,
    source_path: SOURCE_PATH,
    governed_source_row_id: row.id,
    row_revision: revision,
    metadata_source_url_sha256: sourceUrlDigest,
    exact_utf8_bytes_sha256: immutableSource.document_hash,
    exact_utf8_byte_length: immutableSource.source_byte_length,
    source_fidelity: SOURCE_FIDELITY,
    immutable_source: immutableSource,
  };
  return deepFreeze({
    ...body,
    production_snapshot_source_envelope_id: contentId('PRODUCTION_SNAPSHOT_SOURCE_ENVELOPE/V1', body),
  });
}

function validateProductionSnapshotSourceEnvelope(envelope) {
  if (!plainObject(envelope)
    || envelope.schema_version !== 'PRODUCTION_SNAPSHOT_SOURCE_ENVELOPE/V1') {
    fail('INVALID_SOURCE_ENVELOPE', 'invalid production snapshot source envelope.');
  }
  assertPinnedSource({
    project_ref: envelope.snapshot_project_ref,
    project_name: envelope.snapshot_project_name,
    source_table: envelope.source_table,
  });
  if (envelope.source_path !== SOURCE_PATH || !UUID_RE.test(envelope.governed_source_row_id || '')
    || canonicalJson(envelope.source_fidelity) !== canonicalJson(SOURCE_FIDELITY)) {
    fail('INVALID_SOURCE_ENVELOPE', 'source identity or legacy fidelity marker is invalid.');
  }
  validateRevision(envelope.row_revision);
  validateImmutableSource(envelope.immutable_source);
  const expectedOccurrenceKey = contentId('PRODUCTION_SNAPSHOT_SOURCE_OCCURRENCE/V1', {
    snapshot_project_ref: envelope.snapshot_project_ref,
    source_table: envelope.source_table,
    governed_source_row_id: envelope.governed_source_row_id,
    row_revision: envelope.row_revision,
  });
  if (envelope.immutable_source.source_kind !== SOURCE_KIND
    || envelope.immutable_source.source_occurrence_key !== expectedOccurrenceKey
    || envelope.exact_utf8_bytes_sha256 !== envelope.immutable_source.document_hash
    || envelope.exact_utf8_byte_length !== envelope.immutable_source.source_byte_length
    || !DIGEST_RE.test(envelope.metadata_source_url_sha256 || '')) {
    fail('SOURCE_BYTES_MISMATCH', 'bound source bytes, length or lineage do not match.');
  }
  const body = { ...envelope };
  delete body.production_snapshot_source_envelope_id;
  if (canonicalJson(Object.keys(envelope).sort()) !== canonicalJson([...ENVELOPE_KEYS].sort())
    || envelope.production_snapshot_source_envelope_id
    !== contentId('PRODUCTION_SNAPSHOT_SOURCE_ENVELOPE/V1', body)) {
    fail('SOURCE_ENVELOPE_MUTATED', 'source envelope identity does not match its payload.');
  }
  return true;
}

function verifyProductionSnapshotSourceEnvelope({ envelope, row, immutable_snapshot_marker } = {}) {
  validateProductionSnapshotSourceEnvelope(envelope);
  const rebuilt = buildProductionSnapshotSourceEnvelope({
    project_ref: envelope.snapshot_project_ref,
    project_name: envelope.snapshot_project_name,
    source_table: envelope.source_table,
    row,
    immutable_snapshot_marker,
  });
  if (canonicalJson(envelope) !== canonicalJson(rebuilt)) {
    fail('SNAPSHOT_SOURCE_MUTATED', 'snapshot source row no longer matches the immutable envelope.');
  }
  return true;
}

module.exports = {
  PRODUCTION_PROJECT_REF,
  SNAPSHOT_PROJECT_NAME,
  SNAPSHOT_PROJECT_REF,
  SOURCE_FIDELITY,
  SOURCE_KIND,
  SOURCE_TABLE,
  ProductionSnapshotSourceEnvelopeError,
  buildProductionSnapshotSourceEnvelope,
  validateProductionSnapshotSourceEnvelope,
  verifyProductionSnapshotSourceEnvelope,
};
