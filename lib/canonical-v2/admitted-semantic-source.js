const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  decodeSecHtmlCanonicalTextSourceMap,
} = require('./sec-html-canonical-text');

const DIGEST_RE = /^[a-f0-9]{64}$/;
const CONVERSION_KEYS = Object.freeze([
  'schema_version',
  'conversion_stage',
  'verification_status',
  'source_admission_status',
  'source_response_content_id',
  'intake_capture_receipt_id',
  'converter_digest',
  'converter_config_digest',
  'canonical_text',
  'canonical_text_sha256',
  'canonical_text_byte_length',
  'source_map_encoding',
  'source_map_payload_base64',
  'source_map_compressed_sha256',
  'source_map_uncompressed_byte_length',
  'input_region_count',
  'output_mapping_count',
  'source_map_digest',
  'canonical_text_id',
]);
const IMMUTABLE_SOURCE_KEYS = Object.freeze([
  'schema_version',
  'source_kind',
  'authority_representation',
  'source_response_content_id',
  'intake_capture_receipt_id',
  'response_content_type',
  'response_bytes_sha256',
  'response_byte_length',
  'canonical_text_id',
  'canonical_text_sha256',
  'canonical_text_byte_length',
  'converter_digest',
  'converter_config_digest',
  'source_map_encoding',
  'source_map_compressed_sha256',
  'source_map_uncompressed_byte_length',
  'input_region_count',
  'output_mapping_count',
  'source_map_digest',
  'verifier_digest',
  'verification_manifest_id',
  'immutable_source_document_id',
]);
const ADMISSION_KEYS = Object.freeze([
  'schema_version',
  'admission_state',
  'source_kind',
  'immutable_source_document_id',
  'source_response_content_id',
  'canonical_text_id',
  'verification_manifest_id',
  'admitted_intervals',
  'excluded_intervals',
  'conversion_loss_residual_ids',
  'discrepancy_count',
  'blocking_discrepancy_count',
  'coverage_proof_digest',
  'source_admission_manifest_id',
]);
const ENVELOPE_KEYS = Object.freeze([
  'schema_version',
  'input_status',
  'coordinate_system',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'canonical_text_id',
  'canonical_text_sha256',
  'canonical_text_byte_length',
  'source_map_encoding',
  'source_map_compressed_sha256',
  'source_map_uncompressed_byte_length',
  'input_region_count',
  'output_mapping_count',
  'source_map_digest',
  'verification_manifest_id',
  'admitted_intervals',
  'excluded_intervals',
  'semantic_extraction_status',
  'semantic_extraction_input_envelope_id',
]);
const SOURCE_MAP_LINEAGE_KEYS = Object.freeze([
  'source_map_encoding',
  'source_map_compressed_sha256',
  'source_map_uncompressed_byte_length',
  'input_region_count',
  'output_mapping_count',
  'source_map_digest',
]);
const CONTEXT_KEYS = Object.freeze([
  'schema_version',
  'governed_deal_key',
  'deal_admission_id',
  'source_ordinal',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'semantic_extraction_input_envelope_id',
  'source_content_id',
  'source_occurrence_id',
  'source_occurrence_key',
  'source_kind',
  'document_hash',
  'source_byte_length',
  'canonical_text_id',
  'canonical_text_sha256',
  'canonical_text_byte_length',
  'canonical_text',
  'converter_digest',
  'converter_config_digest',
  'source_map_encoding',
  'source_map_compressed_sha256',
  'source_map_uncompressed_byte_length',
  'input_region_count',
  'output_mapping_count',
  'source_map_digest',
  'verification_manifest_id',
  'admitted_semantic_source_context_id',
]);
const REFERENCE_KEYS = Object.freeze([
  'schema_version',
  'immutable_source_document_id',
  'source_admission_manifest_id',
  'semantic_extraction_input_envelope_id',
  'canonical_text_id',
  'governed_deal_key',
  'deal_admission_id',
  'source_ordinal',
]);

class AdmittedSemanticSourceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdmittedSemanticSourceError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AdmittedSemanticSourceError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function requireDigest(value, label) {
  if (!DIGEST_RE.test(value || '')) fail('INVALID_DIGEST', `${label} must be a SHA-256 digest.`);
}

function requireIdentity(value, keys, idKey, domain, label) {
  if (!exactKeys(value, keys)) fail('INVALID_CONTRACT', `${label} must match its closed contract.`);
  const body = { ...value };
  const id = body[idKey];
  delete body[idKey];
  requireDigest(id, idKey);
  if (id !== contentId(domain, body)) fail('IDENTITY_MISMATCH', `${label} identity does not match its payload.`);
}

