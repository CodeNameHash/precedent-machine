const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { validate } = require('../../lib/query/engine');
const { QUERY_KINDS } = require('../../lib/query/types');
const { resolveDealId, resolveDemoPayload } = require('../../lib/query/fixtures/resolve-demo-payload');
const { decodePayload, encodePayload } = require('../../lib/query/fixtures');

const DEMO_SET_PATH = path.join(__dirname, '..', '..', 'lib/query/fixtures/demo-set.json');
const demoSet = JSON.parse(fs.readFileSync(DEMO_SET_PATH, 'utf8'));

// A dumb but sufficient stub corpus: one deal per @deal: token any demo-set
// entry references, plus enough padding so @all_deals resolves to a non-
// trivial array. This is an OFFLINE structural check only — it proves every
// payload validates against its kind's JSON schema and every @deal:/@all_deals
// token resolves; it does NOT assert the pinned `expected` answer against
// real data (that's scripts/query-demo-check.js's job, against the live
// corpus, per WP-1 spec deliverable 2).
function dealTokensIn(value, out = new Set()) {
  if (Array.isArray(value)) { for (const v of value) dealTokensIn(v, out); return out; }
  if (value && typeof value === 'object') { for (const v of Object.values(value)) dealTokensIn(v, out); return out; }
  if (typeof value === 'string' && value.startsWith('@deal:')) out.add(value.slice('@deal:'.length));
  return out;
}

function buildStubDeals() {
  const tokens = new Set();
  for (const entry of demoSet) dealTokensIn(entry.payload, tokens);
  const deals = [...tokens].map((name, i) => ({
    id: `stub-${i}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    acquirer: 'Stub Acquirer',
    target: name,
    value_usd: 5000000000,
    announce_date: '2024-01-01',
    sector: 'Tech',
    metadata: {},
  }));
  // Pad so @all_deals is non-trivial even for entries with no @deal: tokens.
  deals.push({ id: 'stub-pad-1', acquirer: 'Pad Buyer', target: 'Pad Target', value_usd: 1000000000, announce_date: '2023-01-01', sector: 'Tech', metadata: {} });
  return deals;
}

test('demo-set.json is a well-formed array of exactly 20 entries', () => {
  assert.ok(Array.isArray(demoSet), 'demo-set.json must be a JSON array');
  assert.equal(demoSet.length, 20, `expected 20 demo queries, found ${demoSet.length}`);
});

test('every demo-set id is unique', () => {
  const ids = demoSet.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id in demo-set.json');
});

test('every demo-set entry has the required shape', () => {
  for (const entry of demoSet) {
    assert.equal(typeof entry.id, 'string', `${entry.id}: id must be a string`);
    assert.equal(typeof entry.title, 'string', `${entry.id}: title must be a string`);
    assert.equal(typeof entry.question, 'string', `${entry.id}: question must be a string`);
    assert.ok(QUERY_KINDS.includes(entry.kind), `${entry.id}: invalid kind "${entry.kind}"`);
    assert.ok(entry.payload && typeof entry.payload === 'object', `${entry.id}: payload must be an object`);
    assert.ok(entry.expected && typeof entry.expected === 'object', `${entry.id}: expected must be an object`);
    assert.equal(typeof entry.notes, 'string', `${entry.id}: notes must be a string`);
  }
});

test('every kind appears at least once (5-kind coverage)', () => {
  const kinds = new Set(demoSet.map((e) => e.kind));
  for (const kind of QUERY_KINDS) assert.ok(kinds.has(kind), `no demo-set entry exercises kind ${kind}`);
});

test('@deal:/@all_deals tokens resolve against a stub corpus', () => {
  const deals = buildStubDeals();
  for (const entry of demoSet) {
    assert.doesNotThrow(() => resolveDemoPayload(entry.payload, deals), `${entry.id}: token resolution failed`);
  }
});

test('resolveDealId throws BLOCKED_DEAL_MISSING for an unmatched name', () => {
  assert.throws(() => resolveDealId([{ acquirer: 'A', target: 'B' }], 'Nonexistent Co'), /BLOCKED_DEAL_MISSING/);
});

test('every resolved payload validates against its kind schema', () => {
  const deals = buildStubDeals();
  for (const entry of demoSet) {
    const resolved = resolveDemoPayload(entry.payload, deals);
    assert.doesNotThrow(
      () => validate(entry.kind, resolved, { deals }),
      `${entry.id}: payload failed schema/registry validation`,
    );
  }
});

test('every payload round-trips through the base64url encoder used by the query UI', () => {
  for (const entry of demoSet) {
    const encoded = encodePayload(entry.payload);
    const decoded = decodePayload(encoded);
    assert.deepEqual(decoded, entry.payload, `${entry.id}: payload did not round-trip`);
  }
});
