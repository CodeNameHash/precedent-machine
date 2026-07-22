const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  CHUNK_MAX_BYTE_LENGTH,
  buildSourceArtifactChunks,
  reconstructSourceArtifact,
  validateSourceArtifactChunk,
  validateSourceArtifactManifest,
} = require('../lib/canonical-v2/source-artifact-chunks');

function conversion(text = 'Canonical agreement text.') {
  return {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    canonical_text: text,
    nested: { beta: 2, alpha: 1 },
  };
}

function resignManifest(manifest, changes = {}) {
  const body = { ...manifest, ...changes };
  delete body.artifact_manifest_id;
  return {
    ...body,
    artifact_manifest_id: contentId('SOURCE_ARTIFACT_MANIFEST/V1', body),
  };
}

function resignChunk(chunk, changes = {}) {
  const body = { ...chunk, ...changes };
  delete body.chunk_id;
  return {
    ...body,
    chunk_id: contentId('SOURCE_ARTIFACT_CHUNK/V1', body),
  };
}

test('chunks complete canonical JSON deterministically and reconstructs it exactly', () => {
  const first = buildSourceArtifactChunks(conversion('x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2)));
  const reorderedInput = {
    nested: { alpha: 1, beta: 2 },
    canonical_text: 'x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2),
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
  };
  const second = buildSourceArtifactChunks(reorderedInput);

  assert.deepEqual(first, second);
  assert.ok(first.chunks.length >= 3);
  assert.equal(first.manifest.chunk_max_byte_length, 196608);
  assert.ok(first.chunks.every((chunk) => chunk.chunk_byte_length <= 196608));
  assert.deepEqual(reconstructSourceArtifact(first), reorderedInput);
  assert.equal(validateSourceArtifactManifest(first.manifest), true);
  for (const chunk of first.chunks) {
    assert.equal(validateSourceArtifactChunk({ manifest: first.manifest, chunk }), true);
  }
});

test('missing or reordered chunks cannot reconstruct an artifact', () => {
  const artifact = buildSourceArtifactChunks(conversion('x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2)));
  assert.throws(() => reconstructSourceArtifact({
    manifest: artifact.manifest,
    chunks: artifact.chunks.slice(0, -1),
  }), (error) => error.code === 'SOURCE_ARTIFACT_INCOMPLETE');
  assert.throws(() => reconstructSourceArtifact({
    manifest: artifact.manifest,
    chunks: [artifact.chunks[1], artifact.chunks[0], ...artifact.chunks.slice(2)],
  }), (error) => error.code === 'SOURCE_ARTIFACT_CHUNK_ORDER_MISMATCH');
});

test('tampered chunk bytes, hashes and identities are rejected', () => {
  const artifact = buildSourceArtifactChunks(conversion());
  const chunk = artifact.chunks[0];
  const bytes = Buffer.from(chunk.chunk_payload_base64, 'base64');
  bytes[0] ^= 1;
  const tamperedPayload = resignChunk(chunk, {
    chunk_payload_base64: bytes.toString('base64'),
  });
  assert.throws(() => validateSourceArtifactChunk({
    manifest: artifact.manifest,
    chunk: tamperedPayload,
  }), (error) => error.code === 'SOURCE_ARTIFACT_CHUNK_MISMATCH');

  assert.throws(() => validateSourceArtifactChunk({
    manifest: artifact.manifest,
    chunk: { ...chunk, chunk_id: 'f'.repeat(64) },
  }), (error) => error.code === 'INVALID_SOURCE_ARTIFACT_CHUNK');
});

test('oversized chunks remain invalid even when their manifest and identities are recomputed', () => {
  const artifact = buildSourceArtifactChunks(conversion('x'.repeat(CHUNK_MAX_BYTE_LENGTH + 8)));
  const oversizedBytes = Buffer.concat([
    Buffer.from(artifact.chunks[0].chunk_payload_base64, 'base64'),
    Buffer.from('x'),
  ]);
  const oversizedHash = sha256Hex(oversizedBytes);
  const orderedHashes = [...artifact.manifest.ordered_chunk_sha256];
  orderedHashes[0] = oversizedHash;
  const manifest = resignManifest(artifact.manifest, {
    ordered_chunk_sha256: orderedHashes,
  });
  const chunk = resignChunk(artifact.chunks[0], {
    artifact_manifest_id: manifest.artifact_manifest_id,
    chunk_byte_length: oversizedBytes.length,
    chunk_sha256: oversizedHash,
    chunk_payload_base64: oversizedBytes.toString('base64'),
  });
  assert.throws(() => validateSourceArtifactChunk({ manifest, chunk }), (error) => (
    error.code === 'INVALID_SOURCE_ARTIFACT_CHUNK'
  ));
});

test('chunks from different manifests cannot be mixed', () => {
  const first = buildSourceArtifactChunks(conversion('x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2)));
  const second = buildSourceArtifactChunks(conversion(`y${'x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2)}`));
  const mixed = [...first.chunks];
  mixed[1] = second.chunks[1];
  assert.throws(() => reconstructSourceArtifact({
    manifest: first.manifest,
    chunks: mixed,
  }), (error) => error.code === 'INVALID_SOURCE_ARTIFACT_CHUNK');
});

test('manifest fields and chunk hash order are identity-bearing', () => {
  const artifact = buildSourceArtifactChunks(conversion('x'.repeat(CHUNK_MAX_BYTE_LENGTH * 2)));
  assert.throws(() => validateSourceArtifactManifest({
    ...artifact.manifest,
    payload_byte_length: artifact.manifest.payload_byte_length + 1,
  }), (error) => error.code === 'INVALID_SOURCE_ARTIFACT_MANIFEST');
  const reorderedManifest = resignManifest(artifact.manifest, {
    ordered_chunk_sha256: [...artifact.manifest.ordered_chunk_sha256].reverse(),
  });
  const reboundChunks = artifact.chunks.map((chunk) => resignChunk(chunk, {
    artifact_manifest_id: reorderedManifest.artifact_manifest_id,
  }));
  assert.throws(() => reconstructSourceArtifact({
    manifest: reorderedManifest,
    chunks: reboundChunks,
  }), (error) => error.code === 'INVALID_SOURCE_ARTIFACT_CHUNK');
});