function requireFullInterval(intervals, byteLength, label) {
  if (canonicalJson(intervals) !== canonicalJson([{ start: 0, end: byteLength }])) {
    fail('INCOMPLETE_ADMISSION', `${label} must admit the complete canonical text.`);
  }
}

function requireInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    fail('INVALID_INTEGER', `${label} must be an integer greater than or equal to ${minimum}.`);
  }
}

function sourceMapLineage(value) {
  return Object.fromEntries(SOURCE_MAP_LINEAGE_KEYS.map((key) => [key, value[key]]));
}

function requireSame(label, ...values) {
  if (new Set(values.map((value) => canonicalJson(value))).size !== 1) {
    fail('LINEAGE_MISMATCH', `${label} does not agree across the admitted source chain.`);
  }
}

function validateConversion(conversion) {
  if (!exactKeys(conversion, CONVERSION_KEYS)
    || conversion.schema_version !== 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
    || conversion.conversion_stage !== 'CONVERSION_ONLY'
    || conversion.verification_status !== 'NOT_ATTEMPTED'
    || conversion.source_admission_status !== 'NOT_ATTEMPTED'
    || typeof conversion.canonical_text !== 'string') {
    fail('INVALID_CONVERSION', 'conversion must match the closed conversion-only V2 contract.');
  }
  for (const field of [
    'source_response_content_id', 'intake_capture_receipt_id', 'converter_digest',
    'converter_config_digest', 'canonical_text_sha256', 'source_map_compressed_sha256',
    'source_map_digest', 'canonical_text_id',
  ]) requireDigest(conversion[field], field);
  const canonicalBytes = Buffer.from(conversion.canonical_text, 'utf8');
  if (canonicalBytes.length !== conversion.canonical_text_byte_length
    || sha256Hex(canonicalBytes) !== conversion.canonical_text_sha256) {
    fail('CANONICAL_TEXT_MISMATCH', 'canonical text bytes, length and digest do not agree.');
  }
  const canonicalIdentity = {
    source_response_content_id: conversion.source_response_content_id,
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
  };
  if (conversion.canonical_text_id !== contentId('SEC_CANONICAL_TEXT/V2', canonicalIdentity)) {
    fail('CANONICAL_TEXT_IDENTITY_MISMATCH', 'canonical text identity does not match its closed lineage.');
  }
  try {
    decodeSecHtmlCanonicalTextSourceMap(conversion);
  } catch (error) {
    fail('INVALID_CONVERSION_SOURCE_MAP', error.message);
  }
}

