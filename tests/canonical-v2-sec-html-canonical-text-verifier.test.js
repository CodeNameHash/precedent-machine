const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
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
  assert.equal(manifest.input_region_count, conversion.input_regions.length);
  assert.equal(manifest.output_mapping_count, conversion.output_mappings.length);
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
  missing.input_regions.pop();
  expectFailure(intake, missing, ['INPUT_REGION_COVERAGE_MISMATCH']);

  const extra = clone(valid);
  extra.input_regions[0].plausible_label = 'HTML';
  expectFailure(intake, extra, ['INVALID_INPUT_REGION']);

  const gap = clone(valid);
  gap.input_regions[1].input_start += 1;
  expectFailure(intake, gap, ['INPUT_REGION_COVERAGE_MISMATCH']);

  const overlap = clone(valid);
  overlap.input_regions[1].input_start -= 1;
  expectFailure(intake, overlap, ['INPUT_REGION_COVERAGE_MISMATCH']);
});

test('rejects relabelled suppressed text even when byte coverage remains plausible', () => {
  const intake = capture('<body>Shown<script>plausible legal prose</script>After</body>');
  const conversion = clone(convertSecHtmlToCanonicalText(intake));
  const suppressed = conversion.input_regions.find((region) => (
    region.region_kind === 'SUPPRESSED_SCRIPT'
  ));
  suppressed.region_kind = 'TEXT';

  expectFailure(intake, conversion, ['INPUT_CLASSIFICATION_MISMATCH']);
});

test('rejects invented canonical output with self-consistent headline digest claims', () => {
  const intake = capture('<p>Source-backed provision.</p>');
  const conversion = clone(convertSecHtmlToCanonicalText(intake));
  conversion.canonical_text = 'Source-backed provision. Invented exception.';
  conversion.canonical_text_byte_length = Buffer.byteLength(conversion.canonical_text);
  conversion.canonical_text_sha256 = sha256Hex(Buffer.from(conversion.canonical_text, 'utf8'));
  conversion.output_mappings.at(-1).output_end = conversion.canonical_text_byte_length;

  expectFailure(intake, conversion, ['OUTPUT_MAPPING_MISMATCH', 'CANONICAL_TEXT_MISMATCH']);
});

test('rejects a false-plausible entity mapping and normalized whitespace remapping', () => {
  const intake = capture('<table><tr><td>Four&nbsp;&#52;</td><td>days</td></tr></table>');
  const valid = convertSecHtmlToCanonicalText(intake);

  const entity = clone(valid);
  const entityMapping = entity.output_mappings.find((mapping) => (
    mapping.mapping_kind === 'DECODED_ENTITY'
  ));
  entityMapping.input_end -= 1;
  expectFailure(intake, entity, ['OUTPUT_MAPPING_MISMATCH']);

  const whitespace = clone(valid);
  const spaceMapping = whitespace.output_mappings.find((mapping) => (
    mapping.mapping_kind === 'NORMALIZED_SPACE'
  ));
  spaceMapping.mapping_kind = 'DIRECT_TEXT';
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

test('rejects a source-map digest or canonical-text identity mutation', () => {
  const intake = capture('<p>Mapped.</p>');
  const badMap = clone(convertSecHtmlToCanonicalText(intake));
  badMap.source_map_digest = 'd'.repeat(64);
  expectFailure(intake, badMap, ['CANONICAL_TEXT_IDENTITY_MISMATCH']);

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
