const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const SEC_SOURCE_HOST = 'www.sec.gov';
const PRODUCTION_PROJECT_REF = 'tzulhdasmioeechxapdy';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const INPUT_KEYS = Object.freeze([
  'retrieval_url',
  'final_url',
  'status_code',
  'content_type',
  'retrieved_at',
  'retrieval_policy_digest',
  'redirect_count',
  'response_bytes',
]);
const CAPTURE_KEYS = Object.freeze([
  'schema_version',
  'receipt_stage',
  'authority_representation',
  'source_host',
  'retrieval_url_sha256',
  'retrieved_at',
  'retrieval_policy_digest',
  'http_status',
  'response_content_type',
  'redirect_count',
  'response_bytes_sha256',
  'response_byte_length',
  'response_bytes_base64',
  'source_response_content_id',
  'canonical_text_status',
  'source_admission_status',
  'intake_capture_receipt_id',
]);

class SecEdgarIntakeCaptureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecEdgarIntakeCaptureError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new SecEdgarIntakeCaptureError(code, message);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sameKeys(value, keys) {
  return plainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function assertDigest(value, label) {
  if (!DIGEST_RE.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
}

function assertTimestamp(value) {
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (!TIMESTAMP_RE.test(value || '') || Number.isNaN(timestamp)
    || new Date(timestamp).toISOString() !== value) {
    fail('INVALID_RETRIEVAL_TIMESTAMP', 'retrieved_at must be a canonical UTC timestamp.');
  }
}

function exactBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  fail('MISSING_RESPONSE_BYTES', 'response_bytes must contain exact non-empty response bytes.');
}

function parseSecUrl(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail('INVALID_SEC_URL', `${label} must be an exact SEC HTTPS URL.`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('INVALID_SEC_URL', `${label} must be an exact SEC HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== SEC_SOURCE_HOST
    || parsed.username || parsed.password) {
    fail('NON_SEC_SOURCE', `${label} must use the pinned SEC source host over HTTPS.`);
  }
  return parsed;
}

function normaliseContentType(value) {
  if (typeof value !== 'string' || value.split(';', 1)[0].trim().toLowerCase() !== 'text/html') {
    fail('INVALID_CONTENT_TYPE', 'SEC response content type must be text/html.');
  }
  return 'text/html';
}

function assertNoProductionReference(input) {
  if (input && (input.project_ref === PRODUCTION_PROJECT_REF
    || input.database_project_ref === PRODUCTION_PROJECT_REF
    || [input.retrieval_url, input.final_url].some((value) => (
      typeof value === 'string' && value.includes(PRODUCTION_PROJECT_REF)
    )))) {
    fail('PRODUCTION_REFERENCE_FORBIDDEN', 'production database references are forbidden at intake.');
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function buildSecEdgarIntakeCapture(input = {}) {
  assertNoProductionReference(input);
  if (!sameKeys(input, INPUT_KEYS)) {
    fail('UNEXPECTED_INPUT_FIELDS', 'intake input must match its closed contract.');
  }
  const requested = parseSecUrl(input.retrieval_url, 'retrieval_url');
  const final = parseSecUrl(input.final_url, 'final_url');
  if (input.redirect_count !== 0 || final.href !== requested.href
    || input.final_url !== input.retrieval_url) {
    fail('REDIRECT_FORBIDDEN', 'redirects and final URL changes are forbidden.');
  }
  if (input.status_code !== 200) fail('HTTP_STATUS_REJECTED', 'SEC response status must be 200.');
  const responseContentType = normaliseContentType(input.content_type);
  assertTimestamp(input.retrieved_at);
  assertDigest(input.retrieval_policy_digest, 'retrieval_policy_digest');
  const bytes = exactBytes(input.response_bytes);
  if (bytes.length === 0) fail('MISSING_RESPONSE_BYTES', 'response_bytes must not be empty.');

  const responseBytesSha256 = sha256Hex(bytes);
  const responseContentId = contentId('SEC_HTTP_RESPONSE_CONTENT/V1', {
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    response_content_type: responseContentType,
    response_bytes_sha256: responseBytesSha256,
    response_byte_length: bytes.length,
  });
  const body = {
    schema_version: 'SEC_EDGAR_INTAKE_CAPTURE/V1',
    receipt_stage: 'INTAKE_CAPTURE',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_host: SEC_SOURCE_HOST,
    retrieval_url_sha256: sha256Hex(Buffer.from(input.retrieval_url, 'utf8')),
    retrieved_at: input.retrieved_at,
    retrieval_policy_digest: input.retrieval_policy_digest,
    http_status: 200,
    response_content_type: responseContentType,
    redirect_count: 0,
    response_bytes_sha256: responseBytesSha256,
    response_byte_length: bytes.length,
    response_bytes_base64: bytes.toString('base64'),
    source_response_content_id: responseContentId,
    canonical_text_status: 'NOT_CREATED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return deepFreeze({
    ...body,
    intake_capture_receipt_id: contentId('INTAKE_CAPTURE_RECEIPT/V1', body),
  });
}

function validateSecEdgarIntakeCapture(capture) {
  if (!sameKeys(capture, CAPTURE_KEYS)
    || capture.schema_version !== 'SEC_EDGAR_INTAKE_CAPTURE/V1'
    || capture.receipt_stage !== 'INTAKE_CAPTURE'
    || capture.authority_representation !== 'ORIGINAL_HTTP_RESPONSE_BYTES'
    || capture.source_host !== SEC_SOURCE_HOST
    || capture.http_status !== 200
    || capture.response_content_type !== 'text/html'
    || capture.redirect_count !== 0
    || capture.canonical_text_status !== 'NOT_CREATED'
    || capture.source_admission_status !== 'NOT_ATTEMPTED') {
    fail('INVALID_INTAKE_CAPTURE', 'intake capture does not match its closed receipt contract.');
  }
  assertTimestamp(capture.retrieved_at);
  assertDigest(capture.retrieval_url_sha256, 'retrieval_url_sha256');
  assertDigest(capture.retrieval_policy_digest, 'retrieval_policy_digest');
  assertDigest(capture.response_bytes_sha256, 'response_bytes_sha256');
  assertDigest(capture.source_response_content_id, 'source_response_content_id');
  assertDigest(capture.intake_capture_receipt_id, 'intake_capture_receipt_id');

  const bytes = Buffer.from(capture.response_bytes_base64 || '', 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== capture.response_bytes_base64
    || bytes.length !== capture.response_byte_length
    || sha256Hex(bytes) !== capture.response_bytes_sha256) {
    fail('RESPONSE_BYTES_MISMATCH', 'captured response bytes, length and digest must agree.');
  }
  const responseContentId = contentId('SEC_HTTP_RESPONSE_CONTENT/V1', {
    authority_representation: capture.authority_representation,
    response_content_type: capture.response_content_type,
    response_bytes_sha256: capture.response_bytes_sha256,
    response_byte_length: capture.response_byte_length,
  });
  const body = { ...capture };
  delete body.intake_capture_receipt_id;
  if (capture.source_response_content_id !== responseContentId
    || capture.intake_capture_receipt_id !== contentId('INTAKE_CAPTURE_RECEIPT/V1', body)) {
    fail('INTAKE_CAPTURE_MUTATED', 'intake capture identity does not match its payload.');
  }
  return true;
}

function verifySecEdgarIntakeCapture({ capture, ...input } = {}) {
  validateSecEdgarIntakeCapture(capture);
  const rebuilt = buildSecEdgarIntakeCapture(input);
  if (canonicalJson(capture) !== canonicalJson(rebuilt)) {
    fail('INTAKE_CAPTURE_MISMATCH', 'retrieval URL or response bytes no longer match the receipt.');
  }
  return true;
}

module.exports = {
  SEC_SOURCE_HOST,
  SecEdgarIntakeCaptureError,
  buildSecEdgarIntakeCapture,
  validateSecEdgarIntakeCapture,
  verifySecEdgarIntakeCapture,
};
