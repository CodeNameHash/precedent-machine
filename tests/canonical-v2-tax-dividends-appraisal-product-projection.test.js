'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  APPRAISAL_CLAIMS,
  AUTHORITY_STATE,
  DIVIDEND_CLAIMS,
  TAX_CLAIMS,
  TaxDividendsAppraisalProductProjectionError,
  projectTaxDividendsAppraisalClaims,
} = require('../lib/canonical-v2/tax-dividends-appraisal-product-projection');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

const CLAIM_FIXTURES = Object.freeze({
  INTENDED_TAX_TREATMENT_KIND: Object.freeze({
    value: 'REORG_368A',
    attributes: Object.freeze({ treatment_scope_ref: 'the Mergers, taken together', treatment_term_ref: 'Intended Tax Treatment' }),
  }),
  TAX_TREATMENT_PROTECTION_COVENANT: Object.freeze({
    value: true, attributes: Object.freeze({ treatment_term_ref: 'Intended Tax Treatment' }),
  }),
  TRANSFER_TAX_ALLOCATION: Object.freeze({
    value: 'PARENT', attributes: Object.freeze({ bearer_ref: 'Parent and Merger Sub' }),
  }),
  TRANSFER_TAX_COOPERATION: Object.freeze({ value: true, attributes: Object.freeze({}) }),
  FIRPTA_CERTIFICATE_DELIVERY: Object.freeze({ value: true, attributes: Object.freeze({}) }),
  TAX_OPINION_COOPERATION_COVENANT: Object.freeze({ value: true, attributes: Object.freeze({}) }),
  DIVIDEND_COORDINATION_COVENANT: Object.freeze({ value: true, attributes: Object.freeze({}) }),
  APPRAISAL_SETTLEMENT_CONSENT: Object.freeze({
    value: true, attributes: Object.freeze({ statute_ref: 'Section 262 of the DGCL' }),
  }),
  APPRAISAL_WITHDRAWAL_RECONVERSION: Object.freeze({ value: true, attributes: Object.freeze({}) }),
});

function entry(key, overrides = {}) {
  const definition = TAX_CLAIMS[key] || DIVIDEND_CLAIMS[key] || APPRAISAL_CLAIMS[key];
  const fixture = CLAIM_FIXTURES[key] || { value: true, attributes: {} };
  const suffix = overrides.suffix || key.toLowerCase();
  const provisionId = `provision-${suffix}`;
  return {
    resolved_claim_definition_key: key,
    concept_key: definition?.concept || overrides.concept_key || 'TAXM-TREATMENT',
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
  return (error) => error instanceof TaxDividendsAppraisalProductProjectionError
    && error.code === code;
}

test('all governed tax, dividend and appraisal claims reach Review, Query, Compare and market statistics', () => {
  const keys = [...Object.keys(TAX_CLAIMS), ...Object.keys(DIVIDEND_CLAIMS), ...Object.keys(APPRAISAL_CLAIMS)];
  const projection = projectTaxDividendsAppraisalClaims({ resolved_entries: keys.map((key) => entry(key)) });
  assert.equal(projection.authority_state, AUTHORITY_STATE);
  assert.equal(projection.records.length, 9);
  const byKey = new Map(projection.records.map((record) => [record.review.row_key, record]));
  for (const key of keys) {
    const record = byKey.get(key);
    assert.ok(record, key);
    assert.equal(record.review.value, CLAIM_FIXTURES[key].value);
    assert.deepEqual(record.query, record.compare);
    assert.equal(record.market.metric_version, 1);
    assert.equal(record.market.weighting, 'DEAL');
  }
  assert.equal(byKey.get('TAX_OPINION_COOPERATION_COVENANT').review.dimensions.condition_scope_state, 'COVENANT_ONLY');
  assert.equal(byKey.get('APPRAISAL_SETTLEMENT_CONSENT').review.dimensions.statute_taxonomy_state, 'VERBATIM_ONLY_NO_ENUM');
});

test('Query and Compare expose the three governed family fields without taking adjacent-family fields', () => {
  const covenantFields = fieldsForCompareCell('COVENANT_OTHER', ['all']);
  assert.ok(covenantFields.includes('taxMatterFact'));
  assert.ok(covenantFields.includes('dividendFact'));
  assert.ok(covenantFields.includes('appraisalFact'));
  assert.ok(fieldsForCompareCell('STRUCTURE_MECHANICS', ['all']).includes('taxMatterFact'));
  assert.ok(fieldsForCompareCell('CONSIDERATION', ['all']).includes('appraisalFact'));
  assert.ok(!fieldsForCompareCell('CLOSING_CONDITION', ['all']).includes('appraisalFact'));
  assert.ok(!fieldsForCompareCell('COVENANT_INTERIM_OPERATING', ['all']).includes('dividendFact'));
  assert.ok(!fieldsForCompareCell('REPRESENTATION', ['all']).includes('taxMatterFact'));
});

test('the ratified tax-opinion covenant cannot absorb a condition-side tax opinion', () => {
  const candidate = entry('TAX_OPINION_COOPERATION_COVENANT');
  candidate.claim.attributes.condition_to_closing = true;
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [candidate] }),
    projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
  );
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry('TAX_OPINION_CLOSING_CONDITION')] }),
    projectionError('UNGOVERNED_CLAIM'),
  );
});

