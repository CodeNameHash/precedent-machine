'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV31 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeRepresentationQualifierProposals,
  shapeMergerStructureProposals,
  shapeSpecificPerformanceRemedyProposals,
  shapeMiscBoilerplateProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');
const { buildLexicalDisagreementReceipt } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT = compileFixtureContractV31();

test('V31 recorded real-agreement replay pack remains byte-grounded and resolves deterministically', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-real-replay.json'), 'utf8'));
  const source = fs.readFileSync(path.join(__dirname, '..', pack.source_path), 'utf8');
  assert.equal(pack.schema, 'CANONICAL_V2_M3_V31_REPLAY_PACK/V1');
  const shapes = {
    MERGER_STRUCTURE_CLOSING: shapeMergerStructureProposals,
    SPECIFIC_PERFORMANCE_REMEDIES: shapeSpecificPerformanceRemedyProposals,
    MISC_BOILERPLATE: shapeMiscBoilerplateProposals,
  };
  const parsed = {
    MERGER_STRUCTURE_CLOSING: (item) => ({ structure_assertions: [{ assertion_kind: item.assertion_kind, quote: item.quote }], open_world_candidates: [] }),
    SPECIFIC_PERFORMANCE_REMEDIES: (item) => ({ remedy_assertions: [{ assertion_kind: item.assertion_kind, quote: item.quote }], open_world_candidates: [] }),
    MISC_BOILERPLATE: (item) => ({ boilerplate_assertions: [{ assertion_kind: item.assertion_kind, quote: item.quote }], open_world_candidates: [] }),
  };
  for (const item of pack.cases) {
    assert.ok(source.includes(item.quote), `${item.family} quote remains exact in admitted fixture`);
    const { receipt, resolution } = await replay({ source, sectionReference: item.section_reference, dealKey: `landos-${item.family}`, shape: shapes[item.family], parsed: parsed[item.family](item) });
    assert.equal(receipt.compiled_candidates.filter((entry) => entry.ok).length, 1, item.family);
    assert.equal(resolution.resolved.length, 1, item.family);
  }
});

test('V31 read-only production corpus excerpts replay each M3 carrier across two deals', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-live-run', 'corpus-cards.json'), 'utf8'));
  assert.equal(pack.schema, 'CANONICAL_V2_M3_V31_REPLAY_FIXTURES/V1');
  const byFamily = new Map();
  for (const item of pack.cards) {
    const source = `Section ${item.section_reference} Fixture\n${item.source_excerpt}\n`;
    const shaped = item.family === 'REPRESENTATIONS'
      ? shapeRepresentationQualifierProposals({ representation_instances: [{ section_reference: item.section_reference, party_making: item.party_making, qualifiers: [{ kind: item.qualifier_kind, code: item.qualifier_code, quote: item.source_excerpt, attachment: { position: 'TRAILING', governs_path: null } }] }], open_world_candidates: [] }, source)
      : item.family === 'MERGER_STRUCTURE_CLOSING'
        ? shapeMergerStructureProposals({ structure_assertions: [{ assertion_kind: item.assertion_kind, quote: item.source_excerpt }], open_world_candidates: [] }, source)
        : item.family === 'SPECIFIC_PERFORMANCE_REMEDIES'
          ? shapeSpecificPerformanceRemedyProposals({ remedy_assertions: [{ assertion_kind: item.assertion_kind, quote: item.source_excerpt }], open_world_candidates: [] }, source)
          : shapeMiscBoilerplateProposals({ boilerplate_assertions: [{ assertion_kind: item.assertion_kind, quote: item.source_excerpt }], open_world_candidates: [] }, source);
    const { receipt, resolution } = await replay({ source, sectionReference: item.section_reference, dealKey: item.deal_id, shape: () => shaped, parsed: null });
    assert.equal(receipt.compiled_candidates.filter((entry) => entry.ok).length, 1, item.id);
    assert.equal(resolution.open_world.length, 0, item.id);
    assert.equal(resolution.resolved.length, 1, item.id);
    const resolved = resolution.resolved[0];
    const section = receipt.resolved_sections[0];
    const text = Buffer.from(source, 'utf8').slice(section.start, section.end).toString('utf8');
    const lexical = buildLexicalDisagreementReceipt({
      governed_section: { section_ref: section.section_reference, text, text_sha256: section.text_sha256 },
      candidates: [{ closure_id: resolved.claim.closure_id, section_reference: resolved.section_reference, family: resolved.concept_key, evidence: resolved.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })) }],
    });
    const ownOutcome = lexical.family_outcomes.find((entry) => entry.family === resolved.concept_key);
    assert.equal(ownOutcome.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED', item.id);
    byFamily.set(item.family, (byFamily.get(item.family) || 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(byFamily), {
    REPRESENTATIONS: 2,
    MERGER_STRUCTURE_CLOSING: 2,
    SPECIFIC_PERFORMANCE_REMEDIES: 2,
    MISC_BOILERPLATE: 2,
  });
});

