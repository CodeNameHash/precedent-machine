'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV20, compileFixtureContractV24 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { parseDivestitureCapAmount, parseFilingDeadlineDays, ANTITRUST_REGULATORY_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');
const { buildAntitrustRegulatoryProducerPrompt } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { shapeRegulatoryEffortsProposals, REGULATORY_EFFORTS_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { GENERIC_CLAIM_KEY_RESOLUTION_TABLE, MATERIALITY_TABLE, MAPPING_TABLE_VERSION, regulatoryValueCorroborated, regulatoryFilingRegimeCorroborated } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { LEXICAL_FAMILY_LEXICON, LEXICAL_FAMILY_LEXICON_VERSION, validateLexicalFamilyLexicon } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectAntitrustProductSurfaces } = require('../lib/canonical-v2/antitrust-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { provisionFieldValue } = require('../lib/query/types');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

test('antitrust parser preserves scaled-money safety and exact literal money', () => {
  assert.deepEqual(parseDivestitureCapAmount('greater than $700 million in lost value'), { outcome: 'ABSTAIN', reason: 'SCALED_MONEY_LITERAL' });
  assert.equal(parseDivestitureCapAmount('$326,000,000').canonical_value, '326000000');
  assert.equal(parseDivestitureCapAmount('valued above $326,000,000.').canonical_value, '326000000');
  assert.equal(parseDivestitureCapAmount('$1 and $2').reason, 'MULTIPLE_MONEY_LITERALS');
  assert.equal(parseDivestitureCapAmount('one hundred dollars').reason, 'NON_LITERAL_MONEY');
  assert.equal(parseDivestitureCapAmount('€10').reason, 'NON_USD_CURRENCY');
  assert.equal(parseDivestitureCapAmount('$12,34').reason, 'MALFORMED_GROUPING');
});

test('antitrust parser resolves one literal deadline and abstains on non-literal or compound counts', () => {
  assert.equal(parseFilingDeadlineDays('within ten (10) Business Days').canonical_value, '10');
  assert.equal(parseFilingDeadlineDays('within fifteen (15) Business Days').canonical_value, '15');
  assert.equal(parseFilingDeadlineDays('within thirty (30) business days').canonical_value, '30');
  assert.equal(parseFilingDeadlineDays('within twenty five Business Days').reason, 'NON_LITERAL_NUMERAL');
  assert.equal(parseFilingDeadlineDays('within ten (45) Business Days').reason, 'SPELLED_DIGIT_MISMATCH');
  assert.equal(parseFilingDeadlineDays('within 10 Business Days and 45 Business Days').reason, 'MULTIPLE_DAY_COUNTS');
  assert.equal(ANTITRUST_REGULATORY_PARSE_VERSION, 1);
});

test('registry, resolver seam and materiality tier include the M3-B antitrust shapes', () => {
  const bundle = compileFixtureContractV20();
  const burden = bundle.claim_definitions.find((definition) => definition.claim_definition_key === 'REGULATORY_BURDEN_COMMITMENT');
  assert.equal(burden.allowed_canonical_values.length, 6);
  assert.equal(burden.allowed_canonical_values.includes('SILENT_NO_CAP'), false);
  assert.equal(burden.allowed_canonical_values.includes('SILENT'), false);
  const row = GENERIC_CLAIM_KEY_RESOLUTION_TABLE.find((entry) => entry.generic_claim_key === REGULATORY_EFFORTS_CLAIM_KEY);
  assert.deepEqual(row && { concept_key: row.concept_key, registered_claim_definition_key: row.registered_claim_definition_key, party_field: row.party_field }, { concept_key: null, registered_claim_definition_key: null, party_field: 'obligor_party' });
  assert.equal(MAPPING_TABLE_VERSION, 12);
  assert.deepEqual(MATERIALITY_TABLE.find((tier) => tier.label === 'REGULATORY_EFFORTS'), { rank: 65, label: 'REGULATORY_EFFORTS', concept_key_prefixes: ['ANTI-'] });
});

test('prompt and provider shaping retain a single evidenced regulatory assertion', () => {
  const quote = 'Each of Parent and the Company shall use reasonable best efforts to obtain all approvals.';
  const prompt = buildAntitrustRegulatoryProducerPrompt({ source_text: quote, governed_scope: {} });
  assert.equal(prompt.prompt_id, 'native-producer-antitrust-regulatory/v1');
  assert.equal(prompt.prompt_version, 2);
  const shaped = shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: [{ section_reference: '6.1', assertion_kind: 'EFFORTS_STANDARD', canonical_value: 'REASONABLE_BEST_EFFORTS', obligor_party_scope: 'MUTUAL', obligor_party: 'Each of Parent and the Company', quote }], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, REGULATORY_EFFORTS_CLAIM_KEY);
});

