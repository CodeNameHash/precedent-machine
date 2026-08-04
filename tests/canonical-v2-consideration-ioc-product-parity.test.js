'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AUTHORITY_STATE,
  ELECTION_MECHANISM_SCHEMA,
  EVIDENCE_SOURCE,
  projectConsiderationEvidenceProductSurfaces,
  projectIocEvidenceProductSurfaces,
} = require('../lib/canonical-v2/consideration-ioc-evidence-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { executeDealToMarket } = require('../lib/query/executors/deal-to-market');

function openWorld(surface, quote, structured_mechanic) {
  return {
    claim_definition_key: 'OPEN_WORLD_PROPOSITION',
    closure_id: `open:${surface}:${quote.length}`,
    section_reference: '2.9',
    raw_value: quote,
    attributes: {
      why_unmapped: `${surface}: retained as exact evidence`,
      structured_mechanic,
    },
  };
}

function fields(output, type) {
  return new Map(executeDealCompare({
    deal_ids: ['evidence-product'], provision_types: [type], included_field_groups: ['all'], highlight_deltas: false,
  }, {
    deals: [{ id: 'evidence-product', acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: output.cards,
  }).rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
}

test('Consideration evidence projection serves exact Review, side-table, Query, Compare and Market products without calculated allocation', () => {
  const cvr = 'Each Share shall receive one contractual contingent value right per share pursuant to the CVR Agreement.';
  const formula = 'a fraction, the numerator of which is the Maximum Equity Election Cap and the denominator of which is the aggregate number of Mixed Election Shares';
  const awards = 'Each outstanding Company Option shall be cancelled and converted into the right to receive the Merger Consideration.';
  const output = projectConsiderationEvidenceProductSurfaces({
    deal_id: 'evidence-product',
    resolution: { open_world: [
      openWorld('CVR', cvr, { surface: 'CVR' }),
      openWorld('PRORATION_FORMULA', formula, {
        surface: 'PRORATION_FORMULA', equity_cap: 'Maximum Equity Election Cap',
        proration_numerator: 'Maximum Equity Election Cap',
        proration_denominator: 'aggregate number of Mixed Election Shares',
      }),
      openWorld('EQUITY_AWARD_TREATMENT', awards, { surface: 'EQUITY_AWARD_TREATMENT' }),
    ] },
  });
  assert.equal(output.authority_state, AUTHORITY_STATE);
  assert.equal(output.cards.length, 3);
  assert.ok(output.cards.every((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE));
  assert.equal(JSON.stringify(output).includes('allocation'), false);
  assert.deepEqual(output.side_tables.map((row) => row.mechanism_surface).sort(), [
    'CVR', 'EQUITY_AWARD_TREATMENT', 'PRORATION_FORMULA',
  ]);
  assert.equal(output.side_tables.find((row) => row.mechanism_surface === 'EQUITY_AWARD_TREATMENT').exact_evidence, awards);
  const compare = fields(output, 'CONSIDERATION');
  assert.equal(compare.get('cvrPresent'), true);
  assert.equal(compare.get('prorationMechanics'), formula);
  assert.equal(compare.get('equityAwardTreatmentEvidence'), awards);
  const market = executeDealToMarket({ deal_id: 'evidence-product', provision_types: ['CONSIDERATION'] }, {
    deals: [{ id: 'evidence-product', acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: output.cards,
  });
  assert.equal(market.scorecard.find((item) => item.field_path === 'cvrPresent').deal_value, true);
  assert.equal(market.scorecard.find((item) => item.field_path === 'electionMechanicsPresent').deal_value, true);
  assert.equal(market.scorecard.find((item) => item.field_path === 'equityAwardTreatmentPresent').deal_value, true);
});

test('IOC evidence projection preserves long-tail mechanics, narrow attachments and all numeric literals without a new taxonomy', () => {
  const quote = 'The Company shall not make capital expenditures in excess of $25 million in the aggregate during the period ending December 31, 2027, except with Parent consent.';
  const output = projectIocEvidenceProductSurfaces({
    deal_id: 'evidence-product',
    resolution: { open_world: [openWorld('LONG_TAIL_RESTRICTION', quote, {
      surface: 'LONG_TAIL_RESTRICTION', attachment_scope: 'RESTRICTION_LIMB',
      value_literal: '$25 million', unit_literal: 'million', basis_literal: 'in the aggregate',
      period_literal: 'during the period ending December 31, 2027',
    })] },
  });
  assert.equal(output.cards.length, 1);
  assert.equal(output.cards[0].provision_subtype, 'OPEN-WORLD-EVIDENCE');
  assert.deepEqual(output.cards[0].features.iocEvidenceNumeric, {
    value_literal: '$25 million', unit_literal: 'million', basis_literal: 'in the aggregate',
    period_literal: 'during the period ending December 31, 2027',
  });
  assert.deepEqual(output.market[0], {
    metric_key: 'IOC_EVIDENCE_COMMONALITY_BY_SURFACE', value: 'LONG_TAIL_RESTRICTION',
    metric_version: 1, value_dimension: 'EXACT_EVIDENCE_SURFACE',
    canonical_value: 'LONG_TAIL_RESTRICTION', canonical_value_type: 'STRING',
    per_deal_rollup: 'DISTINCT_VALUE_SET', weighting: 'DEAL', evidence: quote,
  });
  assert.equal(fields(output, 'COVENANT_INTERIM_OPERATING').get('iocEvidenceMechanic'), quote);
  const market = executeDealToMarket({ deal_id: 'evidence-product', provision_types: ['COVENANT_INTERIM_OPERATING'] }, {
    deals: [{ id: 'evidence-product', acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: output.cards,
  });
  assert.equal(market.scorecard.find((item) => item.field_path === 'iocEvidenceMechanicPresent').deal_value, true);
});

test('governed election mechanisms retain only quoted choice, cash and stock alternatives, proration and exact evidence', () => {
  const quote = 'A holder may make either a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share. If no election is made, the holder shall be deemed to have made a Cash Election. The proration fraction has a numerator equal to the Maximum Equity Election Cap and a denominator equal to the aggregate number of Mixed Election Shares.';
  const output = projectConsiderationEvidenceProductSurfaces({
    deal_id: 'election-mechanism-product',
    resolution: { open_world: [openWorld('PRORATION_FORMULA', quote, {
      surface: 'PRORATION_FORMULA',
      election_choice: 'may make either a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share',
      cash_alternatives: ['Cash Election to receive $63.00 in cash'],
      stock_alternatives: ['Stock Election to receive one Parent Share'],
      default_treatment: 'shall be deemed to have made a Cash Election',
      equity_cap: 'Maximum Equity Election Cap',
      proration_numerator: 'numerator equal to the Maximum Equity Election Cap',
      proration_denominator: 'denominator equal to the aggregate number of Mixed Election Shares',
    })] },
  });
  assert.equal(output.election_mechanisms.length, 1);
  const [mechanism] = output.election_mechanisms;
  assert.equal(mechanism.schema_version, ELECTION_MECHANISM_SCHEMA);
  assert.equal(mechanism.exact_evidence, quote);
  assert.equal(mechanism.election_choice, 'may make either a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share');
  assert.deepEqual(mechanism.cash_alternatives, ['Cash Election to receive $63.00 in cash']);
  assert.deepEqual(mechanism.stock_alternatives, ['Stock Election to receive one Parent Share']);
  assert.equal(mechanism.default_treatment, 'shall be deemed to have made a Cash Election');
  assert.deepEqual(mechanism.proration, {
    equity_cap: 'Maximum Equity Election Cap',
    numerator: 'numerator equal to the Maximum Equity Election Cap',
    denominator: 'denominator equal to the aggregate number of Mixed Election Shares',
  });
  assert.equal(Object.hasOwn(mechanism.proration, 'cash_cap'), false);
});

test('hostile election fields outside the exact evidence are dropped and CVR never becomes an election mechanism', () => {
  const electionQuote = 'A holder may make a Cash Election.';
  const cvrQuote = 'Each Share shall receive one contractual contingent value right pursuant to the CVR Agreement.';
  const output = projectConsiderationEvidenceProductSurfaces({
    deal_id: 'hostile-election-mechanism-product',
    resolution: { open_world: [
      openWorld('ELECTION_ALTERNATIVE', electionQuote, {
        surface: 'ELECTION_ALTERNATIVE',
        election_choice: 'not in the source',
        cash_alternatives: ['not in the source'],
        stock_alternatives: ['not in the source'],
        default_treatment: 'not in the source',
        proration_numerator: 'not in the source',
      }),
      openWorld('CVR', cvrQuote, { surface: 'CVR' }),
    ] },
  });
  assert.equal(output.election_mechanisms.length, 1);
  const [mechanism] = output.election_mechanisms;
  assert.equal(mechanism.exact_evidence, electionQuote);
  for (const field of ['election_choice', 'alternatives', 'cash_alternatives', 'stock_alternatives', 'default_treatment', 'proration']) {
    assert.equal(Object.hasOwn(mechanism, field), false, field);
  }
  assert.equal(output.cards.find((card) => card.full_text === cvrQuote).features.cvrPresent, true);
});
