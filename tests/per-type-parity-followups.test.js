const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyPerTypeLocalPostPasses,
  filterProvisionsToTypeGroup,
} = require('../lib/parser-v2/extract');
const { validateProvisions } = require('../lib/parser-v2/validate');

test('per-type validation OTHER backfills are filtered out before dry-run/store', () => {
  const classifiedSections = [{
    provision_type: 'REP-T',
    title: 'Material Contracts',
    text: 'Section 3.13. Material Contracts. The Company has no material contracts except as disclosed.',
    startChar: 100,
  }];

  const validation = validateProvisions([], '', classifiedSections);
  assert.equal(validation.provisions.length, 1);
  assert.equal(validation.provisions[0].type, 'OTHER');

  const filtered = filterProvisionsToTypeGroup('REP-T', validation.provisions);
  assert.deepEqual(filtered, []);
});

test('per-type REP post-pass folds materialityScopeType onto materialityQualifier', () => {
  const reps = [{
    type: 'REP-T',
    category: 'Compliance with Laws',
    features: {
      materialityScopeType: 'ENTIRE_REP',
      materialityQualifier: {
        code: 'MAT_MAE_AGGREGATE',
        label: 'MAE',
        text: 'except as would not have an MAE',
      },
    },
  }];

  applyPerTypeLocalPostPasses('REP-T', reps);
  assert.equal(reps[0].features.materialityQualifier.scope, 'ENTIRE_REP');
});

test('per-type IOC post-pass stamps efforts and restriction components', () => {
  const provisions = [
    {
      type: 'IOC',
      features: {
        positiveObligations: [{ obligation: 'use commercially reasonable efforts to preserve relationships' }],
      },
    },
    {
      type: 'IOC-T',
      full_text: 'incur any indebtedness for borrowed money, or guarantee any indebtedness of another Person',
      features: {},
    },
  ];

  applyPerTypeLocalPostPasses('IOC', provisions);
  assert.equal(provisions[0].features.positiveObligations[0].efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
  assert.deepEqual(
    provisions[1].features.restrictionComponents.sort(),
    ['INDEBTEDNESS', 'THIRD_PARTY_OBLIGATIONS'].sort(),
  );
});

test('per-type TERMR post-pass computes outside date months from threaded signing context', () => {
  const termr = [{
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    features: {
      outsideDateISO: '2026-03-21',
      extendedOutsideDateISO: '2026-06-21',
    },
  }];

  applyPerTypeLocalPostPasses('TERMR', termr, { signingDate: '2025-09-21' });
  assert.equal(termr[0].features.outsideDateMonthsPostSigning, 6);
  assert.equal(termr[0].features.extensionMonths, 3);
});