function validateCommittedChain({
  immutable_source_document: immutable,
  source_admission_manifest: admission,
  semantic_extraction_input_envelope: envelope,
  conversion,
} = {}) {
  validateConversion(conversion);
  requireIdentity(
    immutable,
    IMMUTABLE_SOURCE_KEYS,
    'immutable_source_document_id',
    'IMMUTABLE_SOURCE_DOCUMENT/V2',
    'immutable source document',
  );
  requireIdentity(
    admission,
    ADMISSION_KEYS,
    'source_admission_manifest_id',
    'SOURCE_ADMISSION_MANIFEST/V2',
    'source admission manifest',
  );
  requireIdentity(
    envelope,
    ENVELOPE_KEYS,
    'semantic_extraction_input_envelope_id',
    'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    'semantic extraction input envelope',
  );
  for (const field of [
    'source_response_content_id', 'intake_capture_receipt_id', 'response_bytes_sha256',
    'canonical_text_id', 'canonical_text_sha256', 'converter_digest',
    'converter_config_digest', 'source_map_compressed_sha256', 'source_map_digest',
    'verifier_digest', 'verification_manifest_id',
  ]) requireDigest(immutable[field], `immutable_source_document.${field}`);
  requireDigest(admission.coverage_proof_digest, 'source_admission_manifest.coverage_proof_digest');
  requireInteger(immutable.response_byte_length, 'immutable_source_document.response_byte_length', 1);
  requireInteger(immutable.canonical_text_byte_length,
    'immutable_source_document.canonical_text_byte_length');
  requireInteger(immutable.source_map_uncompressed_byte_length,
    'immutable_source_document.source_map_uncompressed_byte_length', 1);
  requireInteger(immutable.input_region_count, 'immutable_source_document.input_region_count', 1);
  requireInteger(immutable.output_mapping_count,
    'immutable_source_document.output_mapping_count');
  if (immutable.schema_version !== 'IMMUTABLE_SOURCE_DOCUMENT/V2'
    || immutable.source_kind !== 'ORIGINAL_BYTES'
    || immutable.authority_representation !== 'ORIGINAL_HTTP_RESPONSE_BYTES'
    || immutable.response_content_type !== 'text/html') {
    fail('INVALID_IMMUTABLE_SOURCE', 'immutable source is not an admitted original SEC response.');
  }
  if (admission.schema_version !== 'SOURCE_ADMISSION_MANIFEST/V2'
    || admission.admission_state !== 'VERIFIED'
    || admission.source_kind !== 'ORIGINAL_BYTES'
    || admission.discrepancy_count !== 0
    || admission.blocking_discrepancy_count !== 0
    || canonicalJson(admission.excluded_intervals) !== '[]'
    || canonicalJson(admission.conversion_loss_residual_ids) !== '[]') {
    fail('SOURCE_NOT_VERIFIED', 'source admission must be VERIFIED with no discrepancy or excluded evidence.');
  }
  if (envelope.schema_version !== 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1'
    || envelope.input_status !== 'READY_FOR_OFFLINE_PROPOSAL'
    || envelope.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
    || envelope.semantic_extraction_status !== 'NOT_ATTEMPTED'
    || canonicalJson(envelope.excluded_intervals) !== '[]') {
    fail('SOURCE_NOT_READY', 'semantic extraction envelope is not in its exact READY state.');
  }
  requireFullInterval(admission.admitted_intervals, conversion.canonical_text_byte_length, 'admission');
  requireFullInterval(envelope.admitted_intervals, conversion.canonical_text_byte_length, 'envelope');
  const coverageProof = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
    admitted_intervals: admission.admitted_intervals,
    excluded_intervals: admission.excluded_intervals,
    discrepancy_count: admission.discrepancy_count,
  });
  if (admission.coverage_proof_digest !== coverageProof) {
    fail('COVERAGE_PROOF_MISMATCH', 'source admission coverage proof does not match the canonical text.');
  }
  requireSame('source response content identity',
    conversion.source_response_content_id,
    immutable.source_response_content_id,
    admission.source_response_content_id);
  requireSame('intake capture identity',
    conversion.intake_capture_receipt_id,
    immutable.intake_capture_receipt_id);
  requireSame('immutable source identity',
    immutable.immutable_source_document_id,
    admission.immutable_source_document_id,
    envelope.immutable_source_document_id);
  requireSame('source admission identity',
    admission.source_admission_manifest_id,
    envelope.source_admission_manifest_id);
  requireSame('canonical text identity',
    conversion.canonical_text_id,
    immutable.canonical_text_id,
    admission.canonical_text_id,
    envelope.canonical_text_id);
  requireSame('canonical text digest',
    conversion.canonical_text_sha256,
    immutable.canonical_text_sha256,
    envelope.canonical_text_sha256);
  requireSame('canonical text length',
    conversion.canonical_text_byte_length,
    immutable.canonical_text_byte_length,
    envelope.canonical_text_byte_length);
  requireSame('converter digest', conversion.converter_digest, immutable.converter_digest);
  requireSame('converter configuration digest',
    conversion.converter_config_digest,
    immutable.converter_config_digest);
  requireSame('source-map lineage',
    sourceMapLineage(conversion),
    sourceMapLineage(immutable),
    sourceMapLineage(envelope));
  requireSame('verification manifest identity',
    immutable.verification_manifest_id,
    admission.verification_manifest_id,
    envelope.verification_manifest_id);
}

