const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  CONFIG_DIGEST,
  CONVERTER_DIGEST,
  SOURCE_MAP_ENCODING,
  convertSecHtmlToCanonicalText,
  decodeSecHtmlCanonicalTextSourceMap,
  validateSecHtmlCanonicalTextConversion,
} = require('../lib/canonical-v2/sec-html-canonical-text');

function capture(html) {
  const url = 'https://www.sec.gov/Archives/edgar/data/1/qxo.htm';
  return buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-22T15:00:00.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.isBuffer(html) ? html : Buffer.from(html, 'utf8'),
  });
}

function assertCoverage(result, inputLength) {
  const sourceMap = decodeSecHtmlCanonicalTextSourceMap(result);
  let cursor = 0;
  for (const region of sourceMap.input_regions) {
    assert.equal(region.input_start, cursor);
    assert.ok(region.input_end > region.input_start);
    cursor = region.input_end;
  }
  assert.equal(cursor, inputLength);

  cursor = 0;
  for (const mapping of sourceMap.output_mappings) {
    assert.equal(mapping.output_start, cursor);
    assert.ok(mapping.output_end > mapping.output_start);
    assert.ok(mapping.input_start >= 0 && mapping.input_end > mapping.input_start);
    assert.ok(mapping.input_end <= inputLength);
    cursor = mapping.output_end;
  }
  assert.equal(cursor, result.canonical_text_byte_length);
}

