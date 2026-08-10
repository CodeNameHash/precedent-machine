'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectGeneralCovenantsProductSurfaces,
} = require('../lib/canonical-v2/general-covenants-product-projection');

const PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'The Company',
  capacity: 'TARGET',
});

function resolution() {
  return {
    resolved: [{
      resolved_claim_definition_key: 'GENERAL_COVENANT_PRESENT',
      concept_key: 'COV-ACCESS',
      section_reference: '6.11',
      party: PARTY,
      provision_instance: {
        provision_instance_id: 'general-covenant-access',
        party: PARTY,
      },
      claim: {
        claim_revision_id: 'claim-general-covenant-access',
        canonical_value: 'COV-ACCESS',
        raw_value: 'The Company shall provide Parent reasonable access to information.',
        attributes: {
          covenant_obligor: 'The Company',
        },
      },
    }],
    open_world: [],
  };
}

test('General Covenants carries the resolved obligor into the card and renders its existing party label', async () => {
  const projection = projectGeneralCovenantsProductSurfaces({
    resolution: resolution(),
    deal_id: 'general-covenants-party-deal',
  });
  const card = projection.cards[0];

  assert.deepEqual(card.party, PARTY);

  const { generalCovenantsConfig } = await import('../components/review/table-configs/general-covenants.config.js');
  const row = generalCovenantsConfig.selectRows({ cards: projection.cards })[0];
  const detailColumn = generalCovenantsConfig.columns.find((column) => column.id === 'detail');
  const html = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    detailColumn.renderCell(row, { primitives: {} }),
  ));

  assert.equal(row.partyLabel, 'The Company');
  assert.match(html, /Party: The Company/);
});

test('General Covenants refuses a resolved party that conflicts with the provision party', () => {
  const ambiguous = resolution();
  ambiguous.resolved[0].provision_instance.party = {
    role: 'COVENANT_OBLIGOR',
    value: 'Parent',
    capacity: 'BUYER',
  };

  assert.throws(
    () => projectGeneralCovenantsProductSurfaces({
      resolution: ambiguous,
      deal_id: 'general-covenants-ambiguous-party-deal',
    }),
    /party conflicts with its provision party/,
  );
});

test('General Covenants refuses a missing or malformed resolved party', () => {
  for (const party of [null, { role: 'COVENANT_OBLIGOR', value: 'The Company' }]) {
    const ambiguous = resolution();
    ambiguous.resolved[0].party = party;
    ambiguous.resolved[0].provision_instance.party = party;

    assert.throws(
      () => projectGeneralCovenantsProductSurfaces({
        resolution: ambiguous,
        deal_id: 'general-covenants-missing-party-deal',
      }),
      /party is ambiguous/,
    );
  }
});
