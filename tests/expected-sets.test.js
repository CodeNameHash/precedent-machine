/* Tests for lib/expected-sets.js — corpus-derived expected-set systematization. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeExpectedSets, analyzeDealCoverage, analyzeCorpusTaxonomy, familyType, isCanonicalCode,
} = require('../lib/expected-sets');

const prov = (deal_id, type, code, category) => ({
  deal_id, type, category: category || code,
  ai_metadata: { features: { canonicalCode: code } },
});

test('familyType collapses party-suffixed types', () => {
  assert.equal(familyType('IOC-T'), 'IOC');
  assert.equal(familyType('TERMR-B'), 'TERMR');
  assert.equal(familyType('COND-B'), 'COND-B'); // COND keeps its own codes
});

test('isCanonicalCode rejects proposed/unknown, accepts real rubric codes', () => {
  assert.equal(isCanonicalCode('REP-T-ORG'), true);
  assert.equal(isCanonicalCode('[PROPOSED] Foo'), false);
  assert.equal(isCanonicalCode('NOT-A-REAL-CODE'), false);
  assert.equal(isCanonicalCode(null), false);
});

test('computeExpectedSets derives importance from corpus frequency + curation', () => {
  // 3 deals; TERMR-OUTSIDE in all 3, TERMR-EXTENSION in 1.
  const provs = [
    prov('d1', 'TERMR', 'TERMR-OUTSIDE'), prov('d2', 'TERMR', 'TERMR-OUTSIDE'), prov('d3', 'TERMR', 'TERMR-OUTSIDE'),
    prov('d1', 'TERMR', 'TERMR-EXTENSION'),
  ];
  const reg = computeExpectedSets(provs);
  const outside = reg.TERMR.find((x) => x.code === 'TERMR-OUTSIDE');
  const ext = reg.TERMR.find((x) => x.code === 'TERMR-EXTENSION');
  assert.equal(outside.importance, 'core');   // 100% + curated
  assert.equal(outside.dealFraction, 1);
  assert.equal(ext.importance, 'common');      // 1/3 deals = 0.33 ≥ COMMON_THRESHOLD
  assert.ok(ext.dealFraction < 0.5);
});

test('analyzeDealCoverage reports present, missing-core, and extra', () => {
  const provs = [
    prov('d1', 'TERMR', 'TERMR-OUTSIDE'), prov('d2', 'TERMR', 'TERMR-OUTSIDE'), prov('d3', 'TERMR', 'TERMR-OUTSIDE'),
    prov('d1', 'TERMR', 'TERMR-MUTUAL'), prov('d2', 'TERMR', 'TERMR-MUTUAL'), prov('d3', 'TERMR', 'TERMR-MUTUAL'),
  ];
  const reg = computeExpectedSets(provs);
  // A deal that has OUTSIDE but not MUTUAL (both curated-core).
  const deal = [prov('dX', 'TERMR', 'TERMR-OUTSIDE'), prov('dX', 'TERMR-T', null, '[PROPOSED] Novel Right')];
  const cov = analyzeDealCoverage(deal, reg);
  const termr = cov.byType.TERMR;
  assert.ok(termr.present.some((x) => x.code === 'TERMR-OUTSIDE'));
  assert.ok(termr.missing.some((x) => x.code === 'TERMR-MUTUAL')); // core, absent
  assert.equal(cov.extra.length, 1);
  assert.equal(cov.extra[0].proposed, true);
});

test('analyzeCorpusTaxonomy surfaces promotion candidates from non-canonical categories', () => {
  const provs = [
    prov('d1', 'TERMR', null, 'General / Preamble'),
    prov('d2', 'TERMR', null, 'General / Preamble'),
    prov('d3', 'COND-B', null, '[PROPOSED] No Termination'),
  ];
  const { promotionCandidates } = analyzeCorpusTaxonomy(provs);
  const top = promotionCandidates[0];
  assert.equal(top.category, 'General / Preamble');
  assert.equal(top.count, 2);
});