test('converts quoted tags, structural whitespace and entities deterministically', () => {
  const html = '<html><body><p data-x="1 > 0">Price&nbsp;is &#128;10 &amp; £5.</p>'
    + '<table><tr><td>A</td><td>B</td></tr></table></body></html>';
  const intake = capture(html);
  const first = convertSecHtmlToCanonicalText(intake);
  const second = convertSecHtmlToCanonicalText(intake);

  assert.equal(first.canonical_text, 'Price is €10 & £5.\nA B');
  assert.deepEqual(first, second);
  assert.equal(validateSecHtmlCanonicalTextConversion({ capture: intake, conversion: first }), true);
  assert.equal(first.converter_digest, CONVERTER_DIGEST);
  assert.equal(first.converter_config_digest, CONFIG_DIGEST);
  assert.match(first.canonical_text_sha256, /^[a-f0-9]{64}$/);
  assert.match(first.canonical_text_id, /^[a-f0-9]{64}$/);
  assert.equal(first.schema_version, 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2');
  assert.equal(first.source_map_encoding, SOURCE_MAP_ENCODING);
  assert.equal(Object.hasOwn(first, 'input_regions'), false);
  assert.equal(Object.hasOwn(first, 'output_mappings'), false);
  assertCoverage(first, Buffer.byteLength(html));
});

test('suppresses comments, script and style while retaining explicit input lineage', () => {
  const html = '<div>Before<!-- secret > text --><script>bad &amp; text</script>'
    + '<style>.x { content: ">"; }</style>After<br>End</div>';
  const result = convertSecHtmlToCanonicalText(capture(html));

  assert.equal(result.canonical_text, 'BeforeAfter\nEnd');
  const sourceMap = decodeSecHtmlCanonicalTextSourceMap(result);
  assert.ok(sourceMap.input_regions.some((region) => region.region_kind === 'COMMENT'));
  assert.ok(sourceMap.input_regions.some((region) => region.region_kind === 'SUPPRESSED_SCRIPT'));
  assert.ok(sourceMap.input_regions.some((region) => region.region_kind === 'SUPPRESSED_STYLE'));
  assertCoverage(result, Buffer.byteLength(html));
});

test('accounts for markup declarations and processing instructions without emitting them', () => {
  const html = '<?xml version="1.0"?><!DOCTYPE html><html><body>Agreement.</body></html>';
  const result = convertSecHtmlToCanonicalText(capture(html));
  assert.equal(result.canonical_text, 'Agreement.');
  const sourceMap = decodeSecHtmlCanonicalTextSourceMap(result);
  assert.equal(sourceMap.input_regions.filter((region) => region.region_kind === 'MARKUP').length, 2);
  assertCoverage(result, Buffer.byteLength(html));
});

test('maps multibyte UTF-8 and decoded entity output to exact source byte ranges', () => {
  const html = '<p>£ “QXO” &#x2014; done</p>';
  const result = convertSecHtmlToCanonicalText(capture(html));
  const entityStart = Buffer.byteLength('<p>£ “QXO” ');
  const entityEnd = entityStart + Buffer.byteLength('&#x2014;');

  assert.equal(result.canonical_text, '£ “QXO” — done');
  const sourceMap = decodeSecHtmlCanonicalTextSourceMap(result);
  assert.ok(sourceMap.output_mappings.some((mapping) => mapping.mapping_kind === 'DECODED_ENTITY'
    && mapping.input_start === entityStart && mapping.input_end === entityEnd));
  assertCoverage(result, Buffer.byteLength(html));
});

test('a one-byte input mutation rekeys source and canonical text identity', () => {
  const first = convertSecHtmlToCanonicalText(capture('<p>Value 10.</p>'));
  const second = convertSecHtmlToCanonicalText(capture('<p>Value 11.</p>'));
  assert.notEqual(first.source_response_content_id, second.source_response_content_id);
  assert.notEqual(first.canonical_text_sha256, second.canonical_text_sha256);
  assert.notEqual(first.canonical_text_id, second.canonical_text_id);
});

test('a mutation in suppressed content still rekeys the content-addressed conversion', () => {
  const first = convertSecHtmlToCanonicalText(capture('<p>A</p><!--x-->'));
  const second = convertSecHtmlToCanonicalText(capture('<p>A</p><!--y-->'));
  assert.equal(first.canonical_text, second.canonical_text);
  assert.equal(first.canonical_text_sha256, second.canonical_text_sha256);
  assert.notEqual(first.source_response_content_id, second.source_response_content_id);
  assert.notEqual(first.canonical_text_id, second.canonical_text_id);
});

test('rejects invalid UTF-8 and never claims verification or admission', () => {
  const result = convertSecHtmlToCanonicalText(capture('<p>Valid</p>'));
  assert.equal(result.conversion_stage, 'CONVERSION_ONLY');
  assert.equal(result.verification_status, 'NOT_ATTEMPTED');
  assert.equal(result.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => convertSecHtmlToCanonicalText(capture(Buffer.from([0x3c, 0x70, 0x3e, 0xc3, 0x28]))),
    (error) => error.code === 'INVALID_UTF8');
});

test('detects a conversion payload mutation', () => {
  const intake = capture('<p>Source text.</p>');
  const conversion = convertSecHtmlToCanonicalText(intake);
  assert.throws(() => validateSecHtmlCanonicalTextConversion({
    capture: intake,
    conversion: { ...conversion, canonical_text: 'Plausible changed text.' },
  }), (error) => error.code === 'CONVERSION_MISMATCH');
});

test('binds executable source bytes and the complete source map into conversion identity', () => {
  const modulePath = path.join(__dirname, '../lib/canonical-v2/sec-html-canonical-text.js');
  assert.equal(CONVERTER_DIGEST, sha256Hex(fs.readFileSync(modulePath)));
  const result = convertSecHtmlToCanonicalText(capture('<p>Mapped.</p>'));
  assert.match(result.source_map_digest, /^[a-f0-9]{64}$/);
  const changedMap = {
    ...result,
    source_map_digest: 'f'.repeat(64),
  };
  assert.throws(() => validateSecHtmlCanonicalTextConversion({
    capture: capture('<p>Mapped.</p>'),
    conversion: changedMap,
  }), (error) => error.code === 'CONVERSION_MISMATCH');
});

test('converts repeated SEC-style regions without per-region full-document scans', () => {
  const source = fs.readFileSync(path.join(
    __dirname,
    '../lib/canonical-v2/sec-html-canonical-text.js',
  ), 'utf8');
  assert.doesNotMatch(source, /\.findIndex\s*\(/);

  const row = '<tr><td>Section&nbsp;5.2</td><td>Four &#52; days £10.</td></tr>';
  const html = `<html><body><table>${row.repeat(5000)}</table></body></html>`;
  const started = Date.now();
  const result = convertSecHtmlToCanonicalText(capture(html));
  const elapsed = Date.now() - started;

  assert.ok(result.canonical_text.startsWith('Section 5.2 Four 4 days £10.'));
  assertCoverage(result, Buffer.byteLength(html));
  const compressedLength = Buffer.from(result.source_map_payload_base64, 'base64').length;
  assert.ok(compressedLength < result.source_map_uncompressed_byte_length / 4,
    `${compressedLength} compressed bytes are not materially smaller than ${result.source_map_uncompressed_byte_length}`);
  assert.ok(elapsed < 3000, `repeated-region conversion took ${elapsed}ms`);
});

test('bounded source-map decoder rejects payload, hash, count and digest tampering', () => {
  const result = convertSecHtmlToCanonicalText(capture('<p>Mapped.</p>'));
  assert.throws(() => decodeSecHtmlCanonicalTextSourceMap({
    ...result,
    source_map_compressed_sha256: '0'.repeat(64),
  }), (error) => error.code === 'INVALID_SOURCE_MAP');
  assert.throws(() => decodeSecHtmlCanonicalTextSourceMap({
    ...result,
    input_region_count: result.input_region_count + 1,
  }), (error) => error.code === 'INVALID_SOURCE_MAP');
  assert.throws(() => decodeSecHtmlCanonicalTextSourceMap({
    ...result,
    source_map_digest: '0'.repeat(64),
  }), (error) => error.code === 'INVALID_SOURCE_MAP');
  assert.throws(() => decodeSecHtmlCanonicalTextSourceMap({
    ...result,
    source_map_uncompressed_byte_length: 64 * 1024 * 1024 + 1,
  }), (error) => error.code === 'SOURCE_MAP_LIMIT_EXCEEDED');
});
