'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeClosingConditionProposals, shapeRegulatoryEffortsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { buildAntitrustRegulatoryProducerPrompt } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { buildClosingConditionsProducerPrompt } = require('../lib/canonical-v2/native-producer/closing-conditions-producer-prompt');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { loadSourceForDiagnostic } = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));
const CONTRACT = compileFixtureContractV34();

function pilotSection(workItemId) {
  const workItem = MANIFEST.work_items.find((item) => item.work_item_id === workItemId);
  const source = MANIFEST.sources.find((item) => item.source_id === workItem.source_id);
  const diagnostic = loadSourceForDiagnostic({ source, root_dir: ROOT });
  const admitted = Object.freeze({
    ...diagnostic,
    context: buildIdentityAdmittedSourceContext(diagnostic.context.canonical_text.text, {
      dealKey: source.governed_deal_key,
      dealAdmissionId: source.deal_admission_id,
      sourceOrdinal: source.source_ordinal,
    }),
  });
  const node = findSectionByReference(diagnostic.tree, workItem.section_pin.section_reference);
  assert.ok(node, `${workItemId}: pinned section exists`);
  return {
    workItem,
    admitted,
    text: Buffer.from(admitted.context.canonical_text.text, 'utf8').subarray(node.start, node.end).toString('utf8'),
  };
}

function exact(text, expression) {
  const match = text.match(expression);
  assert.ok(match, `missing exact source text for ${expression}`);
  return match[0];
}

async function replay({ pilot, response, shaper }) {
  const receipt = await runNativeExtraction({
    source_text: pilot.admitted.context.canonical_text.text,
    document_hash: pilot.admitted.context.document_hash,
    section_references: [pilot.workItem.section_pin.section_reference],
    section_family_assignments: [{
      section_reference: pilot.workItem.section_pin.section_reference,
      family_id: pilot.workItem.family_id,
    }],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'MODIV_IMMUTABLE_CHECKPOINT_REPLAY/V1',
      model_id: 'no-model',
      prompt: [],
      ...shaper(response, governedScope.source_text),
    }),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: pilot.admitted.context,
  });
  return {
    receipt,
    resolution,
    unresolved: resolution.review_queue.filter((entry) => !entry.has_resolution),
  };
}

