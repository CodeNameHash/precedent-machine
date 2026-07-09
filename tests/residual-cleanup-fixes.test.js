// Residual cleanup work package (post metsera-parity-CONFIRM audit). Three
// fixes, one test file:
//
// Fix 1: object+dict attributes whose claims backfill stored the extract.js
// tagged ENVELOPE (`{"value":{code,label,text,...},"quotes":[]}`, or a flat
// structured object) as `verbatim` were dumping that raw JSON into the
// read-view instead of a friendly label. lib/queries/claims-adapter.js now
// detects the JSON-object shape and routes it through the object-parsing
// path (buildObjectItemValue) regardless of whether the attribute is
// "tagged" or a plain scalar. A separate, same-family bug lived in
// consideration-hero.config.js's own stale local copy of valueText (missing
// card-utils.js's label/code-first + text-redundancy fix), which both
// dumped JSON for equityAwardTreatment and doubled the raw code onto the
// label for vestingAcceleration (e.g. "Accelerates ... : ACCEL_ELSE_DOUBLE_TRIGGER").
//
// Fix 2: three render misses --
//   (a) writtenConsentRequired's claim lives on a TERMR-MUTUAL card, which
//       approvals-votes.config.js#isApproval() never selected.
//   (b) cvrMilestonePayments / optionsCvrEarnIn had no consideration-hero row.
//   (c) termination-rights willfulBreachException / specificPerformanceMutual
//       live on TERMF-*/MISC-* cards outside termination-rights.config.js's
//       TERMR_CANONICAL code-matched rows.
//
// Fix 3: clicking a sidebar section entry calls queueSectionScroll() TWICE
// per click (once from the direct click handler, once more when the pushed
// URL round-trips through the router-hydration effect). Each call used to
// mint a brand-new pendingScrollTarget object, cancelling the in-flight
// double-rAF scroll from the first call before it painted -- on data-heavy
// deals this repeated cancel/reschedule for seconds, so the scroll+expand
// looked like it silently never fired. See sameScrollTarget() dedupe guard.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  buildFeaturesForCard,
} = require('../lib/queries/claims-adapter');

let cardUtils;
let considerationHeroMod;
let approvalsVotesMod;
let terminationRightsMod;

test.before(async () => {
  cardUtils = await import(path.join('..', 'components', 'review', 'table-configs', 'card-utils.js'));
  considerationHeroMod = await import(path.join('..', 'components', 'review', 'table-configs', 'consideration-hero.config.js'));
  approvalsVotesMod = await import(path.join('..', 'components', 'review', 'table-configs', 'approvals-votes.config.js'));
  terminationRightsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'termination-rights.config.js'));
});

function claim(overrides = {}) {
  return {
    id: overrides.id || 'claim-1',
    excerpt_id: overrides.excerpt_id || 'card-1:0',
    attribute: overrides.attribute,
    verbatim: overrides.verbatim ?? null,
    evidence_quote: overrides.evidence_quote ?? null,
    canonical: overrides.canonical ?? null,
    created_at: overrides.created_at || '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function noJson(rendered) {
  assert.ok(rendered, 'renders something');
  assert.ok(!rendered.trim().startsWith('{'), `must not leak raw JSON, got: ${rendered}`);
  assert.ok(!/"\w+":\s*[{"[]/.test(rendered), `must not leak raw JSON fragments, got: ${rendered}`);
}

// --- Fix 1: claims-adapter JSON-envelope unwrap -----------------------------

test('materialityQualifier with a JSON tagged-envelope verbatim (canonical populated) renders a friendly label, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'materialityQualifier',
      canonical: 'MAT_MAE_AGGREGATE',
      verbatim: JSON.stringify({
        value: {
          code: 'MAT_MAE_AGGREGATE',
          text: 'Except as would not, individually or in the aggregate, have a Material Adverse Effect',
          label: 'Would not, individually or in aggregate, have MAE',
          scope: 'PARTIAL',
        },
        quotes: [],
      }),
      evidence_quote: 'SECTION 3.09. Tax Matters.',
    }),
  ]);
  const rendered = cardUtils.valueText(features.materialityQualifier);
  noJson(rendered);
  assert.match(rendered, /Would not, individually or in aggregate, have MAE/);
});

