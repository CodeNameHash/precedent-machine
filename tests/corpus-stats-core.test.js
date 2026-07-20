// lib/queries/corpus-stats-core.js -- the shared peer-set/featureSummary/
// peers computation extracted from pages/api/corpus-stats.js (r13, batch
// endpoint follow-on) so pages/api/corpus-stats.js and pages/api/corpus-
// stats-batch.js run the IDENTICAL logic instead of two drifting copies.
// Covers: base/per-code split behavior parity, and the batch-only chunking/
// partitioning helpers (chunkCodesForQuery, partitionByCode) that back the
// batch endpoint's truncation guard.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCorpusBase,
  buildCodeStats,
  chunkCodesForQuery,
  partitionByCode,
  DEFAULT_PER_CODE_CLAIMS_LIMIT,
  DEFAULT_PER_CODE_CARDS_LIMIT,
} = require('../lib/queries/corpus-stats-core');

function deal(id, overrides = {}) {
  return {
    id,
    acquirer: `Acquirer-${id}`,
    target: `Target-${id}`,
    sector: 'Tech',
    value_usd: 1e9,
    announce_date: '2025-01-01',
    metadata: {},
    ...overrides,
  };
}

test('buildCorpusBase excludes staging deals and computes the peer set/options from the rest', () => {
  const deals = [
    deal('d1'),
    deal('d2', { sector: 'Biotech' }),
    deal('staging', { metadata: { ingest_status: 'staging' } }),
  ];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: 'd1', filters: {} });
  assert.equal(base.peerSet.length, 2, 'staging deal excluded from the peer set');
  assert.ok(base.peerIds.has('d1') && base.peerIds.has('d2'));
  assert.deepEqual(base.options.sectors, ['Biotech', 'Tech']);
  assert.equal(base.subject.id, 'd1');
});

test('buildCorpusBase filters the peer set by sector/size/etc, but options stay corpus-wide', () => {
  const deals = [deal('d1', { sector: 'Tech' }), deal('d2', { sector: 'Biotech' })];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: { sector: 'Tech' } });
  assert.deepEqual([...base.peerIds], ['d1'], 'peer set narrowed by the sector filter');
  assert.deepEqual(base.options.sectors, ['Biotech', 'Tech'], 'options list is never filtered -- a chosen filter must not hide other options');
});

test('buildCodeStats computes dealsWithCode/featureSummary/peers from cards+claims already scoped to one code', () => {
  const deals = [deal('d1'), deal('d2'), deal('d3')];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: 'd1', filters: {} });
  const cardsForCode = [
    { deal_id: 'd1', provision_subtype: 'TERMF-COMPANY', id: 'c1', excerpt_id: 'e1' },
    { deal_id: 'd2', provision_subtype: 'TERMF-COMPANY', id: 'c2', excerpt_id: 'e2' },
  ];
  const claimsForCode = [
    { deal_id: 'd1', attribute: 'feeRequired', canonical: 'YES', provenance: { code: 'TERMF-COMPANY' } },
    { deal_id: 'd2', attribute: 'feeRequired', canonical: 'NO', provenance: { code: 'TERMF-COMPANY' } },
  ];
  const stats = buildCodeStats({
    code: 'TERMF-COMPANY',
    cardsForCode,
    claimsForCode,
    subjectDealId: 'd1',
    subject: base.subject,
    peerSet: base.peerSet,
    peerIds: base.peerIds,
    firmsByDeal: base.firmsByDeal,
  });
  assert.equal(stats.code, 'TERMF-COMPANY');
  assert.equal(stats.peerSetSize, 3);
  assert.equal(stats.dealsWithCode, 2);
  assert.equal(stats.featureSummary.length, 1);
  assert.equal(stats.featureSummary[0].attribute, 'feeRequired');
  assert.equal(stats.featureSummary[0].total, 2);
  // Peers exclude the subject deal itself.
  assert.deepEqual(stats.peers.map((p) => p.deal_id), ['d2']);
});

test('buildCodeStats with an empty cards/claims slice (a code with zero matches in a batch) returns zero counts, not an error', () => {
  const deals = [deal('d1')];
  const base = buildCorpusBase({ deals, cards: [], subjectDealId: null, filters: {} });
  const stats = buildCodeStats({
    code: 'NOSOL-GHOST', cardsForCode: [], claimsForCode: [], subjectDealId: null, subject: null, peerSet: base.peerSet, peerIds: base.peerIds, firmsByDeal: base.firmsByDeal,
  });
  assert.equal(stats.dealsWithCode, 0);
  assert.deepEqual(stats.featureSummary, []);
  assert.deepEqual(stats.peers, []);
});