async function replay({ source, sectionReference, parsed, shape, dealKey }) {
  const receipt = await runNativeExtraction({
    source_text: source, document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: [sectionReference], contract_bundle: CONTRACT, definitions: {},
    provider: async ({ governed_scope: scope }) => ({ provider_id: 'recorded-m3-v31-replay/v1', model_id: 'recorded-fixture', prompt: 'recorded-m3-v31-replay/v1', ...shape(parsed, scope.source_text) }),
  });
  return { receipt, resolution: resolveCandidates({ run_receipt: receipt, contract_vocabulary: CONTRACT, admitted_source_context: buildIdentityAdmittedSourceContext(source, { dealKey, dealAdmissionId: sha256Hex(`M3-${dealKey}-V31`) }) }) };
}

test('V31 replays distinct side-specific representation qualifier carriers', async () => {
  const quote = 'to the actual Knowledge of Parent, the representations and warranties of Parent are true and correct in all material respects.';
  const source = `ARTICLE V\nSection 5.1 Representations and Warranties.\n${quote}\n`;
  const { resolution } = await replay({ source, sectionReference: '5.1', dealKey: 'm3-representations-v31', shape: shapeRepresentationQualifierProposals, parsed: {
    representation_instances: [{ section_reference: '5.1', party_making: 'Parent', qualifiers: [
      { kind: 'KNOWLEDGE', code: 'ACTUAL', quote: 'to the actual Knowledge of Parent', attachment: { position: 'CHAPEAU', governs_path: null } },
      { kind: 'ACCURACY', code: 'MAT_ALL_MATERIAL', quote: 'true and correct in all material respects', attachment: { position: 'TRAILING', governs_path: null } },
    ] }], bring_down_conditions: [], open_world_candidates: [],
  } });
  assert.equal(resolution.open_world.length, 0);
  assert.deepEqual(new Set(resolution.resolved.map((row) => row.concept_key)), new Set(['REP-B-QUALIFIER']));
  assert.ok(resolution.resolved.every((row) => row.concept_key !== 'REP-T-CAP'));
});

test('V31 replays grounded merger, remedies and boilerplate presence claims', async () => {
  const cases = [
    { sectionReference: '2.1', dealKey: 'm3-merger-v31', source: 'ARTICLE II\nSection 2.1 Effect of the Merger.\nThe Merger will be governed by and effected under Section 251(h) of the DGCL.\n', quote: 'The Merger will be governed by and effected under Section 251(h) of the DGCL.', shape: shapeMergerStructureProposals, parsed: (quote) => ({ structure_assertions: [{ assertion_kind: 'SHORT_FORM_251H', quote }], open_world_candidates: [] }), definition: 'MERGER_STRUCTURE_MECHANIC_PRESENT', concept: 'MERGER-STRUCTURE' },
    { sectionReference: '9.8', dealKey: 'm3-remedy-v31', source: 'ARTICLE IX\nSection 9.8 Specific Performance.\nEach party shall use reasonable best efforts to obtain an expedited proceeding.\n', quote: 'Each party shall use reasonable best efforts to obtain an expedited proceeding.', shape: shapeSpecificPerformanceRemedyProposals, parsed: (quote) => ({ remedy_assertions: [{ assertion_kind: 'EXPEDITED_PROCEEDING', quote }], open_world_candidates: [] }), definition: 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT', concept: 'REMEDY-SPECIFIC-PERFORMANCE' },
    { sectionReference: '10.9', dealKey: 'm3-misc-v31', source: 'ARTICLE X\nSection 10.9 Governing Law.\nThis Agreement shall be governed by the Laws of the State of Delaware.\n', quote: 'This Agreement shall be governed by the Laws of the State of Delaware.', shape: shapeMiscBoilerplateProposals, parsed: (quote) => ({ boilerplate_assertions: [{ assertion_kind: 'GOVERNING_LAW', quote }], open_world_candidates: [] }), definition: 'MISC_BOILERPLATE_MECHANIC_PRESENT', concept: 'MISC-BOILERPLATE' },
  ];
  for (const item of cases) {
    const { resolution } = await replay({ ...item, parsed: item.parsed(item.quote) });
    assert.equal(resolution.open_world.length, 0, item.dealKey);
    assert.equal(resolution.resolved.length, 1, item.dealKey);
    assert.equal(resolution.resolved[0].resolved_claim_definition_key, item.definition);
    assert.equal(resolution.resolved[0].concept_key, item.concept);
    assert.equal(resolution.resolved[0].claim.canonical_value, true);
  }
});

test('V31 keeps an unsupported representation side as open-world evidence', async () => {
  const quote = 'to the Knowledge of the parties, the representation is true and correct in all material respects.';
  const source = `Section 5.2 Representations and Warranties.\n${quote}\n`;
  const { resolution } = await replay({ source, sectionReference: '5.2', dealKey: 'm3-representations-uncertain-v31', shape: shapeRepresentationQualifierProposals, parsed: {
    representation_instances: [{ section_reference: '5.2', party_making: 'the parties', qualifiers: [{ kind: 'ACCURACY', code: 'MAT_ALL_MATERIAL', quote: 'true and correct in all material respects', attachment: { position: 'TRAILING', governs_path: null } }] }], bring_down_conditions: [], open_world_candidates: [],
  } });
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.open_world[0].reason, 'REPRESENTATION_SIDE_UNRESOLVED');
});