test('materialityQualifier with a JSON tagged-envelope verbatim (canonical null) still resolves a code and label, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'materialityQualifier',
      canonical: null,
      verbatim: JSON.stringify({
        value: { code: 'MAT_MATERIAL_INLINE', text: 'all material Tax Returns...', label: 'Materiality inline within the rep', scope: 'PARTIAL' },
        quotes: [],
      }),
    }),
  ]);
  const rendered = cardUtils.valueText(features.materialityQualifier);
  noJson(rendered);
  assert.equal(features.materialityQualifier.code, 'MAT_MATERIAL_INLINE');
});

test('hsrFilingDeadlineBusinessDays (registry valueType "number") with a JSON envelope verbatim renders structured fields, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'hsrFilingDeadlineBusinessDays',
      canonical: null,
      verbatim: JSON.stringify({ value: { days: 10, text: 'within ten (10) Business Days after the date hereof', unit: 'Business Days' }, quotes: [] }),
    }),
  ]);
  const rendered = cardUtils.valueText(features.hsrFilingDeadlineBusinessDays);
  noJson(rendered);
  assert.match(rendered, /10/);
  assert.match(rendered, /Business Days/);
});

test('positiveObligations (flat JSON object, no envelope) renders structured fields, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'positiveObligations',
      canonical: null,
      verbatim: JSON.stringify({
        appliesTo: ['ASSETS', 'BUSINESS_ORGANIZATION'],
        obligation: 'preserve substantially intact the goodwill',
        efforts_standard: 'COMMERCIALLY_REASONABLE_EFFORTS',
      }),
    }),
  ]);
  const value = Array.isArray(features.positiveObligations) ? features.positiveObligations[0] : features.positiveObligations;
  const rendered = cardUtils.valueText(value);
  noJson(rendered);
  assert.match(rendered, /preserve substantially intact the goodwill/);
});

test('divestitureCapDescription (registry valueType "string") with a JSON envelope verbatim (Anadarko shape, canonical null) renders a clean string, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'divestitureCapDescription',
      canonical: null,
      verbatim: JSON.stringify({
        value: { code: 'BURDENSOME_CONDITION', text: 'neither the provisions of this Section 7.1...', label: 'Burdensome-condition / MAE-style cap' },
        quotes: [],
      }),
    }),
  ]);
  const rendered = cardUtils.valueText(features.divestitureCapDescription);
  noJson(rendered);
});

test('regulatoryStrategyControlTagged with a JSON tagged-envelope verbatim (Chevron shape) renders a friendly label, not JSON', () => {
  const features = buildFeaturesForCard([
    claim({
      attribute: 'regulatoryStrategyControlTagged',
      canonical: 'CONTROL_PARENT',
      verbatim: JSON.stringify({
        value: { code: 'CONTROL_PARENT', text: 'Parent shall have the right to control...', label: 'Parent / Buyer controls strategy' },
        quotes: [],
      }),
    }),
  ]);
  const rendered = cardUtils.valueText(features.regulatoryStrategyControlTagged);
  noJson(rendered);
  assert.match(rendered, /Parent \/ Buyer controls strategy/);
});

test('plain code-as-verbatim tagged attributes are unaffected by the JSON-envelope routing change', () => {
  const features = buildFeaturesForCard([
    claim({ attribute: 'materialityQualifier', canonical: null, verbatim: 'MAT_MATERIAL_INLINE' }),
  ]);
  const rendered = cardUtils.valueText(features.materialityQualifier);
  noJson(rendered);
  assert.ok(!rendered.includes('MAT_MATERIAL_INLINE'), 'raw code must not leak once a label resolves');
});

