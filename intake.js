'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const KEYS = [
  'schema_version', 'receipt_stage', 'authority_representation', 'source_host',
  'retrieval_url_sha256', 'retrieved_at', 'retrieval_policy_digest', 'http_status',
  'response_content_type', 'redirect_count', 'response_bytes_sha256', 'response_byte_length',
  'response_bytes_base64', 'source_response_content_id', 'canonical_text_status',
  'source_admission_status', 'intake_capture_receipt_id',
];

function validateSecEdgarIntakeCapture(capture) {
  if (!capture || canonicalJson(Object.keys(capture).sort()) !== canonicalJson([...KEYS].sort())) {
    throw new TypeError('invalid closed intake capture');
  }
  const bytes = Buffer.from(capture.response_bytes_base64, 'base64');
  if (!bytes.length || bytes.length !== capture.response_byte_length
    || sha256Hex(bytes) !== capture.response_bytes_sha256) throw new TypeError('invalid intake bytes');
  return true;
}

function buildLegacyCapture({ requestedUrl, bytes, contentType, retrievedAt }) {
  const responseBytesSha256 = sha256Hex(bytes);
  const responseContentId = contentId('SEC_HTTP_RESPONSE_CONTENT/V1', {
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    response_content_type: 'text/html',
    response_bytes_sha256: responseBytesSha256,
    response_byte_length: bytes.length,
  });
  const body = {
    schema_version: 'SEC_EDGAR_INTAKE_CAPTURE/V1',
    receipt_stage: 'INTAKE_CAPTURE',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_host: 'www.sec.gov',
    retrieval_url_sha256: sha256Hex(requestedUrl),
    retrieved_at: retrievedAt,
    retrieval_policy_digest: 'a41b56aaac572e4149b71590b03c5d8fa5aaf43a02e90e26e5bada62428ab43e',
    http_status: 200,
    response_content_type: contentType.split(';', 1)[0].trim().toLowerCase(),
    redirect_count: 0,
    response_bytes_sha256: responseBytesSha256,
    response_byte_length: bytes.length,
    response_bytes_base64: bytes.toString('base64'),
    source_response_content_id: responseContentId,
    canonical_text_status: 'NOT_CREATED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return Object.freeze({
    ...body,
    intake_capture_receipt_id: contentId('INTAKE_CAPTURE_RECEIPT/V1', body),
  });
}

module.exports = { buildLegacyCapture, validateSecEdgarIntakeCapture };
