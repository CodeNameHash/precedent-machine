'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectClosingConditionProductSurfaces,
} = require('../lib/canonical-v2/closing-conditions-product-projection');

const PARTY = Object.freeze({
  role: 'CONDITION_BENEFICIARY',
  value: 'Either Principal Party',
  capacity: 'EITHER_PRINCIPAL_PARTY',
});

function resolution() {
  return {
    resolved: [{
      resolved_claim_definition_key: 'STOCKHOLDER_APPROVAL_CONDITION',
      concept_key: 'COND-M-STOCKHOLDER',
      section_reference: '7.01',
      party: PARTY,
      provision_instance: {
        provision_instance_id: 'closing-condition-stockholder',
        party: PARTY,
      },
      claim: {
        claim_revision_id: 'claim-closing-condition-stockholder',
        canonical_value: true,
        raw_value: 'The Company Stockholder Approval shall have been obtained.',
        attributes: {
          approval_definition_ref: 'The Company Stockholder Approval',
        },
      },
    }],
  };
}

test('Closing Conditions carries the exact resolved party into the card and rendered condition row', async () => {
  const projection = projectClosingConditionProductSurfaces({
    resolution: resolution(),
    deal_id: 'closing-conditions-party-deal',
  });
  const card = projection.cards[0];

  assert.deepEqual(card.party, PARTY);

  const { conditionGroups } = await import('../components/review/table-configs/conditions.config.js');
  const groups = conditionGroups({ cards: projection.cards }, {});
  const row = groups.flatMap((group) => group.rows)
    .find((candidate) => candidate.marketProvisionCodes?.includes('COND-M-STOCKHOLDER'));
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));

  assert.equal(row.partyLabel, 'Either Principal Party');
  assert.match(html, /Party: Either Principal Party/);
});

test('Closing Conditions refuses conflicting resolved and provision parties', () => {
  const conflicting = resolution();
  conflicting.resolved[0].provision_instance.party = {
    role: 'CONDITION_BENEFICIARY',
    value: 'Parent',
    capacity: 'BUYER',
  };

  assert.throws(
    () => projectClosingConditionProductSurfaces({
      resolution: conflicting,
      deal_id: 'closing-conditions-conflicting-party-deal',
    }),
    /party conflicts with its provision party/,
  );
});

test('Closing Conditions displays each exact party when one canonical row has separate source provisions', async () => {
  const multiParty = resolution();
  const parentParty = {
    role: 'CONDITION_BENEFICIARY',
    value: 'Parent',
    capacity: 'BUYER',
  };
  multiParty.resolved.push({
    ...structuredClone(multiParty.resolved[0]),
    party: parentParty,
    provision_instance: {
      provision_instance_id: 'closing-condition-stockholder-parent',
      party: parentParty,
    },
    claim: {
      ...structuredClone(multiParty.resolved[0].claim),
      claim_revision_id: 'claim-closing-condition-stockholder-parent',
      raw_value: 'The Parent Stockholder Approval shall have been obtained.',
    },
  });
  const projection = projectClosingConditionProductSurfaces({
    resolution: multiParty,
    deal_id: 'closing-conditions-multiple-party-deal',
  });
  const { conditionGroups } = await import('../components/review/table-configs/conditions.config.js');
  const row = conditionGroups({ cards: projection.cards }, {})
    .flatMap((group) => group.rows)
    .find((candidate) => candidate.marketProvisionCodes?.includes('COND-M-STOCKHOLDER'));
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));

  assert.deepEqual(new Set(row.partyLabels), new Set(['Either Principal Party', 'Parent']));
  assert.match(html, /Party: Either Principal Party/);
  assert.match(html, /Party: Parent/);
});

test('Closing Conditions refuses an incomplete party and different parties grouped under one provision', () => {
  const incomplete = resolution();
  const incompleteParty = {
    role: 'CONDITION_BENEFICIARY',
    capacity: 'EITHER_PRINCIPAL_PARTY',
  };
  incomplete.resolved[0].party = incompleteParty;
  incomplete.resolved[0].provision_instance.party = incompleteParty;
  assert.throws(
    () => projectClosingConditionProductSurfaces({
      resolution: incomplete,
      deal_id: 'closing-conditions-incomplete-party-deal',
    }),
    /party is ambiguous/,
  );

  const groupedConflict = resolution();
  const parentParty = {
    role: 'CONDITION_BENEFICIARY',
    value: 'Parent',
    capacity: 'BUYER',
  };
  groupedConflict.resolved.push({
    ...structuredClone(groupedConflict.resolved[0]),
    party: parentParty,
    provision_instance: {
      ...structuredClone(groupedConflict.resolved[0].provision_instance),
      party: parentParty,
    },
    claim: {
      ...structuredClone(groupedConflict.resolved[0].claim),
      claim_revision_id: 'claim-closing-condition-stockholder-conflict',
    },
  });
  assert.throws(
    () => projectClosingConditionProductSurfaces({
      resolution: groupedConflict,
      deal_id: 'closing-conditions-grouped-party-conflict-deal',
    }),
    /claims for one provision have conflicting parties/,
  );
});