test('tax-sharing ambiguity and adjacent consideration and representation tax facts remain evidence-only', () => {
  for (const key of [
    'TAX_SHARING_AGREEMENT_TERMINATION',
    'TAX_SHARING_REPRESENTATION',
    'WITHHOLDING_RIGHT',
    'TAX_REPRESENTATION',
  ]) {
    assert.throws(
      () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('low-count dividend mechanics and IOC or consideration dividend facts remain evidence-only', () => {
  for (const key of [
    'PRE_CLOSING_SPECIAL_DIVIDEND',
    'PRE_CLOSING_SPECIAL_DIVIDEND_PER_SHARE_AMOUNT',
    'RECURRING_MANDATED_DIVIDEND',
    'DIVIDEND_COORDINATION_WINDOW_DAYS',
    'FINAL_PARTIAL_PERIOD_DIVIDEND',
    'IOC_DIVIDEND_RESTRICTION',
    'UNSURRENDERED_CERTIFICATE_DIVIDEND_TREATMENT',
  ]) {
    assert.throws(
      () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('appraisal statute enums and unadjudicated notice, modality and economics stay evidence-only', () => {
  const candidate = entry('APPRAISAL_SETTLEMENT_CONSENT');
  candidate.claim.attributes.statute_code = 'DGCL_262';
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [candidate] }),
    projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
  );
  for (const key of [
    'APPRAISAL_NOTICE_RIGHT',
    'APPRAISAL_INFORMATION_RIGHT',
    'APPRAISAL_MODALITY',
    'APPRAISAL_COST_ALLOCATION',
    'MAX_DISSENT_CLOSING_CONDITION',
    'APPRAISAL_RIGHTS_AVAILABLE',
  ]) {
    assert.throws(
      () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('product projection fails closed on wrong ownership, invalid values and duplicate claims', () => {
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry('APPRAISAL_SETTLEMENT_CONSENT', { entry: { concept_key: 'CONS-DISSENT' } })] }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [entry('TRANSFER_TAX_ALLOCATION', { claim: { canonical_value: 'COMPANY' } })] }),
    projectionError('INVALID_GOVERNED_CLAIM'),
  );
  const duplicate = entry('DIVIDEND_COORDINATION_COVENANT');
  assert.throws(
    () => projectTaxDividendsAppraisalClaims({ resolved_entries: [duplicate, structuredClone(duplicate)] }),
    projectionError('DUPLICATE_PRODUCT_CLAIM'),
  );
});