function validateContextShape(context) {
  if (!exactKeys(context, CONTEXT_KEYS)
    || context.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1'
    || context.source_kind !== 'ORIGINAL_BYTES'
    || !Number.isInteger(context.source_ordinal)
    || context.source_ordinal < 0
    || typeof context.governed_deal_key !== 'string'
    || !context.governed_deal_key
    || context.governed_deal_key.trim() !== context.governed_deal_key
    || !exactKeys(context.canonical_text, ['schema_version', 'canonical_text_id', 'text'])
    || context.canonical_text.schema_version !== 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1'
    || context.canonical_text.canonical_text_id !== context.canonical_text_id
    || typeof context.canonical_text.text !== 'string') {
    fail('INVALID_CONTEXT', 'admitted semantic source context does not match its closed runtime contract.');
  }
  for (const field of [
    'deal_admission_id', 'immutable_source_document_id', 'source_admission_manifest_id',
    'semantic_extraction_input_envelope_id', 'source_content_id', 'source_occurrence_id',
    'source_occurrence_key', 'document_hash', 'canonical_text_id', 'canonical_text_sha256',
    'converter_digest', 'converter_config_digest', 'source_map_compressed_sha256',
    'source_map_digest', 'verification_manifest_id', 'admitted_semantic_source_context_id',
  ]) requireDigest(context[field], field);
  requireInteger(context.source_byte_length, 'source_byte_length', 1);
  requireInteger(context.canonical_text_byte_length, 'canonical_text_byte_length');
  requireInteger(context.source_map_uncompressed_byte_length,
    'source_map_uncompressed_byte_length', 1);
  requireInteger(context.input_region_count, 'input_region_count', 1);
  requireInteger(context.output_mapping_count, 'output_mapping_count');
  const canonicalBytes = Buffer.from(context.canonical_text.text, 'utf8');
  if (canonicalBytes.length !== context.canonical_text_byte_length
    || sha256Hex(canonicalBytes) !== context.canonical_text_sha256) {
    fail('CANONICAL_TEXT_MISMATCH', 'runtime canonical text bytes, length and digest do not agree.');
  }
  const occurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: context.deal_admission_id,
    source_ordinal: context.source_ordinal,
    immutable_source_document_id: context.immutable_source_document_id,
  });
  const occurrenceId = contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: context.source_content_id,
    source_occurrence_key: occurrenceKey,
  });
  if (context.source_occurrence_key !== occurrenceKey
    || context.source_occurrence_id !== occurrenceId) {
    fail('SOURCE_OCCURRENCE_MISMATCH', 'source occurrence is not bound to deal admission, ordinal and immutable source.');
  }
  const body = { ...context };
  delete body.admitted_semantic_source_context_id;
  if (context.admitted_semantic_source_context_id
    !== contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body)) {
    fail('CONTEXT_IDENTITY_MISMATCH', 'admitted semantic source context identity does not match its payload.');
  }
}

function buildAdmittedSemanticSourceContext({
  immutable_source_document: immutable,
  source_admission_manifest: admission,
  semantic_extraction_input_envelope: envelope,
  conversion,
  governed_deal_key: governedDealKey,
  deal_admission_id: dealAdmissionId,
  source_ordinal: sourceOrdinal,
} = {}) {
  validateCommittedChain({
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    semantic_extraction_input_envelope: envelope,
    conversion,
  });
  if (typeof governedDealKey !== 'string' || !governedDealKey.trim()
    || governedDealKey.trim() !== governedDealKey) {
    fail('INVALID_DEAL_KEY', 'governed_deal_key must be a non-empty trimmed string.');
  }
  requireDigest(dealAdmissionId, 'deal_admission_id');
  if (!Number.isInteger(sourceOrdinal) || sourceOrdinal < 0) {
    fail('INVALID_SOURCE_ORDINAL', 'source_ordinal must be a non-negative integer.');
  }
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutable.immutable_source_document_id,
  });
  const sourceOccurrenceId = contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: immutable.source_response_content_id,
    source_occurrence_key: sourceOccurrenceKey,
  });
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: envelope.semantic_extraction_input_envelope_id,
    source_content_id: immutable.source_response_content_id,
    source_occurrence_id: sourceOccurrenceId,
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: immutable.response_bytes_sha256,
    source_byte_length: immutable.response_byte_length,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    canonical_text: freeze({
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: conversion.canonical_text_id,
      text: conversion.canonical_text,
    }),
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    ...sourceMapLineage(conversion),
    verification_manifest_id: immutable.verification_manifest_id,
  };
  const context = freeze({
    ...body,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      body,
    ),
  });
  validateContextShape(context);
  return context;
}

function validateAdmittedSemanticSourceContext({ context, ...inputs } = {}) {
  validateContextShape(context);
  const expected = buildAdmittedSemanticSourceContext(inputs);
  if (canonicalJson(context) !== canonicalJson(expected)) {
    fail('CONTEXT_LINEAGE_MISMATCH', 'runtime source context does not match its committed source chain.');
  }
  return true;
}

function buildAdmittedSourceReference(context) {
  validateContextShape(context);
  return freeze({
    schema_version: 'ADMITTED_SOURCE_REFERENCE/V1',
    immutable_source_document_id: context.immutable_source_document_id,
    source_admission_manifest_id: context.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: context.semantic_extraction_input_envelope_id,
    canonical_text_id: context.canonical_text_id,
    governed_deal_key: context.governed_deal_key,
    deal_admission_id: context.deal_admission_id,
    source_ordinal: context.source_ordinal,
  });
}

module.exports = {
  AdmittedSemanticSourceError,
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
  validateAdmittedSemanticSourceContext,
};
