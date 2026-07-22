const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSemanticSpan } = require('../lib/canonical-v2/source-structure');
const {
  buildAdmittedSemanticSourceContext,
  buildAdmittedSourceReference,
  validateAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');

const DEAL_KEY = 'QXO-RXO-2025-06-17';
const DEAL_ADMISSION_ID = 'd'.repeat(64);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function identified(value, idKey, domain) {
  const body = { ...value };
  delete body[idKey];
  return {
    ...body,
    [idKey]: contentId(domain, body),
  };
}

function fixtures(html = '<body><p>Capitalization is accurate in all material respects.</p></body>') {
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
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const inputs = {
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope: bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
  };
  return { capture, conversion, bundle, inputs };
}

test('builds a frozen semantic geometry source from the exact admitted SEC lineage', () => {
  const source = fixtures();
  const context = buildAdmittedSemanticSourceContext(source.inputs);
  const expectedOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
    immutable_source_document_id: source.bundle.immutable_source_document.immutable_source_document_id,
  });

  assert.equal(context.schema_version, 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1');
  assert.equal(context.source_kind, 'ORIGINAL_BYTES');
  assert.equal(context.source_content_id, source.capture.source_response_content_id);
  assert.equal(context.document_hash, source.capture.response_bytes_sha256);
  assert.equal(context.source_byte_length, source.capture.response_byte_length);
  assert.equal(context.source_occurrence_key, expectedOccurrenceKey);
  assert.equal(context.source_occurrence_id, contentId('SOURCE_OCCURRENCE/V1', {
    source_content_id: source.capture.source_response_content_id,
    source_occurrence_key: expectedOccurrenceKey,
  }));
  assert.equal(context.canonical_text.text, source.conversion.canonical_text);
  assert.equal(context.canonical_text.canonical_text_id, context.canonical_text_id);
  assert.equal(context.source_map_digest, source.conversion.source_map_digest);
  assert.equal(context.source_map_compressed_sha256, source.conversion.source_map_compressed_sha256);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.canonical_text), true);
  assert.equal(validateAdmittedSemanticSourceContext({ ...source.inputs, context }), true);
});

test('is directly compatible with UTF-8 semantic-span geometry', () => {
  const source = fixtures('<body><p>£ Capitalization representation.</p></body>');
  const context = buildAdmittedSemanticSourceContext(source.inputs);
  const start = Buffer.byteLength('£ ', 'utf8');
  const end = Buffer.byteLength('£ Capitalization', 'utf8');
  const span = buildSemanticSpan(context, start, end);

  assert.equal(span.canonical_text_id, context.canonical_text_id);
  assert.equal(span.absolute_start, start);
  assert.equal(span.absolute_end, end);
  assert.equal(span.exact_bytes_digest, sha256Hex(Buffer.from('Capitalization', 'utf8')));
});

test('does not carry original response bytes or the compact source-map payload at runtime', () => {
  const source = fixtures();
  const context = buildAdmittedSemanticSourceContext(source.inputs);

  assert.equal(Object.hasOwn(context, 'response_bytes_base64'), false);
  assert.equal(Object.hasOwn(context, 'source_map_payload_base64'), false);
  assert.equal(Object.hasOwn(context.canonical_text, 'source_map_payload_base64'), false);
  assert.doesNotMatch(JSON.stringify(context), new RegExp(source.conversion.source_map_payload_base64));
});

test('emits the exact eight-field admitted source reference', () => {
  const source = fixtures();
  const context = buildAdmittedSemanticSourceContext(source.inputs);
  const reference = buildAdmittedSourceReference(context);

  assert.deepEqual(Object.keys(reference).sort(), [
    'schema_version',
    'immutable_source_document_id',
    'source_admission_manifest_id',
    'semantic_extraction_input_envelope_id',
    'canonical_text_id',
    'governed_deal_key',
    'deal_admission_id',
    'source_ordinal',
  ].sort());
  assert.equal(reference.schema_version, 'ADMITTED_SOURCE_REFERENCE/V1');
  assert.equal(reference.governed_deal_key, DEAL_KEY);
  assert.equal(reference.canonical_text_id, context.canonical_text_id);
  assert.equal(Object.isFrozen(reference), true);
});