test('Modiv 5.5 checkpoint replay carries the child clause that corroborates a parent-scoped obligor', async () => {
  const pilot = pilotSection('modiv-antitrust-consents-5-5');
  const consultationViews = exact(pilot.text, /Each party hereto will have the right to review[\s\S]*?Transactions\./);
  const consultationParticipation = exact(pilot.text, /In addition, except as may be prohibited[\s\S]*?legal proceeding\./);
  const efforts = exact(pilot.text, /Subject to the terms[\s\S]*?obligations under this Agreement,/);
  const coreObligations = exact(pilot.text, /Subject to the terms[\s\S]*?\(iii\) effecting all necessary or advisable registrations and other filings required under the Exchange Act or any other federal, state or local Law relating to the Mergers\./);
  const litigationLeaf = exact(pilot.text, /contesting, litigating and defending all lawsuits[\s\S]*?\(“Transaction Litigation”\)/);
  const filingLeaf = exact(pilot.text, /effecting all necessary or advisable registrations and other filings required under the Exchange Act or any other federal, state or local Law relating to the Mergers\./);
  const burden = exact(pilot.text, /Without limiting the generality[\s\S]*?\(the items described in clauses \(i\)-\(iii\), a “Remedy”\);/);
  const nonImpediment = exact(pilot.text, /Between the date of this Agreement[\s\S]*?materially delay the consummation of the Transactions\./);
  const at = (assertionKind, canonicalValue, quote, extra = {}) => ({
    section_reference: 'Section 5.5',
    assertion_kind: assertionKind,
    canonical_value: canonicalValue,
    obligor_party_scope: assertionKind === 'BURDEN_COMMITMENT' || assertionKind === 'NON_IMPEDIMENT_COVENANT' ? 'ONE_PARTY' : 'MUTUAL',
    obligor_party: assertionKind === 'BURDEN_COMMITMENT' || assertionKind === 'NON_IMPEDIMENT_COVENANT' ? 'Parent' : 'each party hereto',
    quote,
    ...extra,
  });
  const checkpointAssertions = [
      at('CONSULTATION_RIGHT', true, consultationViews),
      at('CONSULTATION_RIGHT', true, consultationParticipation),
      at('EFFORTS_STANDARD', 'commercially reasonable efforts', efforts.replace(/,$/, '.')),
      at('LITIGATION_OBLIGATION', true, litigationLeaf),
      at('REGULATORY_FILING_OBLIGATION', true, filingLeaf, { filing_regime_ref: 'Exchange Act' }),
      at('BURDEN_COMMITMENT', true, burden),
      at('NON_IMPEDIMENT_COVENANT', true, nonImpediment),
  ];
  checkpointAssertions[0].obligor_party = 'Each party hereto';
  const checkpointResponse = {
    regulatory_efforts_assertions: checkpointAssertions,
    open_world_candidates: [],
  };
  const rerunResponse = structuredClone(checkpointResponse);
  rerunResponse.regulatory_efforts_assertions[0].canonical_value = 'GOOD_FAITH_VIEWS';
  rerunResponse.regulatory_efforts_assertions[1].canonical_value = 'PARTICIPATE';
  rerunResponse.regulatory_efforts_assertions[2].canonical_value = 'COMMERCIALLY_REASONABLE_EFFORTS';
  rerunResponse.regulatory_efforts_assertions[2].quote = efforts;
  rerunResponse.regulatory_efforts_assertions[3].canonical_value = 'MANDATORY_DEFEND';
  rerunResponse.regulatory_efforts_assertions[3].quote = coreObligations;
  rerunResponse.regulatory_efforts_assertions[4].quote = coreObligations;
  rerunResponse.regulatory_efforts_assertions[5].canonical_value = 'EXPRESS_HOHW';

  const before = await replay({ pilot, response: checkpointResponse, shaper: shapeRegulatoryEffortsProposals });
  const after = await replay({ pilot, response: rerunResponse, shaper: shapeRegulatoryEffortsProposals });

  assert.equal(before.receipt.evidence_residual_count, 1);
  assert.equal(before.receipt.compiled_candidate_count, 6);
  assert.equal(before.unresolved.length, 0);
  assert.equal(before.resolution.open_world.length, 4);
  assert.equal(after.receipt.evidence_residual_count, 0);
  assert.equal(after.receipt.compiled_candidate_count, 7);
  assert.equal(after.unresolved.length, 0);
  assert.equal(after.resolution.open_world.length, 0);
  assert.equal(after.resolution.resolved.length, 7);
});

test('Modiv 5.5(f) resolves the exact Company-and-Parent mutual-obligor order', async () => {
  const pilot = pilotSection('modiv-antitrust-consents-5-5');
  const exactFiveFiveF = exact(
    pilot.text,
    /\(f\) Each of the Company and Parent shall use their respective commercially reasonable efforts to \(i\) take all action necessary[\s\S]*?the other Transactions\./,
  );
  const replayed = await replay({
    pilot,
    response: {
      regulatory_efforts_assertions: [{
        section_reference: 'Section 5.5(f)',
        assertion_kind: 'EFFORTS_STANDARD',
        canonical_value: 'COMMERCIALLY_REASONABLE_EFFORTS',
        obligor_party_scope: 'MUTUAL',
        obligor_party: 'Each of the Company and Parent',
        quote: exactFiveFiveF,
      }],
      open_world_candidates: [],
    },
    shaper: shapeRegulatoryEffortsProposals,
  });

  assert.equal(replayed.unresolved.length, 0, JSON.stringify(replayed.resolution.review_queue, null, 2));
  assert.equal(replayed.resolution.resolved.length, 1);
  assert.equal(replayed.resolution.resolved[0].source_citation, '5.5(f)');
  assert.equal(replayed.resolution.resolved[0].claim.canonical_value, 'COMMERCIALLY_REASONABLE_EFFORTS');
});

