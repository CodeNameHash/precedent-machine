const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const dealSnapshot = require('../lib/generated/home-deal-directory-v1.json');
const searchSnapshot = require('../public/generated/home-search-index-v1.json');
const {
  DEAL_KEYS,
  MAX_DEALS,
  getHomePayload,
  validateDealDirectorySnapshot,
} = require('../lib/home-snapshot');
const {
  MAX_SEARCH_ENTRIES,
  SEARCH_SNAPSHOT_URL,
  homeSearchSuggestions,
  shouldLoadHomeSearchIndex,
  validateHomeSearchSnapshot,
} = require('../lib/home-search');
const { getHomeStaticProps } = require('../lib/home-static-props');
const { buildHomeSnapshots, sizeBand } = require('../scripts/generate-home-snapshots');

test('checked-in deal snapshot is capped, strict and contains the current 40 deals', () => {
  assert.equal(validateDealDirectorySnapshot(dealSnapshot), dealSnapshot);
  assert.equal(dealSnapshot.deals.length, 40);
  assert.ok(dealSnapshot.deals.length <= MAX_DEALS);
  for (const deal of dealSnapshot.deals) {
    assert.deepEqual(Object.keys(deal).sort(), [...DEAL_KEYS].sort());
    assert.equal(typeof deal.structure === 'string' || deal.structure === null, true);
    assert.equal(typeof deal.merger_form === 'string' || deal.merger_form === null, true);
  }
  assert.doesNotMatch(JSON.stringify(dealSnapshot), /"full_text"|"ai_metadata"|"metadata"|"features"/);
});

test('checked-in search snapshot contains only the 250 provision and 80 term links', () => {
  assert.equal(validateHomeSearchSnapshot(searchSnapshot), searchSnapshot);
  assert.equal(searchSnapshot.entries.length, 330);
  assert.ok(searchSnapshot.entries.length <= MAX_SEARCH_ENTRIES);
  assert.equal(searchSnapshot.entries.filter((entry) => entry.type === 'provision').length, 250);
  assert.equal(searchSnapshot.entries.filter((entry) => entry.type === 'term').length, 80);
  assert.equal(searchSnapshot.entries.some((entry) => entry.type === 'deal'), false);
});

test('offline builder splits deal rows from provision and term search entries', () => {
  const payload = {
    deals: [dealSnapshot.deals[0]],
    search_index: [
      { type: 'deal', label: 'Deal', detail: '2026', href: '/review/deal-1' },
      { type: 'provision', label: 'No-shop', detail: 'Deal', href: '/review-v1/deal-1/provision/p-1' },
      { type: 'term', label: 'Company MAE', detail: 'Deal', href: '/review-v1/deal-1/provision/p-2' },
    ],
  };
  const built = buildHomeSnapshots(payload);
  assert.equal(built.dealSnapshot.deals.length, 1);
  assert.deepEqual(built.searchSnapshot.entries.map((entry) => entry.type), ['provision', 'term']);
  assert.equal(built.dealSnapshot.deals[0].structure, payload.deals[0].structure);
  assert.equal(built.dealSnapshot.deals[0].merger_form, payload.deals[0].merger_form);
});

test('offline builder derives value bands from positive values and never classifies a missing value', () => {
  assert.equal(sizeBand(null), null);
  assert.equal(sizeBand(0), null);
  assert.equal(sizeBand(999_999_999), '<$1B');
  assert.equal(sizeBand(5_000_000_000), '$1B-$10B');
  assert.equal(sizeBand(10_000_000_000), '>$10B');

  const sourceDeal = { ...dealSnapshot.deals[0], value: null, value_band: '<$1B' };
  const built = buildHomeSnapshots({ deals: [sourceDeal], search_index: [] });
  assert.equal(built.dealSnapshot.deals[0].value_band, null);
});

test('homepage runtime and static props read only the checked-in deal snapshot', () => {
  assert.deepEqual(getHomePayload(), { deals: dealSnapshot.deals });
  assert.deepEqual(getHomeStaticProps(), {
    props: { initialData: { deals: dealSnapshot.deals } },
    revalidate: 300,
  });

  const apiSource = fs.readFileSync(require.resolve('../pages/api/home.js'), 'utf8');
  const staticSource = fs.readFileSync(require.resolve('../lib/home-static-props.js'), 'utf8');
  const pageSource = fs.readFileSync(require.resolve('../pages/index.js'), 'utf8');
  for (const [label, source] of [
    ['API', apiSource],
    ['static props', staticSource],
    ['homepage', pageSource],
  ]) {
    assert.doesNotMatch(source, /supabase|home-data|from\(['"]provisions['"]\)|fetchAllProvisions/i, `${label} must have no database or provision-scan path`);
  }
  assert.match(apiSource, /getHomePayload/);
  assert.match(staticSource, /getHomePayload/);
});

test('provision and term search asset is fetched lazily only at two characters', () => {
  assert.equal(shouldLoadHomeSearchIndex(''), false);
  assert.equal(shouldLoadHomeSearchIndex('a'), false);
  assert.equal(shouldLoadHomeSearchIndex(' a '), false);
  assert.equal(shouldLoadHomeSearchIndex('ab'), true);
  assert.equal(SEARCH_SNAPSHOT_URL, '/generated/home-search-index-v1.json');

  const pageSource = fs.readFileSync(require.resolve('../pages/index.js'), 'utf8');
  assert.match(pageSource, /if \(!shouldLoadHomeSearchIndex\(search\) \|\| searchIndexStatus !== 'idle'\) return/);
  assert.match(pageSource, /fetch\(SEARCH_SNAPSHOT_URL\)/);
  assert.doesNotMatch(pageSource, /data\?\.search_index/);
});

test('deal suggestions remain available while the separate index loads', () => {
  const deal = dealSnapshot.deals[0];
  const dealHits = homeSearchSuggestions(deal.deal_name.slice(0, 3), [deal], null);
  assert.equal(dealHits[0].type, 'deal');
  assert.equal(dealHits[0].href, `/review/${deal.id}`);

  const provision = searchSnapshot.entries.find((entry) => entry.type === 'provision');
  const provisionHits = homeSearchSuggestions(provision.label, [], searchSnapshot.entries);
  assert.ok(provisionHits.some((entry) => entry.href === provision.href));
});

test('snapshot validators reject oversized or corpus-bearing payloads', () => {
  const oversizedDeals = {
    ...dealSnapshot,
    _meta: { ...dealSnapshot._meta, deal_count: MAX_DEALS + 1 },
    deals: Array.from({ length: MAX_DEALS + 1 }, () => dealSnapshot.deals[0]),
  };
  assert.throws(() => validateDealDirectorySnapshot(oversizedDeals), /exceeds/);

  const corpusBearing = structuredClone(dealSnapshot);
  corpusBearing.deals[0].ai_metadata = {};
  assert.throws(() => validateDealDirectorySnapshot(corpusBearing), /invalid field set|forbidden/);

  const oversizedSearch = {
    ...searchSnapshot,
    _meta: { ...searchSnapshot._meta, entry_count: MAX_SEARCH_ENTRIES + 1 },
    entries: Array.from({ length: MAX_SEARCH_ENTRIES + 1 }, () => searchSnapshot.entries[0]),
  };
  assert.throws(() => validateHomeSearchSnapshot(oversizedSearch), /exceeds/);
});