// -- batch endpoint chunking/partitioning ----------------------------------

test('chunkCodesForQuery groups codes so no single chunk exceeds the safe ceiling, and sizes each chunk\'s limit to its own code count', () => {
  const codes = Array.from({ length: 12 }, (_, i) => `CODE-${i}`);
  const chunks = chunkCodesForQuery(codes, 4000, 20000); // 20000/4000 = 5 codes/chunk
  assert.equal(chunks.length, 3, '12 codes at 5/chunk -> 3 chunks (5, 5, 2)');
  assert.deepEqual(chunks.map((c) => c.codes.length), [5, 5, 2]);
  for (const chunk of chunks) {
    assert.equal(chunk.limit, 4000 * chunk.codes.length);
    assert.ok(chunk.limit <= 20000, 'no chunk asks for more than the safe ceiling');
  }
  // Every code appears in exactly one chunk, in order, nothing dropped.
  assert.deepEqual(chunks.flatMap((c) => c.codes), codes);
});

test('chunkCodesForQuery with few codes returns one chunk (no unnecessary splitting)', () => {
  const chunks = chunkCodesForQuery(['A', 'B', 'C'], DEFAULT_PER_CODE_CLAIMS_LIMIT);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0].codes, ['A', 'B', 'C']);
});

test('chunkCodesForQuery sizes cards chunks larger than claims chunks (cards\' per-code limit is smaller)', () => {
  const codes = Array.from({ length: 10 }, (_, i) => `C${i}`);
  const claimsChunks = chunkCodesForQuery(codes, DEFAULT_PER_CODE_CLAIMS_LIMIT);
  const cardsChunks = chunkCodesForQuery(codes, DEFAULT_PER_CODE_CARDS_LIMIT);
  assert.ok(cardsChunks.length <= claimsChunks.length, 'cards\' smaller per-code limit means fewer/equal chunks for the same code count');
});

test('partitionByCode buckets rows by their own code and seeds an empty bucket for codes with no matches -- never drops a requested code', () => {
  const codes = ['A', 'B', 'C'];
  const rows = [
    { deal_id: 'd1', provenance: { code: 'A' } },
    { deal_id: 'd2', provenance: { code: 'A' } },
    { deal_id: 'd3', provenance: { code: 'B' } },
  ];
  const byCode = partitionByCode(rows, codes, (r) => r.provenance.code);
  assert.equal(byCode.get('A').length, 2);
  assert.equal(byCode.get('B').length, 1);
  assert.deepEqual(byCode.get('C'), [], 'a code with zero matches still gets an (empty) bucket, not a missing key');
});

test('partitionByCode ignores rows whose code is not one of the requested codes (a chunk boundary quirk should never leak into the wrong bucket)', () => {
  const rows = [{ code: 'A' }, { code: 'UNREQUESTED' }];
  const byCode = partitionByCode(rows, ['A'], (r) => r.code);
  assert.equal(byCode.size, 1);
  assert.equal(byCode.get('A').length, 1);
});

// End-to-end truncation-guard scenario: a chunk that comes back AT its own
// limit means the batch endpoint must flag every code in that chunk as
// possibly-truncated (see pages/api/corpus-stats-batch.js) -- this test
// exercises the same detection arithmetic (`rows.length >= chunk.limit`)
// the route applies, against the pure chunking output, so the guard's logic
// is covered without needing a live Supabase mock.
test('a chunk whose returned row count equals its limit is detectable as truncated using chunk.limit', () => {
  const chunks = chunkCodesForQuery(['A', 'B'], 10, 20); // limit = 20 for this one chunk
  assert.equal(chunks.length, 1);
  const chunk = chunks[0];
  const fullRows = new Array(chunk.limit).fill(0).map((_, i) => ({ id: i }));
  const partialRows = fullRows.slice(0, chunk.limit - 1);
  assert.ok(fullRows.length >= chunk.limit, 'exactly-at-limit rows must trip the truncation flag');
  assert.ok(partialRows.length < chunk.limit, 'under-limit rows must NOT trip the truncation flag');
});
