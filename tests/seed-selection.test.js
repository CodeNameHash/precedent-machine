const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  selectSeedDeals,
} = require('../scripts/select-seed-deals');

function queryResult(data, error = null) {
  const query = {
    select() { return this; },
    order() { return this; },
    limit() { return this; },
    eq() { return this; },
    then(resolve) { return Promise.resolve({ data, error }).then(resolve); },
  };
  return query;
}

function mockSupabase({ candidates, deals = [] }) {
  return {
    from(table) {
      if (table === 'deal_candidates') return queryResult(candidates);
      if (table === 'deals') return queryResult(deals);
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function candidate(overrides) {
  return {
    id: overrides.id,
    filing_date: overrides.filing_date || '2026-01-01',
    filed_by_party: overrides.filed_by_party || null,
    target_name: overrides.target_name || 'Target Co.',
    acquirer_name: overrides.acquirer_name || 'Buyer Co.',
    deal_value_usd: overrides.deal_value_usd || null,
    announced_at: overrides.announced_at || null,
    agreement_exhibit_url: overrides.agreement_exhibit_url || `https://sec.example/${overrides.id}.htm`,
    status: overrides.status || 'pending',
  };
}

function mockFetch(textByUrl) {
  return async (url) => ({
    ok: true,
    status: 200,
    text: async () => textByUrl[url] || 'Agreement text with no priority counsel named.',
  });
}

test('parseArgs defaults to pending status and target-count 32', () => {
  const args = parseArgs(['node', 'script']);
  assert.equal(args.status, 'pending');
  assert.equal(args.targetCount, 32);
  assert.equal(args.limit, 200);
});

test('Paul Weiss evidence takes first priority and appears in manifest', async () => {
  const pw = candidate({ id: 'pw', filing_date: '2024-01-01', deal_value_usd: 1_000_000_000 });
  const huge = candidate({ id: 'huge', filing_date: '2026-01-01', deal_value_usd: 50_000_000_000 });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({ candidates: [huge, pw] }),
    targetCount: 2,
    delayMs: 0,
    now: () => new Date('2026-07-05T12:00:00Z'),
    fetchImpl: mockFetch({
      [pw.agreement_exhibit_url]: 'The Company is represented by Paul, Weiss, Rifkind, Wharton & Garrison LLP in this transaction.',
    }),
  });

  assert.equal(manifest.candidates[0].candidate_id, 'pw');
  assert.ok(manifest.candidates[0].priority_reasons.includes('Paul Weiss named in agreement text'));
  assert.match(manifest.candidates[0].paul_weiss_evidence_snippet, /Paul,\s*Weiss/);
});

test('deals at or above $10bn outrank recency fallback', async () => {
  const mega = candidate({ id: 'mega', filing_date: '2023-01-01', deal_value_usd: 10_000_000_000 });
  const recent = candidate({ id: 'recent', filing_date: '2026-01-01', deal_value_usd: 500_000_000 });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({ candidates: [recent, mega] }),
    targetCount: 2,
    delayMs: 0,
    fetchImpl: mockFetch({}),
  });

  assert.equal(manifest.candidates[0].candidate_id, 'mega');
  assert.ok(manifest.candidates[0].priority_reasons.includes('Deal value at or above $10bn'));
});

test('externally verified mega-deals outrank fallback even when candidate value is null', async () => {
  const verified = candidate({ id: 'verified', filing_date: '2024-01-01', deal_value_usd: null });
  const recent = candidate({ id: 'recent', filing_date: '2026-01-01', deal_value_usd: 500_000_000 });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({ candidates: [recent, verified] }),
    targetCount: 2,
    delayMs: 0,
    priorityRows: [{
      candidate_id: 'verified',
      deal_key: 'verified-mega',
      verified_value_usd: 14_000_000_000,
      value_metric: 'equity value',
      source_label: 'Company press release',
      source_url: 'https://example.com/verified',
      focus_note: 'Externally verified mega-deal candidate',
    }],
    fetchImpl: mockFetch({}),
  });

  assert.equal(manifest.candidates[0].candidate_id, 'verified');
  assert.equal(manifest.candidates[0].effective_value_usd, 14_000_000_000);
  assert.ok(manifest.candidates[0].priority_reasons.includes('Deal value at or above $10bn'));
  assert.equal(manifest.candidates[0].priority_verification.source_url, 'https://example.com/verified');
});

test('selector excludes candidates already represented in deals metadata.source_url', async () => {
  const duplicate = candidate({ id: 'duplicate' });
  const fresh = candidate({ id: 'fresh' });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({
      candidates: [duplicate, fresh],
      deals: [{ id: 'deal-1', metadata: { source_url: duplicate.agreement_exhibit_url } }],
    }),
    targetCount: 10,
    delayMs: 0,
    fetchImpl: mockFetch({}),
  });

  assert.deepEqual(manifest.candidates.map((item) => item.candidate_id), ['fresh']);
  assert.equal(manifest.duplicate_excluded_count, 1);
});

test('selector can exclude priority-file duplicates before scoring', async () => {
  const duplicate = candidate({ id: 'duplicate' });
  const fresh = candidate({ id: 'fresh' });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({ candidates: [duplicate, fresh] }),
    targetCount: 10,
    delayMs: 0,
    priorityRows: [{ candidate_id: 'duplicate', exclude: true }],
    fetchImpl: mockFetch({}),
  });

  assert.deepEqual(manifest.candidates.map((item) => item.candidate_id), ['fresh']);
});

test('manifest shape includes candidate id, filing date, parties, value, URL, reasons, and evidence field', async () => {
  const row = candidate({
    id: 'shape',
    filing_date: '2025-12-15',
    acquirer_name: 'Acquirer Inc.',
    target_name: 'Target plc',
    filed_by_party: 'Target plc',
    deal_value_usd: 12_300_000_000,
    agreement_exhibit_url: 'https://sec.example/shape.htm',
  });
  const manifest = await selectSeedDeals({
    supabase: mockSupabase({ candidates: [row] }),
    targetCount: 1,
    delayMs: 0,
    dryRun: true,
    fetchImpl: mockFetch({
      [row.agreement_exhibit_url]: 'Counsel includes Paul Weiss for one of the parties.',
    }),
    now: () => new Date('2026-07-05T09:30:00Z'),
  });

  assert.equal(manifest.generated_at, '2026-07-05T09:30:00.000Z');
  assert.equal(manifest.dry_run, true);
  assert.equal(manifest.status, 'pending');
  assert.equal(manifest.target_count, 1);
  assert.equal(manifest.selected_count, 1);
  assert.deepEqual(Object.keys(manifest.candidates[0]), [
    'candidate_id',
    'filing_date',
    'parties',
    'value_usd',
    'effective_value_usd',
    'url',
    'agreement_exhibit_url',
    'agreement_text_hash',
    'deal_key',
    'priority_reasons',
    'paul_weiss_evidence_snippet',
    'priority_verification',
  ]);
  assert.deepEqual(manifest.candidates[0].parties, {
    acquirer: 'Acquirer Inc.',
    target: 'Target plc',
    filed_by: 'Target plc',
  });
  assert.equal(manifest.candidates[0].value_usd, 12_300_000_000);
  assert.equal(manifest.candidates[0].effective_value_usd, 12_300_000_000);
  assert.equal(manifest.candidates[0].url, 'https://sec.example/shape.htm');
  assert.equal(manifest.candidates[0].deal_key, 'acquirer inc.|target plc');
  assert.match(manifest.candidates[0].paul_weiss_evidence_snippet, /Paul Weiss/);
  assert.equal(manifest.candidates[0].priority_verification, null);
});
