// lib/client/corpus-version.js -- the module-level-memoized /api/corpus-
// version fetch (r13, client wiring of the corpus-version cache token).
// Covers: memoization (one fetch shared by every caller), graceful
// degradation to null on a non-ok response, network error, or timeout.
const test = require('node:test');
const assert = require('node:assert/strict');
const { getCorpusVersion, __resetCorpusVersionForTests } = require('../lib/client/corpus-version.js');

test.beforeEach(() => __resetCorpusVersionForTests());

test('getCorpusVersion resolves the version string from a successful fetch', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ version: 'abc123' }) };
  };
  const version = await getCorpusVersion();
  assert.equal(version, 'abc123');
  assert.equal(calls, 1);
});

test('getCorpusVersion memoizes -- concurrent/subsequent callers share ONE fetch, not one each', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ version: 'shared-token' }) };
  };
  const [a, b, c] = await Promise.all([getCorpusVersion(), getCorpusVersion(), getCorpusVersion()]);
  assert.equal(calls, 1, 'three concurrent callers triggered exactly one underlying fetch');
  assert.equal(a, 'shared-token');
  assert.equal(b, 'shared-token');
  assert.equal(c, 'shared-token');
  // A later call (after the promise already resolved) still reuses the memo.
  const later = await getCorpusVersion();
  assert.equal(calls, 1);
  assert.equal(later, 'shared-token');
});

test('getCorpusVersion degrades to null (never throws) on a non-ok HTTP response', async () => {
  global.fetch = async () => ({ ok: false, json: async () => ({ error: 'boom' }) });
  const version = await getCorpusVersion();
  assert.equal(version, null);
});

test('getCorpusVersion degrades to null on a network error -- callers never need their own try/catch', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  const version = await getCorpusVersion();
  assert.equal(version, null);
});

test('getCorpusVersion degrades to null when the response carries no version field', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  const version = await getCorpusVersion();
  assert.equal(version, null);
});

test('getCorpusVersion never blocks indefinitely -- a fetch that hangs past the cap resolves null via its own AbortController', async () => {
  global.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => {
    // Simulate a hung request: only settles if aborted.
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const start = Date.now();
  const version = await getCorpusVersion();
  const elapsed = Date.now() - start;
  assert.equal(version, null);
  assert.ok(elapsed < 3000, `resolved within the ~2s cap (took ${elapsed}ms)`);
});
