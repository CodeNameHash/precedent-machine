'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectAntitrustProductSurfaces,
} = require('../lib/canonical-v2/antitrust-product-projection');

const PARTY = Object.freeze({
  role: 'REGULATORY_COVENANT_OBLIGOR',
  value: 'Each of Parent and the Company',
  capacity: 'EITHER_PRINCIPAL_PARTY',
});

function resolvedEntry({ party = PARTY, provisionParty = party, claimId = 'claim-antitrust-efforts' } = {}) {
  return {
    resolved_claim_definition_key: 'REGULATORY_EFFORTS_STANDARD',
    concept_key: 'ANTI-EFFORTS',
    section_reference: '6.2',
    party,
    provision_instance: {
      provision_instance_id: 'antitrust-efforts-provision',
      party: provisionParty,
    },
    claim: {
      claim_revision_id: claimId,
      canonical_value: 'REASONABLE_BEST_EFFORTS',
      raw_value: 'Each of Parent and the Company shall use reasonable best efforts to obtain regulatory approval.',
      attributes: {},
    },
  };
}

function project(entries) {
  return projectAntitrustProductSurfaces({
    resolution: { resolved: entries, open_world: [] },
    deal_id: 'antitrust-party-deal',
  });
}

test('Antitrust carries the exact governed party to the card and displays its plain label', async () => {
  const projection = project([resolvedEntry()]);
  assert.deepEqual(projection.cards[0].party, PARTY);

  const { antitrustRegulatoryConfig } = await import('../components/review/table-configs/antitrust-regulatory.config.js');
  const row = antitrustRegulatoryConfig.selectRows({ cards: projection.cards })[0];
  const provisionColumn = antitrustRegulatoryConfig.columns.find((column) => column.id === 'signals');
  const html = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    provisionColumn.renderCell(row, { primitives: {} }),
  ));

  assert.equal(row.partyLabel, 'Each of Parent and the Company');
  assert.deepEqual(row.partyLabels, ['Each of Parent and the Company']);
  assert.match(html, /Party: Each of Parent and the Company/);
});

test('Antitrust rejects conflicting, incomplete, and grouped ambiguous parties', () => {
  assert.throws(
    () => project([resolvedEntry({
      provisionParty: {
        role: 'REGULATORY_COVENANT_OBLIGOR',
        value: 'Parent',
        capacity: 'BUYER',
      },
    })]),
    /party conflicts with its provision party/,
  );

  const incompleteParty = {
    role: 'REGULATORY_COVENANT_OBLIGOR',
    capacity: 'EITHER_PRINCIPAL_PARTY',
  };
  assert.throws(
    () => project([resolvedEntry({ party: incompleteParty, provisionParty: incompleteParty })]),
    /party is ambiguous/,
  );

  const parentParty = {
    role: 'REGULATORY_COVENANT_OBLIGOR',
    value: 'Parent',
    capacity: 'BUYER',
  };
  assert.throws(
    () => project([
      resolvedEntry(),
      resolvedEntry({ party: parentParty, provisionParty: parentParty, claimId: 'claim-antitrust-efforts-parent' }),
    ]),
    /claims for one provision have conflicting parties/,
  );
});
