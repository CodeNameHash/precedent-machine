'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV26 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProxyMeetingProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { classifySectionFamily } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { resolveCandidates, MAPPING_TABLE_VERSION } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  EVIDENCE_SOURCE,
  projectProxyMeetingProductSurfaces,
} = require('../lib/canonical-v2/proxy-meeting-product-projection');
const { provisionFieldValue } = require('../lib/query/types');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const SECTION_REFERENCE = '6.3';

async function productFixture() {
  const quotes = {
    filing: 'The Company shall prepare and file the Proxy Statement with the SEC within thirty (30) calendar days after the date of this Agreement.',
    meeting: 'The Company shall schedule a special meeting to be convened and held within forty-five (45) calendar days after the initial mailing of the Proxy Statement.',
    count: 'The Company may adjourn the Stockholders Meeting no more than two (2) such adjournments.',
    duration: 'The Company may adjourn the Stockholders Meeting for no more than ten (10) Business Days in the aggregate.',
    inclusion: 'The Company shall include the Company Board Recommendation in the Proxy Statement.',
    recordDate: 'The Company shall establish a record date 20 Business Days after the broker search.',
  };
  const source = `AGREEMENT AND PLAN OF MERGER\n\nSection ${SECTION_REFERENCE} Proxy Statement and Stockholders Meeting.\n${Object.values(quotes).join('\n')}\n`;
  const assertions = [
    { assertion_kind: 'FILING_DEADLINE', anchor_kind: 'AGREEMENT_DATE', day_kind: 'CALENDAR', document_ref: 'Proxy Statement', quote: quotes.filing },
    { assertion_kind: 'MEETING_DEADLINE', anchor_kind: 'MAILING', day_kind: 'CALENDAR', meeting_ref: 'special meeting', quote: quotes.meeting },
    { assertion_kind: 'CONVENE_OBLIGATION', meeting_ref: 'special meeting', quote: quotes.meeting },
    { assertion_kind: 'ADJOURNMENT_COUNT_CAP', control_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.count },
    { assertion_kind: 'ADJOURNMENT_DURATION_CAP', day_kind: 'BUSINESS', limit_basis: 'AGGREGATE', control_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.duration },
    { assertion_kind: 'RECOMMENDATION_INCLUSION', document_ref: 'Proxy Statement', quote: quotes.inclusion },
    { assertion_kind: 'RECORD_DATE_ESTABLISHMENT', obligated_party: 'The Company', meeting_ref: 'record date', quote: quotes.recordDate },
  ].map((assertion) => ({ section_reference: SECTION_REFERENCE, ...assertion }));
  const contract = compileFixtureContractV26();
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: [SECTION_REFERENCE],
    contract_bundle: contract,
    definitions: { known_definitions: [] },
    section_family_classifier: classifySectionFamily,
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'proxy-meeting-product-test/v1',
      model_id: 'stub',
      prompt: 'proxy-meeting-product-test',
      ...shapeProxyMeetingProposals({ proxy_meeting_assertions: assertions, open_world_candidates: [] }, governedScope.source_text),
    }),
  });
  const dealId = 'proxy-meeting-product-deal';
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contract,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, {
      dealKey: dealId,
      dealAdmissionId: sha256Hex(`deal-admission:${dealId}`),
    }),
  });
  return { dealId, quotes, receipt, resolution, projection: projectProxyMeetingProductSurfaces({ resolution, deal_id: dealId }) };
}

