const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
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
    ['Capitalization, Section 3.3(a)', 'No knowledge qualifier'],
    ['Capitalization, Section 3.3(c), first sentence', 'No knowledge qualifier'],
  ]);
  assert.deepEqual(metric.distribution.values.map((item) => [item.value, item.count]), [
    ['MAT_ALL_RESPECTS_DE_MINIMIS', 1],
  ]);
  assert.equal(metric.distribution.denominatorCount, 1);
  assert.equal(metric.exclusions.length, 0);
  assert.equal(fixture.row.source_actions.length, 1);
  assert.ok(fixture.exactDetail.detail_payloads[0].response_body.excerpts.some((excerpt) => (
    excerpt.exact_text === 'true and correct except for de minimis inaccuracies'
  )));
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('the canonical design fixture is production-gated and performs no runtime data request', () => {
  const page = fs.readFileSync('pages/design/canonical-v2.js', 'utf8');

  assert.match(page, /designPreviewServerSideProps/);
  assert.match(page, /MarketMetricCell/);
  assert.match(page, /MarketDrilldownSidebar/);
  assert.match(page, /buildLandosReviewedServingFixture/);
  assert.match(page, /buildLandosIocCapexServingFixture/);
  assert.match(page, /buildLandosMaterialContractsServingFixture/);
  assert.match(page, /buildLandosNoShopServingFixture/);
  assert.match(page, /buildLandosTerminationFeeServingFixture/);
  assert.match(page, /No-shop \/ non-solicit terms/);
  assert.match(page, /Interim operating covenant, capital expenditures/);
  assert.match(page, /Material Contracts cash-flow threshold/);
  assert.match(page, /Seller termination fee and triggers/);
  assert.match(page, /Canonical query result/);
  assert.match(page, /Termination fees market check/);
  assert.match(page, /Refine by/);
  assert.match(page, /buildCanonicalQueryResultView/);
  assert.match(page, /NoShopCrossViewPreview/);
  assert.match(page, /qxo-no-shop-cross-view-f26\.json/);
  assert.match(page, /Row isolation proof/);
  assert.match(page, /This provision could not be mapped safely/);
  assert.match(page, /adaptSharedServingRows/);
  assert.match(page, /Exact source evidence/);
  assert.match(page, /CanonicalV2DesignFixture\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.doesNotMatch(page, /\/api\//);
});

test('the F26 preview is compact, inactive and uses one bounded provision layout', () => {
  const preview = require('../__fixtures__/canonical-v2/qxo-no-shop-cross-view-f26.json');
  const component = fs.readFileSync(
    'components/review-v2/NoShopCrossViewPreview.jsx',
    'utf8',
  );
  const route = fs.readFileSync(
    'pages/design/canonical-v2-no-shop-f26.js',
    'utf8',
  );

  assert.equal(preview.release_state, 'INACTIVE_CANDIDATE');
  assert.equal(preview.provision_row.subrows.length, 9);
  assert.deepEqual(preview.surfaces, ['COMPARE', 'CORPUS_CONTEXT', 'QUERY', 'REVIEW']);
  assert.equal(preview.serving_plan.database_calls_per_request, 1);
  assert.equal(preview.serving_plan.immediate_retries, 0);
  assert.equal(
    fs.statSync('__fixtures__/canonical-v2/qxo-no-shop-cross-view-f26.json').size < 100000,
    true,
  );
  assert.match(component, /lg:grid-cols-\[180px_minmax\(0,1fr\)_minmax\(280px,340px\)\]/);
  assert.match(component, /Hide market context/);
  assert.match(component, /aria-label="No-shop provision terms"/);
  assert.match(component, /data-duration-range/);
  assert.match(component, /Selected deal term/);
  assert.match(component, /Comparable terms/);
  assert.match(component, /One-deal certification preview/);
  assert.match(component, /no market percentage or distribution is shown/);
  assert.match(component, /Affected action:/);
  assert.match(component, /Applies to:/);
  assert.match(component, /Relationship:/);
  assert.match(component, /Qualifies .* limb-B prohibited-action outcomes/);
  assert.match(component, /item\.raw_value\?\.text|raw_value\?\.text/);
  assert.match(component, /value === null \|\| value === undefined\) return 'Not applicable';/);
  assert.match(component, /return 'Party not captured';/);
  assert.match(component, /return 'Trigger not captured';/);
  assert.doesNotMatch(component, /No market data/);
  assert.match(route, /designPreviewServerSideProps/);
  assert.match(route, /NoShopCrossViewPreview/);
  assert.match(route, /overflow-x-hidden/);
  assert.match(route, /CanonicalV2NoShopF26\.noLayout = true/);
  assert.doesNotMatch(route, /fetch\s*\(/);
  assert.doesNotMatch(route, /\/api\//);
});

test('the No-Shop governed code formatter distinguishes null from non-null codes', () => {
  const component = fs.readFileSync(
    'components/review-v2/NoShopCrossViewPreview.jsx',
    'utf8',
  );
  const start = component.indexOf('function formatCode(value) {');
  const end = component.indexOf('\n\nfunction formatParty', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const formatCode = Function(`${component.slice(start, end)}\nreturn formatCode;`)();

  assert.equal(formatCode(null), 'Not applicable');
  assert.equal(formatCode(undefined), 'Not applicable');
  assert.equal(formatCode('NO_SHOP_MAE'), 'No shop MAE');
});

test('the real Material Contracts fixture exposes its relative threshold and criterion everywhere', () => {
  const fixture = buildLandosMaterialContractsServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);
  const metric = adapted.data.byRow[adapted.row_key]
    .metrics.MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.rawAmount, '$100,000');
  assert.equal(metric.subject.percentOfDealValue, 0.07272727);
  assert.match(metric.subject.legalTerms.find((term) => term.key === 'criterion').value, /Payments by or to/);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.match(fixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text, /single fiscal year thereafter/);
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('the real seller fee fixture exposes percentage, side and triggers through all four surfaces', () => {
  const fixture = buildLandosTerminationFeeServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);
  const metric = adapted.data.byRow[adapted.row_key]
    .metrics.SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.rawAmount, '$7,000,000');
  assert.equal(metric.subject.percentOfDealValue, 5.09090909);
  assert.equal(metric.subject.legalTerms.find((term) => term.key === 'payer').value, 'Company (target)');
  assert.equal(metric.subject.legalTerms.find((term) => term.key === 'payee').value, 'Parent (buyer)');
  assert.equal(metric.subject.legalTerms.filter((term) => term.key.startsWith('trigger_')).length, 3);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(fixture.detailPackage.detail_payloads[0].response_body.excerpt.exact_text, '$7,000,000');
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
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
