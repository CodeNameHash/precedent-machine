'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV29 } = require('../lib/canonical-v2/contract-bundle');
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
    recordDate: 'The Company shall establish the record date for the Stockholders Meeting.',
    brokerSearch: 'The Company shall complete a broker search for the Stockholders Meeting.',
    parentApproval: 'Parent stockholders shall approve this Agreement by shareholder vote at the Parent Meeting promptly after mailing.',
    mergerSubApproval: "Merger Sub's sole stockholder shall approve this Agreement by written consent immediately following execution.",
    quorumReason: 'The Company may adjourn the Stockholders Meeting due to the absence of a quorum.',
    voteReason: 'The Company may adjourn the Stockholders Meeting due to insufficient affirmative votes.',
    disclosureReason: 'The Company may adjourn the Stockholders Meeting to provide supplemental disclosure.',
    legalReason: 'The Company may adjourn the Stockholders Meeting when required by applicable law.',
    crossReferenceReason: 'The Company may adjourn the Stockholders Meeting for the legal requirement described in Section 6.3(b).',
  };
  const source = `AGREEMENT AND PLAN OF MERGER\n\nSection ${SECTION_REFERENCE} Proxy Statement and Stockholders Meeting.\n${Object.values(quotes).join('\n')}\n`;
  const assertions = [
    { assertion_kind: 'FILING_DEADLINE', anchor_kind: 'AGREEMENT_DATE', day_kind: 'CALENDAR', document_ref: 'Proxy Statement', quote: quotes.filing },
    { assertion_kind: 'MEETING_DEADLINE', anchor_kind: 'MAILING', day_kind: 'CALENDAR', meeting_ref: 'special meeting', quote: quotes.meeting },
    { assertion_kind: 'CONVENE_OBLIGATION', meeting_ref: 'special meeting', quote: quotes.meeting },
    { assertion_kind: 'ADJOURNMENT_COUNT_CAP', control_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.count },
    { assertion_kind: 'ADJOURNMENT_DURATION_CAP', day_kind: 'BUSINESS', limit_basis: 'AGGREGATE', control_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.duration },
    { assertion_kind: 'RECOMMENDATION_INCLUSION', document_ref: 'Proxy Statement', quote: quotes.inclusion },
    { assertion_kind: 'RECORD_DATE_ESTABLISHMENT', obligated_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.recordDate },
    { assertion_kind: 'BROKER_SEARCH_OBLIGATION', obligated_party: 'The Company', meeting_ref: 'Stockholders Meeting', quote: quotes.brokerSearch },
    { assertion_kind: 'PARENT_APPROVAL', obligated_party: 'Parent', adoption_mechanism: 'SHAREHOLDER_VOTE', adoption_timing: 'promptly after mailing', quote: quotes.parentApproval },
    { assertion_kind: 'MERGER_SUB_APPROVAL', obligated_party: 'Merger Sub', adoption_mechanism: 'WRITTEN_CONSENT', adoption_timing: 'immediately following execution', quote: quotes.mergerSubApproval },
    { assertion_kind: 'ADJOURNMENT_REASON', reason_kind: 'QUORUM_ABSENT', meeting_ref: 'Stockholders Meeting', quote: quotes.quorumReason },
    { assertion_kind: 'ADJOURNMENT_REASON', reason_kind: 'INSUFFICIENT_VOTES', meeting_ref: 'Stockholders Meeting', quote: quotes.voteReason },
    { assertion_kind: 'ADJOURNMENT_REASON', reason_kind: 'SUPPLEMENTAL_DISCLOSURE', meeting_ref: 'Stockholders Meeting', quote: quotes.disclosureReason },
    { assertion_kind: 'ADJOURNMENT_REASON', reason_kind: 'LEGAL_REQUIREMENT', meeting_ref: 'Stockholders Meeting', quote: quotes.legalReason },
    { assertion_kind: 'ADJOURNMENT_REASON', reason_kind: null, meeting_ref: 'Stockholders Meeting', quote: quotes.crossReferenceReason },
  ].map((assertion) => ({ section_reference: SECTION_REFERENCE, ...assertion }));
  const contract = compileFixtureContractV29();
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

