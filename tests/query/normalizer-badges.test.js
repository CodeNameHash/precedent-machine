// WP-3 (M4-02) normalizer badges — unit tests for `_prov` attachment on
// executors, extraction_version enrichment in lib/query/prov.js, and the
// backward-compatibility guarantees the plan calls out explicitly:
// DEAL_COMPARE rendering data and lib/query/csv.js output are unchanged
// when `_prov` is absent, and CSV must never include `_prov` even when
// it's present on the underlying result.
const test = require('node:test');
const assert = require('node:assert/strict');

const { runQuery } = require('../../lib/query/engine');
const { resultToCsvRows, toCsv } = require('../../lib/query/csv');
const { registryVersion } = require('../../lib/query/resolve');
const { attachExtractionVersions, collectProvCardIds } = require('../../lib/query/prov');

function feature(value, quote = 'supporting quote') {
  return { value, quotes: [quote] };
}

const deals = [
  { id: 'd1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000, announce_date: '2025-01-15', sector: 'Tech', metadata: {} },
  { id: 'd2', acquirer: 'Buyer Two', target: 'Target Two', value_usd: 2000000000, announce_date: '2025-02-15', sector: 'Healthcare', metadata: {} },
];

// go_shop -> goShopPresent is the FIELD_ALIASES entry called out in the
// spec (lib/query/types.js). d1's provision carries the raw alias
// go_shop_present rather than the canonical goShopPresent key, so
// resolveFeatureValue has to walk the registry's alias list to find it —
// exactly the case _prov exists to surface.
const provisions = [
  {
    id: 'p1-nosol',
    deal_id: 'd1',
    type: 'NOSOL',
    category: 'No solicitation',
    full_text: 'No-shop with a go-shop and four business day match right.',
    ai_metadata: { features: { go_shop_present: feature(true), initialMatchPeriodDays: feature(4), boardChangeForSuperiorProposal: feature(true) } },
  },
  {
    id: 'p2-nosol',
    deal_id: 'd2',
    type: 'NOSOL',
    category: 'No solicitation',
    full_text: 'No-shop with five business day match right, no go-shop.',
    ai_metadata: { features: { goShopPresent: feature(false), initialMatchPeriodDays: feature(5), boardChangeForSuperiorProposal: feature(true) } },
  },
];

const context = { deals, provisions };

test('PROVISION_CROSS_CUT attaches _prov with both canonical and matched (alias) keys', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1', 'd2'],
    columns: ['go_shop'],
    sort_by: 'deal_signing_date_desc',
  }, { context });

  const d1Row = result.rows.find((row) => row.deal_id === 'd1');
  const cell = d1Row.cells[0];
  assert.equal(cell.value, true);
  assert.ok(cell._prov, 'value-bearing cell must carry _prov');
  assert.equal(cell._prov.canonical_key, 'goShopPresent');
  assert.equal(cell._prov.matched_key, 'go_shop_present');
  assert.notEqual(cell._prov.canonical_key, cell._prov.matched_key, 'alias fixture must surface BOTH the canonical and raw keys');
  assert.equal(cell._prov.registry_version, registryVersion());
});

test('MARKET_RANGE deal_points carry _prov for every populated point', async () => {
  const result = await runQuery('MARKET_RANGE', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    field_path: 'go_shop',
    deal_filter: {},
  }, { context });
  assert.equal(result.deal_points.length, 2);
  for (const point of result.deal_points) {
    assert.ok(point._prov);
    assert.equal(point._prov.canonical_key, 'goShopPresent');
  }
  const d1Point = result.deal_points.find((p) => p.deal_id === 'd1');
  assert.equal(d1Point._prov.matched_key, 'go_shop_present');
});

test('empty cells never get a _prov stub', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1'],
    columns: ['no_shop_type'], // not present on p1-nosol's feature bag
    sort_by: 'deal_signing_date_desc',
  }, { context });
  const cell = result.rows[0].cells[0];
  assert.equal(cell.value, null);
  assert.equal(cell._prov, undefined);
});

