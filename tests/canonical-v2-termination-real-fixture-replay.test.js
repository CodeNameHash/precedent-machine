'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV28 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeTerminationFeeProposals,
  shapeTerminationProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
} = require('../lib/canonical-v2/termination-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { provisionFieldValue } = require('../lib/query/types');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const LANDOS_PATH = path.join(__dirname, '..', '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt');
const LANDOS_SOURCE = fs.readFileSync(LANDOS_PATH, 'utf8');
const CONTRACT = compileFixtureContractV28();

function exactSlice(startMarker, endMarker) {
  const start = LANDOS_SOURCE.indexOf(startMarker);
  assert.notEqual(start, -1, `missing Landos marker: ${startMarker}`);
  const end = LANDOS_SOURCE.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing Landos marker: ${endMarker}`);
  return LANDOS_SOURCE.slice(start, end).trim();
}

async function resolveLandosFamily({ family, sectionReference, response, shaper }) {
  const dealKey = `deal:landos-abbvie:${family}`;
  const documentHash = sha256Hex(Buffer.from(LANDOS_SOURCE, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(LANDOS_SOURCE, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const receipt = await runNativeExtraction({
    source_text: LANDOS_SOURCE,
    document_hash: documentHash,
    section_references: [sectionReference],
    contract_bundle: CONTRACT,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shaper(response, governedScope.source_text);
      return {
        provider_id: 'landos-committed-fixture-replay/v1',
        model_id: 'recorded-response',
        prompt: `${family.toLowerCase()}-landos-replay/v1`,
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  });
}

function compareFields(dealId, provisionType, cards) {
  const output = executeDealCompare({
    deal_ids: [dealId],
    provision_types: [provisionType],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', value_usd: 200000000, metadata: {} }],
    provisions: cards,
  });
  return new Map(output.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
}

test('the full committed Landos agreement resolves Termination Rights and keeps extension mechanics open world across product surfaces', async () => {
  const mutualQuote = 'by the mutual written consent of the Company and Parent';
  const legalQuote = exactSlice(
    '(c) by either the Company or Parent if any Governmental Body',
    ' (d) by either the Company or Parent if the Company Stockholders’ Meeting',
  );
  const extensionQuote = exactSlice(
    'provided, further, that if\non the End Date all of the conditions to Closing',
    ' \n\n(c) by either the Company or Parent if any Governmental Body',
  );
  const resolution = await resolveLandosFamily({
    family: 'TERMINATION',
    sectionReference: '7.1',
    shaper: shapeTerminationProposals,
    response: {
      termination_right_assertions: [
        {
          section_reference: '7.1',
          assertion_kind: 'RIGHT_GRANT',
          trigger_kind: 'MUTUAL_CONSENT',
          terminating_party_scope: 'EITHER_PARTY',
          terminating_party: 'the Company and Parent',
          deadline_term: null,
          day_kind: null,
          period_kind: null,
          quote: mutualQuote,
        },
        {
          section_reference: '7.1',
          assertion_kind: 'RIGHT_GRANT',
          trigger_kind: 'LEGAL_RESTRAINT',
          terminating_party_scope: 'EITHER_PARTY',
          terminating_party: 'either the Company or Parent',
          deadline_term: null,
          day_kind: null,
          period_kind: null,
          quote: legalQuote,
        },
      ],
      wave_b_mechanics: [{
        surface: 'OUTSIDE_DATE_EXTENSION',
        section_reference: '7.1',
        detail: 'Parent may extend the End Date up to three times for three months each.',
        quote: extensionQuote,
        extension_mode: 'ELECTIVE',
        electing_party: 'Parent',
        maximum_exercises: 3,
        extension_period_quote: 'three (3) months',
      }],
      open_world_candidates: [],
    },
  });

  assert.deepEqual(
    resolution.resolved.map((entry) => entry.concept_key).sort(),
    ['TERMR-LEGAL', 'TERMR-MUTUAL'],
  );
  assert.equal(resolution.review_queue.length, 2);
  assert.ok(resolution.review_queue.every((item) => item.has_resolution && item.reasons.length === 0));
  assert.equal(resolution.open_world.length, 1);
  assert.match(resolution.open_world[0].attributes.why_unmapped, /^OUTSIDE_DATE_EXTENSION:/);
  assert.equal(resolution.open_world[0].attributes.structured_mechanic.extension_mode, 'ELECTIVE');
  assert.equal(resolution.open_world[0].attributes.structured_mechanic.maximum_exercises, 3);

  const dealId = 'landos-termination-rights';
  const projection = projectTerminationRightsProductSurfaces({ resolution, deal_id: dealId });
  assert.equal(projection.cards.filter((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE).length, 2);
  assert.equal(projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE).length, 1);
  assert.equal(projection.open_items[0].structured_mechanic.maximum_exercises, 3);
  const mutual = projection.cards.find((card) => card.provision_subtype === 'TERMR-MUTUAL');
  assert.equal(provisionFieldValue(mutual, 'TERMINATION_RIGHT', 'partyWhoCanTerminate').value, 'PARTY_MUTUAL');

  const review = await import('../components/review/table-configs/termination-rights.config.js');
  const selected = review.terminationRightsConfig.selectRows({ cards: projection.cards });
  const rows = selected[0].groups.flatMap((group) => group.rows);
  assert.ok(rows.some((row) => row.present && row.id === 'termination-rights-mutual'));
  assert.ok(rows.some((row) => row.id.startsWith('termination-rights-deferred-')));

  const compare = compareFields(dealId, 'TERMINATION_RIGHT', projection.cards);
  assert.equal(compare.get('partyWhoCanTerminate'), 'PARTY_MUTUAL');
  assert.equal(compare.get('extensionMaxExercises'), 3);

  const mutualRow = rows.find((row) => row.id === 'termination-rights-mutual');
  const adapter = await import('../lib/market-metrics/adapter.js');
  const specs = adapter.resolveMarketMetricSpecs(mutualRow, { configId: 'termination-rights' });
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: dealId, value_usd: 200000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow[specs[0].rowKey].metrics)
    .some((metric) => metric.coverage?.observedCount === 1));
});

test('the full committed Landos agreement resolves the Termination Fee amount and tail while sole-remedy mechanics stay open world across product surfaces', async () => {
  const amountQuote = exactSlice(
    'then, in each case, the Company shall pay, by wire transfer',
    ' Other than as specified in Section 7.2(a)',
  );
  const tailQuote = exactSlice(
    '2. within twelve (12) months of termination of this Agreement',
    '\n\nthen, in each case, the Company shall pay',
  );
  const soleRemedyQuote = exactSlice(
    '(b) Claims. Each Party agrees that notwithstanding',
    ' (c) Acknowledgements. Each Party acknowledges',
  );
  const resolution = await resolveLandosFamily({
    family: 'TERMINATION_FEE',
    sectionReference: '7.3',
    shaper: shapeTerminationFeeProposals,
    response: {
      fee_amount_assertions: [{
        section_reference: '7.3',
        fee_side: 'SELLER',
        payer_party: 'the Company',
        fee_term_ref: 'Termination Fee',
        quote: amountQuote,
      }],
      fee_trigger_assertions: [],
      tail_period_assertions: [{ section_reference: '7.3', quote: tailQuote }],
      wave_b_mechanics: [{
        surface: 'SOLE_REMEDY',
        section_reference: '7.3',
        detail: 'Payment is the sole and exclusive remedy, subject to Fraud and Willful Breach.',
        quote: soleRemedyQuote,
        payment_context_quote: 'payment of the Termination Fee',
        remedy_effect_quote: 'sole and exclusive remedy',
        carve_outs: [
          { kind: 'FRAUD', quote: 'Fraud' },
          { kind: 'WILLFUL_BREACH', quote: 'Willful Breach' },
        ],
      }],
      open_world_candidates: [],
    },
  });

  assert.equal(resolution.review_queue.length, 2);
  assert.ok(resolution.review_queue.every((item) => item.has_resolution && item.reasons.length === 0));
  assert.equal(resolution.open_world.length, 1);
  assert.match(resolution.open_world[0].attributes.why_unmapped, /^SOLE_REMEDY_EVIDENCE:/);
  assert.deepEqual(
    resolution.open_world[0].attributes.structured_mechanic.carve_outs.map((entry) => entry.kind),
    ['FRAUD', 'WILLFUL_BREACH'],
  );
  const amount = resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'TERMINATION_FEE_AMOUNT');
  const tail = resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'TERMINATION_FEE_TAIL_PERIOD_MONTHS');
  assert.equal(amount.claim.canonical_value, '7000000');
  assert.equal(amount.concept_key, 'TERMF-TARGET');
  assert.equal(tail.claim.canonical_value, '12');
  assert.equal(tail.concept_key, 'TERMF-TAIL');

  const dealId = 'landos-termination-fee';
  const projection = projectTerminationFeeProductSurfaces({ resolution, deal_id: dealId });
  assert.equal(projection.cards.filter((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE).length, 2);
  assert.equal(projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE).length, 1);
  assert.equal(projection.open_items[0].surface, 'SOLE_REMEDY_EVIDENCE');
  assert.equal(projection.open_items[0].structured_mechanic.owner_family, 'SPECIFIC_PERFORMANCE_REMEDIES');
  const seller = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  assert.equal(provisionFieldValue(seller, 'TERMINATION_FEE', 'feeAmount').value, 7000000);

  const review = await import('../components/review/table-configs/termination-fees.config.js');
  const rows = review.terminationFeesConfig.selectRows({ cards: projection.cards, value_usd: 200000000 });
  assert.ok(rows.some((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(rows.some((row) => row.id.startsWith('termination-fees-deferred-')));
  const tailReview = await import('../components/review/table-configs/tail-fee.config.js');
  assert.equal(tailReview.tailFeeConfig.selectRows({ cards: projection.cards })[0].value, '12 months');

  const compare = compareFields(dealId, 'TERMINATION_FEE', projection.cards);
  assert.equal(compare.get('feeAmount'), 7000000);
  assert.equal(compare.get('feePctOfDealValue'), 3.5);
  assert.equal(compare.get('tailFeeWindowMonths'), 12);
  assert.equal(compare.has('soleRemedy'), false);

  const sellerRow = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  const adapter = await import('../lib/market-metrics/adapter.js');
  const specs = adapter.resolveMarketMetricSpecs(sellerRow, { configId: 'termination-fees' });
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: dealId, value_usd: 200000000, metadata: { deal_value_basis: 'equity_value' } }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow[specs[0].rowKey].metrics)
    .some((metric) => metric.coverage?.observedCount === 1));
});
