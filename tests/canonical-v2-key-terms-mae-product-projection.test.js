'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  KEY_TERM_CLAIMS,
  MAE_CLAIMS,
  KeyTermsMaeProductProjectionError,
  projectKeyTermsMaeClaims,
} = require('../lib/canonical-v2/key-terms-mae-product-projection');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');

const VALUES = Object.freeze({
  ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: '20',
  SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: '50',
  DEFINED_TERM_THRESHOLD_SUBSTITUTION: '50',
  SUPERIOR_PROPOSAL_QUALIFIER: 'FINANCIAL_FAVORABILITY',
  INTERVENING_EVENT_DEFINITION: true,
  INTERVENING_EVENT_EXCLUSION: 'STOCK_PRICE_CHANGE',
  KNOWLEDGE_STANDARD: 'ACTUAL',
  KNOWLEDGE_PERSON_SOURCE: 'NAMED_INDIVIDUALS',
  WILLFUL_BREACH_DEFINITION: true,
  WILLFUL_BREACH_KNOWLEDGE_STANDARD: 'ACTUAL_OR_CONSTRUCTIVE',
  TAX_DEFINITION_RECORDED: true,
  TAX_RETURN_DEFINITION_RECORDED: true,
  MADE_AVAILABLE_DEFINITION_RECORDED: true,
  ORDINARY_COURSE_DEFINITION_RECORDED: true,
  MAE_CARVEOUT: 'PANDEMIC',
  MAE_DEFINITION_PRONG: 'BUSINESS_EFFECTS',
  MAE_DISPROPORTIONALITY_CARVEBACK: true,
});

const ATTRIBUTES = Object.freeze({
  ACQUISITION_PROPOSAL_THRESHOLD_PERCENT: { proposal_term_ref: 'Acquisition Proposal', threshold_basis: 'EQUITY_SECURITIES' },
  SUPERIOR_PROPOSAL_THRESHOLD_PERCENT: { superior_term_ref: 'Superior Proposal', threshold_basis: 'ASSETS' },
  DEFINED_TERM_THRESHOLD_SUBSTITUTION: { substitution_from_percent: '20', substituted_term_ref: 'Acquisition Proposal', host_term_ref: 'Superior Proposal' },
  SUPERIOR_PROPOSAL_QUALIFIER: { superior_term_ref: 'Superior Proposal', qualifier_code: 'FINANCIAL_FAVORABILITY' },
  INTERVENING_EVENT_DEFINITION: { event_term_ref: 'Intervening Event' },
  INTERVENING_EVENT_EXCLUSION: { event_term_ref: 'Intervening Event', exclusion_code: 'STOCK_PRICE_CHANGE' },
  KNOWLEDGE_STANDARD: { knowledge_term_ref: 'Knowledge', standard_code: 'ACTUAL' },
  KNOWLEDGE_PERSON_SOURCE: { knowledge_term_ref: 'Knowledge', source_code: 'NAMED_INDIVIDUALS', named_persons: ['Jane Doe'] },
  WILLFUL_BREACH_DEFINITION: { breach_term_ref: 'Willful Breach' },
  WILLFUL_BREACH_KNOWLEDGE_STANDARD: { breach_term_ref: 'Willful Breach', standard_code: 'ACTUAL_OR_CONSTRUCTIVE' },
  TAX_DEFINITION_RECORDED: {
    defined_term_identity: 'tax', definition_equivalence: 'NOT_ASSERTED',
    definition_envelope: { defined_term: 'Tax', definition_kind: 'TERM_DEFINITION', definition_head_quote: '"Tax" means', definition_body_quote: '"Tax" means any tax.', cross_reference_target: null },
  },
  TAX_RETURN_DEFINITION_RECORDED: {
    defined_term_identity: 'tax return', definition_equivalence: 'NOT_ASSERTED',
    definition_envelope: { defined_term: 'Tax Return', definition_kind: 'TERM_DEFINITION', definition_head_quote: '"Tax Return" means', definition_body_quote: '"Tax Return" means any return required by Law.', cross_reference_target: null },
  },
  MADE_AVAILABLE_DEFINITION_RECORDED: {
    defined_term_identity: 'made available', definition_equivalence: 'NOT_ASSERTED',
    definition_envelope: { defined_term: 'Made Available', definition_kind: 'TERM_DEFINITION', definition_head_quote: '"Made Available" means', definition_body_quote: '"Made Available" means provided before signing.', cross_reference_target: null },
  },
  ORDINARY_COURSE_DEFINITION_RECORDED: {
    defined_term_identity: 'ordinary course', definition_equivalence: 'NOT_ASSERTED',
    definition_envelope: { defined_term: 'Ordinary Course', definition_kind: 'TERM_DEFINITION', definition_head_quote: '"Ordinary Course" means', definition_body_quote: '"Ordinary Course" means the ordinary course of business.', cross_reference_target: null },
  },
  MAE_CARVEOUT: { defined_term_ref: 'Company Material Adverse Effect', carveout_code: 'PANDEMIC', clause_label: '(a)' },
  MAE_DEFINITION_PRONG: { defined_term_ref: 'Company Material Adverse Effect', prong_code: 'BUSINESS_EFFECTS' },
  MAE_DISPROPORTIONALITY_CARVEBACK: { defined_term_ref: 'Company Material Adverse Effect', applies_to_clause_labels: ['(a)', '(b)'], comparison_baseline_phrase: 'other participants in the industry' },
});

