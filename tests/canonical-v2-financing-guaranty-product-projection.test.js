'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUTHORITY_STATE,
  FINANCING_CLAIMS,
  GUARANTY_CLAIMS,
  FinancingGuarantyProductProjectionError,
  projectFinancingGuarantyClaims,
} = require('../lib/canonical-v2/financing-guaranty-product-projection');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

const CLAIM_FIXTURES = Object.freeze({
  FINANCING_OBTAIN_EFFORTS_STANDARD: Object.freeze({
    value: 'REASONABLE_BEST_EFFORTS',
    attributes: Object.freeze({ financing_kind: 'DEBT', obligor_ref: 'Parent and Merger Sub', standard_code: 'REASONABLE_BEST_EFFORTS' }),
  }),
  FINANCING_COOPERATION_PRESENT: Object.freeze({
    value: true,
    attributes: Object.freeze({ financing_kind: 'DEBT_AND_EQUITY', obligor_ref: 'the Company Entities' }),
  }),
  NO_FINANCING_CONDITION_ACKNOWLEDGMENT: Object.freeze({
    value: true,
    attributes: Object.freeze({ financing_kind: 'UNSPECIFIED' }),
  }),
  PAYOFF_DELIVERY_LEAD_TIME_DAYS: Object.freeze({
    value: '2',
    attributes: Object.freeze({ day_kind: 'BUSINESS', delivery_stage: 'FINAL', deliverable_term_ref: 'Payoff Letters' }),
  }),
  MARKETING_PERIOD_LENGTH_DAYS: Object.freeze({
    value: '15',
    attributes: Object.freeze({ day_kind: 'BUSINESS', marketing_term_ref: 'Marketing Period' }),
  }),
  PARENT_PERFORMANCE_GUARANTY: Object.freeze({
    value: true,
    attributes: Object.freeze({ guarantor_ref: 'Parent Holdco', obligor_ref: 'Parent and Merger Sub' }),
  }),
  LIMITED_GUARANTY_DELIVERED: Object.freeze({
    value: true,
    attributes: Object.freeze({ guarantor_ref: 'each Guarantor' }),
  }),
  LIMITED_GUARANTY_IN_EFFECT: Object.freeze({
    value: true,
    attributes: Object.freeze({ guarantor_ref: '3G Fund VI, L.P.' }),
  }),
});

function entry(key, overrides = {}) {
  const definition = FINANCING_CLAIMS[key] || GUARANTY_CLAIMS[key];
  const fixture = CLAIM_FIXTURES[key] || { value: true, attributes: {} };
  const suffix = overrides.suffix || key.toLowerCase();
  const provisionId = `provision-${suffix}`;
  return {
    resolved_claim_definition_key: key,
    concept_key: definition?.concept || overrides.concept_key || 'COV-FINANCING',
    section_reference: overrides.section_reference || `Section ${suffix}`,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
    },
    claim: {
      schema_version: 'CLAIM/V1',
      claim_revision_id: `claim-${suffix}`,
      subject_occurrence_id: provisionId,
      claim_definition_key: key,
      state: 'PRESENT',
      canonical_value: fixture.value,
      attributes: { ...fixture.attributes },
      ...(overrides.claim || {}),
    },
    ...overrides.entry,
  };
}

function projectionError(code) {
  return (error) => error instanceof FinancingGuarantyProductProjectionError && error.code === code;
}

test('all governed financing and guaranty claims reach Review, Query, Compare and market statistics', () => {
  const keys = [...Object.keys(FINANCING_CLAIMS), ...Object.keys(GUARANTY_CLAIMS)];
  const projection = projectFinancingGuarantyClaims({ resolved_entries: keys.map((key) => entry(key)) });
  assert.equal(projection.authority_state, AUTHORITY_STATE);
  assert.equal(projection.records.length, 8);
  const byKey = new Map(projection.records.map((record) => [record.review.row_key, record]));
  for (const key of keys) {
    const record = byKey.get(key);
    assert.ok(record, key);
    assert.equal(record.review.value, CLAIM_FIXTURES[key].value);
    assert.deepEqual(record.query, record.compare);
    assert.equal(record.market.metric_version, 1);
    assert.equal(record.market.weighting, 'DEAL');
  }
  assert.equal(byKey.get('PAYOFF_DELIVERY_LEAD_TIME_DAYS').market.canonical_unit, 'BUSINESS_DAYS');
  assert.equal(byKey.get('MARKETING_PERIOD_LENGTH_DAYS').review.dimensions.mechanics_state, 'LENGTH_ONLY_OPEN_WORLD');
  assert.equal(byKey.get('PARENT_PERFORMANCE_GUARANTY').review.dimensions.economics_state, 'OPEN_WORLD_UNADJUDICATED');
});

