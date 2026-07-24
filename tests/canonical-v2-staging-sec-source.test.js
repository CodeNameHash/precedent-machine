const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const MODULE_PATH = pathToFileURL(
  path.resolve('scripts/lib/canonical-v2-staging-sec-source.mjs'),
).href;
const WRAPPER_PATH = pathToFileURL(
  path.resolve('scripts/canonical-v2-staging-verve-sec-source.mjs'),
).href;

function mockedHttpsGet({ bytes, statusCode = 200, headers = {}, complete = true }) {
  return (_url, _options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = (error) => {
      if (error) process.nextTick(() => request.emit('error', error));
    };
    process.nextTick(() => {
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.headers = headers;
      response.complete = complete;
      callback(response);
      response.emit('data', bytes);
      response.emit('end');
    });
    return request;
  };
}

test('shared staging SEC engine exposes only source operations and bounded transport', async () => {
  const module = await import(MODULE_PATH);
  assert.deepEqual(module.STAGING_SEC_SOURCE_CONSTANTS.SOURCE_OPERATIONS, [
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
  ]);
  assert.equal(module.STAGING_SEC_SOURCE_CONSTANTS.CHUNK_MAX_BYTE_LENGTH, 196608);
  assert.equal(module.STAGING_SEC_SOURCE_CONSTANTS.MAX_WRITER_REQUEST_BYTES, 512 * 1024);
  assert.equal(
    module.STAGING_SEC_SOURCE_CONSTANTS.WRITER_DEFINITION_SHA256,
    '3853be81c08a2817bc5ed9aa12b130ddae69a820ea183445aebcfb272c9cdb14',
  );
  assert.equal(
    module.STAGING_SEC_SOURCE_CONSTANTS.SEC_RETRIEVAL_POLICY_DIGEST,
    '9caf62ecf8a92ceaaebc85964464f0e45ded364e09025151924b012a4ad7ff06',
  );
  const source = fs.readFileSync(
    path.resolve('scripts/lib/canonical-v2-staging-sec-source.mjs'),
    'utf8',
  );
  assert.match(source, /if \(!SOURCE_OPERATIONS\.includes\(request\.operation\)\)/);
  assert.match(source, /active_corpus_release_pointers/);
  assert.match(source, /active_pointer_history/);
  assert.match(source, /protected_canonical_state_unchanged: true/);
  assert.match(source, /profile\.expected\.retrieved_at/);
  assert.match(source, /canonical_payload->>'chunk_payload_base64'/);
  assert.match(source, /assertExactReceipts\(runtime, built\)/);
  assert.match(source, /assertReplay\(runWriter\(runtime, request, \{ commit: true \}\), true\)/);
  assert.doesNotMatch(
    source,
    /canonical_v2_(?:import_candidate_release|rollback_inactive_candidate_release|activate_candidate_release|query_page)/,
  );
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i);
});

test('Verve profile pins the exact SEC exhibit and stable converter lineage', async () => {
  const wrapper = await import(`${WRAPPER_PATH}?profile=${Date.now()}`);
  const profile = wrapper.VERVE_SEC_SOURCE_PROFILE;
  const module = await import(MODULE_PATH);
  assert.equal(module.validateStagingSecSourceProfile(profile), true);
  assert.equal(profile.source_locator_deal_id, '320a3899-0d74-42d6-a412-3a962997d6ca');
  assert.equal(
    profile.retrieval_url_sha256,
    '3b03a37147053b2c2d9bd78f4f3804e53520160292b17b53700a9a1a316fe437',
  );
  assert.equal(
    profile.response_bytes_sha256,
    '0c5317d92be7616364e801ecff9b90c950e466d3e4787f6821294b6bf095317c',
  );
  assert.equal(profile.response_byte_length, 600876);
  assert.equal(
    profile.expected.source_response_content_id,
    'c4eaa807a0322559c1204329dc411a701c711a0a27e03501c691e82f94d31f02',
  );
  assert.equal(
    profile.expected.canonical_text_id,
    '0ec7f053b719c7091b24f3ccee8df3a5290e53f9cb895ccfbb6264587d98fdff',
  );
  assert.equal(profile.expected.retrieved_at, '2026-07-24T21:02:33.849Z');
  assert.equal(profile.expected.artifact_chunk_count, 11);
  assert.equal(profile.expected.artifact_chunk_ids.length, 11);
  assert.equal(profile.expected.artifact_chunk_sha256.length, 11);
  assert.equal(
    Object.values(profile.expected).some((value) => value == null),
    false,
  );
});

test('bounded fetch rejects encoded, incomplete and length-mismatched responses', async () => {
  const module = await import(MODULE_PATH);
  const wrapper = await import(`${WRAPPER_PATH}?fetch=${Date.now()}`);
  const profile = wrapper.VERVE_SEC_SOURCE_PROFILE;
  const bytes = Buffer.alloc(profile.response_byte_length);
  const options = [
    {
      headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' },
      complete: true,
      message: /content encoding/,
    },
    {
      headers: { 'content-type': 'text/html' },
      complete: false,
      message: /did not complete/,
    },
    {
      headers: {
        'content-type': 'text/html',
        'content-length': String(profile.response_byte_length + 1),
      },
      complete: true,
      message: /content length/,
    },
  ];
  for (const option of options) {
    await assert.rejects(
      module.fetchExactSecSource(profile, {
        httpsGet: mockedHttpsGet({
          bytes,
          headers: option.headers,
          complete: option.complete,
        }),
        now: () => '2026-07-24T00:00:00.000Z',
      }),
      option.message,
    );
  }
});

test('engine output contract excludes source payloads, URLs and credentials', () => {
  const source = fs.readFileSync(
    path.resolve('scripts/lib/canonical-v2-staging-sec-source.mjs'),
    'utf8',
  );
  const body = source.slice(
    source.indexOf('function attestation('),
    source.indexOf('export async function runStagingSecSource'),
  );
  assert.doesNotMatch(
    body,
    /response_bytes_base64|canonical_text[,}]|source_map_payload_base64|password|service_role|profile\.url/,
  );
  assert.match(body, /deal_membership_status: 'NOT_ATTEMPTED'/);
  assert.match(body, /semantic_extraction_status/);
  assert.match(body, /rollback_first: mode === 'APPLY'/);
  assert.match(body, /admission_rollback_verified: admissionRollbackVerified/);
});