test('M3-B shapes separate timing-agreement, withdrawal/refiling, strategy, consultation, foreign-filing and non-impediment assertions', () => {
  const quote = 'Parent shall control the regulatory strategy and shall not enter into any timing agreement without the Company\'s prior written consent.';
  const shaped = shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: [
    { section_reference: '6.1', assertion_kind: 'TIMING_AGREEMENT_RESTRICTION', canonical_value: 'NOT_UNREASONABLY_WITHHELD', obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent', quote },
    { section_reference: '6.1', assertion_kind: 'STRATEGY_CONTROL', canonical_value: 'PARENT_CONTROL', obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent', quote },
  ], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals.length, 2);
  assert.deepEqual(shaped.proposals.map((proposal) => proposal.attributes.assertion_kind), ['TIMING_AGREEMENT_RESTRICTION', 'STRATEGY_CONTROL']);
});

test('M3-B corroboration requires distinct grounded antitrust facts', () => {
  assert.equal(regulatoryValueCorroborated('TIMING_AGREEMENT_RESTRICTION', 'NOT_UNREASONABLY_WITHHELD', "Parent shall not enter into any timing agreement without the Company's prior written consent, not to be unreasonably withheld."), true);
  assert.equal(regulatoryValueCorroborated('WITHDRAWAL_REFILING_RESTRICTION', 'MUTUAL_CONSENT', 'Neither party shall withdraw and refile without the consent of the other.'), true);
  assert.equal(regulatoryValueCorroborated('STRATEGY_CONTROL', 'PARENT_CONTROL', 'Parent shall control the regulatory strategy.'), true);
  assert.equal(regulatoryValueCorroborated('CONSULTATION_RIGHT', 'GOOD_FAITH_VIEWS', 'Parent shall consider in good faith the views of the Company.'), true);
  assert.equal(regulatoryValueCorroborated('NON_IMPEDIMENT_COVENANT', true, 'Parent shall not take any action that would prevent or delay consummation of the transactions.'), true);
  assert.equal(regulatoryValueCorroborated('STRATEGY_CONTROL', 'PARENT_CONTROL', 'Parent and the Company shall cooperate.'), false);
  assert.equal(regulatoryFilingRegimeCorroborated('Foreign Competition Act', 'Parent shall file under the Foreign Competition Act.'), true);
  assert.equal(regulatoryFilingRegimeCorroborated('HSR Act and Foreign Competition Act', 'Parent shall file under the HSR Act and Foreign Competition Act.'), false);
});

test('antitrust lexical entries are registered and include the bounded family set', () => {
  const registered = new Set(compileFixtureContractV24().concepts.map((concept) => concept.concept_key));
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, { registeredConceptKeys: registered }));
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 7);
  for (const family of ['ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-TIMING', 'ANTI-FILING']) {
    assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === family), family);
  }
});