test('Modiv 6.1 checkpoint replay carries the complete Registration Statement child clause', async () => {
  const pilot = pilotSection('modiv-closing-conditions-6-1');
  const registrationStatement = exact(pilot.text, /The Registration Statement shall have been declared effective by the SEC and shall not be the subject of any stop order or pending or threatened in writing proceeding seeking a stop order\./);
  const formEffective = 'The Registration Statement shall have been declared effective by the SEC';
  const noStopOrder = 'shall not be the subject of any stop order';
  const pendingProceeding = 'shall not be the subject of any pending or threatened in writing proceeding seeking a stop order.';
  const assertions = (quoteFor) => ({
    closing_condition_assertions: [
      { section_reference: 'Section 6.1(a)', assertion_kind: 'STOCKHOLDER_APPROVAL', approval_definition: 'Company Requisite Vote', quote: exact(pilot.text, /The Company shall have obtained the Company Requisite Vote\./) },
      { section_reference: 'Section 6.1(b)', assertion_kind: 'S4_COMPONENT', s4_component: 'FORM_EFFECTIVE', quote: quoteFor('FORM_EFFECTIVE') },
      { section_reference: 'Section 6.1(b)', assertion_kind: 'S4_COMPONENT', s4_component: 'NO_STOP_ORDER', quote: quoteFor('NO_STOP_ORDER') },
      { section_reference: 'Section 6.1(b)', assertion_kind: 'S4_COMPONENT', s4_component: 'NO_PENDING_OR_THREATENED_PROCEEDING', quote: quoteFor('NO_PENDING_OR_THREATENED_PROCEEDING') },
      { section_reference: 'Section 6.1(c)', assertion_kind: 'LEGAL_RESTRAINT', quote: exact(pilot.text, /No Governmental Entity of competent jurisdiction[\s\S]*?consummation of the Mergers\./) },
      { section_reference: 'Section 6.1(d)', assertion_kind: 'LISTING', listing_venue: 'NYSE', quote: exact(pilot.text, /The shares of Parent Common Stock[\s\S]*?official notice of issuance\./) },
    ],
    open_world_candidates: [],
  });
  const before = await replay({
    pilot,
    response: assertions((component) => ({
      FORM_EFFECTIVE: formEffective,
      NO_STOP_ORDER: noStopOrder,
      NO_PENDING_OR_THREATENED_PROCEEDING: pendingProceeding,
    })[component]),
    shaper: shapeClosingConditionProposals,
  });
  const after = await replay({
    pilot,
    response: assertions(() => registrationStatement),
    shaper: shapeClosingConditionProposals,
  });

  assert.equal(before.receipt.evidence_residual_count, 1);
  assert.equal(before.receipt.compiled_candidate_count, 5);
  assert.equal(before.unresolved.length, 0);
  assert.equal(before.resolution.open_world.length, 0);
  assert.equal(after.receipt.evidence_residual_count, 0);
  assert.equal(after.receipt.compiled_candidate_count, 6);
  assert.equal(after.unresolved.length, 0);
  assert.equal(after.resolution.open_world.length, 0);
  assert.equal(after.resolution.resolved.length, 6);
});

test('affected prompts require the source coverage needed by the governed mappings', () => {
  const antitrust = buildAntitrustRegulatoryProducerPrompt({ source_text: 'x', governed_scope: {} });
  const closing = buildClosingConditionsProducerPrompt({ source_text: 'x', governed_scope: {} });
  assert.equal(antitrust.prompt_version, 5);
  assert.match(antitrust.messages[0].content, /quote must include the exact obligor_party phrase and the operative verb/);
  assert.match(antitrust.messages[0].content, /MANDATORY_DEFEND/);
  assert.equal(closing.prompt_version, 4);
  assert.match(closing.messages[0].content, /repeat the full exact Registration Statement sentence/);
  assert.match(closing.messages[0].content, /Do not emit a stop-order or proceeding fragment/);
});
