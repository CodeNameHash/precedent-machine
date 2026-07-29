const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  emptyFieldRowsForProvision,
  isEmptyFeatureValue,
  summarizeSchemaCoverage,
} = require('../lib/schema/coverage');

test('schema coverage treats false as populated but nullish/list empties as empty', () => {
  assert.equal(isEmptyFeatureValue(false), false);
  assert.equal(isEmptyFeatureValue(0), false);
  assert.equal(isEmptyFeatureValue(''), true);
  assert.equal(isEmptyFeatureValue([]), true);
  assert.equal(isEmptyFeatureValue({ value: '', quotes: [] }), true);
  assert.equal(isEmptyFeatureValue({ value: false, quotes: [] }), false);
  assert.equal(isEmptyFeatureValue({ text: 'verbatim evidence' }), false);
});

test('emptyFieldRowsForProvision honours provision type/code and whenEmpty state', () => {
  const features = [
    { key: 'riskField', label: 'Risk field', provisionTypes: ['MISC'], provisionCodes: ['MISC-ENTIRE'], whenEmpty: 'needs_review' },
    { key: 'otherRisk', label: 'Other risk', provisionTypes: ['MISC'], provisionCodes: ['MISC-NOTICES'], whenEmpty: 'needs_review' },
    { key: 'silentField', label: 'Silent field', provisionTypes: ['MISC'], provisionCodes: [], whenEmpty: 'silent' },
  ];
  const provision = {
    id: 'prov-1',
    deal_id: 'deal-1',
    type: 'MISC',
    category: 'Entire Agreement',
    ai_metadata: {
      code: 'MISC-ENTIRE',
      features: { silentField: 'present' },
    },
  };

  const rows = emptyFieldRowsForProvision(provision, { features, states: ['needs_review'] });
  assert.deepEqual(rows.map((row) => row.feature_key), ['riskField']);
  assert.equal(rows[0].state, 'needs_review');
  assert.equal(rows[0].code, 'MISC-ENTIRE');
});

test('summarizeSchemaCoverage returns per-feature empty-state counts', () => {
  const features = [
    { key: 'riskField', label: 'Risk field', provisionTypes: ['MISC'], provisionCodes: [], whenEmpty: 'needs_review' },
    { key: 'silentField', label: 'Silent field', provisionTypes: ['MISC'], provisionCodes: [], whenEmpty: 'silent' },
  ];
  const provisions = [
    { id: 'p1', type: 'MISC', ai_metadata: { features: { riskField: 'captured' } } },
    { id: 'p2', type: 'MISC', ai_metadata: { features: { silentField: 'captured' } } },
  ];

  const summary = summarizeSchemaCoverage(provisions, { features });
  const risk = summary.features.find((row) => row.feature_key === 'riskField');
  const silent = summary.features.find((row) => row.feature_key === 'silentField');

  assert.equal(summary.totals.provisions, 2);
  assert.equal(summary.totals.feature_opportunities, 4);
  assert.equal(risk.populated, 1);
  assert.equal(risk.needs_review, 1);
  assert.equal(silent.populated, 1);
  assert.equal(silent.silent, 1);
});

test('P7 schema coverage route is contained while needs-review and render chips remain wired', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'schema-coverage.js'), 'utf8');
  const needsReview = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id]', 'needs-review.js'), 'utf8');
  const shared = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
  const review = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');

  assert.match(api, /createBroadCorpusContainedHandler\('GET'\)/);
  assert.doesNotMatch(api, /supabase|summarizeSchemaCoverage|\.range\(/i);
  assert.match(needsReview, /emptyFieldRowsForProvision/);
  assert.match(needsReview, /filterProvisionsForViewMode/);
  assert.match(needsReview, /states: \['needs_review'\]/);
  assert.match(needsReview, /mode=edit&edit=/);
  assert.match(shared, /function schemaEmptyState/);
  assert.match(shared, /export function EmptyFeatureState/);
  assert.match(shared, /schemaRenderFeatureValue\(featureKey, value\)/);
  assert.match(review, /<EmptyFeatureState state=\{emptyState\}/);
  assert.match(review, /\/review-v1\/\$\{dealId\}\/needs-review/);
});
