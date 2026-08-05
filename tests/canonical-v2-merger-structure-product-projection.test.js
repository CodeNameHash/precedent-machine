'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUTHORITY_STATE,
  STRUCTURE_CLAIMS,
  TRANSACTION_STEPS_BOUNDARY,
  MergerStructureProductProjectionError,
  projectMergerStructureClaims,
} = require('../lib/canonical-v2/merger-structure-product-projection');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

const CLAIM_FIXTURES = Object.freeze({
  MERGER_SURVIVOR: Object.freeze({ value: 'TARGET_SURVIVES', attributes: Object.freeze({}) }),
  CLOSING_TIMING_FORMULA: Object.freeze({
    value: true, attributes: Object.freeze({ timing_anchor: 'CONDITIONS_SATISFACTION' }),
  }),
  CLOSING_TIMING_BUSINESS_DAY_COUNT: Object.freeze({
    value: '2', attributes: Object.freeze({ timing_anchor: 'CONDITIONS_SATISFACTION' }),
  }),
  EFFECTIVE_TIME_FILING: Object.freeze({
    value: true,
    attributes: Object.freeze({ filing_instrument_ref: 'certificate of merger', effective_time_term_ref: 'Effective Time' }),
  }),
  SURVIVING_CHARTER_PROVISION: Object.freeze({
    value: true, attributes: Object.freeze({ instrument_ref: 'certificate of incorporation' }),
  }),
});

function entry(key, overrides = {}) {
  const definition = STRUCTURE_CLAIMS[key];
  const fixture = CLAIM_FIXTURES[key] || { value: true, attributes: {} };
  const suffix = overrides.suffix || key.toLowerCase();
  const provisionId = `provision-${suffix}`;
  return {
    resolved_claim_definition_key: key,
    concept_key: definition?.concept || overrides.concept_key || 'STRUCT-MERGER',
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
  return (error) => error instanceof MergerStructureProductProjectionError && error.code === code;
}

test('all governed structure claims reach Review, Query, Compare and market statistics', () => {
  const keys = Object.keys(STRUCTURE_CLAIMS);
  const projection = projectMergerStructureClaims({ resolved_entries: keys.map((key) => entry(key)) });
  assert.equal(projection.authority_state, AUTHORITY_STATE);
  assert.equal(projection.transaction_steps_boundary, TRANSACTION_STEPS_BOUNDARY);
  assert.equal(projection.records.length, 5);
  const byKey = new Map(projection.records.map((record) => [record.review.row_key, record]));
  for (const key of keys) {
    const record = byKey.get(key);
    assert.ok(record, key);
    assert.equal(record.review.value, CLAIM_FIXTURES[key].value);
    assert.deepEqual(record.query, record.compare);
    assert.equal(record.compare.field_key, 'structureMechanicFact');
    assert.equal(record.market.metric_version, 1);
    assert.equal(record.market.weighting, 'DEAL');
    assert.equal(record.transaction_steps_boundary, TRANSACTION_STEPS_BOUNDARY);
  }
  assert.equal(byKey.get('CLOSING_TIMING_BUSINESS_DAY_COUNT').market.canonical_unit, 'BUSINESS_DAYS');
  assert.equal(byKey.get('EFFECTIVE_TIME_FILING').review.dimensions.relationship_state, 'QUOTE_LOCAL_ONLY');
});

test('Query and Compare expose governed structure facts without taking conditions or consideration fields', () => {
  const structureFields = fieldsForCompareCell('STRUCTURE_MECHANICS', ['all']);
  assert.ok(structureFields.includes('structureMechanicFact'));
  assert.ok(structureFields.includes('dealStructure'));
  assert.ok(!structureFields.includes('considerationType'));
  assert.ok(!structureFields.includes('mainCondition'));
  assert.ok(!fieldsForCompareCell('CONSIDERATION', ['all']).includes('structureMechanicFact'));
  assert.ok(!fieldsForCompareCell('CLOSING_CONDITION', ['all']).includes('structureMechanicFact'));
});

test('transaction_steps remains a distinct source and cannot be projected or overwritten', () => {
  const root = path.resolve(__dirname, '..');
  const apiSource = fs.readFileSync(path.join(root, 'pages/api/provisions.js'), 'utf8');
  const projectorSource = fs.readFileSync(path.join(root, 'lib/canonical-v2/merger-structure-product-projection.js'), 'utf8');
  assert.match(apiSource, /transaction_steps/);
  assert.doesNotMatch(projectorSource, /pages\/api\/provisions|transaction_steps\s*:/);
  const candidate = entry('MERGER_SURVIVOR');
  candidate.claim.attributes.transaction_steps = [{ step: 1 }];
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [candidate] }),
    projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
  );
});

