'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV24, compileFixtureContractV36 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeClosingConditionProposals, shapeRegulatoryEffortsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { LEXICAL_FAMILY_LEXICON, validateLexicalFamilyLexicon } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'canonical-v2');

function loadRecordedSource(dealDirectory) {
  const directory = path.join(FIXTURE_ROOT, dealDirectory);
  const adapter = JSON.parse(fs.readFileSync(path.join(directory, 'adapter-result.json'), 'utf8'));
  const pin = JSON.parse(fs.readFileSync(path.join(directory, 'intake-pin.json'), 'utf8'));
  return { pin, text: adapter.admitted_source_contexts[0].canonical_text.text };
}

function entryMatches(entry, text) {
  if (entry.kind === 'LITERAL_ACRONYM') return text.includes(entry.value);
  if (entry.kind === 'LITERAL_PHRASE') return text.toLocaleLowerCase('en-US').includes(entry.value.toLocaleLowerCase('en-US'));
  return new RegExp(entry.value, 'iu').test(text);
}

function closingFixtureBodies() {
  const directory = path.join(FIXTURE_ROOT, 'closing-conditions-fixtures');
  return fs.readdirSync(directory).filter((name) => name.endsWith('.txt')).sort().map((name) => {
    const content = fs.readFileSync(path.join(directory, name), 'utf8');
    const separator = content.indexOf('\n\n');
    assert.ok(separator > 0, `${name}: provenance header`);
    assert.match(content.slice(0, separator), /^Card: [0-9a-f-]+\nSubtype: COND-/);
    return content.slice(separator + 2).trimEnd();
  });
}

function closingFixtureBody(name) {
  const content = fs.readFileSync(path.join(FIXTURE_ROOT, 'closing-conditions-fixtures', `${name}.txt`), 'utf8');
  return content.slice(content.indexOf('\n\n') + 2).trimEnd();
}

test('Antitrust map replays grounded multi-deal litigation and regulatory evidence', async () => {
  const map = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'antitrust-regulatory-fixtures', 'coverage-map.json'), 'utf8'));
  assert.equal(map.schema_version, 'ANTITRUST_REGULATORY_COVERAGE_MAP/V1');
  const contract = compileFixtureContractV24();
  const seen = new Set();
  for (const sourceRun of map.source_runs) {
    const { pin, text } = loadRecordedSource(sourceRun.deal_directory);
    assert.equal(pin.verification_status, 'PASS');
    assert.equal(sha256Hex(Buffer.from(text, 'utf8')), pin.canonical_text_sha256);
    for (const evidence of sourceRun.evidence) {
      assert.ok(text.includes(evidence.quote), `${evidence.evidence_id}: quote absent from admitted bytes`);
      seen.add(evidence.assertion_kind);
    }
    const assertions = sourceRun.evidence.map((evidence) => ({
      section_reference: sourceRun.section_reference,
      assertion_kind: evidence.assertion_kind,
      canonical_value: evidence.canonical_value,
      obligor_party_scope: evidence.obligor_party_scope,
      obligor_party: evidence.obligor_party,
      quote: evidence.quote,
    }));
    const receipt = await runNativeExtraction({
      source_text: text,
      document_hash: sha256Hex(Buffer.from(text, 'utf8')),
      section_references: [sourceRun.section_reference],
      contract_bundle: contract,
      definitions: { known_definitions: [] },
      provider: async ({ governed_scope: governedScope }) => ({
        provider_id: 'antitrust-fixture-replay/v1', model_id: 'fixture', prompt: 'fixture',
        ...shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: assertions, open_world_candidates: [] }, governedScope.source_text),
      }),
    });
    assert.ok(receipt.compiled_candidates.every((entry) => entry.ok), JSON.stringify(receipt.compiled_candidates, null, 2));
  }
  assert.deepEqual([...seen].sort(), ['LITIGATION_OBLIGATION', 'STRATEGY_CONTROL', 'TIMING_AGREEMENT_RESTRICTION']);
});

test('Antitrust recorded sources and Closing Conditions fixture pack cover the first native slice', () => {
  const sources = ['skechers-first-live-run', 'modiv-first-live-run'].map(loadRecordedSource);
  const combined = sources.map(({ text }) => text).join('\n');
  for (const family of ['ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-AGREEMENTS', 'ANTI-FILING']) {
    assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === family && entryMatches(entry, combined)), family);
  }
  const bodies = closingFixtureBodies();
  const registeredConceptKeys = new Set(compileFixtureContractV36().concepts.map((concept) => concept.concept_key));
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, { registeredConceptKeys }));
  for (const family of ['COND-B-REP', 'COND-S-REP', 'COND-MAE', 'COND-COV', 'COND-REG']) {
    assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === family && entryMatches(entry, bodies.join('\n'))), family);
  }
});

