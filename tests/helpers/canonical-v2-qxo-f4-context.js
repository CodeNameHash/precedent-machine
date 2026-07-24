const assert = require('node:assert/strict');

const { contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const {
  AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  AGREEMENT_CANONICAL_TEXT_ID,
  DEAL_ADMISSION_ID,
  DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_VALUE_CANONICAL_TEXT_ID,
  DEAL_VALUE_INTERVAL,
} = require('../../lib/canonical-v2/qxo-material-contracts-slice');
const {
  BUYER_CONFIG,
  SELLER_CONFIG,
} = require('../../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');
const fixture = require('../../__fixtures__/canonical-v2/qxo-f4-termination-source-spans.json');

const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';
const DEAL_VALUE_TEXT_BASE64 = 'ZW50ZXJlZCBpbnRvIGEgZGVmaW5pdGl2ZSBhZ3JlZW1lbnQgdG8gYWNxdWlyZSBUb3BCdWlsZCBDb3JwLiAoTllTRTogQkxEKSAo4oCcVG9wQnVpbGTigJ0pIGZvciBhcHByb3hpbWF0ZWx5ICQxNyBiaWxsaW9u';

function digest(label) {
  return contentId('QXO_F4_TERMINATION_TEST_SOURCE/V1', label);
}

function admittedContext({
  sourceOrdinal,
  documentHash,
  canonicalTextId,
  text,
}) {
  const immutableSourceDocumentId = digest(`immutable:${sourceOrdinal}`);
  const sourceContentId = digest(`source-content:${sourceOrdinal}`);
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const canonicalTextByteLength = Buffer.byteLength(text, 'utf8');
  const sourceMapDigest = digest(`map-digest:${sourceOrdinal}`);
  const admittedIntervals = [{ start: 0, end: canonicalTextByteLength }];
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutableSourceDocumentId,
    source_response_content_id: sourceContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: digest(`verification:${sourceOrdinal}`),
    admitted_intervals: admittedIntervals,
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
      canonical_text_id: canonicalTextId,
      canonical_text_byte_length: canonicalTextByteLength,
      source_map_digest: sourceMapDigest,
      admitted_intervals: admittedIntervals,
      excluded_intervals: [],
      discrepancy_count: 0,
    }),
  };
  const sourceAdmission = Object.freeze({
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  });
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: digest(`envelope:${sourceOrdinal}`),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: documentHash,
    source_byte_length: canonicalTextByteLength + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(Buffer.from(text, 'utf8')),
    canonical_text_byte_length: canonicalTextByteLength,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: digest(`map:${sourceOrdinal}`),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: digest(`verification:${sourceOrdinal}`),
  };
  return {
    sourceContext: Object.freeze({
      ...body,
      admitted_semantic_source_context_id: contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
    }),
    sourceAdmission,
  };
}

function copyPinnedSpans(target, config, encodedSpans) {
  for (const [key, pin] of Object.entries(config.spanPins)) {
    const bytes = Buffer.from(encodedSpans[key], 'base64');
    assert.equal(bytes.length, pin.interval.end - pin.interval.start, `${config.feeSide}:${key}`);
    assert.equal(sha256Hex(bytes), pin.sha256, `${config.feeSide}:${key}`);
    bytes.copy(target, pin.interval.start);
  }
}

function buildQxoF4SourceContexts() {
  assert.equal(fixture.schema_version, 'QXO_F4_TERMINATION_SOURCE_SPANS/V1');
  assert.equal(fixture.document_sha256, AGREEMENT_DOCUMENT_HASH);
  assert.equal(fixture.canonical_text_byte_length, AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH);
  const agreementBytes = Buffer.alloc(AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  copyPinnedSpans(agreementBytes, BUYER_CONFIG, fixture.buyer);
  copyPinnedSpans(agreementBytes, SELLER_CONFIG, fixture.seller);
  const dealValueBytes = Buffer.alloc(DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  Buffer.from(DEAL_VALUE_TEXT_BASE64, 'base64').copy(dealValueBytes, DEAL_VALUE_INTERVAL.start);
  const agreement = admittedContext({
    sourceOrdinal: 0,
    documentHash: AGREEMENT_DOCUMENT_HASH,
    canonicalTextId: AGREEMENT_CANONICAL_TEXT_ID,
    text: agreementBytes.toString('utf8'),
  });
  const dealValue = admittedContext({
    sourceOrdinal: 1,
    documentHash: DEAL_VALUE_DOCUMENT_HASH,
    canonicalTextId: DEAL_VALUE_CANONICAL_TEXT_ID,
    text: dealValueBytes.toString('utf8'),
  });
  return {
    agreementSourceContext: agreement.sourceContext,
    agreementSourceAdmission: agreement.sourceAdmission,
    dealValueSourceContext: dealValue.sourceContext,
    dealValueSourceAdmission: dealValue.sourceAdmission,
  };
}

module.exports = {
  buildQxoF4SourceContexts,
};
