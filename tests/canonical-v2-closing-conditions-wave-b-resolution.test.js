'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV24 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeClosingConditionProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, MAPPING_TABLE_VERSION } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectClosingConditionProductSurfaces } = require('../lib/canonical-v2/closing-conditions-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const SECTION_REFERENCE = '7.2';
const QUOTES = Object.freeze({
  stockholder: 'The Company Stockholder Approval shall have been obtained by the requisite affirmative vote of the stockholders.',
  legal: 'No order or injunction shall be in effect that prohibits, enjoins or makes illegal the consummation of the Merger.',
  government: 'No Governmental Authority shall have commenced a regulatory proceeding seeking to prevent the Merger.',
  s4: 'The Form S-4 shall have been declared effective by the SEC and no stop order shall be in effect and no proceedings for such purpose shall be pending or threatened by the SEC.',
  listing: 'The shares of Parent Common Stock shall have been authorized for listing on the NYSE, upon official notice of issuance.',
  funds: 'PubCo shall have cash equal to, or greater than, $3,800,002.59.',
  certificate: 'The Company shall have delivered to Parent a certificate certifying that the conditions set forth in Sections 7.2(a), 7.2(b) and 7.2(c) have been satisfied.',
  frustration: 'No Party may rely on the failure of a condition if such failure was proximately caused by such Party\'s material breach.',
  burdensome: 'Parent shall not be required to accept a Burdensome Condition.',
  dissent: 'Dissenting Shares shall not exceed 10% of the outstanding shares.',
});

function sourceText() {
  return `AGREEMENT AND PLAN OF MERGER\n\nARTICLE VII\n\nSection ${SECTION_REFERENCE} Conditions to Closing.\n${Object.values(QUOTES).join('\n')}\n`;
}

function assertions() {
  const at = (assertionKind, quote, extra = {}) => ({
    section_reference: SECTION_REFERENCE, assertion_kind: assertionKind, quote, ...extra,
  });
  return [
    at('STOCKHOLDER_APPROVAL', QUOTES.stockholder, { approval_definition: 'requisite affirmative vote of the stockholders' }),
    at('LEGAL_RESTRAINT', QUOTES.legal),
    at('GOVERNMENT_PROCEEDING', QUOTES.government),
    at('S4_COMPONENT', QUOTES.s4, { s4_component: 'FORM_EFFECTIVE' }),
    at('S4_COMPONENT', QUOTES.s4, { s4_component: 'NO_STOP_ORDER' }),
    at('S4_COMPONENT', QUOTES.s4, { s4_component: 'NO_PENDING_OR_THREATENED_PROCEEDING' }),
    at('LISTING', QUOTES.listing, { listing_venue: 'NYSE' }),
    at('FUNDS', QUOTES.funds, { condition_obligor: 'PubCo' }),
    at('DOLLAR_THRESHOLD', QUOTES.funds, { threshold_role: 'FUNDS_MINIMUM', condition_obligor: 'PubCo' }),
    at('OFFICER_CERTIFICATE', QUOTES.certificate, {
      certificate_side: 'TARGET_CERTIFICATE', certifying_party: 'Company',
      certified_condition_refs: ['7.2(a)', '7.2(b)', '7.2(c)'],
    }),
    at('FRUSTRATION_CAUSATION', QUOTES.frustration, { causation_standard: 'PROXIMATELY_CAUSED' }),
    at('FRUSTRATION_BREACH', QUOTES.frustration, { breach_standard: 'MATERIAL_BREACH' }),
    at('BURDENSOME_CONDITION', QUOTES.burdensome, { burdensome_scope: 'PARENT_ONLY', condition_obligor: 'Parent' }),
    at('DISSENT_THRESHOLD', QUOTES.dissent),
  ];
}