test('low-count offer mechanics and offer-anchored closing formulas remain evidence-only', () => {
  for (const key of [
    'SECTION_251H_GOVERNED',
    'OFFER_INITIAL_EXPIRATION_BUSINESS_DAYS',
    'OFFER_EXTENSION_INCREMENT_MAX_BUSINESS_DAYS',
    'OFFER_COMMENCEMENT_BUSINESS_DAYS',
    'TOP_UP_OPTION',
  ]) {
    assert.throws(
      () => projectMergerStructureClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
  const candidate = entry('CLOSING_TIMING_FORMULA');
  candidate.claim.attributes.timing_anchor = 'OFFER_CONSUMMATION';
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [candidate] }),
    projectionError('INVALID_GOVERNED_ATTRIBUTES'),
  );
});

test('consideration, conditions and termination mechanics remain with their owners', () => {
  for (const key of [
    'MERGER_CONSIDERATION_AMOUNT',
    'OFFER_PRICE',
    'CONTINGENT_VALUE_RIGHT',
    'CLOSING_CONDITION',
    'OFFER_MINIMUM_CONDITION',
    'TERMINATION_RIGHT_GRANT',
    'OUTSIDE_DATE',
  ]) {
    assert.throws(
      () => projectMergerStructureClaims({ resolved_entries: [entry(key, { suffix: key.toLowerCase() })] }),
      projectionError('UNGOVERNED_CLAIM'),
    );
  }
});

test('unadjudicated structural relationships remain evidence-only', () => {
  for (const [key, attribute, value] of [
    ['MERGER_SURVIVOR', 'surviving_entity_ref', 'the Company'],
    ['EFFECTIVE_TIME_FILING', 'filing_sequence', 1],
    ['EFFECTIVE_TIME_FILING', 'precedes_effective_time_ref', 'Second Effective Time'],
    ['SURVIVING_CHARTER_PROVISION', 'applies_to_survivor_ref', 'the Surviving Corporation'],
  ]) {
    const candidate = entry(key, { suffix: `${key}-${attribute}`.toLowerCase() });
    candidate.claim.attributes[attribute] = value;
    assert.throws(
      () => projectMergerStructureClaims({ resolved_entries: [candidate] }),
      projectionError('UNADJUDICATED_PRODUCT_ATTRIBUTE'),
    );
  }
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [entry('DEAL_STRUCTURE')] }),
    projectionError('UNGOVERNED_CLAIM'),
  );
});

test('product projection fails closed on wrong ownership, invalid values and duplicate claims', () => {
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [entry('MERGER_SURVIVOR', { entry: { concept_key: 'CONS-CASH' } })] }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [entry('CLOSING_TIMING_BUSINESS_DAY_COUNT', { claim: { canonical_value: '-2' } })] }),
    projectionError('INVALID_GOVERNED_CLAIM'),
  );
  const duplicate = entry('SURVIVING_CHARTER_PROVISION');
  assert.throws(
    () => projectMergerStructureClaims({ resolved_entries: [duplicate, structuredClone(duplicate)] }),
    projectionError('DUPLICATE_PRODUCT_CLAIM'),
  );
});