// --- Fix 1b: consideration-hero.config.js's stale local valueText ----------

test('consideration-hero equityAwardTreatment (flat JSON, no envelope) renders structured fields inline, not raw JSON', () => {
  // Build the equityAwardTreatment value the way the real adapter does (flat
  // JSON verbatim, no `.value` envelope) rather than hand-authoring the
  // parsed shape, so this test exercises the exact adapter output.
  const adapterFeatures = buildFeaturesForCard([
    claim({
      attribute: 'equityAwardTreatment',
      canonical: null,
      verbatim: JSON.stringify({
        espp: 'Company ESPP is frozen, no new participants or increased elections are permitted.',
        stockOptions: 'Company Stock Options are cancelled for cash plus one CVR per underlying share.',
      }),
    }),
  ]);
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [{
      id: 'equity',
      provision_subtype: 'CONSID-EQUITY',
      short_title: 'Treatment of Equity Awards',
      primary_quote: 'Company Options are cancelled...',
      features: { considerationType: 'cash', equityAwardTreatment: adapterFeatures.equityAwardTreatment },
    }],
  });
  const row = rows.find((r) => r.id === 'consideration-hero-equityAwardTreatment');
  assert.ok(row, 'equity-award treatment row renders');
  noJson(row.detail);
  assert.match(row.detail, /Company ESPP is frozen/);
});

test('consideration-hero vestingAcceleration does not double the raw canonical code onto the label', () => {
  const adapterFeatures = buildFeaturesForCard([
    claim({ attribute: 'vestingAcceleration', canonical: null, verbatim: 'ACCEL_ELSE_DOUBLE_TRIGGER' }),
  ]);
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [{
      id: 'vest',
      provision_subtype: 'CONSID-EQUITY',
      features: { considerationType: 'cash', vestingAcceleration: adapterFeatures.vestingAcceleration },
    }],
  });
  const row = rows.find((r) => r.id === 'consideration-hero-vestingAcceleration');
  assert.ok(row, 'vesting-acceleration row renders');
  assert.ok(!row.detail.includes('ACCEL_ELSE_DOUBLE_TRIGGER'), `raw code must not leak after the label, got: ${row.detail}`);
});

// --- Fix 2a: writtenConsentRequired (TERMR-MUTUAL card-selection miss) -----

test('approvals-votes config selects the TERMR-MUTUAL card so writtenConsentRequired renders', () => {
  const rows = approvalsVotesMod.approvalsVotesConfig.selectRows({
    cards: [{
      id: 'mutual-consent',
      provision_type: 'TERMINATION_RIGHT',
      provision_subtype: 'TERMR-MUTUAL',
      short_title: 'Mutual Termination',
      primary_quote: '(a) by mutual written consent of Parent, Merger Sub and the Company;',
      features: { writtenConsentRequired: true },
    }],
  });
  const row = rows.find((r) => r.label === 'Written consent required');
  assert.ok(row, 'writtenConsentRequired row must render from the TERMR-MUTUAL card');
  assert.equal(row.detail, 'Yes');
});

// --- Fix 2b: CVR milestone / options-earn-in consideration rows -----------

test('consideration-hero config exposes cvrMilestonePayments and optionsCvrEarnIn rows when present', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [{
      id: 'convert',
      provision_subtype: 'CONSID-CONVERT',
      short_title: 'Conversion of Shares',
      features: {
        considerationType: 'cash-with-cvr',
        perShareAmount: '$47.50',
        cvrMilestonePayments: [
          { code: 'CVR_MILESTONE', label: 'Clinical Trial Milestone Payment', text: '"Clinical Trial Milestone Payment" means $5.00' },
        ],
        optionsCvrEarnIn: { code: 'MUST_BE_ITM', label: 'Must be in-the-money', text: 'MUST_BE_ITM' },
      },
    }],
  });
  const milestoneRow = rows.find((r) => r.id === 'consideration-hero-cvrMilestonePayments');
  const earnInRow = rows.find((r) => r.id === 'consideration-hero-optionsCvrEarnIn');
  assert.ok(milestoneRow, 'cvrMilestonePayments row renders');
  assert.ok(earnInRow, 'optionsCvrEarnIn row renders');
  assert.match(milestoneRow.detail, /Clinical Trial Milestone Payment/);
  assert.match(earnInRow.detail, /Must be in-the-money/);
});