function resolvedEntry(key, overrides = {}) {
  const definition = KEY_TERM_CLAIMS[key] || MAE_CLAIMS[key];
  const keyTerm = Object.hasOwn(KEY_TERM_CLAIMS, key);
  const provisionId = `provision:${key}`;
  return {
    section_reference: '1.1',
    concept_key: definition.concept,
    resolved_claim_definition_key: key,
    provision_instance: {
      schema_version: keyTerm ? 'STRUCTURAL_PROVISION_INSTANCE/V1' : 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
    },
    claim: {
      claim_revision_id: `claim:${key}`,
      claim_definition_key: key,
      subject_occurrence_id: provisionId,
      state: 'PRESENT',
      canonical_value: VALUES[key],
      attributes: { ...ATTRIBUTES[key] },
    },
    ...overrides,
  };
}

test('all governed Key Defined Terms and MAE claims reach Review, Query, Compare and market records', () => {
  const entries = [...Object.keys(KEY_TERM_CLAIMS), ...Object.keys(MAE_CLAIMS)].map(resolvedEntry);
  const projection = projectKeyTermsMaeClaims({ resolved_entries: entries });
  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(projection.records.length, 17);
  for (const record of projection.records) {
    assert.equal(record.review.row_key, record.query.value.claim_definition_key);
    assert.deepEqual(record.compare, record.query);
    assert.equal(record.market.metric_version, 1);
    if (KEY_TERM_CLAIMS[record.review.row_key]?.value_kind === 'RECORDED_DEFINITION') {
      assert.equal(record.market.market_statistics, 'NOT_CALCULATED');
      assert.equal(Object.hasOwn(record.market, 'weighting'), false);
    } else {
      assert.equal(record.market.weighting, 'DEAL');
    }
  }
  assert.deepEqual(
    new Set(projection.records.map((record) => record.owner_family)),
    new Set(['KEY_DEFINED_TERMS', 'MAE_DEFINITION']),
  );
  assert.deepEqual(fieldsForCompareCell('DEFINITION').slice(0, 2), ['definedTermFact', 'maeDefinitionFact']);
});

test('the four later definition records preserve exact envelopes without comparable market output', () => {
  const keys = [
    'TAX_DEFINITION_RECORDED', 'TAX_RETURN_DEFINITION_RECORDED',
    'MADE_AVAILABLE_DEFINITION_RECORDED', 'ORDINARY_COURSE_DEFINITION_RECORDED',
  ];
  const projection = projectKeyTermsMaeClaims({ resolved_entries: keys.map(resolvedEntry) });
  assert.deepEqual(projection.records.map((record) => record.review.row_key).sort(), [...keys].sort());
  for (const record of projection.records) {
    assert.equal(record.market.market_statistics, 'NOT_CALCULATED');
    assert.equal(record.query.value.definition_equivalence, 'NOT_ASSERTED');
    assert.equal(record.review.exact_definition.definition_body_quote, ATTRIBUTES[record.review.row_key].definition_envelope.definition_body_quote);
  }
});

test('threshold substitution is visible as a raw rule but never becomes an effective threshold statistic', () => {
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: [resolvedEntry('DEFINED_TERM_THRESHOLD_SUBSTITUTION')],
  });
  const [record] = projection.records;
  assert.equal(record.query.value.canonical_value, '50');
  assert.equal(record.query.value.dimensions.substitution_from_percent, '20');
  assert.equal(record.query.value.dimensions.relationship_state, 'OPEN_WORLD_UNADJUDICATED');
  assert.equal(record.market.metric_key, 'KEY_DEFINED_TERM_SUBSTITUTION_RULE_PRESENCE');
  assert.equal(record.market.canonical_value, true);
  assert.notEqual(record.market.value_dimension, 'PERCENT');
});

test('MAE disproportionality stays provision-level and does not publish a per-clause relationship', () => {
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: [resolvedEntry('MAE_DISPROPORTIONALITY_CARVEBACK')],
  });
  const [record] = projection.records;
  assert.deepEqual(record.query.value.dimensions, {
    relationship_state: 'OPEN_WORLD_UNADJUDICATED',
  });
  assert.doesNotMatch(JSON.stringify(record), /applies_to_clause_labels|comparison_baseline_phrase/);
  assert.equal(record.market.metric_key, 'MAE_DISPROPORTIONALITY_CARVEBACK_PRESENCE');
});

test('no-shop, closing-condition and derived relationship claims fail closed', () => {
  for (const claimDefinitionKey of ['NO_SHOP_NOTICE_PERIOD_DAYS', 'NO_MAE_CONDITION_CONTINUING']) {
    assert.throws(
      () => projectKeyTermsMaeClaims({ resolved_entries: [{
        resolved_claim_definition_key: claimDefinitionKey,
        claim: { claim_definition_key: claimDefinitionKey },
      }] }),
      (error) => error instanceof KeyTermsMaeProductProjectionError
        && error.code === 'UNGOVERNED_CLAIM',
    );
  }
  const relationship = resolvedEntry('DEFINED_TERM_THRESHOLD_SUBSTITUTION');
  relationship.claim.attributes.effective_threshold_percent = '50';
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: [relationship] }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'UNADJUDICATED_RELATIONSHIP',
  );
});
