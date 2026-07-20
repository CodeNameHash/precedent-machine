const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDurationClaim,
  selectDurationCohort,
} = require('../lib/queries/corpus-duration');

function claim(dealId, code, value, evidenceQuote = null, excerptId = null) {
  return {
    deal_id: dealId,
    attribute: 'noticePeriod',
    canonical: null,
    verbatim: String(value),
    evidence_quote: evidenceQuote,
    excerpt_id: excerptId,
    provenance: { code, feature_key: 'noticePeriod', feature_value: value },
  };
}

test('normalizeDurationClaim preserves business, calendar and elapsed clocks', () => {
  assert.deepEqual(normalizeDurationClaim(claim('a', 'NOSOL-INTERVENING', 4, 'four (4) Business Days prior notice')), {
    value: 4,
    unit: 'business_days',
  });
  assert.deepEqual(normalizeDurationClaim(claim('b', 'NOSOL-INTERVENING', 4, 'four calendar days prior notice')), {
    value: 4,
    unit: 'calendar_days',
  });
  assert.deepEqual(normalizeDurationClaim(claim('c', 'NOSOL-INTERVENING', 96, 'at least 96 hours written notice')), {
    value: 96,
    unit: 'elapsed_hours',
  });
});

test('normalizeDurationClaim can use the linked card quote when a rematerialized claim lost its evidence', () => {
  const qxo = claim('qxo', 'NOSOL-INTERVENING', 4, null, 'qxo-intervening');
  const linked = 'The Company has given Parent at least four (4) business days prior written notice and a new four (4)-business day period applies to each change.';
  assert.deepEqual(normalizeDurationClaim(qxo, linked), { value: 4, unit: 'business_days' });
});

test('normalizeDurationClaim fails closed on conflicting or missing clock evidence', () => {
  assert.equal(normalizeDurationClaim(claim('a', 'NOSOL-INTERVENING', 4)), null);
  assert.equal(normalizeDurationClaim(claim('b', 'NOSOL-INTERVENING', 4, 'the shorter of one Business Day or 48 hours')), null);
  assert.equal(normalizeDurationClaim({
    ...claim('c', 'NOSOL-INTERVENING', 4, 'four Business Days prior notice'),
    provenance: { code: 'NOSOL-INTERVENING', feature_value: { value: 4, unit: 'calendar_days' } },
  }), null);
  assert.equal(normalizeDurationClaim({
    ...claim('d', 'NOSOL-INTERVENING', 4),
    provenance: {
      code: 'NOSOL-INTERVENING',
      value: 4,
      unit: 'business_days',
      feature_value: { value: 4, unit: 'calendar_days' },
    },
  }, 'four Business Days prior notice'), null);
});

test('QXO business-day cohort excludes hour, calendar, unknown-clock and different-trigger claims', () => {
  const claims = [
    claim('qxo', 'NOSOL-INTERVENING', 4, null, 'qxo-intervening'),
    claim('qxo', 'NOSOL-NOTICE', 24, 'within 24 hours'),
    claim('peer-business-3', 'NOSOL-INTERVENING', 3, 'three (3) Business Days prior notice'),
    claim('peer-hours', 'NOSOL-INTERVENING', 96, 'at least 96 hours written notice'),
    claim('peer-calendar', 'NOSOL-INTERVENING', 4, 'four calendar days prior notice'),
    claim('peer-unknown', 'NOSOL-INTERVENING', 5),
    claim('peer-business-5', 'NOSOL-INTERVENING', 5, 'five Business Days prior notice'),
    claim('peer-other-trigger', 'NOSOL-MATCH', 5, 'five Business Days prior notice'),
  ];
  const evidenceByCardKey = new Map([
    ['qxo|qxo-intervening', 'Parent receives four (4) business days prior written notice.'],
  ]);

  const { cohort, reason } = selectDurationCohort({
    claims,
    subjectDealId: 'qxo',
    requestedCode: 'NOSOL-INTERVENING',
    evidenceByCardKey,
  });

  assert.equal(reason, null);
  assert.equal(cohort.unit, 'business_days');
  assert.equal(cohort.triggerCode, 'NOSOL-INTERVENING');
  assert.equal(cohort.subjectValue, 4);
  assert.deepEqual(cohort.entries.map((entry) => entry.duration.value).sort((a, b) => a - b), [3, 4, 5]);
  assert.deepEqual(cohort.entries.map((entry) => entry.claim.deal_id).sort(), ['peer-business-3', 'peer-business-5', 'qxo']);
  assert.equal(cohort.eligibleDealCount, 6);
  assert.equal(cohort.excludedDealCount, 3);
});

test('an exact subject-code claim with an unknown clock does not fall back to a different trigger', () => {
  const claims = [
    claim('qxo', 'NOSOL-INTERVENING', 4),
    claim('qxo', 'NOSOL-NOTICE', 24, 'within 24 hours'),
  ];
  const result = selectDurationCohort({
    claims,
    subjectDealId: 'qxo',
    requestedCode: 'NOSOL-INTERVENING',
    evidenceByCardKey: new Map(),
  });
  assert.equal(result.cohort, null);
  assert.equal(result.reason, 'subject-duration-unknown');
});
