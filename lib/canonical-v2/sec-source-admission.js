const { canonicalJson, contentId } = require('./canonical-bytes');
const path = require('node:path');
const {
  validateSecEdgarIntakeCapture,
} = require('./sec-edgar-intake-capture');
const {
  decodeSecHtmlCanonicalTextSourceMap,
  validateSecHtmlCanonicalTextConversion,
} = require('./sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('./sec-html-canonical-text-verifier');

const DIGEST_RE = /^[a-f0-9]{64}$/;
const BUNDLE_KEYS = Object.freeze([
  'schema_version',
  'immutable_source_document',
  'source_admission_manifest',
  'source_admission_preparation_receipt',
  'semantic_extraction_input_envelope',
  'verified_sec_source_admission_bundle_id',
]);

class SecSourceAdmissionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecSourceAdmissionError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new SecSourceAdmissionError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function isPlain(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isPlain(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function assertDigest(value, label) {
  if (!DIGEST_RE.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
}

function assertVerifiedInputs(capture, conversion, verification) {
  validateSecEdgarIntakeCapture(capture);
  validateSecHtmlCanonicalTextConversion({ capture, conversion });
  if (!isPlain(verification)
    || verification.schema_version !== 'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1'
    || verification.verification_status !== 'PASS'
    || verification.source_admission_status !== 'NOT_ATTEMPTED') {
    fail('NON_PASS_VERIFICATION', 'source admission requires an independent PASS verification manifest.');
  }
  const independentlyVerified = verifySecHtmlCanonicalText({ capture, conversion });
  if (canonicalJson(verification) !== canonicalJson(independentlyVerified)) {
    fail('VERIFICATION_MANIFEST_MISMATCH', 'verification manifest does not match independent verification.');
  }
  return independentlyVerified;
}

function identified(schemaVersion, idKey, body) {
  return freeze({
    ...body,
    [idKey]: contentId(schemaVersion, body),
  });
}

function compactSourceMapLineage(conversion) {
  return {
    source_map_encoding: conversion.source_map_encoding,
    source_map_compressed_sha256: conversion.source_map_compressed_sha256,
    source_map_uncompressed_byte_length: conversion.source_map_uncompressed_byte_length,
    input_region_count: conversion.input_region_count,
    output_mapping_count: conversion.output_mapping_count,
    source_map_digest: conversion.source_map_digest,
  };
}

function buildAdmissionBundle({ capture, conversion, verified }) {

  const immutableBody = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2',
    source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_response_content_id: capture.source_response_content_id,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    response_content_type: capture.response_content_type,
    response_bytes_sha256: capture.response_bytes_sha256,
    response_byte_length: capture.response_byte_length,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    ...compactSourceMapLineage(conversion),
    verifier_digest: verified.verifier_digest,
    verification_manifest_id: verified.verification_manifest_id,
  };
  const immutable = identified(
    'IMMUTABLE_SOURCE_DOCUMENT/V2',
    'immutable_source_document_id',
    immutableBody,
  );

  const admittedIntervals = freeze([freeze({
    start: 0,
    end: conversion.canonical_text_byte_length,
  })]);
  const coverageProofDigest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
    admitted_intervals: admittedIntervals,
    excluded_intervals: [],
    discrepancy_count: 0,
  });
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_response_content_id: capture.source_response_content_id,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verified.verification_manifest_id,
    admitted_intervals: admittedIntervals,
    excluded_intervals: freeze([]),
    conversion_loss_residual_ids: freeze([]),
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: coverageProofDigest,
  };
  const admission = identified(
    'SOURCE_ADMISSION_MANIFEST/V2',
    'source_admission_manifest_id',
    admissionBody,
  );

  const preparationSlotId = contentId('SOURCE_ADMISSION_PREPARATION_SLOT/V1', {
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
  });
  const receiptBody = {
    schema_version: 'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1',
    operation: 'DEAL_SCOPE_RUN',
    action: 'PREPARE_SOURCE_ADMISSION',
    preparation_slot_id: preparationSlotId,
    immutable_source_document_id: immutable.immutable_source_document_id,
    canonical_text_id: conversion.canonical_text_id,
    verification_manifest_id: verified.verification_manifest_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    semantic_extraction_status: 'NOT_ATTEMPTED',
    terminal_status: 'PASS',
  };
  const receipt = identified(
    'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1',
    'source_admission_preparation_receipt_id',
    receiptBody,
  );

  const envelopeBody = {
    schema_version: 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    input_status: 'READY_FOR_OFFLINE_PROPOSAL',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    ...compactSourceMapLineage(conversion),
    verification_manifest_id: verified.verification_manifest_id,
    admitted_intervals: admittedIntervals,
    excluded_intervals: freeze([]),
    semantic_extraction_status: 'NOT_ATTEMPTED',
  };
  const envelope = identified(
    'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    'semantic_extraction_input_envelope_id',
    envelopeBody,
  );

  const bundleBody = {
    schema_version: 'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    source_admission_preparation_receipt: receipt,
    semantic_extraction_input_envelope: envelope,
  };
  return freeze({
    ...bundleBody,
    verified_sec_source_admission_bundle_id: contentId(
      'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
      bundleBody,
    ),
  });
}

