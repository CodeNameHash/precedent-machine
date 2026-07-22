const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SEC_SOURCE_HOST,
  buildSecEdgarIntakeCapture,
  validateSecEdgarIntakeCapture,
  verifySecEdgarIntakeCapture,
} = require('../lib/canonical-v2/sec-edgar-intake-capture');

function input(overrides = {}) {
  const retrievalUrl = 'https://www.sec.gov/Archives/edgar/data/1/agreement.htm?doc=qxo';
  return {
    retrieval_url: retrievalUrl,
    final_url: retrievalUrl,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-07-22T14:15:16.000Z',
    retrieval_policy_digest: 'a'.repeat(64),
    redirect_count: 0,
    response_bytes: Buffer.from('<html><body>Original agreement.</body></html>'),
    ...overrides,
  };
}

test('creates a receipt-first identity over exact original SEC response bytes', () => {
  const retrieval = input();
  const capture = buildSecEdgarIntakeCapture(retrieval);
  assert.equal(validateSecEdgarIntakeCapture(capture), true);
  assert.equal(verifySecEdgarIntakeCapture({ capture, ...retrieval }), true);
  assert.equal(capture.receipt_stage, 'INTAKE_CAPTURE');
  assert.equal(capture.authority_representation, 'ORIGINAL_HTTP_RESPONSE_BYTES');
  assert.equal(capture.source_host, SEC_SOURCE_HOST);
  assert.equal(capture.response_byte_length, retrieval.response_bytes.length);
  assert.equal(capture.canonical_text_status, 'NOT_CREATED');
  assert.equal(capture.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(Object.hasOwn(capture, 'retrieval_url'), false);
  assert.equal(JSON.stringify(capture).includes(retrieval.retrieval_url), false);
  assert.ok(Object.isFrozen(capture));
});

test('refuses redirects, final URL changes and non-SEC sources', () => {
  assert.throws(() => buildSecEdgarIntakeCapture(input({ redirect_count: 1 })), /redirects/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/other.htm',
  })), /final URL changes/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({
    retrieval_url: 'https://example.com/agreement.htm',
    final_url: 'https://example.com/agreement.htm',
  })), /pinned SEC source host/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({
    final_url: 'https://sec.gov/Archives/edgar/data/1/agreement.htm?doc=qxo',
  })), /pinned SEC source host/);
});

test('refuses non-200, non-HTML, missing bytes and invalid retrieval lineage', () => {
  assert.throws(() => buildSecEdgarIntakeCapture(input({ status_code: 404 })), /status must be 200/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ content_type: 'application/pdf' })), /text\/html/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ response_bytes: Buffer.alloc(0) })), /must not be empty/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ response_bytes: 'HTML text' })), /exact non-empty/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ retrieved_at: '2026-07-22' })), /canonical UTC/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ retrieved_at: '2026-99-22T14:15:16.000Z' })), /canonical UTC/);
  assert.throws(() => buildSecEdgarIntakeCapture(input({ retrieval_policy_digest: 'short' })), /SHA-256/);
});

test('detects URL, body and closed-receipt mutation', () => {
  const retrieval = input();
  const capture = buildSecEdgarIntakeCapture(retrieval);
  assert.throws(() => verifySecEdgarIntakeCapture({
    capture,
    ...input({ retrieval_url: `${retrieval.retrieval_url}&changed=1`, final_url: `${retrieval.final_url}&changed=1` }),
  }), /no longer match/);
  assert.throws(() => verifySecEdgarIntakeCapture({
    capture,
    ...input({ response_bytes: Buffer.from('<html>changed</html>') }),
  }), /no longer match/);
  assert.throws(() => validateSecEdgarIntakeCapture({ ...capture, extra: true }), /closed receipt/);
  assert.throws(() => validateSecEdgarIntakeCapture({
    ...capture,
    response_byte_length: capture.response_byte_length + 1,
  }), /bytes, length and digest/);
});

test('refuses production references and arbitrary intake fields', () => {
  assert.throws(() => buildSecEdgarIntakeCapture({
    ...input(),
    database_project_ref: 'tzulhdasmioeechxapdy',
  }), /production database references/);
  const forbiddenUrl = `https://www.sec.gov/Archives/${'tzulhdasmioeechxapdy'}/agreement.htm`;
  assert.throws(() => buildSecEdgarIntakeCapture(input({
    retrieval_url: forbiddenUrl,
    final_url: forbiddenUrl,
  })), /production database references/);
  assert.throws(() => buildSecEdgarIntakeCapture({ ...input(), invented: true }), /closed contract/);
});

test('intake module cannot construct canonical text or claim source admission', () => {
  const modulePath = path.join(__dirname, '../lib/canonical-v2/sec-edgar-intake-capture.js');
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\/source-structure['"]\)/);
  assert.doesNotMatch(source, /buildImmutableSource\s*\(/);
  assert.doesNotMatch(source, /source_admission_status:\s*['"](?:ADMITTED|CREATED)['"]/);
});