// --- Fix 2c: termination-rights cross-cutting remedies group --------------

test('termination-rights config surfaces willfulBreachException and specificPerformanceMutual from MISC/TERMF cards', () => {
  const cards = [
    {
      id: 'termf-sole',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-SOLE',
      short_title: 'Sole Remedy',
      primary_quote: 'the payment of the Termination Fee shall be the sole and exclusive remedy...',
      features: { willfulBreachException: true },
    },
    {
      id: 'misc-specific',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-SPECIFIC',
      short_title: 'Specific Performance',
      primary_quote: 'each party shall be entitled to seek specific performance...',
      features: { specificPerformanceMutual: true },
    },
  ];
  const rows = terminationRightsMod.terminationRightsConfig.selectRows({ cards });
  assert.equal(rows.length, 1);
  const remedies = rows[0].groups.find((g) => g.id === 'remedies');
  assert.ok(remedies, 'a Remedies (cross-reference) group renders when willfulBreachException/specificPerformanceMutual exist on non-TERMR cards');
  const willful = remedies.rows.find((r) => r.present && /willful/i.test(r.label));
  const specPerf = remedies.rows.find((r) => r.present && /specific performance/i.test(r.label));
  assert.ok(willful, 'willful-breach exception row renders');
  assert.ok(specPerf, 'specific performance mutual row renders');
});

test('termination-rights crossCuttingGroup returns null when neither attribute is present anywhere in the deal', () => {
  const group = terminationRightsMod.crossCuttingGroup({ cards: [{ id: 'x', provision_subtype: 'TERMR-OUTSIDE', features: { outsideDate: 'June 30, 2026' } }] });
  assert.equal(group, null);
});

// --- Fix 3: nav-scroll dedupe guard (source-text assertion; pages/review/[id].js
// is a giant non-JSX-transformable page, so tests on it follow the existing
// codebase convention of asserting against the raw source rather than
// mounting the component -- see tests/review-page-card-switch.test.js). -----

test('review page dedupes repeated scroll-target requests so a redundant queueSectionScroll/queueProvisionScroll call does not cancel an in-flight scroll', () => {
  const reviewPageSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.match(
    reviewPageSource,
    /const sameScrollTarget = \(prev, next\) =>\s*\n\s*!!prev && prev\.provisionId === next\.provisionId && prev\.sectionType === next\.sectionType;/,
    'a sameScrollTarget dedupe guard must exist',
  );
  // Both queuers must route their setPendingScrollTarget call through the
  // guard (functional updater comparing against the dedupe helper), not a
  // bare object literal -- a bare literal is what caused the double-call
  // (click handler + router-hydration effect) to cancel/reschedule the
  // pending double-rAF scroll on every redundant call.
  const queueProvisionScrollBody = reviewPageSource.slice(
    reviewPageSource.indexOf('const queueProvisionScroll = useCallback'),
    reviewPageSource.indexOf('const queueSectionScroll = useCallback'),
  );
  const queueSectionScrollBody = reviewPageSource.slice(
    reviewPageSource.indexOf('const queueSectionScroll = useCallback'),
    reviewPageSource.indexOf('useEffect(() => {\n    if (!pendingScrollTarget) return;'),
  );
  assert.match(queueProvisionScrollBody, /setPendingScrollTarget\(\(prev\) => \(sameScrollTarget\(prev, target\) \? prev : target\)\)/);
  assert.match(queueSectionScrollBody, /setPendingScrollTarget\(\(prev\) => \(sameScrollTarget\(prev, target\) \? prev : target\)\)/);
});