function buildVerifiedSecSourceAdmission({ capture, conversion, verification } = {}) {
  return buildAdmissionBundle({
    capture,
    conversion,
    verified: assertVerifiedInputs(capture, conversion, verification),
  });
}

function conversionWithoutCompressedSourceMap(conversion) {
  const copy = { ...conversion };
  delete copy.source_map_payload_base64;
  delete copy.source_map_compressed_sha256;
  return copy;
}

function isSafeRepositoryRelativePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && value !== '.'
    && !path.isAbsolute(value)
    && !path.win32.isAbsolute(value)
    && !value.includes('\\')
    && !value.split(/[\\/]/).includes('..')
    && path.normalize(value) === value;
}

function buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload({
  capture,
  locally_validated_conversion: locallyValidatedConversion,
  adopted_conversion: adoptedConversion,
  verification,
  recorded_source_map_provenance: recordedSourceMapProvenance,
} = {}) {
  const verified = assertVerifiedInputs(capture, locallyValidatedConversion, verification);
  if (!recordedSourceMapProvenance
    || !isSafeRepositoryRelativePath(recordedSourceMapProvenance.source_map_payload_path)
    || !DIGEST_RE.test(recordedSourceMapProvenance.source_map_compressed_sha256 || '')) {
    fail('INVALID_RECORDED_SOURCE_MAP_PROVENANCE', 'recorded source-map payload path and SHA-256 are required.');
  }
  if (adoptedConversion.source_map_compressed_sha256
    !== recordedSourceMapProvenance.source_map_compressed_sha256) {
    fail('ADOPTED_SOURCE_MAP_DIGEST_MISMATCH', 'adopted source-map digest does not match the run-recorded payload digest.');
  }
  if (canonicalJson(conversionWithoutCompressedSourceMap(locallyValidatedConversion))
    !== canonicalJson(conversionWithoutCompressedSourceMap(adoptedConversion))) {
    fail('ADOPTED_SOURCE_MAP_CONVERSION_MISMATCH', 'adopted conversion differs from the strictly validated conversion outside compressed source-map fields.');
  }
  if (canonicalJson(decodeSecHtmlCanonicalTextSourceMap(locallyValidatedConversion))
    !== canonicalJson(decodeSecHtmlCanonicalTextSourceMap(adoptedConversion))) {
    fail('ADOPTED_SOURCE_MAP_DIVERGES', 'adopted source map does not inflate to the strictly validated source map.');
  }
  const adoptedVerification = verifySecHtmlCanonicalText({ capture, conversion: adoptedConversion });
  if (canonicalJson(verified) !== canonicalJson(adoptedVerification)) {
    fail('ADOPTED_SOURCE_MAP_VERIFICATION_MISMATCH', 'adopted conversion does not independently verify to the locally validated conversion.');
  }
  return buildAdmissionBundle({ capture, conversion: adoptedConversion, verified });
}

function validateVerifiedSecSourceAdmission({
  capture,
  conversion,
  verification,
  bundle,
} = {}) {
  if (!exactKeys(bundle, BUNDLE_KEYS)) {
    fail('INVALID_ADMISSION_BUNDLE', 'source-admission bundle must match its closed contract.');
  }
  const expected = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  if (canonicalJson(bundle) !== canonicalJson(expected)) {
    fail('ADMISSION_BUNDLE_MISMATCH', 'source-admission bundle identity or lineage was altered.');
  }
  assertDigest(bundle.verified_sec_source_admission_bundle_id, 'bundle identity');
  return true;
}

module.exports = {
  SecSourceAdmissionError,
  buildVerifiedSecSourceAdmission,
  buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload,
  validateVerifiedSecSourceAdmission,
};
