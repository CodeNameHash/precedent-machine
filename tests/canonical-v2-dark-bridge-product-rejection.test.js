'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DARK_AUTHORITY_STATE,
  UNAUTHENTICATED_SOURCE_STATE,
  DarkAuthorityNotServableError,
  assertNoDarkAuthorityRecords,
  assertRowIsServable,
  hasDarkAuthority,
  rowHasDarkAuthority,
} = require('../lib/query/dark-authority-fence');
const { executeQuery, runQuery } = require('../lib/query/engine');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { MarketStatsError } = require('../lib/row-market-stats/errors');

// lib/market-metrics/adapter.js and lib/market-metrics/section-rows.js are ES
// modules — load them the same way tests/canonical-v2-legacy-card-bridge.test.js
// does, so this file has no dependency on any CommonJS/ESM bridging change.
function loadEsmModule(relativePath) {
  const swc = require('next/dist/build/swc');
  const transform = ({ source, filename }) => {
    try {
      const result = swc.transformSync(source, {
        filename,
        jsc: {
          parser: { syntax: 'ecmascript', jsx: true, dynamicImport: true },
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'commonjs' },
      });
      return { code: result.code };
    } catch (error) {
      return { code: '', error };
    }
  };
  const jiti = require('jiti')(__filename, {
    interopDefault: true,
    extensions: ['.js', '.jsx', '.json'],
    transform,
    cache: false,
  });
  return jiti(relativePath);
}

const { resolveMarketMetricRow } = loadEsmModule('../lib/market-metrics/adapter.js');
const { enumerateMarketSectionRows } = loadEsmModule('../lib/market-metrics/section-rows.js');

// The fence's own error class is the single source of truth for its code —
// derive it rather than duplicating the literal string.
const DARK_CODE = new DarkAuthorityNotServableError().code;

// dark-authority-fence.js, lib/query/engine.js, lib/query/executors/deal-compare.js
// and lib/row-market-stats/{service,errors}.js are all plain CommonJS,
// required directly (no jiti) — `instanceof` is meaningful for these.
function isDarkError(error) {
  return error instanceof DarkAuthorityNotServableError && error.code === DARK_CODE;
}

function isMarketStatsDarkError(error) {
  return error instanceof MarketStatsError && error.code === DARK_CODE;
}

// lib/market-metrics/adapter.js is loaded through the jiti ESM shim above, so
// an error it throws is not guaranteed to share class identity with the
// DarkAuthorityNotServableError required directly in this file. Check the
// `.code` contract only — the same way the legacy-card-bridge test's
// bridgeError()-style checks stay code-only for anything crossing that
// boundary.
function hasDarkErrorCode(error) {
  return Boolean(error) && error.code === DARK_CODE;
}

// Runs fn and fails with a clear, located message (plus the real underlying
// error text) if it throws — used everywhere a record is expected to be
// SERVABLE, so an over-broad fence shows up as a readable failure rather
// than an opaque assert.doesNotThrow diff.
function assertServable(fn, description) {
  try {
    return fn();
  } catch (error) {
    assert.fail(`${description} incorrectly rejected a servable record: ${error && error.message}`);
  }
  return undefined;
}

async function assertServableAsync(fn, description) {
  try {
    return await fn();
  } catch (error) {
    assert.fail(`${description} incorrectly rejected a servable record: ${error && error.message}`);
  }
  return undefined;
}

// The four markers hasDarkAuthority() checks independently — a record is
// dark if ANY ONE of these is set, top-level or nested under `provenance`.
const DARK_MARKERS = [
  {
    name: 'authority_state === VALIDATED_NOT_SERVED',
    stamp: (record) => ({ ...record, authority_state: DARK_AUTHORITY_STATE }),
  },
  {
    name: 'provenance.canonical_v2_authority_state === VALIDATED_NOT_SERVED',
    stamp: (record) => ({
      ...record,
      provenance: { ...(record.provenance || {}), canonical_v2_authority_state: DARK_AUTHORITY_STATE },
    }),
  },
  {
    name: 'source_authentication_state === SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
    stamp: (record) => ({ ...record, source_authentication_state: UNAUTHENTICATED_SOURCE_STATE }),
  },
  {
    name: 'provenance.source_authentication_state === SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY',
    stamp: (record) => ({
      ...record,
      provenance: { ...(record.provenance || {}), source_authentication_state: UNAUTHENTICATED_SOURCE_STATE },
    }),
  },
];

function darkRecord(marker, seed = {}) {
  return marker.stamp({ id: 'dark-source-record', ...seed });
}

