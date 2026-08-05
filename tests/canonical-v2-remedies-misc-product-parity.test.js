'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EVIDENCE_SOURCE,
  projectRemediesMiscProductSurfaces,
} = require('../lib/canonical-v2/remedies-misc-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { calculateMarketStats } = require('../lib/row-market-stats/service');

const DEAL_ID = 'remedies-misc-product-deal';

function resolvedEntry({ definition, concept, provision, quote, value = true, attributes = {} }) {
  return {
    resolved_claim_definition_key: definition,
    concept_key: concept,
    section_reference: concept.startsWith('REM-') ? '9.8' : '9.10',
    provision_instance: { provision_instance_id: provision },
    claim: {
      claim_revision_id: `${provision}:${definition}`,
      raw_value: quote,
      canonical_value: value,
      attributes,
    },
  };
}

function fixture() {
  const quotes = {
    sp: 'Each Party shall be entitled to specific performance without posting any bond or other security.',
    financing: 'The Company may enforce specific performance if and only if the Debt Financing has been funded.',
    nonrecourse: 'No Debt Financing Source shall have any liability to the Company under this Agreement.',
    jury: 'EACH PARTY IRREVOCABLY WAIVES ANY RIGHT TO A TRIAL BY JURY.',
    law: 'This Agreement shall be governed by the laws of the State of Delaware.',
    forum: 'Each Party submits to the exclusive jurisdiction of the Court of Chancery of the State of Delaware.',
    assignment: 'This Agreement shall not be assigned without the prior written consent of the other Party.',
    amendment: 'This Agreement may be amended only by a written instrument signed by the Parties.',
    notices: 'All notices shall be delivered by email or nationally recognised courier.',
    entire: 'This Agreement constitutes the entire agreement among the Parties.',
    tpb: 'This Agreement does not confer upon any Person any third-party beneficiary rights.',
    severability: 'If any provision is invalid or unenforceable, the remaining provisions remain in effect.',
    counterparts: 'This Agreement may be executed in counterparts and by electronic signature.',
  };
  const resolution = {
    resolved: [
      resolvedEntry({ definition: 'SPECIFIC_PERFORMANCE_AVAILABLE', concept: 'REM-SP', provision: 'rem-sp', quote: quotes.sp, attributes: { sp_holder_scope: 'MUTUAL', sp_holder_ref: 'Each Party' } }),
      resolvedEntry({ definition: 'SPECIFIC_PERFORMANCE_FINANCING_CONDITION', concept: 'REM-SP', provision: 'rem-sp', quote: quotes.financing, attributes: { financing_term_ref: 'Debt Financing' } }),
      resolvedEntry({ definition: 'SP_BOND_SECURITY_WAIVER', concept: 'REM-SP', provision: 'rem-sp', quote: quotes.sp }),
      resolvedEntry({ definition: 'NON_RECOURSE_PROVISION', concept: 'REM-NONRECOURSE', provision: 'rem-nonrecourse', quote: quotes.nonrecourse, attributes: { protected_class_kind: 'FINANCING_SOURCES', protected_class_ref: 'Debt Financing Source' } }),
      resolvedEntry({ definition: 'JURY_TRIAL_WAIVER', concept: 'REM-JURY', provision: 'rem-jury', quote: quotes.jury }),
      resolvedEntry({ definition: 'GOVERNING_LAW_STATE', concept: 'ADMIN-GOVLAW', provision: 'admin-law', quote: quotes.law, value: 'DELAWARE' }),
      resolvedEntry({ definition: 'FORUM_SELECTION_PROVISION', concept: 'ADMIN-FORUM', provision: 'admin-forum', quote: quotes.forum, attributes: { primary_forum_ref: 'Court of Chancery of the State of Delaware' } }),
      resolvedEntry({ definition: 'FORUM_EXCLUSIVE', concept: 'ADMIN-FORUM', provision: 'admin-forum', quote: quotes.forum }),
      resolvedEntry({ definition: 'ASSIGNMENT_CONSENT_RESTRICTION', concept: 'ADMIN-ASSIGN', provision: 'admin-assign', quote: quotes.assignment }),
      resolvedEntry({ definition: 'AMENDMENT_WRITTEN_INSTRUMENT', concept: 'ADMIN-AMEND', provision: 'admin-amend', quote: quotes.amendment }),
      resolvedEntry({ definition: 'NOTICES_PROVISION', concept: 'ADMIN-NOTICES', provision: 'admin-notices', quote: quotes.notices }),
      resolvedEntry({ definition: 'ENTIRE_AGREEMENT_INTEGRATION', concept: 'ADMIN-ENTIRE', provision: 'admin-entire', quote: quotes.entire }),
      resolvedEntry({ definition: 'NO_THIRD_PARTY_BENEFICIARIES', concept: 'ADMIN-TPB', provision: 'admin-tpb', quote: quotes.tpb }),
      resolvedEntry({ definition: 'SEVERABILITY_PROVISION', concept: 'ADMIN-SEVER', provision: 'admin-sever', quote: quotes.severability }),
      resolvedEntry({ definition: 'COUNTERPARTS_EXECUTION', concept: 'ADMIN-COUNTER', provision: 'admin-counter', quote: quotes.counterparts }),
    ],
    open_world: [
      {
        closure_id: 'sole-remedy-open', section_reference: '8.3', claim_definition_key: 'OPEN_WORLD_PROPOSITION', reason: 'UNMAPPED_GENERIC_CLAIM_KEY',
        raw_value: 'Payment of the Parent Termination Fee is the sole and exclusive remedy.', canonical_value: null,
        attributes: { why_unmapped: 'SOLE_REMEDY_EVIDENCE: termination-fee-owned economics', nearest_concept: null }, evidence: [],
      },
      {
        closure_id: 'notice-open', section_reference: '9.2', claim_definition_key: 'OPEN_WORLD_PROPOSITION', reason: 'UNMAPPED_GENERIC_CLAIM_KEY',
        raw_value: 'Notice is effective one Business Day after delivery, or at 5:00 p.m. if sent by email.', canonical_value: null,
        attributes: { why_unmapped: 'NOTICE: multiple timing literals', nearest_concept: null }, evidence: [],
      },
      {
        closure_id: 'forum-open', section_reference: '9.10', claim_definition_key: 'OPEN_WORLD_PROPOSITION', reason: 'UNMAPPED_GENERIC_CLAIM_KEY',
        raw_value: 'If Chancery lacks jurisdiction, proceedings may be brought in federal court, then state court.', canonical_value: null,
        attributes: { why_unmapped: 'FORUM_FALLBACK: nested forum cascade', nearest_concept: null }, evidence: [],
      },
    ],
  };
  return { quotes, projection: projectRemediesMiscProductSurfaces({ resolution, deal_id: DEAL_ID }) };
}

function compareFields(projection, cardId) {
  const result = executeDealCompare({
    deal_ids: [DEAL_ID], provision_types: ['MISC_BOILERPLATE'], included_field_groups: ['all'], highlight_deltas: false,
  }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', metadata: {} }],
    provisions: projection.cards.filter((card) => card.id === cardId),
  });
  return new Map(result.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
}

test('governed remedies and boilerplate claims project without promoting boundary evidence', () => {
  const { projection } = fixture();
  const sp = projection.cards.find((card) => card.id === 'rem-sp:REM-SP');
  const forum = projection.cards.find((card) => card.id === 'admin-forum:ADMIN-FORUM');
  assert.equal(sp.features.specificPerformance, true);
  assert.equal(sp.features.specificPerformanceMutual, true);
  assert.equal(sp.features.bondSecurityRequiredForSP, false);
  assert.match(sp.features.specificPerformanceLimitations, /Debt Financing/);
  assert.match(sp.features.specificPerformanceLimitations, /bond or other security/);
  assert.deepEqual(forum.features.forumCourts, ['Court of Chancery of the State of Delaware']);
  assert.equal(forum.features.jurisdictionExclusive, true);
  assert.equal(projection.cards.some((card) => card.provision_subtype === 'REM-CAP'), false);
  assert.equal(projection.claims.some((claim) => /sole and exclusive remedy|one Business Day|federal court/.test(claim.verbatim)), false);
  assert.equal(projection.open_items.some((item) => /sole and exclusive remedy/.test(item.raw_value)), true);
  assert.equal(projection.cards.some((card) => /sole and exclusive remedy/.test(card.full_text)), false);
  const evidenceCards = projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE);
  assert.equal(evidenceCards.length, 2);
  assert.ok(evidenceCards.every((card) => Object.keys(card.features).length === 0));
});

