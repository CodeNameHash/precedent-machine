'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const { projectKeyTermsMaeClaims } = require('../lib/canonical-v2/key-terms-mae-product-projection');

const PARTY = Object.freeze({ role: 'DEFINITION_SUBJECT', value: 'the Company', capacity: 'TARGET' });
const PROVISION_ID = 'provision:company-mae';

function maeEntry(key, id, canonicalValue, attributes, rawValue) {
  return {
    section_reference: '1.1',
    concept_key: 'DEF-MAE',
    resolved_claim_definition_key: key,
    party: PARTY,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: PROVISION_ID,
      party: PARTY,
    },
    claim: {
      claim_revision_id: id,
      claim_definition_key: key,
      subject_occurrence_id: PROVISION_ID,
      state: 'PRESENT',
      canonical_value: canonicalValue,
      raw_value: rawValue,
      attributes: {
        section_reference: '1.1',
        defined_term_ref: 'Company Material Adverse Effect',
        definition_subject: 'the Company',
        ...attributes,
      },
    },
  };
}

function prong(id, code, quote) {
  return maeEntry('MAE_DEFINITION_PRONG', id, code, { prong_code: code }, quote);
}

test('a governed prong creates an honest review-card feature without inventing a limb count', () => {
  const quote = 'has a material adverse effect on the business, assets, liabilities or results of operations of the Company';
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: [prong('claim:business-effects', 'BUSINESS_EFFECTS', quote)],
  });

  assert.equal(projection.records.length, 1);
  assert.equal(projection.mae_review_cards.length, 1);
  const [card] = projection.mae_review_cards;
  assert.equal(Object.hasOwn(card.features, 'maeLimbType'), false);
  assert.equal(Object.hasOwn(card.features, 'maeLimbs'), false);
  assert.deepEqual(card.features.maeDefinitionProngs, [{
    code: 'BUSINESS_EFFECTS',
    label: 'Business effects',
    text: quote,
    quotes: [quote],
    claim_revision_id: 'claim:business-effects',
    source_claim_revision_ids: ['claim:business-effects'],
    source_section_reference: '1.1',
  }]);
  assert.deepEqual(card.canonical_v2_lineage.claim_revision_ids, ['claim:business-effects']);
  assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids, {
    maeDefinitionProngs: ['claim:business-effects'],
  });
});

test('the MAE table displays each governed code as a plain label with that claim exact evidence', async () => {
  const businessQuote = 'has a material adverse effect on the business and operations of the Company';
  const consummationQuote = 'prevents or materially delays the consummation of the Merger';
  const carveoutQuote = '(a) changes in general economic conditions';
  const relationshipQuote = 'in the case of clause (a), except to the extent disproportionately adverse relative to other industry participants';
  const projection = projectKeyTermsMaeClaims({
    resolved_entries: [
      prong('claim:business-effects', 'BUSINESS_EFFECTS', businessQuote),
      prong('claim:consummation', 'CONSUMMATION_PREVENTION', consummationQuote),
      maeEntry('MAE_CARVEOUT', 'claim:economy', 'ECONOMY_GENERAL', {
        carveout_code: 'ECONOMY_GENERAL', clause_label: '(a)', limb_path: ['carveouts', '(a)'],
      }, carveoutQuote),
      maeEntry('MAE_DISPROPORTIONALITY_CARVEBACK', 'claim:disproportionality', true, {
        carveback_source_form: 'TRAILING_LIST',
        applies_to_clause_labels: ['(a)'],
        comparison_baseline_phrase: 'other industry participants',
        incremental_impact_phrase: null,
        limb_path: [],
      }, relationshipQuote),
    ],
  });

  assert.equal(projection.records.length, 4);
  assert.equal(projection.mae_review_cards.length, 1);
  const [card] = projection.mae_review_cards;
  assert.deepEqual(card.canonical_v2_lineage.feature_claim_revision_ids, {
    carveouts: ['claim:economy'],
    maeCarveouts: ['claim:economy'],
    maeDisproportionalityRollup: ['claim:disproportionality', 'claim:economy'],
    maeDefinitionProngs: ['claim:business-effects', 'claim:consummation'],
    maeDisproportionalityRelationships: ['claim:disproportionality'],
  });

  const { maeDefinitionsConfig } = await import('../components/review/table-configs/mae-definitions.config.js');
  const rows = maeDefinitionsConfig.selectRows({ cards: projection.mae_review_cards });
  const prongRow = rows.find((row) => row.featureKey === 'maeDefinitionProngs');
  const relationshipRow = rows.find((row) => row.featureKey === 'maeDisproportionalityRelationships');
  assert.ok(prongRow);
  assert.ok(relationshipRow);
  assert.equal(rows.some((row) => row.featureKey === 'maeLimbType' || row.featureKey === 'maeLimbs'), false);

  const PillCell = ({ label, evidence }) => React.createElement('span', { 'data-evidence': evidence }, label);
  const signalColumn = maeDefinitionsConfig.columns.find((column) => column.id === 'signals');
  const prongHtml = renderToStaticMarkup(signalColumn.renderCell(prongRow, { primitives: { PillCell } }));
  assert.match(prongHtml, />Business effects</);
  assert.match(prongHtml, />Consummation prevention</);
  assert.match(prongHtml, new RegExp(`data-evidence="${businessQuote}"`));
  assert.match(prongHtml, new RegExp(`data-evidence="${consummationQuote}"`));
  assert.doesNotMatch(prongHtml, /ONE_LIMB|TWO_LIMB|One limb|Two limbs/);

  const relationshipHtml = renderToStaticMarkup(signalColumn.renderCell(relationshipRow, { primitives: { PillCell } }));
  assert.match(relationshipHtml, />Disproportionality carveback</);
  assert.ok(relationshipHtml.includes(`data-evidence="${relationshipQuote}"`));
});