test('the resolver promotes only the six governed Proxy and Meeting claim definitions', async () => {
  const { resolution } = await productFixture();
  assert.equal(MAPPING_TABLE_VERSION, 15);
  assert.deepEqual(resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(), [
    'BOARD_RECOMMENDATION_INCLUSION',
    'MEETING_ADJOURNMENT_MAX_COUNT',
    'MEETING_ADJOURNMENT_MAX_DAYS',
    'MEETING_CONVENE_OBLIGATION',
    'MEETING_DEADLINE_DAYS',
    'PROXY_FILING_DEADLINE_DAYS',
  ], JSON.stringify({ sections: resolution.resolution_receipt, review: resolution.review_queue, open: resolution.open_world, residuals: resolution.residuals }, null, 2));
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].attributes.assertion_kind, 'RECORD_DATE_ESTABLISHMENT');
  assert.equal(resolution.open_world[0].reason, 'PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED');
  assert.equal(resolution.resolution_receipt.proxy_meeting_parse_version, 1);
  const meetingClaims = resolution.resolved.filter((entry) => entry.claim.raw_value.includes('special meeting'));
  assert.deepEqual(meetingClaims.map((entry) => entry.resolved_claim_definition_key).sort(), [
    'MEETING_CONVENE_OBLIGATION',
    'MEETING_DEADLINE_DAYS',
  ]);
});

test('native Proxy and Meeting claims reach Review, Query, Compare and market statistics', async () => {
  const { dealId, projection } = await productFixture();
  const nativeCards = projection.cards.filter((card) => card.canonical_v2_lineage.source !== EVIDENCE_SOURCE);
  const evidenceCards = projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.equal(evidenceCards.length, 1);
  assert.deepEqual(evidenceCards[0].features, {});
  assert.equal(projection.claims.some((claim) => claim.verbatim.includes('record date')), false);

  const proxyCard = nativeCards.find((card) => card.features.proxyFilingDeadline);
  assert.equal(provisionFieldValue(proxyCard, 'SEC_FILING_MEETING', 'proxyFilingDeadline').value, '30');
  assert.equal(provisionFieldValue(proxyCard, 'SEC_FILING_MEETING', 'boardRecommendationInclusion').value, true);

  const config = await import('../components/review/table-configs/sec-meeting.config.js');
  const rows = config.secMeetingConfig.selectRows({ cards: projection.cards });
  for (const rowId of [
    'sec-meeting-proxy-filing',
    'sec-meeting-meeting',
    'sec-meeting-boardRecommendationInclusion',
    'sec-meeting-meetingConveneObligation',
    'sec-meeting-adjournment-0',
    'sec-meeting-record-date',
  ]) assert.ok(rows.some((row) => row.id === rowId), rowId);
  const composite = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const compositeRows = composite.votesApprovalsMeetingConfig.selectRows({ cards: projection.cards });
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-boardRecommendationInclusion'));
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-meetingConveneObligation'));
  const evidenceRow = rows.find((row) => row.id === 'sec-meeting-record-date');
  assert.equal(evidenceRow.marketState, 'OPEN_NATIVE_FIELD');

  const compare = executeDealCompare({
    deal_ids: [dealId],
    provision_types: ['SEC_FILING_MEETING'],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards,
  });
  const fields = new Map(compare.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
  assert.equal(fields.get('proxyFilingDeadline'), '30');
  assert.equal(fields.get('meetingDeadline'), '45');
  assert.equal(fields.get('boardRecommendationInclusion'), true);
  assert.equal(fields.get('meetingConveneObligation'), true);
  assert.equal(fields.get('meetingAdjournmentMaxCount'), 2);
  assert.equal(fields.get('meetingAdjournmentMaxDays'), 10);

  const adapter = await import('../lib/market-metrics/adapter.js');
  const governedRows = rows.filter((row) => row.marketPresence || row.marketSubterms);
  const specs = governedRows.flatMap((row) => adapter.resolveMarketMetricSpecs(row, { configId: 'sec-meeting' }));
  assert.ok(specs.length >= 5);
  assert.equal(adapter.resolveMarketMetricRow(evidenceRow, { configId: 'sec-meeting' }).resolution, 'evidence_only');
  const market = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: null,
    filters: {},
    specs,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', value_usd: 1000000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  const results = Object.values(market.byRow).flatMap((row) => Object.values(row.metrics));
  assert.ok(results.some((result) => result.coverage?.observedCount === 1));
  assert.equal(JSON.stringify(projection).includes('terminationTriggers'), false);
  assert.equal(JSON.stringify(projection).includes('tenderOfferMinimumCondition'), false);
  assert.equal(JSON.stringify(projection).includes('boardChangeForSuperiorProposal'), false);
});
