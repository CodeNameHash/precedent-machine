'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectProxyMeetingProductSurfaces,
} = require('../lib/canonical-v2/proxy-meeting-product-projection');

function deadlineEntry({ claimId, party, trigger = 'MAILING' }) {
  return {
    resolved_claim_definition_key: 'MEETING_DEADLINE_DAYS',
    concept_key: 'COV-MEETING',
    section_reference: '4.5',
    party: null,
    provision_instance: {
      provision_instance_id: 'topbuild-meeting-provision',
      party: null,
    },
    claim: {
      claim_revision_id: claimId,
      canonical_value: '21',
      raw_value: `${party} shall hold its stockholder meeting within twenty-one (21) business days after mailing.`,
      attributes: {
        assertion_kind: 'MEETING_DEADLINE',
        anchor_kind: trigger,
        day_kind: 'BUSINESS',
        obligated_party: party,
      },
    },
  };
}

function projectionFor(entries) {
  return projectProxyMeetingProductSurfaces({
    resolution: { resolved: entries, open_world: [] },
    deal_id: 'topbuild-deadline-display',
  });
}

async function renderedMeetingRows(entries) {
  const projection = projectionFor(entries);
  const { votesApprovalsMeetingConfig } = await import('../components/review/table-configs/votes-approvals-meeting.config.js');
  const rows = votesApprovalsMeetingConfig.selectRows({ cards: projection.cards })
    .filter((row) => row.id.startsWith('votes-approvals-meeting-meeting'));
  const provisionColumn = votesApprovalsMeetingConfig.columns.find((column) => column.id === 'provision');
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', null, label),
  };
  return {
    projection,
    rows,
    html: rows.map((row) => renderToStaticMarkup(React.createElement(
      React.Fragment,
      null,
      provisionColumn.renderCell(row, { primitives }),
    ))),
  };
}

test('TopBuild renders both exact party-bound meeting deadlines without merging them', async () => {
  const result = await renderedMeetingRows([
    deadlineEntry({ claimId: 'topbuild-parent-deadline', party: 'Parent' }),
    deadlineEntry({ claimId: 'topbuild-company-deadline', party: 'The Company' }),
  ]);

  assert.equal(result.projection.cards.length, 2);
  assert.deepEqual(
    result.projection.cards.map((card) => card.features.meetingDeadline.party).sort(),
    ['Parent', 'The Company'],
  );
  assert.ok(result.projection.cards.every((card) => card.party === null));
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.partyLabel).sort(), ['Parent', 'The Company']);
  assert.ok(result.rows.every((row) => row.deadline.days === 21));
  assert.ok(result.rows.every((row) => row.deadline.unit === 'BUSINESS_DAYS'));
  assert.ok(result.rows.every((row) => row.deadline.trigger === 'MAILING'));
  assert.ok(result.html.some((html) => /Party: Parent/.test(html)));
  assert.ok(result.html.some((html) => /Party: The Company/.test(html)));
  assert.ok(result.html.every((html) => /21.*business days.*after.*mailing/.test(html)), result.html.join('\n'));
});

test('meeting deadline display does not invent a missing trigger', async () => {
  const result = await renderedMeetingRows([
    deadlineEntry({ claimId: 'topbuild-triggerless-deadline', party: 'The Company', trigger: null }),
  ]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].deadline.trigger, null);
  assert.match(result.html[0], /21.*business days/);
  assert.doesNotMatch(result.html[0], /after/);
});