test('Closing Conditions replay preserves clause standards and resolves Kraft from grounded party context', async () => {
  const targetRep = closingFixtureBody('066e1fd7');
  const buyerRep = closingFixtureBody('f10b6b21');
  const mae = closingFixtureBody('c0d6b18f');
  const covenant = closingFixtureBody('3a0c665c');
  const approvals = closingFixtureBody('fa44d3ce');
  const hsr = 'The waiting period applicable to the consummation of the Merger under the HSR Act shall have expired or been terminated';
  const scheduled = 'approvals required in those jurisdictions set forth in Section 7.1(b) shall have been obtained';
  const source = ['AGREEMENT AND PLAN OF MERGER', 'Section 7.2 Conditions to Closing.', targetRep, buyerRep, mae, covenant, approvals].join('\n');
  const assertions = [
    { section_reference: '7.2', assertion_kind: 'BRING_DOWN_TIER', condition_obligor: 'Company', accuracy_standard: 'MAT_ALL_RESPECTS', rep_side: 'TARGET_REPS', covered_scope: 'Section 4.02(a)', quote: targetRep },
    { section_reference: '7.2', assertion_kind: 'BRING_DOWN_TIER', condition_obligor: 'Parent', accuracy_standard: 'MAT_ALL_RESPECTS', rep_side: 'BUYER_REPS', covered_scope: 'Section 4.1(a)', quote: buyerRep },
    { section_reference: '7.2', assertion_kind: 'NO_MAE_CONDITION', mae_term: 'Company Material Adverse Effect', mae_party: 'TARGET', quote: mae },
    { section_reference: '7.2', assertion_kind: 'MAE_CONTINUING', mae_term: 'Company Material Adverse Effect', mae_party: 'TARGET', quote: mae },
    { section_reference: '7.2', assertion_kind: 'COVENANT_COMPLIANCE', standard: 'MAT_ALL_MATERIAL', obligor: 'Kraft', quote: covenant },
    { section_reference: '7.2', assertion_kind: 'REGULATORY_APPROVAL', approval_kind: 'HSR', quote: hsr },
    { section_reference: '7.2', assertion_kind: 'REGULATORY_APPROVAL', approval_kind: 'SCHEDULED_APPROVALS', quote: scheduled },
  ];
  const contract = compileFixtureContractV24();
  const receipt = await runNativeExtraction({
    source_text: source, document_hash: sha256Hex(Buffer.from(source, 'utf8')), section_references: ['7.2'],
    contract_bundle: contract, definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'closing-fixture-replay/v1', model_id: 'fixture', prompt: 'fixture',
      ...shapeClosingConditionProposals({ closing_condition_assertions: assertions, open_world_candidates: [] }, governedScope.source_text),
    }),
  });
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok), JSON.stringify(receipt.compiled_candidates, null, 2));
  const partyContext = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'closing-conditions-fixtures', 'party-capacity-context.json'), 'utf8'));
  const deal = require('../lib/generated/home-deal-directory-v1.json').deals.find((entry) => entry.id === partyContext.deal_id);
  assert.equal(deal.target_display, 'Kraft');
  const resolution = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: contract,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, { dealKey: partyContext.deal_id, dealAdmissionId: sha256Hex(`deal-admission:${partyContext.deal_id}`) }),
    party_capacity_overrides: partyContext.party_capacities,
  });
  assert.ok(resolution.review_queue.every((entry) => entry.has_resolution), JSON.stringify(resolution.review_queue, null, 2));
  assert.equal(resolution.resolved.length, assertions.length);
  const covenantClaim = resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'COVENANT_COMPLIANCE_STANDARD');
  assert.deepEqual(covenantClaim.party, { role: 'CONDITION_OBLIGOR', value: 'Kraft', capacity: 'TARGET' });
  assert.deepEqual(resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_ACCURACY_STANDARD').map((entry) => entry.claim.attributes.covered_scope_ref).sort(), ['Section 4.02(a)', 'Section 4.1(a)']);
  assert.equal(resolution.resolved.find((entry) => entry.resolved_claim_definition_key === 'NO_MAE_CONDITION_CONTINUING').claim.attributes.mae_term_ref, 'Company Material Adverse Effect');
  assert.equal(resolution.resolved.filter((entry) => entry.resolved_claim_definition_key === 'REGULATORY_APPROVAL_CONDITION').length, 2);
});