test('Closing Conditions Wave B resolves grounded facts, preserves certificate references and keeps dissent honest', async () => {
  const source = sourceText();
  const dealKey = 'closing-wave-b';
  const contract = compileFixtureContractV24();
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: [SECTION_REFERENCE],
    contract_bundle: contract,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'closing-wave-b-test/v1', model_id: 'stub', prompt: 'closing-wave-b-test',
      ...shapeClosingConditionProposals({ closing_condition_assertions: assertions() }, governedScope.source_text),
    }),
  });
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(source, {
    dealKey, dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contract,
    admitted_source_context: admittedSourceContext,
  });
  const definitions = resolution.resolved.map((entry) => entry.resolved_claim_definition_key);
  for (const expected of [
    'STOCKHOLDER_APPROVAL_CONDITION', 'LEGAL_RESTRAINT_CONDITION',
    'GOVERNMENT_PROCEEDING_CONDITION', 'S4_CONDITION_COMPONENT', 'LISTING_CONDITION',
    'FUNDS_AVAILABILITY_CONDITION', 'CONDITION_DOLLAR_THRESHOLD',
    'OFFICER_CERTIFICATE_REQUIRED', 'FRUSTRATION_CAUSATION_STANDARD',
    'FRUSTRATION_BREACH_STANDARD', 'BURDENSOME_CONDITION',
  ]) assert.ok(definitions.includes(expected), `${expected}: ${JSON.stringify({
    definitions,
    review: resolution.review_queue.map((row) => row.reasons),
    open: resolution.open_world.map((row) => row.reason),
  })}`);
  const money = resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'CONDITION_DOLLAR_THRESHOLD');
  assert.equal(money.claim.canonical_value, '3800002.59');
  const certificate = resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'OFFICER_CERTIFICATE_REQUIRED');
  assert.equal(certificate.claim.attributes.certificate_relationship_status, 'VERBATIM_SECTION_REFERENCES');
  assert.deepEqual(certificate.claim.attributes.certified_condition_refs, ['7.2(a)', '7.2(b)', '7.2(c)']);
  assert.ok(resolution.open_world.some((entry) => entry.reason === 'CONDITION_ASSERTION_KIND_OUT_OF_ENUM' && entry.attributes.assertion_kind === 'DISSENT_THRESHOLD'));
  assert.equal(resolution.resolution_receipt.mapping_table_version, 20);
  assert.equal(MAPPING_TABLE_VERSION, 20);

  const projection = projectClosingConditionProductSurfaces({ resolution, deal_id: dealKey });
  assert.ok(projection.cards.every((card) => card.canonical_v2_lineage.source === 'CANONICAL_V2_NATIVE_CLAIM'));
  assert.deepEqual(projection.open_items, [
    { item: 'DISSENT_THRESHOLD', state: 'BLOCKED', reason: 'NO_GROUNDED_CORPUS_QUOTE' },
  ]);

  const conditions = await import('../components/review/table-configs/conditions.config.js');
  const groups = conditions.conditionGroups({ cards: projection.cards }, {});
  const renderedCodes = groups.flatMap((group) => group.presentRows)
    .map((row) => row.matches[0]?.features?.canonicalCode);
  for (const code of [
    'COND-M-STOCKHOLDER', 'COND-M-LEGAL', 'COND-M-S4', 'COND-M-LISTING',
    'COND-S-FUNDS', 'COND-B-CERT', 'COND-FRUSTRATE',
  ]) assert.ok(renderedCodes.includes(code), `review row ${code}`);

  const compare = executeDealCompare({
    deal_ids: [dealKey], provision_types: ['CLOSING_CONDITION'],
    included_field_groups: ['all'], highlight_deltas: false,
  }, {
    deals: [{ id: dealKey, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards,
  });
  const compareFields = new Map(compare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(compareFields.get('stockholderApprovalRequired'), true);
  assert.equal(compareFields.get('absenceOfEnjoiningOrderPresent'), true);
  assert.equal(compareFields.get('governmentProceedingConditionPresent'), true);
  assert.equal(compareFields.get('certificationRequired'), true);
  assert.equal(compareFields.get('fundsCondition'), true);
  assert.equal(compareFields.get('dollarThreshold'), 3800002.59);

  const marketAdapter = await import('../lib/market-metrics/adapter.js');
  const sellerGroup = groups.find((group) => group.id === 'seller');
  const fundsRow = sellerGroup.rows.find((row) => row.marketProvisionCodes?.includes('COND-S-FUNDS'));
  const specs = marketAdapter.resolveMarketMetricSpecs(fundsRow, { configId: 'conditions' });
  const market = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs,
  }, {
    deals: [{ id: dealKey, acquirer: 'Parent', target: 'Company', value_usd: 100000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  const marketResults = Object.values(market.byRow[specs[0].rowKey].metrics);
  assert.ok(marketResults.some((result) => (
    result.distribution?.kind === 'money'
      && result.coverage?.observedCount === 1
      && result.distribution?.raw?.stats?.n === 1
  )));
});
