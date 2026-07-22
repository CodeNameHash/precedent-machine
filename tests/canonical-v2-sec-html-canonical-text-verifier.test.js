const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync, inflateRawSync, constants: zlibConstants } = require('node:zlib');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  CONFIG_DIGEST,
  VERIFIER_DIGEST,
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');

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
    response_bytes: Buffer.from(html, 'utf8'),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function decodeMap(conversion) {
  return JSON.parse(inflateRawSync(
    Buffer.from(conversion.source_map_payload_base64, 'base64'),
  ).toString('utf8'));
}

function replaceMap(conversion, sourceMap, { canonical = true } = {}) {
  const source = canonical ? canonicalJson(sourceMap) : JSON.stringify(sourceMap, null, 2);
  const uncompressed = Buffer.from(source, 'utf8');
  const compressed = deflateRawSync(uncompressed, {
    level: 9,
    windowBits: 15,
    memLevel: 8,
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
  });
  conversion.source_map_payload_base64 = compressed.toString('base64');
  conversion.source_map_compressed_sha256 = sha256Hex(compressed);
  conversion.source_map_uncompressed_byte_length = uncompressed.length;
  conversion.input_region_count = sourceMap.input_regions.length;
  conversion.output_mapping_count = sourceMap.output_mappings.length;
  conversion.source_map_digest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', sourceMap);
  conversion.canonical_text_id = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: conversion.source_response_content_id,
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
  });
  return conversion;
}

function expectFailure(captureValue, conversion, codes) {
  assert.throws(
    () => verifySecHtmlCanonicalText({ capture: captureValue, conversion }),
    (error) => codes.includes(error.code),
  );
}

