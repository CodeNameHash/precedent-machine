'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectProxyMeetingProductSurfaces,
} = require('../lib/canonical-v2/proxy-meeting-product-projection');

const PARTY = Object.freeze({
  role: 'MEETING_ADJOURNMENT_CONTROL',
  value: 'The Company',
  capacity: 'TARGET',
});

function resolution() {
  return {
    resolved: [{
      resolved_claim_definition_key: 'MEETING_ADJOURNMENT_REASON',
      concept_key: 'COV-MEETING',
      section_reference: '6.3',
      party: PARTY,
      provision_instance: {
        provision_instance_id: 'proxy-meeting-adjournment',
        party: PARTY,
      },
      claim: {
        claim_revision_id: 'claim-proxy-meeting-adjournment',
        canonical_value: 'QUORUM_ABSENT',
        raw_value: 'The Company may adjourn the meeting if a quorum is absent.',
        attributes: {
          control_party: 'The Company',
        },
      },
    }],
    open_world: [],
  };
}

test('Proxy and Meeting carries the exact resolved party into the atomic feature and row, not the provision card', async () => {
  const projection = projectProxyMeetingProductSurfaces({
    resolution: resolution(),
    deal_id: 'proxy-meeting-party-deal',
  });
  const card = projection.cards[0];

  assert.equal(card.party, null);
  assert.equal(card.canonical_v2_lineage.obligated_party, 'The Company');
  assert.equal(card.features.adjournmentRights[0].party, 'The Company');

  const { votesApprovalsMeetingConfig } = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const row = votesApprovalsMeetingConfig.selectRows({ cards: projection.cards })
    .find((candidate) => candidate.kind === 'adjournment');
  const provisionColumn = votesApprovalsMeetingConfig.columns.find((column) => column.id === 'provision');
  const html = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    provisionColumn.renderCell(row, { primitives: {} }),
  ));

  assert.equal(row.partyLabel, 'The Company');
  assert.match(html, /Party: The Company/);
});

test('Proxy and Meeting refuses conflicting resolved and provision parties', () => {
  const conflicting = resolution();
  conflicting.resolved[0].provision_instance.party = {
    role: 'MEETING_ADJOURNMENT_CONTROL',
    value: 'Parent',
    capacity: 'BUYER',
  };

  assert.throws(
    () => projectProxyMeetingProductSurfaces({
      resolution: conflicting,
      deal_id: 'proxy-meeting-conflicting-party-deal',
    }),
    /party conflicts with its provision party/,
  );
});

test('Proxy and Meeting refuses an incomplete canonical party', () => {
  const incomplete = resolution();
  const incompleteParty = {
    role: 'MEETING_ADJOURNMENT_CONTROL',
    capacity: 'TARGET',
  };
  incomplete.resolved[0].party = incompleteParty;
  incomplete.resolved[0].provision_instance.party = incompleteParty;
  assert.throws(
    () => projectProxyMeetingProductSurfaces({
      resolution: incomplete,
      deal_id: 'proxy-meeting-incomplete-party-deal',
    }),
    /party is ambiguous/,
  );
});

function conveneEntry(claimId, obligatedParty) {
  return {
    resolved_claim_definition_key: 'MEETING_CONVENE_OBLIGATION',
    concept_key: 'COV-MEETING',
    section_reference: '6.6',
    party: null,
    provision_instance: { provision_instance_id: 'shared-company-parent-meeting', party: null },
    claim: {
      claim_revision_id: claimId,
      canonical_value: true,
      raw_value: `${obligatedParty} shall convene and hold its stockholder meeting.`,
      attributes: { obligated_party: obligatedParty },
    },
  };
}

test('hostile shared provision keeps Company and Parent in separate atomic rows and leaves both cards party-neutral', async () => {
  const projection = projectProxyMeetingProductSurfaces({
    resolution: {
      resolved: [
        conveneEntry('claim-company-convene', 'The Company'),
        conveneEntry('claim-parent-convene', 'Parent'),
      ],
      open_world: [],
    },
    deal_id: 'proxy-meeting-shared-side-deal',
  });

  assert.equal(projection.cards.length, 2);
  assert.ok(projection.cards.every((card) => card.party === null));
  assert.deepEqual(
    projection.cards.map((card) => card.canonical_v2_lineage.obligated_party).sort(),
    ['Parent', 'The Company'],
  );
  assert.ok(projection.cards.every((card) => card.canonical_v2_lineage.claim_revision_ids.length === 1));

  const { votesApprovalsMeetingConfig } = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const rows = votesApprovalsMeetingConfig.selectRows({ cards: projection.cards })
    .filter((row) => row.featureKey === 'meetingConveneObligation');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.partyLabel).sort(), ['Parent', 'The Company']);
  assert.deepEqual(rows.map((row) => row.claimRevisionId).sort(), ['claim-company-convene', 'claim-parent-convene']);
});

test('document subjects do not become parties and cannot merge two scalar claims', async () => {
  const entries = ['company', 'parent'].map((side) => ({
    resolved_claim_definition_key: 'BOARD_RECOMMENDATION_INCLUSION',
    concept_key: 'COV-PROXY',
    section_reference: '6.5',
    party: null,
    provision_instance: { provision_instance_id: 'shared-proxy-document', party: null },
    claim: {
      claim_revision_id: `claim-${side}-recommendation`,
      canonical_value: true,
      raw_value: `the Joint Proxy Statement shall include the ${side} Board Recommendation.`,
      attributes: { obligated_party: 'the Joint Proxy Statement' },
    },
  }));
  const projection = projectProxyMeetingProductSurfaces({
    resolution: { resolved: entries, open_world: [] },
    deal_id: 'proxy-meeting-document-subject-deal',
  });
  assert.equal(projection.cards.length, 2);
  assert.ok(projection.cards.every((card) => card.party === null));
  assert.ok(projection.cards.every((card) => card.canonical_v2_lineage.obligated_party === null));

  const { votesApprovalsMeetingConfig } = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const rows = votesApprovalsMeetingConfig.selectRows({ cards: projection.cards })
    .filter((row) => row.featureKey === 'boardRecommendationInclusion');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.partyLabel === null));
  assert.deepEqual(rows.map((row) => row.claimRevisionId).sort(), [
    'claim-company-recommendation',
    'claim-parent-recommendation',
  ]);
});
