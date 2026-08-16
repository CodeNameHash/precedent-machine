const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { assertCandidate, fetchExactCandidate } = require('../lib/canonical-v2/m7-source-admission');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

function candidate() {
  const url = 'https://www.sec.gov/Archives/edgar/data/1/test.htm';
  return {
    schema_version: 'STAGE_2Y_M7_SOURCE_CANDIDATE/V1', candidate_key: 'test',
    deal_name: 'Test', governed_deal_key: 'deal:test', url,
    url_sha256: sha256Hex(Buffer.from(url)),
    required_document_anchors: ['AGREEMENT AND PLAN OF MERGER', 'TEST COMPANY'],
    expected_raw_sha256: null, expected_raw_byte_length: null,
    expected_canonical_sha256: null, expected_canonical_byte_length: null,
  };
}

test('candidate contract accepts only governed SEC membership', () => {
  assert.equal(assertCandidate(candidate()), undefined);
  assert.throws(() => assertCandidate({ ...candidate(), governed_deal_key: 'test' }), /DEAL_KEY/);
  assert.throws(() => assertCandidate({ ...candidate(), url: 'https://example.com/a' }), /URL/);
});

test('exact fetch rejects redirects and accepts complete governed bytes', async () => {
  const bytes = Buffer.from('<html>AGREEMENT AND PLAN OF MERGER TEST COMPANY</html>');
  const get = (url, options, callback) => {
    const request = new EventEmitter(); request.setTimeout = () => {}; request.destroy = (error) => request.emit('error', error);
    process.nextTick(() => {
      const response = new EventEmitter(); response.statusCode = 200; response.complete = true;
      response.headers = { 'content-type': 'text/html', 'content-length': String(bytes.length) };
      callback(response); response.emit('data', bytes); response.emit('end');
    });
    return request;
  };
  const result = await fetchExactCandidate(candidate(), { httpsGet: get, now: () => '2026-08-12T15:30:00.000Z' });
  assert.equal(result.redirect_count, 0); assert.deepEqual(result.bytes, bytes);
});

test('runner has no model, database, product, serving or publication interface', () => {
  const source = require('node:fs').readFileSync('scripts/stage-2y-generalisation-source-admit.mjs', 'utf8');
  assert.doesNotMatch(source, /@anthropic-ai|from ['"]openai|canonical_v2_write|createClient\(/i);
});