// A deliberately minimal, marker-free record used to prove the fences admit
// ordinary data. marketState: 'OPEN_NATIVE_FIELD' routes resolveMarketMetricRow
// through its simplest, self-contained resolution branch (builds one
// nonComparableMetric() inline) so this stays scoped to the dark-authority
// fence rather than the unrelated declared/semantic/manifest/registry
// metric-resolution fallback chain.
const CLEAN_RECORD = Object.freeze({
  id: 'clean-source-record',
  label: 'Clean record',
  marketState: 'OPEN_NATIVE_FIELD',
});

// ---------------------------------------------------------------------------
// 1-5: every hard fence rejects each of the four dark markers independently.
// ---------------------------------------------------------------------------
for (const marker of DARK_MARKERS) {
  test(`hard fences reject dark marker: ${marker.name}`, async () => {
    const record = darkRecord(marker);
    const context = { provisions: [record], deals: [] };

    assert.throws(
      () => assertNoDarkAuthorityRecords([record]),
      isDarkError,
      'assertNoDarkAuthorityRecords must reject this marker',
    );

    assert.throws(
      () => executeQuery('DEAL_COMPARE', {}, context),
      isDarkError,
      'executeQuery (query engine) must reject a context carrying this marker',
    );

    await assert.rejects(
      () => runQuery('DEAL_COMPARE', {}, { context }),
      isDarkError,
      'runQuery (query engine) must reject a context carrying this marker',
    );

    assert.throws(
      () => executeDealCompare({}, { provisions: [record] }),
      isDarkError,
      'executeDealCompare must reject this marker',
    );

    assert.throws(
      () => calculateMarketStats({ specs: [] }, { cards: [record], claims: [] }),
      isMarketStatsDarkError,
      'calculateMarketStats must reject this marker carried in cards[]',
    );

    assert.throws(
      () => calculateMarketStats({ specs: [] }, { cards: [], claims: [record] }),
      isMarketStatsDarkError,
      'calculateMarketStats must reject this marker carried in claims[]',
    );

    assert.throws(
      () => resolveMarketMetricRow(record, {}),
      hasDarkErrorCode,
      'resolveMarketMetricRow must reject this marker as a source row',
    );
  });
}

// ---------------------------------------------------------------------------
// 6: the soft filter drops marketSkip / DARK_REVIEW_ONLY rows, keeps others.
// ---------------------------------------------------------------------------
test('enumerateMarketSectionRows drops marketSkip and DARK_REVIEW_ONLY rows but keeps ordinary rows', () => {
  const rows = [
    { id: 'row-skip', marketSkip: true, label: 'Skipped row' },
    { id: 'row-dark-review', marketState: 'DARK_REVIEW_ONLY', label: 'Dark-review-only row' },
    { id: 'row-ordinary-1', label: 'Ordinary row 1' },
    { id: 'row-ordinary-2', label: 'Ordinary row 2' },
  ];
  // A section id that hits none of section-rows.js's special-cased branches
  // (definitions/nosol/conditions/ioc-exceptions) falls through to calling
  // section.config.selectRows(reviewDeal) directly, which decouples this
  // test from every real table-config module.
  const section = {
    id: 'synthetic-dark-bridge-test-section',
    config: { selectRows: () => rows },
  };

  const survivingIds = enumerateMarketSectionRows(section, {}).map(({ row }) => row.id);

  assert.deepEqual(survivingIds, ['row-ordinary-1', 'row-ordinary-2']);
});

// ---------------------------------------------------------------------------
// 7: negative control — a clean record must pass every hard fence.
// ---------------------------------------------------------------------------
test('negative control: a clean, non-dark record passes every hard fence without throwing', async () => {
  const context = {
    deals: [{ id: 'deal-a' }, { id: 'deal-b' }],
    provisions: [CLEAN_RECORD],
  };
  const payload = { deal_ids: ['deal-a', 'deal-b'], provision_types: [] };

  assertServable(() => assertNoDarkAuthorityRecords([CLEAN_RECORD]), 'assertNoDarkAuthorityRecords');
  assertServable(() => executeQuery('DEAL_COMPARE', payload, context), 'executeQuery (query engine)');
  await assertServableAsync(() => runQuery('DEAL_COMPARE', payload, { context }), 'runQuery (query engine)');
  assertServable(() => executeDealCompare(payload, context), 'executeDealCompare');
  assertServable(
    () => calculateMarketStats({ specs: [] }, { cards: [CLEAN_RECORD], claims: [] }),
    'calculateMarketStats (clean record in cards[])',
  );
  assertServable(
    () => calculateMarketStats({ specs: [] }, { cards: [], claims: [CLEAN_RECORD] }),
    'calculateMarketStats (clean record in claims[])',
  );
  assertServable(() => resolveMarketMetricRow(CLEAN_RECORD, {}), 'resolveMarketMetricRow');
});

