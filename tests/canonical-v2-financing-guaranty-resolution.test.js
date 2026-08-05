'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV30 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeGovernedFinancingProposals,
  shapeGovernedGuarantyProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, materialityFor } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { runStage1 } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

function card(family, id) {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', family, 'corpus-cards.json'), 'utf8'));
  const found = fixture.cards.find((entry) => entry.id === id);
  assert.ok(found, `fixture card ${id} exists`);
  return found;
}

const FINANCING_CARD = card('financing-covenants-live-run', '6b29cdd2-3269-4a63-a8f9-05005199a51c');
const GUARANTY_CARD = card('guaranty-live-run', '252c2296-e805-4cac-bf1d-0e03f82539f5');
const FINANCING_QUOTE = 'Each of Parent and Merger Sub shall use reasonable best efforts to take, or cause to be taken, all things necessary, to obtain the Debt Financing';
const GUARANTY_QUOTE = 'Parent and Merger Sub have delivered a duly executed guaranty from 3G Fund VI, L.P., a Cayman Islands exempted limited partnership';
const CONTRACT_BUNDLE = compileFixtureContractV30();

function replayProvider(parsed, shape) {
  return async ({ governed_scope: governedScope }) => {
    const shaped = shape(parsed, governedScope.source_text);
    return {
      provider_id: 'recorded-m3-financing-guaranty-replay/v1',
      model_id: 'recorded-fixture',
      prompt: 'recorded-m3-financing-guaranty-replay/v1',
      proposals: shaped.proposals,
      evidence_residuals: shaped.evidence_residuals,
    };
  };
}

async function replay({ sourceText, sectionReference, parsed, shape, dealKey }) {
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [sectionReference],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: {},
    provider: replayProvider(parsed, shape),
    section_family_classifier: async () => ({ declined: true }),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: buildIdentityAdmittedSourceContext(sourceText, {
      dealKey,
      dealAdmissionId: sha256Hex(`M3-${dealKey}-V1`),
    }),
  });
  return { receipt, resolution };
}

test('recorded financing fixture replays as a governed reasonable-best-efforts claim', async () => {
  assert.ok(FINANCING_CARD.region_full_text.includes(FINANCING_QUOTE));
  const { receipt, resolution } = await replay({
    sourceText: FINANCING_CARD.region_full_text,
    sectionReference: '6.06',
    shape: shapeGovernedFinancingProposals,
    dealKey: FINANCING_CARD.deal_id,
    parsed: { financing_assertions: [{
      section_reference: '6.06', assertion_kind: 'OBTAIN_EFFORTS', financing_kind: 'DEBT',
      standard_code: 'REASONABLE_BEST_EFFORTS', obligor: 'Each of Parent and Merger Sub',
      day_kind: null, delivery_stage: null, deliverable_term: null, marketing_term: null, quote: FINANCING_QUOTE,
    }], open_world_candidates: [] },
  });
  assert.equal(receipt.resolved_sections[0].section_family, 'FINANCING_COVENANTS');
  assert.equal(resolution.review_queue.length, 1, 'unavailable global review gates keep resolved claims queued');
  assert.equal(resolution.open_world.length, 0);
  assert.equal(resolution.resolved.length, 1);
  assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'FINANCING_OBTAIN_EFFORTS_STANDARD');
  assert.equal(resolution.resolved[0].claim.canonical_value, 'REASONABLE_BEST_EFFORTS');
});

test('recorded guaranty fixture replays as a governed delivery claim', async () => {
  assert.ok(GUARANTY_CARD.region_full_text.includes(GUARANTY_QUOTE));
  const { receipt, resolution } = await replay({
    sourceText: GUARANTY_CARD.region_full_text,
    sectionReference: '4.13',
    shape: shapeGovernedGuarantyProposals,
    dealKey: GUARANTY_CARD.deal_id,
    parsed: { guaranty_assertions: [{
      section_reference: '4.13', assertion_kind: 'GUARANTY_DELIVERED',
      guarantor_ref: '3G Fund VI, L.P.', obligor_ref: null, quote: GUARANTY_QUOTE,
    }], open_world_candidates: [] },
  });
  assert.equal(receipt.resolved_sections[0].section_family, 'GUARANTY_FINANCING_PARTY');
  assert.equal(resolution.review_queue.length, 1, 'unavailable global review gates keep resolved claims queued');
  assert.equal(resolution.open_world.length, 0);
  assert.equal(resolution.resolved.length, 1);
  assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'LIMITED_GUARANTY_DELIVERED');
  assert.equal(resolution.resolved[0].claim.canonical_value, true);
});

test('Financing and Guaranty stage-one routing and approved materiality ranks are fixed', () => {
  assert.equal(runStage1('Debt Financing').section_family, 'FINANCING_COVENANTS');
  assert.equal(runStage1('Guaranty').section_family, 'GUARANTY_FINANCING_PARTY');
  assert.equal(materialityFor({ conceptKey: 'GTY-PERF' }).rank, 74);
  assert.equal(materialityFor({ conceptKey: 'COV-FINANCING' }).rank, 75);
});