test('_prov.card_id is a transient join key, never sent to the client', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1', 'd2'],
    columns: ['go_shop'],
    sort_by: 'deal_signing_date_desc',
  }, { context });
  // Before enrichment the executor-attached stub carries card_id.
  assert.ok(result.rows.some((row) => row.cells.some((cell) => cell._prov && cell._prov.card_id)));
  await attachExtractionVersions(result, { provisions, sb: null });
  for (const row of result.rows) {
    for (const cell of row.cells) {
      if (!cell._prov) continue;
      assert.equal(cell._prov.card_id, undefined, 'card_id must be stripped after enrichment');
      assert.ok('extraction_version' in cell._prov);
      assert.ok('extraction_run_id' in cell._prov);
    }
  }
});

test('attachExtractionVersions resolves extraction_version via content-hash join against provision_cards', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1'],
    columns: ['go_shop'],
    sort_by: 'deal_signing_date_desc',
  }, { context });

  const { spanHash } = require('../../lib/schema/provision-card');
  const regionHash = spanHash(provisions[0].full_text);
  let queried = 0;
  const fakeSb = {
    from(table) {
      assert.equal(table, 'provision_cards');
      return {
        select(cols) {
          assert.match(cols, /deal_id/);
          return {
            in(col, ids) {
              queried += 1;
              assert.equal(col, 'deal_id');
              assert.deepEqual(ids, ['d1']);
              return Promise.resolve({
                data: [{ deal_id: 'd1', region_hash: regionHash, provenance: { extractor_version: 'm2-00-store-cards-v1', run_id: 'run-xyz' } }],
                error: null,
              });
            },
          };
        },
      };
    },
  };
  await attachExtractionVersions(result, { provisions, sb: fakeSb });
  assert.equal(queried, 1, 'exactly one batched query, never per-cell');
  const cell = result.rows[0].cells[0];
  assert.equal(cell._prov.extraction_version, 'm2-00-store-cards-v1');
  assert.equal(cell._prov.extraction_run_id, 'run-xyz');
});

test('collectProvCardIds is a no-op walk when nothing carries _prov', () => {
  assert.equal(collectProvCardIds({ a: [1, 2, { b: 'c' }] }).size, 0);
});

// ---- Backward compatibility -------------------------------------------

test('DEAL_COMPARE result shape is unchanged for callers that ignore _prov', async () => {
  const result = await runQuery('DEAL_COMPARE', {
    deal_ids: ['d1', 'd2'],
    provision_types: ['COVENANT_NO_SOLICITATION'],
    highlight_deltas: true,
    included_field_groups: ['primary', 'qualifiers'],
  }, { context });
  assert.equal(result.columns.length, 2);
  assert.equal(result.rows.length, 1);
  const cell = result.rows[0].cells[0];
  // The pre-WP-3 fields are all still exactly where they were.
  assert.ok('deal_id' in cell);
  assert.ok('card_id' in cell);
  assert.ok('primary_quote' in cell);
  assert.ok('key_fields' in cell);
  assert.ok('delta_severity' in cell);
  assert.ok('delta_versus' in cell);
});

test('CSV export never includes _prov, with or without it present on the result', async () => {
  const result = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1', 'd2'],
    columns: ['go_shop'],
    sort_by: 'deal_signing_date_desc',
  }, { context });
  assert.ok(result.rows.some((row) => row.cells.some((cell) => cell._prov)));

  const rows = resultToCsvRows(result);
  const csv = toCsv(rows);
  assert.ok(!csv.includes('_prov'), 'CSV text must never contain the _prov key');
  assert.ok(!csv.includes('canonical_key'));
  assert.ok(!csv.includes('registry_version'));

  // Sanity: the CSV still round-trips exactly the value columns it did
  // before _prov existed (rows sorted deal_signing_date_desc, so d2 — whose
  // go_shop is false — comes first).
  assert.equal(rows[0][0], 'Deal');
  assert.equal(rows[1][2], 'No');
});

test('CSV export is byte-identical whether or not _prov is present on the cells', async () => {
  const withProv = await runQuery('PROVISION_CROSS_CUT', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_ids: ['d1', 'd2'],
    columns: ['go_shop'],
    sort_by: 'deal_signing_date_desc',
  }, { context });
  const stripped = JSON.parse(JSON.stringify(withProv));
  for (const row of stripped.rows) {
    for (const cell of row.cells) delete cell._prov;
  }
  assert.equal(toCsv(resultToCsvRows(withProv)), toCsv(resultToCsvRows(stripped)));
});
