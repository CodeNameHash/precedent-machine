const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildCompleteServingFixture } = require('../__fixtures__/canonical-v2/shared-serving-row');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');

test('the preview fixture binds the same complete market row to all four surfaces', () => {
  const adapted = adaptSharedServingRow(buildCompleteServingFixture().row);
  const metric = adapted.data.byRow[adapted.row_key].metrics.REPRESENTATION_ACCURACY_STANDARD;

  assert.deepEqual(SURFACES, ['REVIEW', 'CORPUS_CONTEXT', 'COMPARE', 'QUERY']);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].row_key, adapted.row_key);
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(metric.subject.status, 'present');
  assert.equal(metric.subject.value, 'MAT_ALL_MATERIAL');
  assert.equal(metric.subject.label, 'True in all material respects');
  assert.deepEqual(metric.distribution.values.map((item) => [item.value, item.count]), [
    ['MAT_ALL_MATERIAL', 20],
    ['MAT_MAE_QUALIFIED', 17],
  ]);
  assert.equal(metric.distribution.denominatorCount, 37);
  assert.equal(metric.exclusions[0].dealCount, 2);
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('the canonical design fixture is production-gated and performs no runtime data request', () => {
  const page = fs.readFileSync('pages/design/canonical-v2.js', 'utf8');

  assert.match(page, /designPreviewServerSideProps/);
  assert.match(page, /MarketMetricCell/);
  assert.match(page, /MarketDrilldownSidebar/);
  assert.match(page, /CanonicalV2DesignFixture\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.doesNotMatch(page, /\/api\//);
});
