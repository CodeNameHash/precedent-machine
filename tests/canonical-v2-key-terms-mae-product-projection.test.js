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
  MAE_CARVEOUT: { section_reference: '1.1', defined_term_ref: 'Company Material Adverse Effect', definition_subject: 'the Company', carveout_code: 'PANDEMIC', clause_label: '(a)' },
  MAE_DEFINITION_PRONG: { section_reference: '1.1', defined_term_ref: 'Company Material Adverse Effect', definition_subject: 'the Company', prong_code: 'BUSINESS_EFFECTS' },
  MAE_DISPROPORTIONALITY_CARVEBACK: {
    section_reference: '1.1',
    defined_term_ref: 'Company Material Adverse Effect',
    definition_subject: 'the Company',
    carveback_source_form: 'TRAILING_LIST',
    applies_to_clause_labels: ['(a)'],
    comparison_baseline_phrase: 'other participants in the industry',
    limb_path: [],
  },
});

function resolvedEntry(key, overrides = {}) {
  const definition = KEY_TERM_CLAIMS[key] || MAE_CLAIMS[key];
  const keyTerm = Object.hasOwn(KEY_TERM_CLAIMS, key);
  const provisionId = `provision:${key}`;
  const party = { role: 'DEFINITION_SUBJECT', value: 'the Company', capacity: 'TARGET' };
  return {
    section_reference: '1.1',
    concept_key: definition.concept,
    resolved_claim_definition_key: key,
    provision_instance: {
      schema_version: keyTerm ? 'STRUCTURAL_PROVISION_INSTANCE/V1' : 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
      ...(keyTerm ? {} : { party }),
    },
    ...(keyTerm ? {} : { party }),
    claim: {
      claim_revision_id: `claim:${key}`,
      claim_definition_key: key,
      subject_occurrence_id: provisionId,
      state: 'PRESENT',
      canonical_value: VALUES[key],
      attributes: { ...ATTRIBUTES[key] },
      raw_value: key === 'MAE_DISPROPORTIONALITY_CARVEBACK'
        ? '(a) disproportionately affected relative to other participants in the industry'
        : `exact evidence for ${key}`,
    },
    ...overrides,
  };
}

test('all governed Key Defined Terms and MAE claims reach Review, Query, Compare and market records', () => {
  const entries = [...Object.keys(KEY_TERM_CLAIMS), ...Object.keys(MAE_CLAIMS)].map(resolvedEntry);
  for (const entry of entries.filter(({ concept_key: conceptKey }) => conceptKey === 'DEF-MAE')) {
    entry.provision_instance.provision_instance_id = 'provision:mae-all-governed';
    entry.claim.subject_occurrence_id = 'provision:mae-all-governed';
  }
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

test('MAE trailing-list disproportionality publishes its governed covered-limb relationship', () => {
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: [
      maeEntry('MAE_CARVEOUT', { id: 'target-a', attributes: { limb_path: ['carveouts', '(a)'] } }),
      maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', { id: 'relationship-a' }),
    ],
  });
  const record = projection.records.find(({ review }) => review.row_key === 'MAE_DISPROPORTIONALITY_CARVEBACK');
  assert.deepEqual(record.query.value.dimensions, {
    relationship_state: 'GOVERNED_CLAUSE_LABEL_RELATIONSHIP',
    carveback_source_form: 'TRAILING_LIST',
    covered_limb_labels: ['(a)'],
    comparison_baseline_phrase: 'other participants in the industry',
    incremental_impact_phrase: null,
    limb_path: [],
  });
  assert.equal(record.review.source_form, 'TRAILING_LIST');
  assert.match(record.review.evidence.exact_quote, /other participants in the industry/);
  assert.equal(record.market.metric_key, 'MAE_DISPROPORTIONALITY_CARVEBACK_PRESENCE');
});

function maeEntry(key, {
  id, provisionId = 'provision:mae-rollup', canonicalValue = VALUES[key], attributes = {}, rawValue,
}) {
  const entry = resolvedEntry(key);
  entry.provision_instance.provision_instance_id = provisionId;
  entry.claim.subject_occurrence_id = provisionId;
  entry.claim.claim_revision_id = `claim:${id}`;
  entry.claim.canonical_value = canonicalValue;
  entry.claim.attributes = { ...ATTRIBUTES[key], ...attributes };
  entry.claim.raw_value = rawValue || entry.claim.raw_value;
  return entry;
}

