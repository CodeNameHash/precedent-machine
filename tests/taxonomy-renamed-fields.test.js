/* taxonomyForFeatureKey() keyed off pre-Phase-0-C field names for several
   fields renamed during the Phase 0-C reconciliation
   (docs/schema-shape/reconciliation-log.jsonl), so the current field_key
   resolved to no taxonomy dictionary at all even though the field is
   genuinely closed-vocab. Verified via the normalizer-lift investigation
   (canonical-promotion dry-run): regulatoryCooperationScope (69 rows) and
   divestitureCapDescription (55 rows) only recovered a taxonomy match via a
   fallback to the pre-rename ai_metadata.feature_key. This test locks in the
   direct (current-key) resolution so that fallback isn't load-bearing.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const taxonomy = require('../lib/taxonomy.js');

test('regulatoryCooperationScope (renamed from consultationTier) resolves to CONSULTATION_TIER', () => {
  const dict = taxonomy.taxonomyForFeatureKey('regulatoryCooperationScope');
  assert.equal(dict, taxonomy.CONSULTATION_TIER);
  assert.ok(taxonomy.isValidTaxonomyCode('NOTICE_CONSULT', dict));
  assert.ok(taxonomy.isValidTaxonomyCode('PARTICIPATE', dict));
  assert.ok(taxonomy.isValidTaxonomyCode('CONSENT_NOT_UNREASONABLE', dict));
});

test('divestitureCapDescription (renamed from burdenCommitment) resolves to BURDEN_COMMITMENT', () => {
  const dict = taxonomy.taxonomyForFeatureKey('divestitureCapDescription');
  assert.equal(dict, taxonomy.BURDEN_COMMITMENT);
  assert.ok(taxonomy.isValidTaxonomyCode('BURDENSOME_CONDITION', dict));
  assert.ok(taxonomy.isValidTaxonomyCode('NO_LITIGATION_ONLY', dict));
});

test('timingAgreementsProhibited (renamed from timingAgreement) resolves to TIMING_AGREEMENT', () => {
  const dict = taxonomy.taxonomyForFeatureKey('timingAgreementsProhibited');
  assert.equal(dict, taxonomy.TIMING_AGREEMENT);
  assert.ok(taxonomy.isValidTaxonomyCode('BARRED_MUTUAL_CONSENT', dict));
});

test('the pre-rename keys still resolve, for old triples whose provenance carries the old feature_key', () => {
  assert.equal(taxonomy.taxonomyForFeatureKey('consultationTier'), taxonomy.CONSULTATION_TIER);
  assert.equal(taxonomy.taxonomyForFeatureKey('burdenCommitment'), taxonomy.BURDEN_COMMITMENT);
  assert.equal(taxonomy.taxonomyForFeatureKey('timingAgreement'), taxonomy.TIMING_AGREEMENT);
});

test('regulatoryStrategyControlTagged (renamed from regulatoryStrategyControl) already resolves to ANTITRUST_CONTROL', () => {
  const dict = taxonomy.taxonomyForFeatureKey('regulatoryStrategyControlTagged');
  assert.equal(dict, taxonomy.ANTITRUST_CONTROL);
});

test('unknown feature keys still return null (no accidental catch-all)', () => {
  assert.equal(taxonomy.taxonomyForFeatureKey('someTotallyUnknownField'), null);
});
