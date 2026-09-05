'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { createSharedSourceCore, IdentityConflictError } = require('..');

const transaction = {
  target_identity: '0002040807',
  transaction_anchor: {
    issuer_cik: '0002040807',
    accession_number: '0001193125-25-210030',
    document_role: 'MERGER_AGREEMENT',
  },
  announced_transaction_ordinal: 0,
};
const source = {
  sec_url: 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/agreement.htm',
  source_role: 'MERGER_AGREEMENT',
};
const publicLookup = async () => [{ address: '23.62.25.91', family: 4 }];

async function run({ transport, lookup = publicLookup, maxBytes = 100 } = {}) {
  const core = createSharedSourceCore({ transport, lookup, maxBytes });
  const transactionId = await core.registerTransaction(transaction);
  return core.admitDealSources({ transaction_id: transactionId, sources: [source] });
}

test('rejects HTTP and unapproved hosts before fetch', async () => {
  const core = createSharedSourceCore({ transport: async () => { throw new Error('must not fetch'); }, lookup: publicLookup });
  const id = await core.registerTransaction(transaction);
  for (const sec_url of ['http://www.sec.gov/a', 'https://example.com/a', 'https://user@www.sec.gov/a']) {
    await assert.rejects(core.admitDealSources({ transaction_id: id, sources: [{ ...source, sec_url }] }),
      (error) => error.code === 'UNAPPROVED_SEC_URL');
  }
});

test('rejects full relevant IANA special-purpose ranges before fetch', async () => {
  for (const address of [
    '0.1.2.3', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.1.1',
    '172.16.0.1', '192.0.0.1', '192.0.2.1', '192.31.196.1', '192.52.193.1',
    '192.88.99.1', '192.168.0.1', '192.175.48.1', '198.18.0.1',
    '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1',
    '::', '::1', '::ffff:127.0.0.1', '64:ff9b::1', '64:ff9b:1::1', '100::1',
    '2001::1', '2001:2::1', '2001:db8::1', '2002::1', '2620:4f:8000::1',
    '3fff::1', '5f00::1', 'fc00::1', 'fe80::1', 'ff00::1',
  ]) {
    await assert.rejects(run({
      lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      transport: async () => { throw new Error('must not fetch'); },
    }), (error) => error.code === 'FORBIDDEN_DESTINATION');
  }
});

test('allows ordinary global SEC CDN address families', async () => {
  for (const address of ['23.62.25.91', '2600:1408:ec00:36::1736:7f24']) {
    const result = await run({
      lookup: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      transport: async () => new Response('<p>x</p>', {
        status: 200, headers: { 'content-type': 'text/html' },
      }),
    });
    assert.match(result, /^[a-f0-9]{64}$/);
  }
});

test('default https.get transport honours Node all-lookup callback shape', async () => {
  const originalGet = https.get;
  const calls = [];
  https.get = (url, options, callback) => {
    options.lookup('www.sec.gov', { all: true, verbatim: true }, (error, addresses) => {
      assert.ifError(error);
      calls.push({ mode: 'all', addresses });
    });
    options.lookup('www.sec.gov', { all: false, verbatim: true }, (error, address, family) => {
      assert.ifError(error);
      calls.push({ mode: 'scalar', address, family });
    });
    const response = {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      on() {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('<p>x</p>');
      },
    };
    callback(response);
    return { on() {} };
  };
  try {
    const core = createSharedSourceCore({
      lookup: async () => [{ address: '23.62.25.91', family: 4 }],
    });
    const id = await core.registerTransaction(transaction);
    await core.admitDealSources({ transaction_id: id, sources: [source] });
  } finally {
    https.get = originalGet;
  }
  assert.deepEqual(calls, [
    { mode: 'all', addresses: [{ address: '23.62.25.91', family: 4 }] },
    { mode: 'scalar', address: '23.62.25.91', family: 4 },
  ]);
});

test('validates every redirect destination', async () => {
  let calls = 0;
  await assert.rejects(run({ transport: async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { location: 'https://example.com/steal' } });
  } }), (error) => error.code === 'UNAPPROVED_SEC_URL');
  assert.equal(calls, 1);
});

test('resolves and validates every allowed redirect hop', async () => {
  let resolves = 0;
  let calls = 0;
  const lookup = async () => {
    resolves += 1;
    return resolves === 1 ? [{ address: '23.62.25.91', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
  };
  await assert.rejects(run({ lookup, transport: async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { location: '/Archives/edgar/data/2040807/000119312525210030/next.htm' } });
  } }), (error) => error.code === 'FORBIDDEN_DESTINATION');
  assert.equal(calls, 1);
  assert.equal(resolves, 2);
});

test('requires exact 200 and rejects disallowed or absent content type', async () => {
  await assert.rejects(run({ transport: async () => new Response('no', { status: 404, headers: { 'content-type': 'text/html' } }) }),
    (error) => error.code === 'HTTP_STATUS_REJECTED');
  await assert.rejects(run({ transport: async () => new Response(null, { status: 204, headers: { 'content-type': 'text/html' } }) }),
    (error) => error.code === 'HTTP_STATUS_REJECTED');
  for (const contentType of ['application/pdf', '']) {
    await assert.rejects(run({ transport: async () => new Response('x', { status: 200, headers: { 'content-type': contentType } }) }),
      (error) => error.code === 'CONTENT_TYPE_REJECTED');
  }
});

test('rejects declared and streamed bodies beyond the byte limit', async () => {
  await assert.rejects(run({ transport: async () => new Response('x', {
    status: 200, headers: { 'content-type': 'text/html', 'content-length': '101' },
  }) }), (error) => error.code === 'RESPONSE_TOO_LARGE');
  await assert.rejects(run({ transport: async () => new Response('x'.repeat(101), {
    status: 200, headers: { 'content-type': 'text/html' },
  }) }), (error) => error.code === 'RESPONSE_TOO_LARGE');
});