test('governed remedies and boilerplate reach Review, Query, Compare and market statistics', async () => {
  const { projection } = fixture();
  const config = await import('../components/review/table-configs/misc-boilerplate.config.js');
  const rows = config.miscBoilerplateConfig.selectRows({ cards: projection.cards });
  for (const rowId of [
    'misc-boilerplate-governing-law',
    'misc-boilerplate-forum',
    'misc-boilerplate-specific-performance',
    'misc-boilerplate-jury-waiver',
    'misc-boilerplate-amendment',
    'misc-boilerplate-severability',
    'misc-boilerplate-counterparts',
    'misc-boilerplate-non-recourse',
    'misc-boilerplate-notices',
    'misc-boilerplate-entire-agreement',
    'misc-boilerplate-no-third-party-beneficiaries',
    'misc-boilerplate-assignment',
  ]) assert.ok(rows.some((row) => row.id === rowId), rowId);
  const evidenceRows = rows.filter((row) => row.marketState === 'OPEN_NATIVE_FIELD');
  assert.equal(evidenceRows.length, 2);

  const spFields = compareFields(projection, 'rem-sp:REM-SP');
  assert.equal(spFields.get('specificPerformance'), true);
  assert.equal(spFields.get('specificPerformanceMutual'), true);
  assert.equal(spFields.get('bondSecurityRequiredForSP'), false);
  assert.match(spFields.get('specificPerformanceLimitations'), /Debt Financing|bond/);
  const juryFields = compareFields(projection, 'rem-jury:REM-JURY');
  assert.equal(juryFields.get('juryWaiver'), true);
  const lawFields = compareFields(projection, 'admin-law:ADMIN-GOVLAW');
  assert.equal(lawFields.get('governingLaw'), 'DELAWARE');
  const forumFields = compareFields(projection, 'admin-forum:ADMIN-FORUM');
  assert.equal(forumFields.get('jurisdictionExclusive'), true);
  assert.match(forumFields.get('forumCourts'), /Court of Chancery/);
  const assignmentFields = compareFields(projection, 'admin-assign:ADMIN-ASSIGN');
  assert.match(assignmentFields.get('assignmentRestrictions'), /prior written consent/);

  const adapter = await import('../lib/market-metrics/adapter.js');
  for (const row of evidenceRows) assert.equal(adapter.resolveMarketMetricRow(row, { configId: 'misc-boilerplate' }).resolution, 'evidence_only');
  const specs = rows
    .filter((row) => row.marketSubterms || row.featureKeys)
    .flatMap((row) => adapter.resolveMarketMetricSpecs(row, { configId: 'misc-boilerplate' }));
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: DEAL_ID, acquirer: 'Parent', target: 'Company', value_usd: 1000000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow).flatMap((row) => Object.values(row.metrics)).some((result) => result.coverage?.observedCount === 1));
});