test('the resolver promotes the governed Proxy and Meeting follow-on facts', async () => {
  const { resolution } = await productFixture();
  assert.equal(MAPPING_TABLE_VERSION, 20);
  assert.deepEqual(resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(), [
    'BOARD_RECOMMENDATION_INCLUSION',
    'BROKER_SEARCH_OBLIGATION_PRESENT',
    'MEETING_ADJOURNMENT_MAX_COUNT',
    'MEETING_ADJOURNMENT_MAX_DAYS',
    'MEETING_ADJOURNMENT_REASON',
    'MEETING_ADJOURNMENT_REASON',
    'MEETING_ADJOURNMENT_REASON',
    'MEETING_ADJOURNMENT_REASON',
    'MEETING_CONVENE_OBLIGATION',
    'MEETING_DEADLINE_DAYS',
    'MERGER_SUB_APPROVAL_OBLIGATION',
    'PARENT_APPROVAL_OBLIGATION',
    'PROXY_FILING_DEADLINE_DAYS',
    'RECORD_DATE_ESTABLISHMENT_PRESENT',
  ], JSON.stringify({ sections: resolution.resolution_receipt, review: resolution.review_queue, open: resolution.open_world, residuals: resolution.residuals }, null, 2));
  assert.equal(resolution.open_world.length, 0);
  assert.ok(resolution.review_queue.some((item) => item.reasons.includes('ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED')));
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
  assert.equal(evidenceCards.length, 0);
  assert.equal(projection.claims.some((claim) => claim.verbatim.includes('record date')), true);

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
    'sec-meeting-broker-search',
  ]) assert.ok(rows.some((row) => row.id === rowId), rowId);
  const composite = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const compositeRows = composite.votesApprovalsMeetingConfig.selectRows({ cards: projection.cards });
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-boardRecommendationInclusion'));
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-meetingConveneObligation'));
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-parent-approval'));
  assert.ok(compositeRows.some((row) => row.id === 'votes-approvals-meeting-merger-sub-approval'));
  const recordRow = rows.find((row) => row.id === 'sec-meeting-record-date');
  const brokerRow = rows.find((row) => row.id === 'sec-meeting-broker-search');
  assert.equal(recordRow.marketState, 'FEATURE_BACKED');
  assert.equal(brokerRow.marketState, 'FEATURE_BACKED');

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
  assert.equal(fields.get('meetingRecordDate'), true);
  assert.equal(fields.get('brokerSearchObligation'), true);
  assert.equal(fields.get('parentApprovalMechanism'), 'SHAREHOLDER_VOTE');
  assert.equal(fields.get('mergerSubApprovalMechanism'), 'WRITTEN_CONSENT');

  const adapter = await import('../lib/market-metrics/adapter.js');
  const governedRows = rows.filter((row) => row.marketPresence || row.marketSubterms);
  const specs = governedRows.flatMap((row) => adapter.resolveMarketMetricSpecs(row, { configId: 'sec-meeting' }));
  assert.ok(specs.length >= 5);
  assert.equal(adapter.resolveMarketMetricRow(recordRow, { configId: 'sec-meeting' }).resolution, 'feature_registry');
  assert.equal(adapter.resolveMarketMetricRow(brokerRow, { configId: 'sec-meeting' }).resolution, 'feature_registry');
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

// ─────────────────────────────────────────────────────────────────────────
// Step 3F1 (docs/core/PLAN.md, "give the marker a downstream contract"):
// meetingParty()'s `adjournmentRights[].party` field is COMPANY/PARENT-
// shaped and rendered directly to a user. A JOINT_MULTI_PARTY_CAPACITY (or
// any other unrecognised) capacity must never leak through as a raw
// internal marker string. Built directly against
// projectProxyMeetingProductSurfaces rather than the full extraction
// pipeline, since no committed evidence reaches this path with a joint
// capacity today (the point of the test is to prove the guard, not to
// reproduce a live symptom).
// ─────────────────────────────────────────────────────────────────────────

test('JOINT_MULTI_PARTY capacity: adjournmentRights[].party is null, never the raw internal marker string', () => {
  const resolution = {
    resolved: [{
      resolved_claim_definition_key: 'MEETING_ADJOURNMENT_MAX_COUNT',
      concept_key: 'COV-MEETING',
      section_reference: SECTION_REFERENCE,
      party: { role: 'MEETING_ADJOURNMENT_CONTROL', value: 'Parent and Company Merger Sub', capacity: 'JOINT_MULTI_PARTY' },
      provision_instance: { provision_instance_id: 'joint-adjournment' },
      claim: {
        claim_revision_id: 'joint-adjournment:MEETING_ADJOURNMENT_MAX_COUNT',
        canonical_value: '2',
        raw_value: 'Parent and Company Merger Sub may adjourn the Stockholders Meeting no more than two (2) such adjournments.',
        attributes: {},
      },
    }],
    open_world: [],
  };
  const projection = projectProxyMeetingProductSurfaces({ resolution, deal_id: 'proxy-meeting-joint-capacity' });
  assert.equal(projection.cards.length, 1, 'the row itself must still project -- only the party field is refused');
  const [card] = projection.cards;
  assert.equal(card.features.adjournmentRights[0].party, null);
  assert.equal(JSON.stringify(card.features).includes('JOINT_MULTI_PARTY'), false, 'the raw internal marker must never reach a served field');
});
