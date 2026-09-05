'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSharedSourceCore } = require('..');

const root = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/metsera/conformance.json')));
const bytes = fs.readFileSync(path.join(root, 'fixtures/metsera/response.htm'));

test('real Metsera bytes reproduce every pinned identity offline', async () => {
  const core = createSharedSourceCore({
    lookup: async () => [{ address: '23.62.25.91', family: 4 }],
    transport: async () => new Response(bytes, {
      status: 200,
      headers: {
        'content-type': fixture.source.content_type,
        'content-length': String(bytes.length),
        date: new Date(fixture.source.retrieved_at).toUTCString(),
      },
    }),
  });
  const transactionId = await core.registerTransaction({
    target_identity: fixture.target_identity,
    transaction_anchor: fixture.transaction_anchor,
    announced_transaction_ordinal: fixture.announced_transaction_ordinal,
  });
  assert.equal(transactionId, fixture.expected.transaction_id);
  const admissionSetId = await core.admitDealSources({
    transaction_id: transactionId,
    sources: [{ sec_url: fixture.source.sec_url, source_role: fixture.source.source_role }],
  });
  assert.match(admissionSetId, /^[a-f0-9]{64}$/);
  const [document] = [...core.store.documents.values()];
  assert.equal(document.document_id, fixture.expected.document_id);
  assert.equal(document.raw_sha256, fixture.expected.raw_sha256);
  assert.equal(document.canonical_sha256, fixture.expected.canonical_sha256);
  assert.equal(document.source_map_digest, fixture.expected.source_map_digest);
  assert.equal(document.source_map_compressed_sha256, fixture.expected.source_map_compressed_sha256);
  assert.equal(Buffer.from(document.exact_response_bytes_base64, 'base64').equals(bytes), true);
  assert.equal(Buffer.byteLength(Buffer.from(document.canonical_utf8_base64, 'base64')), document.canonical_byte_length);
});