test('rejects independently valid objects whose committed lineage does not agree', () => {
  const source = fixtures();
  const admission = clone(source.inputs.source_admission_manifest);
  admission.source_response_content_id = 'f'.repeat(64);
  const rekeyedAdmission = identified(
    admission,
    'source_admission_manifest_id',
    'SOURCE_ADMISSION_MANIFEST/V2',
  );
  const envelope = clone(source.inputs.semantic_extraction_input_envelope);
  envelope.source_admission_manifest_id = rekeyedAdmission.source_admission_manifest_id;
  const rekeyedEnvelope = identified(
    envelope,
    'semantic_extraction_input_envelope_id',
    'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
  );

  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    source_admission_manifest: rekeyedAdmission,
    semantic_extraction_input_envelope: rekeyedEnvelope,
  }), (error) => error.code === 'LINEAGE_MISMATCH');
});

test('rejects non-VERIFIED admission and non-READY extraction states', () => {
  const source = fixtures();
  const admission = identified({
    ...clone(source.inputs.source_admission_manifest),
    admission_state: 'PENDING',
  }, 'source_admission_manifest_id', 'SOURCE_ADMISSION_MANIFEST/V2');
  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    source_admission_manifest: admission,
  }), (error) => error.code === 'SOURCE_NOT_VERIFIED');

  const envelope = identified({
    ...clone(source.inputs.semantic_extraction_input_envelope),
    input_status: 'BLOCKED',
  }, 'semantic_extraction_input_envelope_id', 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1');
  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    semantic_extraction_input_envelope: envelope,
  }), (error) => error.code === 'SOURCE_NOT_READY');
});

test('rejects canonical text and runtime identity mutation', () => {
  const source = fixtures();
  const conversion = clone(source.conversion);
  conversion.canonical_text += ' invented';
  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    conversion,
  }), (error) => error.code === 'CANONICAL_TEXT_MISMATCH');

  const context = clone(buildAdmittedSemanticSourceContext(source.inputs));
  context.source_occurrence_key = '0'.repeat(64);
  assert.throws(() => buildAdmittedSourceReference(context),
    (error) => error.code === 'SOURCE_OCCURRENCE_MISMATCH');

  const changedText = clone(buildAdmittedSemanticSourceContext(source.inputs));
  changedText.canonical_text.text += ' plausible';
  assert.throws(() => validateAdmittedSemanticSourceContext({
    ...source.inputs,
    context: changedText,
  }), (error) => error.code === 'CANONICAL_TEXT_MISMATCH');
});

test('rejects incomplete evidence coverage and ungoverned deal identity', () => {
  const source = fixtures();
  const admission = clone(source.inputs.source_admission_manifest);
  admission.admitted_intervals[0].end -= 1;
  admission.coverage_proof_digest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: admission.canonical_text_id,
    canonical_text_byte_length: source.conversion.canonical_text_byte_length,
    source_map_digest: source.conversion.source_map_digest,
    admitted_intervals: admission.admitted_intervals,
    excluded_intervals: admission.excluded_intervals,
    discrepancy_count: admission.discrepancy_count,
  });
  const rekeyed = identified(
    admission,
    'source_admission_manifest_id',
    'SOURCE_ADMISSION_MANIFEST/V2',
  );
  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    source_admission_manifest: rekeyed,
  }), (error) => error.code === 'INCOMPLETE_ADMISSION');
  assert.throws(() => buildAdmittedSemanticSourceContext({
    ...source.inputs,
    governed_deal_key: ' QXO ',
  }), (error) => error.code === 'INVALID_DEAL_KEY');
});

test('context identity is content-addressed over the complete closed runtime payload', () => {
  const source = fixtures();
  const context = buildAdmittedSemanticSourceContext(source.inputs);
  const body = { ...context };
  delete body.admitted_semantic_source_context_id;

  assert.equal(
    context.admitted_semantic_source_context_id,
    contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
  );
  assert.equal(canonicalJson(buildAdmittedSemanticSourceContext(source.inputs)), canonicalJson(context));
});