test('independently verifies every input region, transformation and content identity', () => {
  const intake = capture('<?xml version="1.0"?><!DOCTYPE html><body><p data-x="1 > 0">'
    + 'Price&nbsp;is &#128;10 &amp; £5.</p><!--hidden--><script>doBad()</script>'
    + '<table><tr><td>A</td><td>B</td></tr></table></body>');
  const conversion = convertSecHtmlToCanonicalText(intake);
  const manifest = verifySecHtmlCanonicalText({ capture: intake, conversion });

  assert.equal(manifest.schema_version, 'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1');
  assert.equal(manifest.verification_status, 'PASS');
  assert.equal(manifest.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(manifest.canonical_text_id, conversion.canonical_text_id);
  assert.equal(manifest.converter_config_digest, CONFIG_DIGEST);
  assert.equal(manifest.verifier_digest, VERIFIER_DIGEST);
  assert.equal(manifest.input_region_count, conversion.input_region_count);
  assert.equal(manifest.output_mapping_count, conversion.output_mapping_count);
  assert.match(manifest.verification_manifest_id, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(manifest), true);

  const body = { ...manifest };
  delete body.verification_manifest_id;
  assert.equal(
    manifest.verification_manifest_id,
    contentId('CANONICAL_TEXT_VERIFICATION_MANIFEST/V1', body),
  );
});

test('fails closed on missing, extra, gapped and overlapping input regions', () => {
  const intake = capture('<body><p>Alpha.</p><p>Beta.</p></body>');
  const valid = convertSecHtmlToCanonicalText(intake);

  const missing = clone(valid);
  const missingMap = decodeMap(missing);
  missingMap.input_regions.pop();
  replaceMap(missing, missingMap);
  expectFailure(intake, missing, ['INPUT_REGION_COVERAGE_MISMATCH']);

  const extra = clone(valid);
  const extraMap = decodeMap(extra);
  extraMap.input_regions[0].push('HTML');
  replaceMap(extra, extraMap);
  expectFailure(intake, extra, ['INVALID_INPUT_REGION_TUPLE']);

  const gap = clone(valid);
  const gapMap = decodeMap(gap);
  gapMap.input_regions[1][0] += 1;
  replaceMap(gap, gapMap);
  expectFailure(intake, gap, ['INPUT_REGION_COVERAGE_MISMATCH']);

  const overlap = clone(valid);
  const overlapMap = decodeMap(overlap);
  overlapMap.input_regions[1][0] -= 1;
  replaceMap(overlap, overlapMap);
  expectFailure(intake, overlap, ['INPUT_REGION_COVERAGE_MISMATCH']);
});

test('rejects relabelled suppressed text even when byte coverage remains plausible', () => {
  const intake = capture('<body>Shown<script>plausible legal prose</script>After</body>');
  const conversion = clone(convertSecHtmlToCanonicalText(intake));
  const sourceMap = decodeMap(conversion);
  const suppressed = sourceMap.input_regions.find((region) => region[2] === 'SUPPRESSED_SCRIPT');
  suppressed[2] = 'TEXT';
  replaceMap(conversion, sourceMap);

  expectFailure(intake, conversion, ['INPUT_CLASSIFICATION_MISMATCH']);
});

test('rejects invented canonical output with self-consistent headline digest claims', () => {
  const intake = capture('<p>Source-backed provision.</p>');
  const conversion = clone(convertSecHtmlToCanonicalText(intake));
  conversion.canonical_text = 'Source-backed provision. Invented exception.';
  conversion.canonical_text_byte_length = Buffer.byteLength(conversion.canonical_text);
  conversion.canonical_text_sha256 = sha256Hex(Buffer.from(conversion.canonical_text, 'utf8'));
  const sourceMap = decodeMap(conversion);
  sourceMap.output_mappings.at(-1)[1] = conversion.canonical_text_byte_length;
  replaceMap(conversion, sourceMap);

  expectFailure(intake, conversion, ['OUTPUT_MAPPING_MISMATCH', 'CANONICAL_TEXT_MISMATCH']);
});

test('rejects a false-plausible entity mapping and normalized whitespace remapping', () => {
  const intake = capture('<table><tr><td>Four&nbsp;&#52;</td><td>days</td></tr></table>');
  const valid = convertSecHtmlToCanonicalText(intake);

  const entity = clone(valid);
  const entityMap = decodeMap(entity);
  const entityMapping = entityMap.output_mappings.find((mapping) => mapping[4] === 'DECODED_ENTITY');
  entityMapping[3] -= 1;
  replaceMap(entity, entityMap);
  expectFailure(intake, entity, ['OUTPUT_MAPPING_MISMATCH']);

  const whitespace = clone(valid);
  const whitespaceMap = decodeMap(whitespace);
  const spaceMapping = whitespaceMap.output_mappings.find((mapping) => mapping[4] === 'NORMALIZED_SPACE');
  spaceMapping[4] = 'DIRECT_TEXT';
  replaceMap(whitespace, whitespaceMap);
  expectFailure(intake, whitespace, ['OUTPUT_MAPPING_MISMATCH']);
});

test('rejects stale executable and config digests before issuing a manifest', () => {
  const intake = capture('<p>Bound.</p>');
  const staleExecutable = clone(convertSecHtmlToCanonicalText(intake));
  staleExecutable.converter_digest = 'b'.repeat(64);
  expectFailure(intake, staleExecutable, ['STALE_EXECUTABLE_DIGEST']);

  const staleConfig = clone(convertSecHtmlToCanonicalText(intake));
  staleConfig.converter_config_digest = 'c'.repeat(64);
  expectFailure(intake, staleConfig, ['CONFIG_DIGEST_MISMATCH']);
});

test('rejects corrupted, unhashed, unbounded and noncanonical compressed source maps', () => {
  const intake = capture('<p>Compressed map.</p>');
  const valid = convertSecHtmlToCanonicalText(intake);

  const badHash = clone(valid);
  const changed = Buffer.from(badHash.source_map_payload_base64, 'base64');
  changed[0] ^= 1;
  badHash.source_map_payload_base64 = changed.toString('base64');
  expectFailure(intake, badHash, ['COMPRESSED_SOURCE_MAP_HASH_MISMATCH']);

  const badInflate = clone(valid);
  const invalidCompressed = Buffer.from('not-a-deflate-stream', 'utf8');
  badInflate.source_map_payload_base64 = invalidCompressed.toString('base64');
  badInflate.source_map_compressed_sha256 = sha256Hex(invalidCompressed);
  expectFailure(intake, badInflate, ['SOURCE_MAP_INFLATE_FAILED']);

  const unbounded = clone(valid);
  unbounded.source_map_uncompressed_byte_length = (64 * 1024 * 1024) + 1;
  expectFailure(intake, unbounded, ['SOURCE_MAP_LIMIT_EXCEEDED']);

  const wrongLength = clone(valid);
  wrongLength.source_map_uncompressed_byte_length += 1;
  expectFailure(intake, wrongLength, ['SOURCE_MAP_LENGTH_MISMATCH']);

  const noncanonical = clone(valid);
  replaceMap(noncanonical, decodeMap(noncanonical), { canonical: false });
  expectFailure(intake, noncanonical, ['INVALID_SOURCE_MAP_CONTRACT']);
});

test('rejects malformed compact tuples and dishonest tuple counts', () => {
  const intake = capture('<p>Tuple map &amp; lineage.</p>');
  const valid = convertSecHtmlToCanonicalText(intake);

  const badRegionTuple = clone(valid);
  const regionMap = decodeMap(badRegionTuple);
  regionMap.input_regions[0].push('unexpected');
  replaceMap(badRegionTuple, regionMap);
  expectFailure(intake, badRegionTuple, ['INVALID_INPUT_REGION_TUPLE']);

  const badMappingTuple = clone(valid);
  const mappingMap = decodeMap(badMappingTuple);
  mappingMap.output_mappings[0][4] = null;
  replaceMap(badMappingTuple, mappingMap);
  expectFailure(intake, badMappingTuple, ['INVALID_OUTPUT_MAPPING_TUPLE']);

  const dishonestCount = clone(valid);
  dishonestCount.input_region_count += 1;
  expectFailure(intake, dishonestCount, ['SOURCE_MAP_COUNT_MISMATCH']);
});

test('rejects a source-map digest or canonical-text identity mutation', () => {
  const intake = capture('<p>Mapped.</p>');
  const badMap = clone(convertSecHtmlToCanonicalText(intake));
  badMap.source_map_digest = 'd'.repeat(64);
  expectFailure(intake, badMap, ['SOURCE_MAP_DIGEST_MISMATCH']);

  const badIdentity = clone(convertSecHtmlToCanonicalText(intake));
  badIdentity.canonical_text_id = 'e'.repeat(64);
  expectFailure(intake, badIdentity, ['CANONICAL_TEXT_IDENTITY_MISMATCH']);
});

test('verifier is independent, linear and cannot claim source admission', () => {
  const modulePath = path.join(
    __dirname,
    '../lib/canonical-v2/sec-html-canonical-text-verifier.js',
  );
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\/sec-html-canonical-text['"]\)/);
  assert.doesNotMatch(source, /convertSecHtmlToCanonicalText|validateSecHtmlCanonicalTextConversion/);
  assert.doesNotMatch(source, /\.findIndex\s*\(/);
  assert.doesNotMatch(source, /source_admission_status:\s*['"](?:ADMITTED|CREATED)['"]/);

  const row = '<tr><td>Section&nbsp;5.2</td><td>Four &#52; days £10.</td></tr>';
  const intake = capture(`<html><body><table>${row.repeat(3000)}</table></body></html>`);
  const conversion = convertSecHtmlToCanonicalText(intake);
  const started = Date.now();
  const manifest = verifySecHtmlCanonicalText({ capture: intake, conversion });
  const elapsed = Date.now() - started;

  assert.equal(manifest.verification_status, 'PASS');
  assert.ok(elapsed < 3000, `independent verification took ${elapsed}ms`);
});
