/* Tests for lib/feature-compare.js — the general, dynamic comparison engine,
   plus the thin lib/rep-materiality.js wrapper. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  comparableFeatures, compareFeature, cohortFeatureStats, featureOutliers, codeForFeature, numericValue,
} = require('../lib/feature-compare');
const {
  repMaterialityCode, compareRepMateriality, repMaterialityStats, repMaterialityOutliers, NO_QUALIFIER,
} = require('../lib/rep-materiality');

let _id = 0;
// Build a provision on a given family type with an arbitrary features object.
function prov(deal_id, type, features, full_text) {
  return {
    id: `p${++_id}`,
    deal_id,
    type,
    category: (features && features.canonicalCode) || type,
    full_text: full_text || 'Clause text supporting the extracted feature value.',
    ai_metadata: { code: (features && features.canonicalCode) || null, features: features || {} },
  };
}
const tagged = (code, text) => ({ code, label: 'x', text });
const citable = (value, ...quotes) => ({ value, quotes });

const DEALS = [
  { id: 'd1', target: 'Alpha', sector: 'pharma', value_usd: 5e8, announce_date: '2025-01-10' },
  { id: 'd2', target: 'Beta', sector: 'tech', value_usd: 5e9, announce_date: '2024-06-01' },
  { id: 'd3', target: 'Gamma', sector: 'pharma', value_usd: 2e10, announce_date: '2025-03-15' },
];

// ── comparableFeatures ─────────────────────────────────────────────────────

test('comparableFeatures excludes free-text and includes enum/tagged/boolean/list kinds', () => {
  const cat = comparableFeatures();
  // Drives off real FEATURES — REP-T and ANTI must appear.
  assert.ok(cat['REP-T'] && cat.ANTI && cat.IOC);

  const byKey = (type) => new Map(cat[type].map((f) => [f.key, f]));
  const rep = byKey('REP-T');
  const anti = byKey('ANTI');
  const ioc = byKey('IOC');

  // enum (bringDownStandard), tagged/object coded (materialityQualifier,
  // knowledgeQualifier), list set (permittedExceptions) all present.
  // knowledgeQualifier moved from an LLM-authored article-wide boolean to a
  // deterministically-stamped per-rep TAGGED object (audit fix: the UI's
  // per-rep Knowledge Qualifier cell needs code/label/text/scope, not a bare
  // boolean it could never actually attach to an individual rep row).
  assert.equal(rep.get('bringDownStandard').kind, 'enum');
  assert.ok(Array.isArray(rep.get('bringDownStandard').options));
  assert.equal(rep.get('materialityQualifier').kind, 'coded');
  assert.equal(rep.get('materialityQualifier').coded, true);
  assert.equal(rep.get('knowledgeQualifier').kind, 'coded');
  assert.equal(ioc.get('permittedExceptions').kind, 'set');
  assert.equal(anti.get('effortsStandard').kind, 'enum');

  // Free-text feature is excluded entirely.
  assert.equal(rep.has('mainConcept'), false); // type: 'text'
  // Every surfaced feature has a non-null kind.
  for (const [, feats] of Object.entries(cat)) {
    for (const f of feats) assert.ok(f.kind, `kind for ${f.key}`);
  }
});

// ── compareFeature: enum ───────────────────────────────────────────────────

test('compareFeature buckets an ENUM over the schema options (ordinal), keeps quotes', () => {
  const provs = [
    prov('d1', 'ANTI', { effortsStandard: citable('reasonable-best-efforts', 'use its reasonable best efforts') }),
    prov('d2', 'ANTI', { effortsStandard: citable('reasonable-best-efforts', 'reasonable best efforts') }),
    prov('d3', 'ANTI', { effortsStandard: citable('best-efforts', 'use best efforts') }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'ANTI', featureKey: 'effortsStandard' });
  assert.equal(out.kind, 'enum');
  assert.equal(out.n, 3);
  assert.equal(out.cohortSize, 3);
  // Ordinal order: 'best-efforts' precedes 'reasonable-best-efforts' in options.
  assert.equal(out.distribution[0].value, 'best-efforts');
  const rbe = out.distribution.find((b) => b.value === 'reasonable-best-efforts');
  assert.equal(rbe.count, 2);
  assert.equal(rbe.dealFraction, 0.67);
  assert.ok(rbe.points[0].quotes[0] && rbe.points[0].provision_id);
});

// ── compareFeature: coded (materiality) ────────────────────────────────────

test('compareFeature buckets a TAGGED CODE (materiality) with labels + quotes', () => {
  const provs = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'would not have an MAE') }),
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: citable(tagged('MAT_MAE_QUALIFIED', 'MAE'), 'not have a Material Adverse Effect') }),
    prov('d3', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MATERIAL_TO_COMPANY', 'material to the Company') }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'REP-T', featureKey: 'materialityQualifier', absentCode: NO_QUALIFIER });
  assert.equal(out.kind, 'coded');
  assert.equal(out.n, 3);
  const mae = out.distribution.find((b) => b.value === 'MAT_MAE_QUALIFIED');
  assert.equal(mae.count, 2);
  assert.equal(mae.label, 'True except where failure would not have an MAE');
  assert.equal(out.distribution[0].value, 'MAT_MAE_QUALIFIED'); // modal leads
  for (const b of out.distribution) for (const pt of b.points) assert.ok(pt.quotes[0] && pt.provision_id);
});

test('compareFeature absentCode buckets an unqualified rep as MAT_NO_QUALIFIER via full_text', () => {
  const provs = [prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP' }, 'The Company owns its Intellectual Property free of Liens.')];
  const out = compareFeature(provs, DEALS, { type: 'REP-T', featureKey: 'materialityQualifier', absentCode: NO_QUALIFIER });
  const noq = out.distribution.find((b) => b.value === NO_QUALIFIER);
  assert.ok(noq);
  assert.match(noq.points[0].quotes[0], /Intellectual Property/);
});

// ── compareFeature: boolean ────────────────────────────────────────────────

test('compareFeature computes a BOOLEAN present/absent rate across deals', () => {
  const provs = [
    prov('d1', 'ANTI', { hellOrHighWater: citable(true, 'without limitation, hell or high water') }),
    prov('d2', 'ANTI', { hellOrHighWater: citable(false, 'subject to a divestiture cap') }),
    prov('d3', 'ANTI', { hellOrHighWater: citable(true, 'take any and all actions') }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'ANTI', featureKey: 'hellOrHighWater' });
  assert.equal(out.kind, 'boolean');
  assert.equal(out.n, 3);
  assert.equal(out.presentRate, 0.67); // 2 of 3 deals true
  const yes = out.distribution.find((b) => b.value === true);
  assert.equal(yes.count, 2);
  assert.ok(yes.points[0].quotes[0]);
});

// ── compareFeature: list set-membership ────────────────────────────────────

test('compareFeature computes SET membership for a list feature (cross-deal frequency)', () => {
  const provs = [
    prov('d1', 'IOC', {
      permittedExceptions: [tagged('ORDINARY_COURSE', 'in the ordinary course'), tagged('REQUIRED_BY_LAW', 'as required by law')],
    }),
    prov('d2', 'IOC', {
      permittedExceptions: [tagged('ORDINARY_COURSE', 'ordinary course of business')],
    }),
    prov('d3', 'IOC', {
      permittedExceptions: [tagged('REQUIRED_BY_LAW', 'required by applicable law'), tagged('WITH_CONSENT', "with Parent's consent")],
    }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'IOC', featureKey: 'permittedExceptions' });
  assert.equal(out.kind, 'set');
  assert.equal(out.n, 3);
  const oc = out.distribution.find((b) => b.code === 'ORDINARY_COURSE');
  const law = out.distribution.find((b) => b.code === 'REQUIRED_BY_LAW');
  assert.equal(oc.count, 2); // present in 2 of 3 deals
  assert.equal(law.count, 2);
  assert.equal(oc.dealFraction, 0.67);
  assert.ok(oc.label && oc.points[0].quotes[0]);
});

// ── dynamic cohort ─────────────────────────────────────────────────────────

test('compareFeature recomputes over a sector cohort', () => {
  const provs = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'a') }), // pharma
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'b') }), // tech
    prov('d3', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_ALL_MATERIAL', 'c') }),  // pharma
  ];
  const out = compareFeature(provs, DEALS, { type: 'REP-T', featureKey: 'materialityQualifier', filters: { sector: 'pharma' } });
  assert.equal(out.n, 2); // d1 + d3 only
  assert.equal(out.filters.sector, 'pharma');
});

test('compareFeature restricts to an explicit hand-picked dealIds cohort', () => {
  const provs = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'a') }),
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'b') }),
    prov('d3', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_ALL_MATERIAL', 'c') }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'REP-T', featureKey: 'materialityQualifier', filters: { dealIds: ['d1', 'd2'] } });
  assert.equal(out.n, 2);
  assert.equal(out.cohortSize, 2);
});

// ── featureOutliers + n-floor guardrail ────────────────────────────────────

test('featureOutliers SUPPRESSES off-market when cohort n < minN', () => {
  const cohort = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'a') }),
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'b') }),
    prov('d3', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'c') }),
  ];
  const stats = cohortFeatureStats(cohort, DEALS, {}).filter((s) => s.featureKey === 'materialityQualifier');
  const dealProvs = [prov('dX', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MATERIAL_TO_COMPANY', 'divergent') })];
  const outliers = featureOutliers(dealProvs, stats, {});
  assert.equal(outliers.length, 1);
  const o = outliers[0];
  assert.equal(o.offMarket, false, 'NEVER off-market below minN');
  assert.equal(o.corpusN, 3);
  assert.ok(o.differsFrom >= 1 && o.ofDeals === 3);
  assert.ok(o.quotes[0]);
});

test('featureOutliers asserts off-market only when n ≥ minN', () => {
  const stats = [{
    type: 'REP-T', featureKey: 'materialityQualifier', label: 'Materiality Qualifier', kind: 'coded', n: 20,
    mode: 'MAT_MAE_QUALIFIED', modeLabel: 'MAE',
    distribution: [
      { value: 'MAT_MAE_QUALIFIED', label: 'MAE', count: 18, dealFraction: 0.9 },
      { value: 'MAT_MATERIAL_TO_COMPANY', label: 'Material to Co', count: 2, dealFraction: 0.1 },
    ],
  }];
  const dealProvs = [prov('dX', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MATERIAL_TO_COMPANY', 'divergent') })];
  const outliers = featureOutliers(dealProvs, stats, { minN: 12 });
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].offMarket, true);
  assert.equal(outliers[0].differsFrom, 18); // 20 − 2 sharing deals
});

test('featureOutliers flags a NUMERIC value outside the cohort IQR (only when n≥minN)', () => {
  const stats = [{ type: 'ANTI', featureKey: 'hsrFilingDeadlineBusinessDays', label: 'HSR deadline', kind: 'numeric', n: 15, median: 10, q1: 8, q3: 12 }];
  const dealProvs = [prov('dX', 'ANTI', { hsrFilingDeadlineBusinessDays: citable(30, 'within thirty business days') })];
  const outliers = featureOutliers(dealProvs, stats, { minN: 12 });
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].offMarket, true);
  assert.equal(outliers[0].dealValue, 30);
});

// ── numericValue: a multi-figure string is never resolved by picking "the
//    first" number it contains ──────────────────────────────────────────────
//
// FEATURES.TERMF's feeAmount is `type: 'currency'`, so compareFeature/
// cohortFeatureStats/featureOutliers all route it through numericValue() for
// cross-deal median/quartile stats and single-deal outlier comparison. A real
// termination-fee headline can legitimately name more than one dollar figure
// -- lib/canonical-v2/termination-product-projection.js#conditionalFeeHeadline
// renders a branch-conditional fee (lib/canonical-v2/termination-product-
// projection.js's own committed Modiv fixture, pinned in
// tests/canonical-v2-termination-fee-conditional-amount-projection.test.js)
// as "Lesser of $10,000,000 (...) or $15,000,000 (...) and the REIT
// Requirements cap" — two genuinely different amounts depending on which
// contract branch fires. Silently returning the first ($10,000,000) would
// plot a cross-deal distribution point, or flag a deal as a market outlier,
// off an arbitrary substring — a wrong number that reads as precise. Same
// principle as parseFeeAmountUsd in termination-fees.config.js, fixed for
// the identical defect.

const MODIV_FEE_HEADLINE = 'Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv) or (v)) and the REIT Requirements cap';

test('numericValue resolves a single clean figure (real single-branch fee headline, TopBuild)', () => {
  // tests/fixtures/review-parity/cases/termination-fees/7dc3a05f-topbuild.projection.json
  assert.equal(numericValue(citable('$600,000,000', 'a fee of $600,000,000')), 600000000);
  assert.equal(numericValue(5), 5, 'a bare number is untouched');
  assert.equal(numericValue(citable(30, 'within thirty business days')), 30, 'a citable-wrapped number is untouched');
});

test('numericValue returns null (never the first figure) for a real branch-conditional fee headline', () => {
  assert.equal(numericValue(citable(MODIV_FEE_HEADLINE, MODIV_FEE_HEADLINE)), null);
});

test('numericValue returns null for a range rather than guessing an endpoint', () => {
  assert.equal(numericValue(citable('30-45 days', 'within 30-45 days')), null);
});

test('numericValue still returns null with no number present at all, or no raw value (unchanged)', () => {
  assert.equal(numericValue(citable('not specified', 'not specified')), null);
  assert.equal(numericValue(null), null);
  assert.equal(numericValue(undefined), null);
});

test('a branch-conditional fee headline is excluded from the cross-deal numeric distribution, never misplaced in it', () => {
  const provs = [
    prov('d1', 'TERMF', { feeAmount: citable('$20,000,000', 'a fee of $20,000,000') }),
    prov('d2', 'TERMF', { feeAmount: citable('$40,000,000', 'a fee of $40,000,000') }),
    // Whatever real path lands a branch-conditional headline on a
    // currency-typed feature, it must fall out of the distribution entirely
    // rather than being misread as $10,000,000.
    prov('d3', 'TERMF', { feeAmount: citable(MODIV_FEE_HEADLINE, MODIV_FEE_HEADLINE) }),
  ];
  const out = compareFeature(provs, DEALS, { type: 'TERMF', featureKey: 'feeAmount' });
  assert.equal(out.kind, 'numeric');
  assert.equal(out.n, 2, 'the ambiguous deal must not count toward n');
  assert.equal(out.count, 2);
  assert.equal(out.median, 30000000, 'median of $20M/$40M only -- never pulled toward a fabricated $10M point');
  assert.deepEqual(out.points.map((p) => p.deal_id).sort(), ['d1', 'd2']);
});

test('a branch-conditional fee headline is skipped by featureOutliers, never flagged off a fabricated number', () => {
  const stats = [{
    type: 'TERMF', featureKey: 'feeAmount', label: 'Termination fee', kind: 'numeric', n: 15, median: 30000000, q1: 20000000, q3: 40000000,
  }];
  const dealProvs = [prov('dX', 'TERMF', { feeAmount: citable(MODIV_FEE_HEADLINE, MODIV_FEE_HEADLINE) })];
  const outliers = featureOutliers(dealProvs, stats, { minN: 12 });
  // $10,000,000 (the first figure in the headline) is well below q1 ($20M)
  // and would have been silently flagged off-market under the old
  // first-number-wins behaviour. Guarded, the feature has no resolvable
  // value at all, so it is skipped outright rather than asserting a
  // confident, wrong verdict.
  assert.equal(outliers.length, 0);
});

// ── thin rep-materiality wrapper ───────────────────────────────────────────

test('repMaterialityCode unwraps tagged / citable / list and defaults to NO_QUALIFIER', () => {
  assert.equal(repMaterialityCode(prov('d1', 'REP-T', { materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'x') })), 'MAT_MAE_QUALIFIED');
  assert.equal(repMaterialityCode(prov('d1', 'REP-T', { materialityQualifier: citable(tagged('MAT_ALL_MATERIAL', 'x'), 'q') })), 'MAT_ALL_MATERIAL');
  assert.equal(repMaterialityCode(prov('d1', 'REP-T', {})), NO_QUALIFIER);
  assert.equal(repMaterialityCode(prov('d1', 'REP-T', { materialityQualifier: tagged('NOT_A_REAL_CODE', 'x') })), NO_QUALIFIER);
});

test('compareRepMateriality delegates to the engine and narrows by repCode', () => {
  const provs = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'a') }),
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-LIT', materialityQualifier: tagged('MAT_ALL_MATERIAL', 'b') }),
  ];
  const out = compareRepMateriality(provs, DEALS, { repCode: 'REP-T-IP' });
  assert.equal(out.n, 1);
  assert.equal(out.filters.code, 'REP-T-IP');
  assert.equal(out.distribution[0].value, 'MAT_MAE_QUALIFIED');
});

test('repMaterialityOutliers filters to the materiality feature and respects the guardrail', () => {
  const cohort = [
    prov('d1', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'a') }),
    prov('d2', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_MAE_QUALIFIED', 'b') }),
  ];
  const stats = repMaterialityStats(cohort, DEALS, {});
  const dealProvs = [prov('dX', 'REP-T', { canonicalCode: 'REP-T-IP', materialityQualifier: tagged('MAT_ALL_MATERIAL', 'z') })];
  const outliers = repMaterialityOutliers(dealProvs, stats, {});
  assert.ok(outliers.every((o) => o.featureKey === 'materialityQualifier'));
  assert.ok(outliers.every((o) => o.offMarket === false)); // n=2 < 12
});