test('Query and Compare expose the governed financing and guaranty fields without taking no-shop ownership', () => {
  assert.ok(fieldsForCompareCell('COVENANT_OTHER', ['all']).includes('financingCovenantFact'));
  assert.ok(fieldsForCompareCell('COVENANT_OTHER', ['all']).includes('guarantyFact'));
  assert.ok(fieldsForCompareCell('DEFINITION', ['all']).includes('financingCovenantFact'));
  assert.ok(fieldsForCompareCell('REPRESENTATION', ['all']).includes('guarantyFact'));
  assert.ok(fieldsForCompareCell('COVENANT_NO_SOLICITATION', ['all']).includes('initialMatchPeriodDays'));
  assert.ok(!fieldsForCompareCell('COVENANT_NO_SOLICITATION', ['all']).includes('financingCovenantFact'));
});

test('marketing-period mechanics, reimbursement amounts and market flex remain evidence-only', () => {
  for (const [attribute, value] of [
    ['commencement_trigger', 'Required Financial Information'],
    ['blackout_dates', ['2026-11-25']],
    ['early_completion_override', 'Debt Financing funded'],
  ]) {
    const candidate = entry('MARKETING_PERIOD_LENGTH_DAYS', { suffix: attribute });
    candidate.claim.attributes[attribute] = value;
    assert.throws(
      () => projectFinancingGuarantyClaims({ resolved_entries: [candidate] }),
      projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
    );
  }
  for (const key of ['FINANCING_REIMBURSEMENT_AMOUNT', 'FINANCING_MARKET_FLEX', 'MARKETING_PERIOD_BLACKOUT_DATES']) {
    assert.throws(
      () => projectFinancingGuarantyClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('guaranty economics remain evidence-only', () => {
  for (const [attribute, value] of [
    ['guaranty_cap_amount', '100000000'],
    ['payment_or_collection', 'PAYMENT'],
    ['guaranteed_obligations', ['TERMINATION_FEE']],
  ]) {
    const candidate = entry('PARENT_PERFORMANCE_GUARANTY', { suffix: attribute });
    candidate.claim.attributes[attribute] = value;
    assert.throws(
      () => projectFinancingGuarantyClaims({ resolved_entries: [candidate] }),
      projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
    );
  }
});

test('remedies, termination fees and closing conditions cannot enter these family projections', () => {
  for (const key of [
    'SPECIFIC_PERFORMANCE_FINANCING_CARVEOUT',
    'FINANCING_FAILURE_TERMINATION_FEE',
    'FINANCING_CONDITION',
    'FINANCING_COOPERATION_BREACH_CLOSING_CONDITION',
  ]) {
    assert.throws(
      () => projectFinancingGuarantyClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('quoted no-financing-condition text stays an acknowledgment and never becomes a scope-closure negative', () => {
  const candidate = entry('NO_FINANCING_CONDITION_ACKNOWLEDGMENT');
  const record = projectFinancingGuarantyClaims({ resolved_entries: [candidate] }).records[0];
  assert.equal(record.review.dimensions.condition_scope_state, 'QUOTED_ACKNOWLEDGMENT_ONLY');
  assert.equal(record.market.canonical_value, true);
  candidate.claim.attributes.condition_absent = true;
  assert.throws(
    () => projectFinancingGuarantyClaims({ resolved_entries: [candidate] }),
    projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
  );
});

test('product projection fails closed on wrong family ownership, invalid values and duplicate claims', () => {
  assert.throws(
    () => projectFinancingGuarantyClaims({ resolved_entries: [entry('PARENT_PERFORMANCE_GUARANTY', { entry: { concept_key: 'REM-NONRECOURSE' } })] }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );
  assert.throws(
    () => projectFinancingGuarantyClaims({ resolved_entries: [entry('PAYOFF_DELIVERY_LEAD_TIME_DAYS', { claim: { canonical_value: '-2' } })] }),
    projectionError('INVALID_GOVERNED_CLAIM'),
  );
  const duplicate = entry('LIMITED_GUARANTY_DELIVERED');
  assert.throws(
    () => projectFinancingGuarantyClaims({ resolved_entries: [duplicate, structuredClone(duplicate)] }),
    projectionError('DUPLICATE_PRODUCT_CLAIM'),
  );
});
