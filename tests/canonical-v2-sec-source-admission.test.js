const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync, inflateRawSync } = require('node:zlib');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
  buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload,
  validateVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const { sourceMapPayloadPathFor } = require('../lib/canonical-v2/source-map-payload-store');

function inputs(html = '<body><p>Section 5.2. Four business days.</p></body>') {
  const url = 'https://www.sec.gov/Archives/edgar/data/1/qxo.htm';
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-22T15:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from(html, 'utf8'),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  return { capture, conversion, verification };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('builds the closed verified source-admission chain without semantic claims', () => {
  const source = inputs();
  const bundle = buildVerifiedSecSourceAdmission(source);
  const immutable = bundle.immutable_source_document;
  const admission = bundle.source_admission_manifest;
  const receipt = bundle.source_admission_preparation_receipt;
  const envelope = bundle.semantic_extraction_input_envelope;

  assert.equal(immutable.schema_version, 'IMMUTABLE_SOURCE_DOCUMENT/V2');
  assert.equal(immutable.source_kind, 'ORIGINAL_BYTES');
  assert.equal(immutable.source_response_content_id, source.capture.source_response_content_id);
  assert.equal(immutable.verification_manifest_id, source.verification.verification_manifest_id);
  assert.equal(immutable.source_map_encoding, source.conversion.source_map_encoding);
  assert.equal(
    immutable.source_map_compressed_sha256,
    source.conversion.source_map_compressed_sha256,
  );
  assert.equal(
    immutable.source_map_uncompressed_byte_length,
    source.conversion.source_map_uncompressed_byte_length,
  );
  assert.equal(immutable.input_region_count, source.verification.input_region_count);
  assert.equal(immutable.output_mapping_count, source.verification.output_mapping_count);
  assert.equal(admission.schema_version, 'SOURCE_ADMISSION_MANIFEST/V2');
  assert.equal(admission.admission_state, 'VERIFIED');
  assert.deepEqual(admission.admitted_intervals, [{
    start: 0,
    end: source.conversion.canonical_text_byte_length,
  }]);
  assert.equal(admission.discrepancy_count, 0);
  assert.equal(admission.blocking_discrepancy_count, 0);
  assert.deepEqual(admission.excluded_intervals, []);
  assert.deepEqual(admission.conversion_loss_residual_ids, []);
  assert.equal(receipt.action, 'PREPARE_SOURCE_ADMISSION');
  assert.equal(receipt.terminal_status, 'PASS');
  assert.equal(receipt.semantic_extraction_status, 'NOT_ATTEMPTED');
  assert.equal(envelope.coordinate_system, 'UTF8_CANONICAL_TEXT_HALF_OPEN');
  assert.equal(envelope.input_status, 'READY_FOR_OFFLINE_PROPOSAL');
  assert.equal(envelope.semantic_extraction_status, 'NOT_ATTEMPTED');
  assert.equal(envelope.source_map_digest, source.verification.source_map_digest);
  assert.equal(
    envelope.source_map_compressed_sha256,
    source.conversion.source_map_compressed_sha256,
  );
  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(validateVerifiedSecSourceAdmission({ ...source, bundle }), true);
});

test('content-addresses every new object over its exact closed payload', () => {
  const source = inputs();
  const bundle = buildVerifiedSecSourceAdmission(source);
  const cases = [
    ['immutable_source_document', 'IMMUTABLE_SOURCE_DOCUMENT/V2', 'immutable_source_document_id'],
    ['source_admission_manifest', 'SOURCE_ADMISSION_MANIFEST/V2', 'source_admission_manifest_id'],
    ['source_admission_preparation_receipt', 'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1', 'source_admission_preparation_receipt_id'],
    ['semantic_extraction_input_envelope', 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', 'semantic_extraction_input_envelope_id'],
  ];
  for (const [key, domain, idKey] of cases) {
    const body = { ...bundle[key] };
    const id = body[idKey];
    delete body[idKey];
    assert.equal(id, contentId(domain, body));
  }
  const body = { ...bundle };
  delete body.verified_sec_source_admission_bundle_id;
  assert.equal(
    bundle.verified_sec_source_admission_bundle_id,
    contentId('VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1', body),
  );
});

test('references rather than duplicates original response bytes or canonical text', () => {
  const html = '<body><p>UNIQUE_ORIGINAL_RESPONSE_MARKER</p></body>';
  const source = inputs(html);
  const bundle = buildVerifiedSecSourceAdmission(source);
  const encoded = JSON.stringify(bundle);

  assert.equal(Object.hasOwn(bundle.immutable_source_document, 'response_bytes_base64'), false);
  assert.equal(Object.hasOwn(bundle.immutable_source_document, 'canonical_text'), false);
  assert.equal(Object.hasOwn(bundle.immutable_source_document, 'source_map_payload_base64'), false);
  assert.equal(Object.hasOwn(bundle.semantic_extraction_input_envelope, 'canonical_text'), false);
  assert.equal(
    Object.hasOwn(bundle.semantic_extraction_input_envelope, 'source_map_payload_base64'),
    false,
  );
  assert.doesNotMatch(encoded, /UNIQUE_ORIGINAL_RESPONSE_MARKER/);
  assert.doesNotMatch(encoded, new RegExp(source.capture.response_bytes_base64));
  assert.doesNotMatch(encoded, new RegExp(source.conversion.source_map_payload_base64));
});

test('rejects a self-consistently rehashed alternative compressed map representation', () => {
  const source = inputs(`<body>${'<p>Mapped source text.</p>'.repeat(100)}</body>`);
  const conversion = clone(source.conversion);
  const sourceMapBytes = inflateRawSync(Buffer.from(
    conversion.source_map_payload_base64,
    'base64',
  ));
  const alternative = deflateRawSync(sourceMapBytes, { level: 1 });
  assert.notEqual(
    alternative.toString('base64'),
    conversion.source_map_payload_base64,
  );
  conversion.source_map_payload_base64 = alternative.toString('base64');
  conversion.source_map_compressed_sha256 = sha256Hex(alternative);

  assert.throws(
    () => buildVerifiedSecSourceAdmission({ ...source, conversion }),
    (error) => error.code === 'CONVERSION_MISMATCH',
  );

  const unchangedMap = JSON.parse(sourceMapBytes.toString('utf8'));
  assert.equal(
    conversion.source_map_digest,
    contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', unchangedMap),
  );
  assert.equal(sourceMapBytes.toString('utf8'), canonicalJson(unchangedMap));
});

test('uses a run-recorded equivalent compressed map only after strict local conversion validation', () => {
  const source = inputs(`<body>${'<p>Mapped source text.</p>'.repeat(100)}</body>`);
  const sourceMapBytes = inflateRawSync(Buffer.from(
    source.conversion.source_map_payload_base64,
    'base64',
  ));
  const alternative = deflateRawSync(sourceMapBytes, { level: 1 });
  assert.notEqual(alternative.toString('base64'), source.conversion.source_map_payload_base64);

  const adoptedConversion = {
    ...source.conversion,
    source_map_payload_base64: alternative.toString('base64'),
    source_map_compressed_sha256: sha256Hex(alternative),
  };
  const sourceInputs = {
    capture: source.capture,
    locally_validated_conversion: source.conversion,
    adopted_conversion: adoptedConversion,
    verification: source.verification,
    recorded_source_map_provenance: {
      source_map_payload_path: sourceMapPayloadPathFor(source.conversion.canonical_text_id),
      source_map_compressed_sha256: sha256Hex(alternative),
    },
  };
  const bundle = buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload(sourceInputs);
  assert.equal(
    bundle.immutable_source_document.source_map_compressed_sha256,
    sha256Hex(alternative),
  );
  assert.throws(
    () => buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload({
      ...sourceInputs,
      recorded_source_map_provenance: {
        ...sourceInputs.recorded_source_map_provenance,
        source_map_compressed_sha256: 'f'.repeat(64),
      },
    }),
    (error) => error.code === 'ADOPTED_SOURCE_MAP_DIGEST_MISMATCH',
  );
  assert.throws(
    () => buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload({
      ...sourceInputs,
      recorded_source_map_provenance: {
        ...sourceInputs.recorded_source_map_provenance,
        source_map_payload_path: '../outside.deflate',
      },
    }),
    (error) => error.code === 'INVALID_RECORDED_SOURCE_MAP_PROVENANCE',
  );
  assert.throws(
    () => buildVerifiedSecSourceAdmissionForRecordedSourceMapPayload({
      ...sourceInputs,
      recorded_source_map_provenance: {
        ...sourceInputs.recorded_source_map_provenance,
        source_map_payload_path: '/tmp/outside.deflate',
      },
    }),
    (error) => error.code === 'INVALID_RECORDED_SOURCE_MAP_PROVENANCE',
  );
});

test('rejects tampered capture, conversion and independent verification', () => {
  const source = inputs();

  const capture = clone(source.capture);
  capture.response_byte_length += 1;
  assert.throws(
    () => buildVerifiedSecSourceAdmission({ ...source, capture }),
    (error) => error.code === 'RESPONSE_BYTES_MISMATCH',
  );

  const conversion = clone(source.conversion);
  conversion.canonical_text += ' invented';
  assert.throws(
    () => buildVerifiedSecSourceAdmission({ ...source, conversion }),
    (error) => error.code === 'CONVERSION_MISMATCH',
  );

  const verification = clone(source.verification);
  verification.verification_status = 'FAIL';
  assert.throws(
    () => buildVerifiedSecSourceAdmission({ ...source, verification }),
    (error) => error.code === 'NON_PASS_VERIFICATION',
  );
});

test('rejects a plausible PASS manifest that was rekeyed after tampering', () => {
  const source = inputs();
  const verification = clone(source.verification);
  verification.canonical_text_byte_length += 1;
  const body = { ...verification };
  delete body.verification_manifest_id;
  verification.verification_manifest_id = contentId(
    'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
    body,
  );

  assert.throws(
    () => buildVerifiedSecSourceAdmission({ ...source, verification }),
    (error) => error.code === 'VERIFICATION_MANIFEST_MISMATCH',
  );
});

test('rejects altered identities, lineage and extra bundle fields', () => {
  const source = inputs();
  const valid = buildVerifiedSecSourceAdmission(source);
  const altered = clone(valid);
  altered.semantic_extraction_input_envelope.canonical_text_sha256 = 'f'.repeat(64);
  assert.throws(
    () => validateVerifiedSecSourceAdmission({ ...source, bundle: altered }),
    (error) => error.code === 'ADMISSION_BUNDLE_MISMATCH',
  );

  const extra = clone(valid);
  extra.plausible_publication_status = 'PUBLISHED';
  assert.throws(
    () => validateVerifiedSecSourceAdmission({ ...source, bundle: extra }),
    (error) => error.code === 'INVALID_ADMISSION_BUNDLE',
  );
});
