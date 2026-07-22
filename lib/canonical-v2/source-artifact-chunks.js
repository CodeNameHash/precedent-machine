const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const ARTIFACT_KIND = 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2';
const PAYLOAD_ENCODING = 'CANONICAL_JSON_UTF8/V1';
const CHUNK_MAX_BYTE_LENGTH = 192 * 1024;
const MAX_ARTIFACT_BYTE_LENGTH = 128 * 1024 * 1024;
const MAX_CHUNK_COUNT = Math.ceil(MAX_ARTIFACT_BYTE_LENGTH / CHUNK_MAX_BYTE_LENGTH);
const DIGEST_RE = /^[a-f0-9]{64}$/;
const MANIFEST_KEYS = Object.freeze([
  'schema_version',
  'artifact_kind',
  'payload_encoding',
  'payload_byte_length',
  'payload_sha256',
  'chunk_count',
  'chunk_max_byte_length',
  'ordered_chunk_sha256',
  'artifact_manifest_id',
]);
const CHUNK_KEYS = Object.freeze([
  'schema_version',
  'artifact_manifest_id',
  'artifact_kind',
  'chunk_ordinal',
  'chunk_byte_length',
  'chunk_sha256',
  'chunk_payload_base64',
  'chunk_id',
]);

class SourceArtifactError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SourceArtifactError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new SourceArtifactError(code, message, details);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, keys) {
  return plainObject(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function manifestBody(manifest) {
  const body = { ...manifest };
  delete body.artifact_manifest_id;
  return body;
}

function chunkBody(chunk) {
  const body = { ...chunk };
  delete body.chunk_id;
  return body;
}

function validateSourceArtifactManifest(manifest) {
  if (!hasExactKeys(manifest, MANIFEST_KEYS)
    || manifest.schema_version !== 'SOURCE_ARTIFACT_MANIFEST/V1'
    || manifest.artifact_kind !== ARTIFACT_KIND
    || manifest.payload_encoding !== PAYLOAD_ENCODING
    || !Number.isSafeInteger(manifest.payload_byte_length)
    || manifest.payload_byte_length < 1
    || manifest.payload_byte_length > MAX_ARTIFACT_BYTE_LENGTH
    || !DIGEST_RE.test(manifest.payload_sha256 || '')
    || !Number.isSafeInteger(manifest.chunk_count)
    || manifest.chunk_count < 1
    || manifest.chunk_count > MAX_CHUNK_COUNT
    || manifest.chunk_max_byte_length !== CHUNK_MAX_BYTE_LENGTH
    || !Array.isArray(manifest.ordered_chunk_sha256)
    || manifest.ordered_chunk_sha256.length !== manifest.chunk_count
    || manifest.ordered_chunk_sha256.some((digest) => !DIGEST_RE.test(digest || ''))
    || manifest.chunk_count !== Math.ceil(
      manifest.payload_byte_length / CHUNK_MAX_BYTE_LENGTH,
    )
    || !DIGEST_RE.test(manifest.artifact_manifest_id || '')
    || manifest.artifact_manifest_id !== contentId(
      'SOURCE_ARTIFACT_MANIFEST/V1',
      manifestBody(manifest),
    )) {
    fail('INVALID_SOURCE_ARTIFACT_MANIFEST', 'source artifact manifest is outside its closed identity contract.');
  }
  return true;
}

function decodeChunkPayload(chunk) {
  if (typeof chunk.chunk_payload_base64 !== 'string' || chunk.chunk_payload_base64.length === 0) {
    fail('INVALID_SOURCE_ARTIFACT_CHUNK', 'source artifact chunk payload must be canonical non-empty base64.');
  }
  const bytes = Buffer.from(chunk.chunk_payload_base64, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== chunk.chunk_payload_base64) {
    fail('INVALID_SOURCE_ARTIFACT_CHUNK', 'source artifact chunk payload must be canonical non-empty base64.');
  }
  return bytes;
}

function expectedChunkByteLength(manifest, ordinal) {
  if (ordinal < manifest.chunk_count - 1) return CHUNK_MAX_BYTE_LENGTH;
  return manifest.payload_byte_length
    - (CHUNK_MAX_BYTE_LENGTH * (manifest.chunk_count - 1));
}

function validateSourceArtifactChunk({ manifest, chunk } = {}) {
  validateSourceArtifactManifest(manifest);
  if (!hasExactKeys(chunk, CHUNK_KEYS)
    || chunk.schema_version !== 'SOURCE_ARTIFACT_CHUNK/V1'
    || chunk.artifact_manifest_id !== manifest.artifact_manifest_id
    || chunk.artifact_kind !== manifest.artifact_kind
    || !Number.isSafeInteger(chunk.chunk_ordinal)
    || chunk.chunk_ordinal < 0
    || chunk.chunk_ordinal >= manifest.chunk_count
    || !Number.isSafeInteger(chunk.chunk_byte_length)
    || chunk.chunk_byte_length !== expectedChunkByteLength(manifest, chunk.chunk_ordinal)
    || chunk.chunk_byte_length > CHUNK_MAX_BYTE_LENGTH
    || !DIGEST_RE.test(chunk.chunk_sha256 || '')
    || chunk.chunk_sha256 !== manifest.ordered_chunk_sha256[chunk.chunk_ordinal]
    || !DIGEST_RE.test(chunk.chunk_id || '')
    || chunk.chunk_id !== contentId('SOURCE_ARTIFACT_CHUNK/V1', chunkBody(chunk))) {
    fail('INVALID_SOURCE_ARTIFACT_CHUNK', 'source artifact chunk is outside its manifest or identity contract.');
  }
  const bytes = decodeChunkPayload(chunk);
  if (bytes.length !== chunk.chunk_byte_length || sha256Hex(bytes) !== chunk.chunk_sha256) {
    fail('SOURCE_ARTIFACT_CHUNK_MISMATCH', 'source artifact chunk bytes, length and digest do not agree.');
  }
  return true;
}

function buildSourceArtifactChunks(conversion) {
  if (!plainObject(conversion) || conversion.schema_version !== ARTIFACT_KIND) {
    fail('INVALID_SOURCE_ARTIFACT_PAYLOAD', 'source artifact payload must be a complete canonical text conversion V2.');
  }
  const payload = Buffer.from(canonicalJson(conversion), 'utf8');
  if (payload.length < 1 || payload.length > MAX_ARTIFACT_BYTE_LENGTH) {
    fail('SOURCE_ARTIFACT_LIMIT_EXCEEDED', 'source artifact payload exceeds the bounded artifact limit.');
  }
  const rawChunks = [];
  for (let start = 0; start < payload.length; start += CHUNK_MAX_BYTE_LENGTH) {
    rawChunks.push(payload.subarray(start, Math.min(start + CHUNK_MAX_BYTE_LENGTH, payload.length)));
  }
  const manifestBodyValue = {
    schema_version: 'SOURCE_ARTIFACT_MANIFEST/V1',
    artifact_kind: ARTIFACT_KIND,
    payload_encoding: PAYLOAD_ENCODING,
    payload_byte_length: payload.length,
    payload_sha256: sha256Hex(payload),
    chunk_count: rawChunks.length,
    chunk_max_byte_length: CHUNK_MAX_BYTE_LENGTH,
    ordered_chunk_sha256: rawChunks.map((bytes) => sha256Hex(bytes)),
  };
  const manifest = deepFreeze({
    ...manifestBodyValue,
    artifact_manifest_id: contentId('SOURCE_ARTIFACT_MANIFEST/V1', manifestBodyValue),
  });
  const chunks = rawChunks.map((bytes, chunkOrdinal) => {
    const body = {
      schema_version: 'SOURCE_ARTIFACT_CHUNK/V1',
      artifact_manifest_id: manifest.artifact_manifest_id,
      artifact_kind: ARTIFACT_KIND,
      chunk_ordinal: chunkOrdinal,
      chunk_byte_length: bytes.length,
      chunk_sha256: manifest.ordered_chunk_sha256[chunkOrdinal],
      chunk_payload_base64: bytes.toString('base64'),
    };
    return deepFreeze({
      ...body,
      chunk_id: contentId('SOURCE_ARTIFACT_CHUNK/V1', body),
    });
  });
  return deepFreeze({ manifest, chunks });
}

function reconstructSourceArtifact({ manifest, chunks } = {}) {
  validateSourceArtifactManifest(manifest);
  if (!Array.isArray(chunks) || chunks.length !== manifest.chunk_count) {
    fail('SOURCE_ARTIFACT_INCOMPLETE', 'source artifact requires every manifest chunk exactly once.');
  }
  const buffers = chunks.map((chunk, ordinal) => {
    if (!plainObject(chunk) || chunk.chunk_ordinal !== ordinal) {
      fail('SOURCE_ARTIFACT_CHUNK_ORDER_MISMATCH', 'source artifact chunks must be in exact manifest order.');
    }
    validateSourceArtifactChunk({ manifest, chunk });
    return decodeChunkPayload(chunk);
  });
  const payload = Buffer.concat(buffers, manifest.payload_byte_length);
  if (payload.length !== manifest.payload_byte_length
    || sha256Hex(payload) !== manifest.payload_sha256) {
    fail('SOURCE_ARTIFACT_PAYLOAD_MISMATCH', 'reconstructed source artifact does not match its manifest.');
  }
  let parsed;
  try {
    parsed = JSON.parse(payload.toString('utf8'));
  } catch {
    fail('SOURCE_ARTIFACT_JSON_INVALID', 'reconstructed source artifact is not valid JSON.');
  }
  if (!plainObject(parsed)
    || parsed.schema_version !== manifest.artifact_kind
    || Buffer.from(canonicalJson(parsed), 'utf8').compare(payload) !== 0) {
    fail('SOURCE_ARTIFACT_NOT_CANONICAL', 'reconstructed source artifact is not canonical JSON for its declared kind.');
  }
  return deepFreeze(parsed);
}

module.exports = {
  ARTIFACT_KIND,
  CHUNK_MAX_BYTE_LENGTH,
  MAX_ARTIFACT_BYTE_LENGTH,
  PAYLOAD_ENCODING,
  SourceArtifactError,
  buildSourceArtifactChunks,
  reconstructSourceArtifact,
  validateSourceArtifactChunk,
  validateSourceArtifactManifest,
};