// ---------------------------------------------------------------------------
// 8: depth — a dark record buried in a larger batch still poisons it, and a
// dark record nested inside a row's source card is still caught.
// ---------------------------------------------------------------------------
test('depth: a buried or nested dark record is still caught, not silently skipped', () => {
  const marker = DARK_MARKERS[0];
  const buried = darkRecord(marker, { id: 'buried-in-the-middle' });
  const batch = [{ id: 'clean-1' }, { id: 'clean-2' }, buried, { id: 'clean-3' }];

  assert.throws(
    () => assertNoDarkAuthorityRecords(batch),
    isDarkError,
    'a dark record buried mid-array must still be caught by assertNoDarkAuthorityRecords',
  );

  assert.throws(
    () => executeDealCompare({}, { provisions: batch }),
    isDarkError,
    'a dark record buried mid-array must still be caught by executeDealCompare',
  );

  assert.throws(
    () => calculateMarketStats({ specs: [] }, { cards: batch, claims: [] }),
    isMarketStatsDarkError,
    'a dark record buried mid-array must still be caught by calculateMarketStats',
  );

  // Depth via nesting, not array position: the row itself carries no marker,
  // but the source card it wraps does. sourceValuesForRow() must still reach
  // into row.sourceCard rather than only checking the row's own fields.
  const nestedDarkRow = { id: 'row-with-dark-source', sourceCard: darkRecord(marker, { id: 'nested-source' }) };
  assert.throws(
    () => resolveMarketMetricRow(nestedDarkRow, {}),
    hasDarkErrorCode,
    'a dark record nested under row.sourceCard must still be caught by resolveMarketMetricRow',
  );
});

// ---------------------------------------------------------------------------
// 9: the fence must not crash on null/undefined/non-object entries.
// ---------------------------------------------------------------------------
test('defensive: null, undefined and non-object entries do not crash the fence', () => {
  const junkValues = [null, undefined, 'not-a-record', 42, true, [], {}];

  for (const junk of junkValues) {
    assert.equal(
      hasDarkAuthority(junk),
      false,
      `hasDarkAuthority must not throw or misclassify junk value: ${String(junk)}`,
    );
  }

  // A batch of pure junk with no dark record present must pass silently.
  assertServable(() => assertNoDarkAuthorityRecords(junkValues), 'assertNoDarkAuthorityRecords (pure junk batch)');

  // A dark record buried among junk must still be caught.
  const marker = DARK_MARKERS[0];
  const withDark = [...junkValues, darkRecord(marker, { id: 'in-the-junk-drawer' })];
  assert.throws(
    () => assertNoDarkAuthorityRecords(withDark),
    isDarkError,
    'a dark record hidden among null/undefined/non-object junk must still be caught',
  );

  // calculateMarketStats' own pre-check performs the identical
  // [...cards, ...claims].some(hasDarkAuthority) test. Non-nullish junk
  // (strings/numbers/booleans/arrays/empty objects) must not trip it.
  // NOTE: raw null/undefined *entries inside dataset.cards* are deliberately
  // not exercised here — they hit an unrelated, pre-existing crash further
  // down calculateMarketStats, in indexDataset() (lib/row-market-stats/
  // observations.js: `card.deal_id` is read without optional chaining),
  // AFTER the dark-authority pre-check has already passed cleanly. That is a
  // null-safety gap in unrelated aggregation code, not a dark-authority
  // rejection failure — reported separately, not asserted here.
  const nonNullishJunk = ['not-a-record', 42, true, [], {}];
  assertServable(
    () => calculateMarketStats({ specs: [] }, { cards: nonNullishJunk, claims: [] }),
    'calculateMarketStats (non-nullish junk batch)',
  );
  assert.throws(
    () => calculateMarketStats(
      { specs: [] },
      { cards: [...nonNullishJunk, darkRecord(marker, { id: 'stats-junk-drawer' })], claims: [] },
    ),
    isMarketStatsDarkError,
    'a dark record hidden among non-nullish junk must still be caught by calculateMarketStats',
  );

  // rowHasDarkAuthority / assertRowIsServable must tolerate a null/undefined
  // row itself, and a row whose nested source fields are junk.
  assert.equal(rowHasDarkAuthority(null), false);
  assert.equal(rowHasDarkAuthority(undefined), false);
  assertServable(() => assertRowIsServable(null), 'assertRowIsServable(null)');
  assertServable(() => assertRowIsServable(undefined), 'assertRowIsServable(undefined)');

  const junkNestedRow = {
    id: 'row-defensive',
    card: null,
    sourceCard: undefined,
    source: 'not-an-object',
    sourceCards: [null, undefined, 'junk'],
    cards: [null, undefined, 42],
  };
  assert.equal(rowHasDarkAuthority(junkNestedRow), false);
  assertServable(
    () => resolveMarketMetricRow({ ...junkNestedRow, label: 'Defensive row', marketState: 'OPEN_NATIVE_FIELD' }, {}),
    'resolveMarketMetricRow (row with junk-only nested source fields)',
  );
});
