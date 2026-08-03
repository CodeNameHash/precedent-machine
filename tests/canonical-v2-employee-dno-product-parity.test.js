'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EVIDENCE_SOURCE,
  projectEmployeeDnoProductSurfaces,
} = require('../lib/canonical-v2/employee-dno-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const {
  MATERIALITY_TABLE,
  materialityFor,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const DEAL_ID = 'employee-dno-product-deal';

function resolvedEntry({ definition, concept, provision, quote, value = true, attributes = {} }) {
  return {
    resolved_claim_definition_key: definition,
    concept_key: concept,
    section_reference: concept === 'COV-EMPLOYEE' ? '6.8' : '6.9',
    provision_instance: { provision_instance_id: provision },
    claim: {
      claim_revision_id: `${provision}:${definition}`,
      raw_value: quote,
      canonical_value: value,
      attributes,
    },
  };
}

function fixture() {
  const employeeQuote = 'For twelve months after Closing, base salary shall be no less favourable and prior service shall be credited.';
  const dnoQuote = 'For six years after Closing, Parent shall maintain D&O tail insurance at a premium not exceeding 300% and advance expenses.';
  const resolution = {
    resolved: [
      resolvedEntry({
        definition: 'EMPLOYEE_COMP_ITEM_STANDARD', concept: 'COV-EMPLOYEE', provision: 'employee-provision', quote: employeeQuote,
        attributes: { comp_item: 'BASE_SALARY', standard_kind: 'NO_LESS_FAVORABLE', aggregation: 'ITEM_BY_ITEM', benchmark: 'TARGET_PRE_CLOSING' },
      }),
      resolvedEntry({ definition: 'BENEFITS_CONTINUATION_PERIOD_MONTHS', concept: 'COV-EMPLOYEE', provision: 'employee-provision', quote: employeeQuote, value: '12' }),
      resolvedEntry({ definition: 'EMPLOYEE_SERVICE_CREDIT', concept: 'COV-EMPLOYEE', provision: 'employee-provision', quote: employeeQuote }),
      resolvedEntry({ definition: 'WELFARE_PLAN_TRANSITION_RELIEF', concept: 'COV-EMPLOYEE', provision: 'employee-provision', quote: employeeQuote, attributes: { relief_kind: 'PREEXISTING_AND_WAITING_WAIVER' } }),
      resolvedEntry({ definition: 'INDEMNIFICATION_CONTINUATION', concept: 'DNO-INDEM', provision: 'dno-provision', quote: dnoQuote }),
      resolvedEntry({ definition: 'ADVANCEMENT_OF_EXPENSES', concept: 'DNO-INDEM', provision: 'dno-provision', quote: dnoQuote }),
      resolvedEntry({ definition: 'INDEMNIFICATION_SURVIVAL_YEARS', concept: 'DNO-INDEM', provision: 'dno-provision', quote: dnoQuote, value: '6' }),
      resolvedEntry({ definition: 'TAIL_POLICY_OBLIGATION', concept: 'DNO-TAIL', provision: 'dno-provision', quote: dnoQuote }),
      resolvedEntry({ definition: 'TAIL_POLICY_PERIOD_YEARS', concept: 'DNO-TAIL', provision: 'dno-provision', quote: dnoQuote, value: '6' }),
      resolvedEntry({ definition: 'TAIL_PREMIUM_CAP_PERCENT', concept: 'DNO-TAIL', provision: 'dno-provision', quote: dnoQuote, value: '300', attributes: { cap_basis_ref: 'current annual premium' } }),
      resolvedEntry({ definition: 'COVERED_PERSON_TPB_RIGHTS', concept: 'DNO-BENEF', provision: 'dno-provision', quote: dnoQuote }),
    ],
    open_world: [
      {
        closure_id: 'employee-open', section_reference: '6.8', claim_definition_key: 'OPEN_WORLD_PROPOSITION',
        reason: 'UNMAPPED_GENERIC_CLAIM_KEY', raw_value: 'The Company shall terminate its 401(k) plan before Closing.', canonical_value: null,
        attributes: { why_unmapped: 'RETIREMENT_401K: plan termination mechanics', nearest_concept: null }, evidence: [],
      },
      {
        closure_id: 'dno-open', section_reference: '6.9', claim_definition_key: 'OPEN_WORLD_PROPOSITION',
        reason: 'UNMAPPED_GENERIC_CLAIM_KEY', raw_value: 'Expenses shall be advanced within ten days after receipt of an undertaking.', canonical_value: null,
        attributes: { why_unmapped: 'ADVANCEMENT_TIMING: timing mechanic', nearest_concept: null }, evidence: [],
      },
    ],
  };
  return { employeeQuote, dnoQuote, projection: projectEmployeeDnoProductSurfaces({ resolution, deal_id: DEAL_ID }) };
}

test('D&O claims use Ben-ratified materiality rank 85', () => {
  const tier = MATERIALITY_TABLE.find((entry) => entry.label === 'DNO_INDEMNIFICATION');
  assert.deepEqual(tier, {
    rank: 85,
    label: 'DNO_INDEMNIFICATION',
    concept_key_prefixes: ['DNO-'],
  });
  assert.deepEqual(
    materialityFor({ conceptKey: 'DNO-INDEM', claimDefinitionKey: 'INDEMNIFICATION_CONTINUATION' }),
    tier,
  );
});

test('governed Employee Matters and D&O claims project to product cards without promoting held-open mechanics', () => {
  const { projection } = fixture();
  const employee = projection.cards.find((card) => card.id === 'employee-provision');
  const dno = projection.cards.find((card) => card.id === 'dno-provision');
  assert.equal(employee.features.protectionPeriodMonths, 12);
  assert.equal(employee.features.continuedService, true);
  assert.equal(employee.features.eligibilityWaiver, true);
  assert.equal(employee.features.compensationItems[0].standard_code, 'NO_LESS_FAVORABLE');
  assert.equal(dno.features.doInsurance, true);
  assert.equal(dno.features.insurancePeriod, 6);
  assert.equal(dno.features.insuranceCap, '300%');
  assert.equal(dno.features.advancementOfExpenses, true);
  const evidenceCards = projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.equal(evidenceCards.length, 2);
  assert.ok(evidenceCards.every((card) => Object.keys(card.features).length === 0));
  assert.equal(projection.claims.some((claim) => /401\(k\)|within ten days/.test(claim.verbatim)), false);
});

test('Employee Matters and D&O cards reach Review, Query, Compare and market statistics', async () => {
  const { projection } = fixture();
  const employeeConfig = await import('../components/review/table-configs/employee-benefits.config.js');
  const employeeRows = employeeConfig.employeeBenefitsConfig.selectRows({ cards: projection.cards });
  assert.ok(employeeRows.some((row) => row.id === 'employee-benefits-BASE_SALARY'));
  assert.ok(employeeRows.some((row) => row.id === 'employee-benefits-continuedService'));
  const employeeEvidence = employeeRows.find((row) => row.marketState === 'OPEN_NATIVE_FIELD');
  assert.ok(employeeEvidence);

  const generalConfig = await import('../components/review/table-configs/general-covenants.config.js');
  const dnoRows = generalConfig.generalCovenantsConfig.selectRows({ cards: projection.cards });
  const dnoRow = dnoRows.find((row) => row.id === 'general-covenants-insurance');
  assert.ok(dnoRow);
  assert.equal(dnoRow.marketSubterms.some((subterm) => subterm.key === 'insurance-cap'), true);
  const dnoEvidence = dnoRows.find((row) => row.marketState === 'OPEN_NATIVE_FIELD');
  assert.ok(dnoEvidence);

  const compare = executeDealCompare({
    deal_ids: [DEAL_ID], provision_types: ['COVENANT_OTHER'], included_field_groups: ['all'], highlight_deltas: false,
  }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards.filter((card) => card.id === 'employee-provision'),
  });
  const fields = new Map(compare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(fields.get('protectionPeriodMonths'), 12);
  assert.equal(fields.get('continuedService'), true);
  assert.ok(fields.get('compensationItems'));
  const dnoCompare = executeDealCompare({
    deal_ids: [DEAL_ID], provision_types: ['COVENANT_OTHER'], included_field_groups: ['all'], highlight_deltas: false,
  }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards.filter((card) => card.id === 'dno-provision'),
  });
  const dnoFields = new Map(dnoCompare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(dnoFields.get('insuranceCap'), '300%');
  assert.equal(dnoFields.get('advancementOfExpenses'), true);
  assert.equal(dnoFields.get('indemnificationPeriod'), 6);

  const adapter = await import('../lib/market-metrics/adapter.js');
  assert.equal(adapter.resolveMarketMetricRow(employeeEvidence, { configId: 'employee-benefits' }).resolution, 'evidence_only');
  assert.equal(adapter.resolveMarketMetricRow(dnoEvidence, { configId: 'general-covenants' }).resolution, 'evidence_only');
  const specs = [
    ...employeeRows.filter((row) => row.marketPresence || row.marketSubterms).flatMap((row) => adapter.resolveMarketMetricSpecs(row, { configId: 'employee-benefits' })),
    ...dnoRows.filter((row) => row.marketPresence || row.marketSubterms).flatMap((row) => adapter.resolveMarketMetricSpecs(row, { configId: 'general-covenants' })),
  ];
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', value_usd: 1000000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow).flatMap((row) => Object.values(row.metrics)).some((result) => result.coverage?.observedCount === 1));
});