test('native antitrust candidates reach Review, Query, Compare and market statistics', async () => {
  const sectionReference = '6.1';
  const quotes = {
    efforts: 'Parent shall use reasonable best efforts to obtain all regulatory approvals.',
    burden: 'Parent shall not be required to divest assets or accept any Burdensome Condition.',
    cap: 'Parent shall not be required to divest assets valued in excess of $326,000,000.',
    litigation: 'Parent shall vigorously contest and defend through litigation any regulatory challenge.',
    timing: "Parent shall not enter into any timing agreement without the Company's prior written consent, not to be unreasonably withheld.",
    withdrawal: 'Parent shall withdraw and refile in good faith under the HSR Act.',
    hsr: 'Parent shall file under the HSR Act within ten (10) Business Days.',
    foreign: 'Parent shall file under the Foreign Competition Act.',
    foreignDeadline: 'Parent shall file under the Foreign Competition Act within fifteen (15) Calendar Days.',
    strategy: 'Parent shall control the regulatory strategy.',
    consultation: 'Parent shall consider in good faith the views of the Company.',
    noAction: 'Parent shall not take any action that would prevent or delay consummation of the transactions.',
  };
  const source = `AGREEMENT AND PLAN OF MERGER\n\nSection ${sectionReference} Regulatory Matters.\n${Object.values(quotes).join('\n')}\n`;
  const at = (assertionKind, quote, canonicalValue, extra = {}) => ({
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    canonical_value: canonicalValue,
    obligor_party_scope: 'ONE_PARTY',
    obligor_party: 'Parent',
    quote,
    ...extra,
  });
  const assertions = [
    at('EFFORTS_STANDARD', quotes.efforts, 'REASONABLE_BEST_EFFORTS'),
    at('BURDEN_COMMITMENT', quotes.burden, 'ANTI_HOHW'),
    at('DIVESTITURE_CAP_AMOUNT', quotes.cap, null),
    at('LITIGATION_OBLIGATION', quotes.litigation, 'MANDATORY_DEFEND'),
    at('TIMING_AGREEMENT_RESTRICTION', quotes.timing, 'NOT_UNREASONABLY_WITHHELD'),
    at('WITHDRAWAL_REFILING_RESTRICTION', quotes.withdrawal, 'BUYER_UNILATERAL_GF'),
    at('HSR_FILING_DEADLINE', quotes.hsr, null, { day_kind: 'BUSINESS', filing_regime_ref: 'HSR Act' }),
    at('REGULATORY_FILING_OBLIGATION', quotes.foreign, true, { filing_regime_ref: 'Foreign Competition Act' }),
    at('REGULATORY_FILING_DEADLINE', quotes.foreignDeadline, null, { day_kind: 'CALENDAR', filing_regime_ref: 'Foreign Competition Act' }),
    at('STRATEGY_CONTROL', quotes.strategy, 'PARENT_CONTROL'),
    at('CONSULTATION_RIGHT', quotes.consultation, 'GOOD_FAITH_VIEWS'),
    at('NON_IMPEDIMENT_COVENANT', quotes.noAction, true),
  ];
  const contract = compileFixtureContractV20();
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: [sectionReference],
    contract_bundle: contract,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'antitrust-product-test/v1',
      model_id: 'stub',
      prompt: 'antitrust-product-test',
      ...shapeRegulatoryEffortsProposals({
        regulatory_efforts_assertions: assertions,
        open_world_candidates: [],
      }, governedScope.source_text),
    }),
  });
  assert.ok(
    receipt.compiled_candidates.every((entry) => entry.ok === true),
    JSON.stringify(receipt.compiled_candidates.filter((entry) => entry.ok !== true), null, 2),
  );
  const dealId = 'antitrust-product-deal';
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contract,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, {
      dealKey: dealId,
      dealAdmissionId: sha256Hex(`deal-admission:${dealId}`),
    }),
  });
  assert.equal(
    resolution.resolved.length,
    assertions.length,
    JSON.stringify({
      resolved: resolution.resolved.map((entry) => entry.resolved_claim_definition_key),
      review: resolution.review_queue.map((entry) => entry.reasons),
      residuals: resolution.residuals,
    }),
  );

  const projection = projectAntitrustProductSurfaces({ resolution, deal_id: dealId });
  assert.equal(projection.open_items.length, 0);
  assert.ok(projection.cards.every((card) => card.canonical_v2_lineage.source === 'CANONICAL_V2_NATIVE_CLAIM'));
  const projectedPullCard = projection.cards.find((card) => card.features.pullRefile);
  assert.equal(projectedPullCard.features.pullRefile, 'BUYER_UNILATERAL_GF');
  assert.equal(provisionFieldValue(projectedPullCard, 'ANTITRUST_REGULATORY', 'pullRefile').value, 'BUYER_UNILATERAL_GF');

  const config = await import('../components/review/table-configs/antitrust-regulatory.config.js');
  const rows = config.mappedAntitrustRows(projection.cards);
  for (const rowId of [
    'antitrust-regulatory-efforts',
    'antitrust-regulatory-divestiture-cap',
    'antitrust-regulatory-litigation',
    'antitrust-regulatory-hsr-deadline',
    'antitrust-regulatory-foreign-filings',
    'antitrust-regulatory-strategy-control',
    'antitrust-regulatory-consultation',
    'antitrust-regulatory-clear-skies',
    'antitrust-regulatory-pull-refile',
    'antitrust-regulatory-timing-agreements',
  ]) assert.ok(rows.some((row) => row.id === rowId), `Review row ${rowId}`);
  const pullRow = rows.find((row) => row.id === 'antitrust-regulatory-pull-refile');
  assert.deepEqual(pullRow.signals.map((signal) => signal.label), ['Buyer may pull-and-refile (good-faith gated)']);

  const compare = executeDealCompare({
    deal_ids: [dealId],
    provision_types: ['ANTITRUST_REGULATORY'],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards,
  });
  const compareFields = new Map(compare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(compareFields.get('antitrustEffortsStandard'), 'reasonable-best-efforts');
  assert.equal(compareFields.get('burdenCommitment'), 'ANTI_HOHW');
  assert.equal(compareFields.get('divestitureCap'), 326000000);
  assert.equal(compareFields.get('litigationObligation'), 'MANDATORY_DEFEND');
  assert.equal(compareFields.get('hsrFilingDeadlineBusinessDays'), 10);
  assert.equal(compareFields.get('foreignFilingsRequired'), 'PRESENT');
  assert.equal(compareFields.get('otherRegulatoryFilingDeadlines'), 15);
  assert.equal(compareFields.get('regulatoryStrategyControlTagged'), 'PARENT_CONTROL');
  assert.equal(compareFields.get('consultationTier'), 'GOOD_FAITH_VIEWS');
  assert.equal(compareFields.get('pullRefile'), 'BUYER_UNILATERAL_GF');
  assert.equal(compareFields.get('timingAgreement'), 'NOT_UNREASONABLY_WITHHELD');
  assert.equal(compareFields.get('clearSkiesParent'), true);
  assert.equal(compareFields.get('clearSkiesCompany'), null);
  assert.equal(compareFields.get('reverseTerminationFee'), null);

  const legacyDealId = 'antitrust-legacy-deal';
  const legacyCompare = executeDealCompare({
    deal_ids: [legacyDealId],
    provision_types: ['ANTITRUST_REGULATORY'],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: legacyDealId, acquirer: 'Buyer', target: 'Target', metadata: {} }],
    provisions: [{
      id: 'legacy-antitrust-card',
      deal_id: legacyDealId,
      type: 'ANTI',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: 'ANTI-EFFORTS',
      full_text: 'Buyer shall use commercially reasonable efforts, but has no hell-or-high-water obligation.',
      ai_metadata: { features: { effortsStandard: 'commercially-reasonable-efforts', hellOrHighWater: false } },
    }],
  });
  const legacyFields = new Map(legacyCompare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(legacyFields.get('antitrustEffortsStandard'), 'commercially-reasonable-efforts');
  assert.equal(legacyFields.get('burdenCommitment'), false);

  const adapter = await import('../lib/market-metrics/adapter.js');
  for (const row of rows) {
    assert.ok(adapter.resolveMarketMetricSpecs(row, { configId: 'antitrust-regulatory' }).length > 0, row.id);
  }
  const burdenRow = rows.find((row) => row.id === 'antitrust-regulatory-divestiture-cap');
  const specs = adapter.resolveMarketMetricSpecs(burdenRow, { configId: 'antitrust-regulatory' });
  const market = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: null,
    filters: {},
    specs,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', value_usd: 2000000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  const marketResults = Object.values(market.byRow[specs[0].rowKey].metrics);
  assert.ok(marketResults.some((result) => (
    result.distribution?.kind === 'money'
      && result.coverage?.observedCount === 1
      && result.distribution?.raw?.stats?.n === 1
  )));
  assert.ok(marketResults.some((result) => (
    result.distribution?.kind === 'categorical' && result.coverage?.observedCount === 1
  )));
});