test('per-limb and trailing-list sources union by full limb identity, preserve claim edges, and never duplicate a two-code limb', () => {
  const localQuote = '(a) changes, except to the extent they disproportionately affect the Company relative to peer companies';
  const trailingQuote = 'in the case of clauses (a) and (k), except to the extent such matters disproportionately affect the Company relative to peer companies';
  const entries = [
    maeEntry('MAE_CARVEOUT', { id: 'natural', canonicalValue: 'NATURAL_DISASTERS', attributes: { carveout_code: 'NATURAL_DISASTERS', clause_label: '(a)', limb_path: ['carveouts', '(a)'] } }),
    maeEntry('MAE_CARVEOUT', { id: 'pandemic', canonicalValue: 'PANDEMIC', attributes: { carveout_code: 'PANDEMIC', clause_label: '(a)', limb_path: ['carveouts', '(a)'] } }),
    maeEntry('MAE_CARVEOUT', { id: 'gaap', canonicalValue: 'CHANGE_IN_GAAP', attributes: { carveout_code: 'CHANGE_IN_GAAP', clause_label: '(b)', limb_path: ['carveouts', '(b)'] } }),
    maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', {
      id: 'per-limb',
      attributes: {
        carveback_source_form: 'PER_LIMB', applies_to_clause_labels: ['(a)'],
        comparison_baseline_phrase: 'peer companies', limb_path: ['carveouts', '(a)'],
      },
      rawValue: localQuote,
    }),
    maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', {
      id: 'trailing',
      attributes: {
        carveback_source_form: 'TRAILING_LIST', applies_to_clause_labels: ['(a)', '(k)'],
        comparison_baseline_phrase: 'peer companies', limb_path: [],
      },
      rawValue: trailingQuote,
    }),
  ];
  const cyberQuote = '(k) cybersecurity events and data-security incidents';
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: entries,
    open_world_entries: [{
      closure_id: 'open-world-cyber-k',
      section_reference: '1.1',
      raw_value: cyberQuote,
      reason: 'NATIVE_OPEN_WORLD_PROPOSAL',
      attributes: { defined_term_ref: 'Company Material Adverse Effect' },
    }],
  });
  const [rollup] = projection.mae_disproportionality_rollups;
  assert.equal(rollup.covered_limbs.filter(({ clause_label: label }) => label === '(a)').length, 1);
  const a = rollup.limbs.find(({ clause_label: label }) => label === '(a)');
  assert.deepEqual(a.carveout_codes, ['NATURAL_DISASTERS', 'PANDEMIC']);
  assert.deepEqual(a.source_forms, ['PER_LIMB', 'TRAILING_LIST']);
  assert.equal(a.sources.length, 2);
  assert.equal(a.relationship_edges.length, 4);
  assert.ok(a.relationship_edges.every(({ exact_disproportionality_quote: quote }) => /disproportionately/.test(quote)));
  const b = rollup.limbs.find(({ clause_label: label }) => label === '(b)');
  assert.equal(b.hasDisproportionateImpactCarveback, 'NOT_ESTABLISHED');
  assert.equal(b.relationship_state, 'NOT_ESTABLISHED');
  const k = rollup.limbs.find(({ clause_label: label }) => label === '(k)');
  assert.equal(k.relationship_state, 'OPEN_WORLD_LIMB_RELATIONSHIP');
  assert.deepEqual(k.carveout_claim_revision_ids, []);
  assert.deepEqual(k.open_world_evidence.map(({ exact_open_world_quote: quote }) => quote), [cyberQuote]);
  assert.deepEqual(rollup.query, rollup.compare);
});

test('a duplicate trailing-list label with two full limb paths routes to relationship review and never guesses', () => {
  const quote = 'clauses (a) disproportionately affect the Company relative to peers';
  const entries = [
    maeEntry('MAE_CARVEOUT', { id: 'outer-a', canonicalValue: 'ECONOMY_GENERAL', attributes: { carveout_code: 'ECONOMY_GENERAL', clause_label: '(a)', limb_path: ['outer', '(a)'] } }),
    maeEntry('MAE_CARVEOUT', { id: 'inner-a', canonicalValue: 'INDUSTRY_GENERAL', attributes: { carveout_code: 'INDUSTRY_GENERAL', clause_label: '(a)', limb_path: ['inner', '(a)'] } }),
    maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', {
      id: 'ambiguous',
      attributes: { carveback_source_form: 'TRAILING_LIST', applies_to_clause_labels: ['(a)'], comparison_baseline_phrase: 'peers', limb_path: [] },
      rawValue: quote,
    }),
  ];
  const [rollup] = projectKeyTermsMaeClaims({ resolved_entries: entries }).mae_disproportionality_rollups;
  assert.equal(rollup.relationship_review_items.length, 1);
  assert.equal(rollup.relationship_review_items[0].reason, 'AMBIGUOUS_DUPLICATE_CLAUSE_LABEL');
  assert.ok(rollup.limbs.every(({ relationship_state: state }) => state === 'NOT_ESTABLISHED'));
  assert.equal(rollup.query.value.dimensions.relationship_state, 'REVIEW_REQUIRED');
});

test('tampered MAE relationship baseline fails closed at product projection', () => {
  const entry = maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', {
    id: 'tampered',
    attributes: { carveback_source_form: 'TRAILING_LIST', applies_to_clause_labels: ['(a)'], comparison_baseline_phrase: 'invented peers', limb_path: [] },
    rawValue: '(a) disproportionately affects the Company relative to real peers',
  });
  assert.throws(
    () => projectKeyTermsMaeClaims({ resolved_entries: [
      maeEntry('MAE_CARVEOUT', { id: 'target-a', attributes: { limb_path: ['carveouts', '(a)'] } }),
      entry,
    ] }),
    (error) => error instanceof KeyTermsMaeProductProjectionError
      && error.code === 'INVALID_GOVERNED_ATTRIBUTES',
  );
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
