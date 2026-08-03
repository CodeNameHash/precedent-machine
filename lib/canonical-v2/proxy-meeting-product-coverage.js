'use strict';

const PROXY_MEETING_PRODUCT_COVERAGE_SCHEMA = 'CANONICAL_V2_PROXY_MEETING_FOLLOW_ON_COVERAGE/V1';

const ROW_COVERAGE = Object.freeze({
  'votes-approvals-meeting-approval-definition': Object.freeze({
    owner_id: 'KEY_DEFINED_TERMS',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze([]),
  }),
  'votes-approvals-meeting-vote-threshold': Object.freeze({
    owner_id: 'KEY_DEFINED_TERMS',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze([]),
  }),
  'votes-approvals-meeting-parent-approval': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'BEN_DECISION_REQUIRED',
    claim_keys: Object.freeze(['PARENT_MERGER_SUB_ADOPTION']),
  }),
  'votes-approvals-meeting-proxy-filing': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'REGISTERED_FIRST_SLICE',
    claim_keys: Object.freeze(['PROXY_FILING_DEADLINE_DAYS']),
  }),
  'votes-approvals-meeting-mailing': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'GROUNDED_FOLLOW_ON',
    claim_keys: Object.freeze(['PROXY_MAILING_DEADLINE_DAYS']),
  }),
  'votes-approvals-meeting-meeting': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'REGISTERED_FIRST_SLICE',
    claim_keys: Object.freeze(['MEETING_DEADLINE_DAYS', 'MEETING_CONVENE_OBLIGATION']),
  }),
  'votes-approvals-meeting-record-date': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'BEN_DECISION_REQUIRED',
    claim_keys: Object.freeze(['MEETING_RECORD_DATE_ESTABLISHMENT']),
  }),
  'votes-approvals-meeting-broker-search': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'BEN_DECISION_REQUIRED',
    claim_keys: Object.freeze(['MEETING_BROKER_SEARCH_OBLIGATION']),
  }),
  'votes-approvals-meeting-adjournment': Object.freeze({
    owner_id: 'PROXY_MEETING_COVENANTS',
    governance_state: 'GROUNDED_FOLLOW_ON',
    claim_keys: Object.freeze([
      'MEETING_ADJOURNMENT_MAX_COUNT',
      'MEETING_ADJOURNMENT_MAX_DAYS',
      'MEETING_ADJOURNMENT_REASON',
      'MEETING_ADJOURNMENT_CONTROL',
      'MEETING_ADJOURNMENT_CONSENT_OVERRIDE',
    ]),
  }),
  'votes-approvals-meeting-offerCommencementDeadline': Object.freeze({
    owner_id: 'MERGER_STRUCTURE_CLOSING',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze(['OFFER_COMMENCEMENT_DEADLINE']),
  }),
  'votes-approvals-meeting-scheduleTOFiling': Object.freeze({
    owner_id: 'MERGER_STRUCTURE_CLOSING',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze(['SCHEDULE_TO_FILING']),
  }),
  'votes-approvals-meeting-schedule14D9Filing': Object.freeze({
    owner_id: 'MERGER_STRUCTURE_CLOSING',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze(['SCHEDULE_14D9_FILING']),
  }),
  'votes-approvals-meeting-stockholderListCovenant': Object.freeze({
    owner_id: 'MERGER_STRUCTURE_CLOSING',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze(['OFFER_STOCKHOLDER_LIST_COVENANT']),
  }),
  'votes-approvals-meeting-acceptanceAndPaymentMechanics': Object.freeze({
    owner_id: 'MERGER_STRUCTURE_CLOSING',
    governance_state: 'BOUNDARY_VISIBLE',
    claim_keys: Object.freeze(['OFFER_ACCEPTANCE_PAYMENT_MECHANICS']),
  }),
  'sec-meeting-tenderOfferMinimumCondition': Object.freeze({
    owner_id: 'CLOSING_CONDITIONS',
    governance_state: 'BOUNDARY_EXCLUDED',
    claim_keys: Object.freeze(['TENDER_OFFER_MINIMUM_CONDITION']),
  }),
});

const COMPOSITE_SEC_ROW_IDS = Object.freeze([
  'sec-meeting-offerCommencementDeadline',
  'sec-meeting-scheduleTOFiling',
  'sec-meeting-schedule14D9Filing',
  'sec-meeting-stockholderListCovenant',
  'sec-meeting-acceptanceAndPaymentMechanics',
]);

function coverageForRowId(rowId) {
  if (ROW_COVERAGE[rowId]) return ROW_COVERAGE[rowId];
  if (typeof rowId === 'string' && rowId.startsWith('votes-approvals-meeting-adjournment-')) {
    return ROW_COVERAGE['votes-approvals-meeting-adjournment'];
  }
  return null;
}

function coverageForSecRowId(rowId) {
  if (typeof rowId !== 'string') return null;
  if (ROW_COVERAGE[rowId]) return ROW_COVERAGE[rowId];
  const prefix = 'sec-meeting-';
  if (!rowId.startsWith(prefix)) return null;
  return coverageForRowId(`votes-approvals-meeting-${rowId.slice(prefix.length)}`);
}

function enrichProxyMeetingRow(row) {
  if (!row || typeof row !== 'object') return row;
  const coverage = coverageForRowId(row.id);
  if (!coverage) return row;
  return {
    ...row,
    ownerFamily: coverage.owner_id,
    governanceState: coverage.governance_state,
    targetClaimKeys: [...coverage.claim_keys],
  };
}

module.exports = {
  COMPOSITE_SEC_ROW_IDS,
  PROXY_MEETING_PRODUCT_COVERAGE_SCHEMA,
  ROW_COVERAGE,
  coverageForRowId,
  coverageForSecRowId,
  enrichProxyMeetingRow,
};