test('rejects typed transaction identity conflict before any write', async () => {
  const conflictStore = {
    writes: 0,
    async getTransaction() { return { identity_payload: { conflict: true } }; },
    async writeBatch() { this.writes += 1; },
  };
  const core = createSharedSourceCore({ store: conflictStore, transport: async () => {}, lookup: publicLookup });
  await assert.rejects(core.registerTransaction(transaction), IdentityConflictError);
  assert.equal(conflictStore.writes, 0);
});

test('rejects source-to-transaction identity conflict before document storage', async () => {
  const core = createSharedSourceCore({
    lookup: publicLookup,
    transport: async () => new Response('<p>x</p>', { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  const id = await core.registerTransaction(transaction);
  const writesBefore = core.store.writeCount;
  await assert.rejects(core.admitDealSources({
    transaction_id: id,
    sources: [{ ...source, sec_url: 'https://www.sec.gov/Archives/edgar/data/999/000119312525210030/x.htm' }],
  }), IdentityConflictError);
  assert.equal(core.store.writeCount, writesBefore);
  assert.equal(core.store.documents.size, 0);
});

test('security policy cannot be weakened by consumer configuration', () => {
  assert.throws(() => createSharedSourceCore({ maxBytes: 16 * 1024 * 1024 + 1 }),
    (error) => error.code === 'INVALID_CONFIGURATION');
  assert.throws(() => createSharedSourceCore({ maxBytes: 0 }),
    (error) => error.code === 'INVALID_CONFIGURATION');
});

test('transport receives only the public address validated for that hop', async () => {
  const seen = [];
  await run({
    lookup: async () => [{ address: '23.62.25.91', family: 4 }],
    transport: async (url, options) => {
      seen.push({ url, address: options.address, family: options.family });
      return new Response('<p>x</p>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });
  assert.deepEqual(seen, [{ url: source.sec_url, address: '23.62.25.91', family: 4 }]);
});

test('later filing in the same transaction and role creates version lineage', async () => {
  const core = createSharedSourceCore({
    lookup: publicLookup,
    transport: async (url) => new Response(url.includes('210030') ? '<p>v1</p>' : '<p>v2</p>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }),
  });
  const id = await core.registerTransaction(transaction);
  await core.admitDealSources({ transaction_id: id, sources: [source] });
  await core.admitDealSources({ transaction_id: id, sources: [{
    ...source,
    sec_url: 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210031/amendment.htm',
  }] });
  const rows = [...core.store.documents.values()];
  assert.equal(rows.length, 2);
  const first = rows.find((row) => row.version_ordinal === 1);
  const second = rows.find((row) => row.version_ordinal === 2);
  assert.equal(second.predecessor_document_id, first.document_id);
});

test('same-role filings within one batch form sequential version lineage', async () => {
  const core = createSharedSourceCore({
    lookup: publicLookup,
    transport: async (url) => new Response(url.includes('210030') ? '<p>v1</p>' : '<p>v2</p>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }),
  });
  const id = await core.registerTransaction(transaction);
  await core.admitDealSources({ transaction_id: id, sources: [source, {
    ...source,
    sec_url: 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210031/amendment.htm',
  }] });
  const rows = [...core.store.documents.values()];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].version_ordinal, 1);
  assert.equal(rows[0].predecessor_document_id, null);
  assert.equal(rows[1].version_ordinal, 2);
  assert.equal(rows[1].predecessor_document_id, rows[0].document_id);
});

test('uses an explicit valid retrieval clock and rejects invalid clocks with a typed error', async () => {
  for (const clock of [() => new Date('invalid'), () => '2026-09-05T00:00:00.000Z', () => { throw new Error('clock'); }]) {
    const core = createSharedSourceCore({
      clock,
      lookup: publicLookup,
      transport: async () => new Response('<p>x</p>', {
        status: 200, headers: { 'content-type': 'text/html', date: 'not-a-date' },
      }),
    });
    const id = await core.registerTransaction(transaction);
    const writesBefore = core.store.writeCount;
    await assert.rejects(core.admitDealSources({ transaction_id: id, sources: [source] }),
      (error) => error.code === 'INVALID_RETRIEVAL_TIME');
    assert.equal(core.store.writeCount, writesBefore);
  }
  const expected = '2026-09-05T12:34:56.789Z';
  const core = createSharedSourceCore({
    clock: () => new Date(expected),
    lookup: publicLookup,
    transport: async () => new Response('<p>x</p>', {
      status: 200, headers: { 'content-type': 'text/html', date: 'not-a-date' },
    }),
  });
  const id = await core.registerTransaction(transaction);
  await core.admitDealSources({ transaction_id: id, sources: [source] });
  const row = [...core.store.documents.values()][0];
  assert.equal(row.response_metadata.retrieved_at, expected);
  assert.equal(row.response_metadata.headers.date, 'not-a-date');
});

test('one SEC locator cannot bind to two transactions and conflict writes nothing', async () => {
  const core = createSharedSourceCore({
    lookup: publicLookup,
    transport: async () => new Response('<p>x</p>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }),
  });
  const firstId = await core.registerTransaction(transaction);
  await core.admitDealSources({ transaction_id: firstId, sources: [source] });
  const secondId = await core.registerTransaction({ ...transaction, announced_transaction_ordinal: 1 });
  const writesBefore = core.store.writeCount;
  await assert.rejects(core.admitDealSources({ transaction_id: secondId, sources: [source] }), IdentityConflictError);
  assert.equal(core.store.writeCount, writesBefore);
  assert.equal(core.store.documents.size, 1);
});
