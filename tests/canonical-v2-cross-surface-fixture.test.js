const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');

test('the real reviewed preview fixture binds the same complete market row to all four surfaces', () => {
  const fixture = buildLandosReviewedServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);
  const metric = adapted.data.byRow[adapted.row_key].metrics.REPRESENTATION_ACCURACY_STANDARD;

  assert.deepEqual(SURFACES, ['REVIEW', 'CORPUS_CONTEXT', 'COMPARE', 'QUERY']);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].row_key, adapted.row_key);
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(metric.subject.status, 'present');
  assert.equal(metric.subject.value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(metric.subject.label, 'True in all respects, except de minimis inaccuracies');
  assert.deepEqual(metric.subject.legalTerms.map((term) => [term.label, term.value]), [
    ['Accuracy standard', 'True in all respects, except de minimis inaccuracies'],
    ['Exception', 'De minimis inaccuracies'],
    ['Tested when', 'Signing and closing; specified earlier date where applicable'],
  ]);
  assert.deepEqual(metric.distribution.values.map((item) => [item.value, item.count]), [
    ['MAT_ALL_RESPECTS_DE_MINIMIS', 1],
  ]);
  assert.equal(metric.distribution.denominatorCount, 1);
  assert.equal(metric.exclusions.length, 0);
  assert.equal(fixture.row.source_actions.length, 1);
  assert.equal(
    fixture.exactDetail.detail_payloads[0].response_body.excerpt.exact_text,
    'true and correct except for de minimis inaccuracies',
  );
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('the canonical design fixture is production-gated and performs no runtime data request', () => {
  const page = fs.readFileSync('pages/design/canonical-v2.js', 'utf8');

  assert.match(page, /designPreviewServerSideProps/);
  assert.match(page, /MarketMetricCell/);
  assert.match(page, /MarketDrilldownSidebar/);
  assert.match(page, /buildLandosReviewedServingFixture/);
  assert.match(page, /buildLandosIocCapexServingFixture/);
  assert.match(page, /buildLandosNoShopServingFixture/);
  assert.match(page, /No-shop \/ non-solicit terms/);
  assert.match(page, /Interim operating covenant, capital expenditures/);
  assert.match(page, /Row isolation proof/);
  assert.match(page, /This provision could not be mapped safely/);
  assert.match(page, /adaptSharedServingRows/);
  assert.match(page, /Exact source evidence/);
  assert.match(page, /CanonicalV2DesignFixture\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.doesNotMatch(page, /\/api\//);
});

test('the real IOC capex fixture exposes source-backed relative value through all four surfaces', () => {
  const fixture = buildLandosIocCapexServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);
  const metric = adapted.data.byRow[adapted.row_key].metrics.IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.rawAmount, '$100,000');
  assert.equal(metric.subject.percentOfDealValue, 0.07272727);
  assert.equal(metric.subject.denominator.value, '137500000');
  assert.match(metric.subject.legalTerms.find((term) => term.key === 'exceptions').value, /Parent written consent/);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].row_key, adapted.row_key);
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(fixture.row.source_actions.length, 1);
  assert.equal(fixture.row.canonical_result.source_detail_state.state, 'AVAILABLE');
  assert.equal(fixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text, '$100,000');
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('the real no-shop fixture exposes every result through the same four surface bindings', () => {
  const fixture = buildLandosNoShopServingFixture();
  const adaptedRows = fixture.rows.map(adaptSharedServingRow);
  assert.equal(adaptedRows.length, 8);
  for (const adapted of adaptedRows) {
    for (const surface of SURFACES) {
      assert.equal(adapted.surface_bindings[surface].row_key, adapted.row_key);
      assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
    }
  }
  assert.equal(fixture.detailPackages.length, 8);
  fixture.rows.forEach((row) => {
    assert.equal(row.source_actions.length, 1);
    assert.equal(row.canonical_result.source_detail_state.state, 'AVAILABLE');
  });
  assert.equal(adaptedRows.filter(
    (row) => row.resolution.metrics[0].metricKey === 'NO_SHOP_PROHIBITED_ACTION',
  ).length, 5);
  assert.doesNotMatch(JSON.stringify(adaptedRows), /No market data/);
});
