'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { shapeTerminationFeeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectTerminationFeeProductSurfaces } = require('../lib/canonical-v2/termination-product-projection');
const { projectRemediesMiscProductSurfaces } = require('../lib/canonical-v2/remedies-misc-product-projection');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const LANDOS_SOURCE = fs.readFileSync(path.join(
  __dirname,
  '..',
  '__fixtures__',
  'demo-deal',
  'landos-abbvie-agreement.txt',
), 'utf8');
const CONTRACT = compileFixtureContractV38();

function exactSlice(startMarker, endMarker) {
  const start = LANDOS_SOURCE.indexOf(startMarker);
  assert.notEqual(start, -1, startMarker);
  const end = LANDOS_SOURCE.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, endMarker);
  return LANDOS_SOURCE.slice(start, end).trim();
}

const SOLE_REMEDY_QUOTE = exactSlice(
  '(b) Claims. Each Party agrees that notwithstanding',
  ' (c) Acknowledgements. Each Party acknowledges',
);

async function resolveSoleRemedy({
  remedyEffectQuote = 'sole and exclusive remedy',
  carveOuts = [
    { kind: 'FRAUD', quote: 'Fraud' },
    { kind: 'WILLFUL_BREACH', quote: 'Willful Breach' },
  ],
  paymentContextQuote = 'payment of such Termination Fee',
} = {}) {
  const dealKey = 'deal:landos-sole-remedy';
  const admittedSourceContext = buildIdentityAdmittedSourceContext(LANDOS_SOURCE, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const receipt = await runNativeExtraction({
    source_text: LANDOS_SOURCE,
    document_hash: sha256Hex(Buffer.from(LANDOS_SOURCE, 'utf8')),
    section_references: ['7.3'],
    contract_bundle: CONTRACT,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeTerminationFeeProposals({
        fee_amount_assertions: [],
        fee_trigger_assertions: [],
        tail_period_assertions: [],
        wave_b_mechanics: [{
          surface: 'SOLE_REMEDY',
          section_reference: '7.3',
          detail: 'sole-remedy legal effect and exceptions',
          quote: SOLE_REMEDY_QUOTE,
          payment_context_quote: paymentContextQuote,
          remedy_effect_quote: remedyEffectQuote,
          carve_outs: carveOuts,
        }],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'sole-remedy-hostile-fixture/v1',
        model_id: 'recorded-response',
        prompt: 'sole-remedy-hostile-fixture/v1',
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

test('V38 registers the approved Remedies-owned sole-remedy effect and closed carve-out enum', () => {
  assert.ok(CONTRACT.concepts.some((entry) => entry.concept_key === 'REM-SOLE'));
  const effect = CONTRACT.claim_definitions.find((entry) => entry.claim_definition_key === 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT');
  const carveOut = CONTRACT.claim_definitions.find((entry) => entry.claim_definition_key === 'SOLE_REMEDY_CARVEOUT_KIND');
  assert.deepEqual(effect.allowed_canonical_values, [true]);
  assert.deepEqual(carveOut.allowed_canonical_values, ['FRAUD', 'WILLFUL_BREACH']);
});

test('Landos resolves one Remedies legal effect, two separate exceptions and a round-trip fee link', async () => {
  const resolution = await resolveSoleRemedy();
  const effects = resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT');
  const carveOuts = resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'SOLE_REMEDY_CARVEOUT_KIND');
  assert.equal(effects.length, 1);
  assert.equal(effects[0].concept_key, 'REM-SOLE');
  assert.equal(effects[0].claim.canonical_value, true);
  assert.deepEqual(carveOuts.map((entry) => entry.claim.canonical_value), ['FRAUD', 'WILLFUL_BREACH']);
  assert.ok(carveOuts.every((entry) => entry.provision_instance.provision_instance_id
    === effects[0].provision_instance.provision_instance_id));

  const feeItem = resolution.open_world.find((entry) => entry.reason === 'SOLE_REMEDY_FEE_CONTEXT_LINKED');
  const link = feeItem.attributes.structured_mechanic.remedies_claim_link;
  assert.deepEqual(link, {
    provision_instance_id: effects[0].provision_instance.provision_instance_id,
    claim_revision_id: effects[0].claim.claim_revision_id,
  });
  assert.equal(feeItem.attributes.structured_mechanic.payment_context_quote, 'payment of such Termination Fee');
  assert.equal(Object.hasOwn(feeItem.attributes.structured_mechanic, 'remedy_effect_quote'), false);
  assert.equal(Object.hasOwn(feeItem.attributes.structured_mechanic, 'carve_outs'), false);

  const feeProjection = projectTerminationFeeProductSurfaces({ resolution, deal_id: 'landos-sole-remedy' });
  const feeCard = feeProjection.cards.find((card) => card.features.soleRemedyFeeContext);
  assert.deepEqual(feeCard.features.soleRemedyRemediesClaimLink, link);
  assert.equal(feeCard.features.soleRemedyFeeContext.payment_context_quote, 'payment of such Termination Fee');
  assert.equal(Object.hasOwn(feeCard.features, 'remediesOwnedSoleRemedyEvidence'), false);
  assert.equal(JSON.stringify(feeCard.features).includes('carve_outs'), false);

  const remediesProjection = projectRemediesMiscProductSurfaces({ resolution, deal_id: 'landos-sole-remedy' });
  const remediesCards = remediesProjection.cards.filter((card) => card.provision_subtype === 'REM-SOLE');
  assert.equal(remediesCards.length, 1);
  assert.equal(remediesCards[0].features.soleRemedy, true);
  assert.deepEqual(remediesCards[0].features.soleRemedyCarveOuts, ['FRAUD', 'WILLFUL_BREACH']);
  assert.equal(remediesCards[0].features.soleRemedyFeeContext.payment_context_quote, 'payment of such Termination Fee');
  assert.equal(remediesProjection.open_items.filter((item) => item.reason === 'SOLE_REMEDY_FEE_CONTEXT_LINKED').length, 1);
});

test('a bad carve-out kind and an uncorroborated quote stay open world without blocking the legal effect', async () => {
  const resolution = await resolveSoleRemedy({
    carveOuts: [
      { kind: 'INDEMNIFICATION', quote: 'Fraud' },
      { kind: 'FRAUD', quote: 'invented fraud exception' },
    ],
  });
  assert.equal(resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT').length, 1);
  assert.equal(resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'SOLE_REMEDY_CARVEOUT_KIND').length, 0);
  assert.ok(resolution.open_world.some((entry) => entry.reason === 'SOLE_REMEDY_CARVEOUT_KIND_OUT_OF_ENUM'));
  assert.ok(resolution.open_world.some((entry) => entry.reason === 'SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED'));
  assert.equal(resolution.resolved.some((entry) => ['INDEMNIFICATION', 'FRAUD'].includes(entry.claim.canonical_value)), false);
});

test('a missing legal-effect quote mints no Remedies claim and keeps a null fee link', async () => {
  const resolution = await resolveSoleRemedy({ remedyEffectQuote: null });
  assert.equal(resolution.resolved.some((entry) => entry.concept_key === 'REM-SOLE'), false);
  const residual = resolution.open_world.find(
    (entry) => entry.reason === 'SOLE_REMEDY_LEGAL_EFFECT_QUOTE_MISSING',
  );
  assert.equal(
    residual.attributes.structured_mechanic.proposed_mechanic.surface,
    'SOLE_REMEDY_EVIDENCE',
  );
  assert.deepEqual(
    residual.attributes.structured_mechanic.proposed_mechanic.carve_outs,
    [
      { kind: 'FRAUD', quote: 'Fraud' },
      { kind: 'WILLFUL_BREACH', quote: 'Willful Breach' },
    ],
  );
  const feeProjection = projectTerminationFeeProductSurfaces({ resolution, deal_id: 'landos-sole-remedy-open' });
  const feeCard = feeProjection.cards.find((card) => card.features.soleRemedyFeeContext);
  assert.equal(feeCard.features.soleRemedyRemediesClaimLink, null);
  assert.equal(projectRemediesMiscProductSurfaces({ resolution, deal_id: 'landos-sole-remedy-open' })
    .cards.some((card) => card.provision_subtype === 'REM-SOLE'), false);
});

test('an invented legal-effect quote stays exact open world and mints no Remedies claim', async () => {
  const resolution = await resolveSoleRemedy({ remedyEffectQuote: 'invented exclusive-remedy phrase' });
  assert.equal(resolution.resolved.some((entry) => entry.concept_key === 'REM-SOLE'), false);
  const residual = resolution.open_world.find(
    (entry) => entry.reason === 'SOLE_REMEDY_LEGAL_EFFECT_QUOTE_UNCORROBORATED',
  );
  assert.equal(
    residual.attributes.structured_mechanic.proposed_mechanic.remedy_effect_quote,
    'invented exclusive-remedy phrase',
  );
  const feeItem = resolution.open_world.find(
    (entry) => entry.attributes?.structured_mechanic?.owner_family === 'TERMINATION_FEE',
  );
  assert.equal(feeItem.attributes.structured_mechanic.remedies_claim_link, null);
  assert.equal(Object.hasOwn(feeItem.attributes.structured_mechanic, 'remedy_effect_quote'), false);
});

test('sole-remedy Fraud and Willful Breach exceptions do not merge with reps or defined-term claims', async () => {
  const resolution = await resolveSoleRemedy();
  const distinct = [
    ...resolution.resolved,
    {
      concept_key: 'REP-T-FRAUDCARVEOUT',
      resolved_claim_definition_key: 'FRAUD_CARVEOUT_PRESENT',
      provision_instance: { provision_instance_id: 'reps-fraud-provision' },
      claim: { claim_revision_id: 'reps-fraud-claim', canonical_value: true },
    },
    {
      concept_key: 'DEF-WILLFUL',
      resolved_claim_definition_key: 'WILLFUL_BREACH_DEFINITION_PRESENT',
      provision_instance: { provision_instance_id: 'willful-definition-provision' },
      claim: { claim_revision_id: 'willful-definition-claim', canonical_value: true },
    },
  ];
  const sole = distinct.filter((entry) => entry.concept_key === 'REM-SOLE');
  assert.equal(sole.filter((entry) => entry.claim.canonical_value === 'FRAUD').length, 1);
  assert.equal(sole.filter((entry) => entry.claim.canonical_value === 'WILLFUL_BREACH').length, 1);
  assert.equal(new Set(distinct.map((entry) => entry.provision_instance.provision_instance_id)).size, 3);
  assert.ok(sole.every((entry) => !Object.hasOwn(entry, 'definition_relationship')));
});

test('sole-remedy resolution is byte-stable for identical source and proposals', async () => {
  const first = await resolveSoleRemedy();
  const second = await resolveSoleRemedy();
  assert.equal(canonicalJson(first), canonicalJson(second));
});

test('the ruling binding names the resolver and its hostile test', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'canonical-v2', 'decision-reconciliation-proposal.js'), 'utf8');
  assert.match(source, /lib\/canonical-v2\/native-producer\/sole-remedy-resolution\.js/);
  assert.match(source, /tests\/canonical-v2-sole-remedy-resolution\.test\.js/);
  const prompt = fs.readFileSync(path.join(__dirname, '..', 'lib', 'canonical-v2', 'native-producer', 'specific-performance-remedies-producer-prompt.js'), 'utf8');
  assert.match(prompt, /Remedies owns the sole-remedy legal effect/);
  assert.doesNotMatch(prompt, /sole-remedy or fee-election clause belongs to termination fees/i);
});
