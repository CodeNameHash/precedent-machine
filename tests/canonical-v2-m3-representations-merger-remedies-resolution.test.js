'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV33 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  FAMILY_ADAPTERS,
  shapeRepresentationQualifierProposals,
  shapeMergerStructureProposals,
  shapeSpecificPerformanceRemedyProposals,
  shapeMiscBoilerplateProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  AUTHORITY_STATE: REPRESENTATIONS_AUTHORITY_STATE,
  projectRepresentationClaims,
} = require('../lib/canonical-v2/representations-product-projection');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');
const { buildLexicalDisagreementReceipt } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT = compileFixtureContractV33();

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
    if (item.family === 'SPECIFIC_PERFORMANCE_REMEDIES' && item.assertion_kind !== 'SPECIFIC_PERFORMANCE') {
      assert.equal(resolution.resolved.length, 0, item.family);
      assert.equal(resolution.open_world.length, 1, item.family);
      assert.equal(resolution.open_world[0].reason, 'M3_CARRIER_ASSERTION_KIND_OUT_OF_ENUM', item.family);
      continue;
    }
    assert.equal(resolution.resolved.length, 1, item.family);
  }
});

test('V31 read-only production corpus excerpts replay each M3 carrier across two deals', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-fixtures', 'corpus-cards.json'), 'utf8'));
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
    if (item.family === 'REPRESENTATIONS') {
      assert.equal(resolution.resolved.length, 0, item.id);
      assert.equal(resolution.open_world.length, 1, item.id);
      assert.equal(resolution.open_world[0].reason, 'REPRESENTATION_QUALIFIER_KIND_NOT_EXACT', item.id);
      byFamily.set(item.family, (byFamily.get(item.family) || 0) + 1);
      continue;
    }
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

async function replayRepresentationAdapter({ source, sectionReference, parsed, dealKey }) {
  const adapter = FAMILY_ADAPTERS.REPRESENTATIONS;
  const prompt = adapter.prompt_builder({
    source_text: source,
    governed_scope: { section_reference: sectionReference },
    known_definitions: [],
  });
  const promptText = prompt.messages.map((message) => message.content).join('\n');
  assert.ok(promptText.includes(source));
  assert.ok(promptText.includes('ACCURACY_STANDARD'));
  assert.ok(promptText.includes('KNOWLEDGE_STANDARD'));
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: [sectionReference],
    contract_bundle: CONTRACT,
    definitions: {},
    provider: async ({ governed_scope: scope }) => ({
      provider_id: 'recorded-representations-adapter/v1',
      model_id: 'recorded-fixture',
      prompt: prompt.messages,
      ...adapter.response_shaper(parsed, scope.source_text),
    }),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, {
      dealKey,
      dealAdmissionId: sha256Hex(`M3-${dealKey}-REPRESENTATIONS`),
    }),
  });
  return { prompt, receipt, resolution };
}

test('real representation excerpt reaches distinct accuracy and knowledge product records through the live adapter', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-fixtures', 'corpus-cards.json'), 'utf8'));
  const card = pack.cards.find((item) => item.id === '31826de1-4399-4dd5-b3bb-fd58f5d6f9ae');
  const source = `Section ${card.section_reference} Regulatory Matters.\n${card.source_excerpt}\n`;
  const accuracyQuote = 'true and correct in all material respects';
  const knowledgeQuote = 'to the Knowledge of the Company';
  assert.ok(card.source_excerpt.includes(accuracyQuote));
  assert.ok(card.source_excerpt.includes(knowledgeQuote));

  const { resolution } = await replayRepresentationAdapter({
    source,
    sectionReference: card.section_reference,
    dealKey: card.deal_id,
    parsed: {
      representation_instances: [{
        section_reference: card.section_reference,
        party_making: card.party_making,
        qualifiers: [
          {
            kind: 'ACCURACY',
            code: 'MAT_ALL_MATERIAL',
            quote: accuracyQuote,
            attachment: { position: 'CHAPEAU', governs_path: null },
          },
          {
            kind: 'KNOWLEDGE',
            code: null,
            quote: knowledgeQuote,
            attachment: { position: 'ITEM', governs_path: ['Regulatory Authorizations'] },
          },
        ],
      }],
      bring_down_conditions: [],
      open_world_candidates: [],
    },
  });

  assert.equal(resolution.open_world.length, 0);
  assert.deepEqual(
    resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(),
    ['KNOWLEDGE_QUALIFIER', 'REPRESENTATION_ACCURACY_STANDARD'],
  );
  assert.equal(resolution.resolved.some((entry) => (
    entry.resolved_claim_definition_key === 'REPRESENTATION_QUALIFIER_STANDARD'
  )), false);
  assert.ok(resolution.resolved.every((entry) => (
    entry.provision_instance.party.role === 'REPRESENTATION_MAKER'
      && entry.provision_instance.party.capacity === 'TARGET'
  )));

  const projection = projectRepresentationClaims({ resolved_entries: resolution.resolved });
  assert.equal(projection.authority_state, REPRESENTATIONS_AUTHORITY_STATE);
  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(projection.records.length, 2);
  assert.deepEqual(
    projection.records.map((record) => record.query.value.claim_definition_key).sort(),
    ['KNOWLEDGE_QUALIFIER', 'REPRESENTATION_ACCURACY_STANDARD'],
  );
  assert.deepEqual(
    new Set(projection.records.map((record) => record.evidence.quote)),
    new Set([accuracyQuote, knowledgeQuote]),
  );
  assert.ok(projection.records.every((record) => record.evidence.spans.length > 0));
});

test('a novel attribute in a real known representation stays open-world through the dark projection', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-fixtures', 'corpus-cards.json'), 'utf8'));
  const card = pack.cards.find((item) => item.id === '31826de1-4399-4dd5-b3bb-fd58f5d6f9ae');
  const source = `Section ${card.section_reference} Regulatory Matters.\n${card.source_excerpt}\n`;
  const accuracyQuote = 'true and correct in all material respects';
  const knowledgeQuote = 'to the Knowledge of the Company';
  const novelAttributeQuote = 'any material updates, changes, corrections or modification to such applications, notifications, submissions, information, claims, reports and data required under applicable Laws have been submitted to the FDA or other Governmental Body.';
  assert.ok(card.source_excerpt.includes(novelAttributeQuote));

  const { resolution } = await replayRepresentationAdapter({
    source,
    sectionReference: card.section_reference,
    dealKey: `${card.deal_id}-novel-attribute`,
    parsed: {
      representation_instances: [{
        section_reference: card.section_reference,
        party_making: card.party_making,
        qualifiers: [
          {
            kind: 'ACCURACY',
            code: 'MAT_ALL_MATERIAL',
            quote: accuracyQuote,
            attachment: { position: 'CHAPEAU', governs_path: null },
          },
          {
            kind: 'KNOWLEDGE',
            code: null,
            quote: knowledgeQuote,
            attachment: { position: 'ITEM', governs_path: ['Regulatory Authorizations'] },
          },
        ],
      }],
      bring_down_conditions: [],
      open_world_candidates: [{
        candidate_kind: 'ATTRIBUTE_OR_QUESTION',
        observed_category: 'Regulatory submission update obligation',
        observed_quote: novelAttributeQuote,
        why_unmapped: 'A novel substantive representation attribute has no governed comparable field.',
        nearest_concept: 'REP-T-QUALIFIER',
      }],
    },
  });

  assert.equal(resolution.resolved.length, 2);
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].attributes.candidate_kind, 'ATTRIBUTE_OR_QUESTION');
  assert.equal(resolution.open_world[0].attributes.observed_category, 'Regulatory submission update obligation');
  assert.equal(resolution.open_world[0].raw_value, novelAttributeQuote);
  assert.ok(resolution.open_world[0].evidence.length > 0);

  const projection = projectRepresentationClaims({
    resolved_entries: resolution.resolved,
    open_world_entries: resolution.open_world,
  });
  assert.equal(projection.authority_state, 'VALIDATED_NOT_SERVED');
  assert.equal(projection.records.length, 2);
  assert.equal(projection.open_items.length, 1);
  const openItem = projection.open_items[0];
  assert.equal(openItem.candidate_kind, 'ATTRIBUTE_OR_QUESTION');
  assert.equal(openItem.category, 'Regulatory submission update obligation');
  assert.equal(openItem.quote, novelAttributeQuote);
  assert.deepEqual(openItem.evidence, resolution.open_world[0].evidence);
  assert.equal(openItem.certification_state, 'BLOCKED_OPEN_WORLD');
  assert.equal(openItem.comparison_eligible, false);
  assert.equal(Object.hasOwn(openItem, 'query'), false);
  assert.equal(Object.hasOwn(openItem, 'compare'), false);
  assert.equal(Object.hasOwn(openItem, 'market'), false);
});

test('real representation long-tail evidence remains open-world', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-v31-fixtures', 'corpus-cards.json'), 'utf8'));
  const card = pack.cards.find((item) => item.id === '31826de1-4399-4dd5-b3bb-fd58f5d6f9ae');
  const source = `Section ${card.section_reference} Regulatory Matters.\n${card.source_excerpt}\n`;
  const subjectCatalogue = 'all applications, notifications, submissions, information, claims, reports and data';
  const { resolution } = await replayRepresentationAdapter({
    source,
    sectionReference: card.section_reference,
    dealKey: `${card.deal_id}-open-world`,
    parsed: {
      representation_instances: [{
        section_reference: card.section_reference,
        party_making: card.party_making,
        qualifiers: [
          {
            kind: 'TEMPORAL',
            code: null,
            quote: 'Since January 1, 2023',
            attachment: { position: 'CHAPEAU', governs_path: null },
          },
          {
            kind: 'ACCURACY',
            code: 'MAT_ALL_MATERIAL',
            quote: card.source_excerpt,
            attachment: { position: 'TRAILING', governs_path: null },
          },
        ],
      }],
      bring_down_conditions: [],
      open_world_candidates: [{
        observed_quote: subjectCatalogue,
        why_unmapped: 'The representation subject catalogue is not closed.',
        nearest_concept: null,
      }],
    },
  });

  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.open_world.length, 3);
  assert.deepEqual(new Set(resolution.open_world.map((entry) => entry.reason)), new Set([
    'REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED',
    'REPRESENTATION_QUALIFIER_KIND_NOT_EXACT',
    'NATIVE_OPEN_WORLD_PROPOSAL',
  ]));
  assert.ok(resolution.open_world.some((entry) => entry.raw_value === subjectCatalogue));
});

test('real Skechers SEC and disclosure-letter chapeau remains open-world', async () => {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'article-iii-canonical-excerpt.txt'), 'utf8');
  const chapeau = fixture.split('\n').find((line) => line.startsWith('With respect to any Section of this Article III'));
  assert.ok(chapeau);
  const source = `Section 3.0 Company Representations.\n${chapeau}\n`;
  const { resolution } = await replayRepresentationAdapter({
    source,
    sectionReference: '3.0',
    dealKey: 'skechers-representations-chapeau',
    parsed: {
      representation_instances: [],
      bring_down_conditions: [],
      open_world_candidates: [{
        observed_quote: chapeau,
        why_unmapped: 'General SEC and disclosure-letter exceptions remain exact open-world evidence.',
        nearest_concept: null,
      }],
    },
  });
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].reason, 'NATIVE_OPEN_WORLD_PROPOSAL');
  assert.equal(resolution.open_world[0].raw_value, chapeau);
});

test('V31 separates a grounded knowledge qualifier and retains trailing accuracy evidence open-world', async () => {
  const quote = 'to the actual Knowledge of Parent, the representations and warranties of Parent are true and correct in all material respects.';
  const source = `ARTICLE V\nSection 5.1 Representations and Warranties.\n${quote}\n`;
  const { resolution } = await replay({ source, sectionReference: '5.1', dealKey: 'm3-representations-v31', shape: shapeRepresentationQualifierProposals, parsed: {
    representation_instances: [{ section_reference: '5.1', party_making: 'Parent', qualifiers: [
      { kind: 'KNOWLEDGE', code: 'ACTUAL', quote: 'to the actual Knowledge of Parent', attachment: { position: 'CHAPEAU', governs_path: null } },
      { kind: 'ACCURACY', code: 'MAT_ALL_MATERIAL', quote: 'true and correct in all material respects', attachment: { position: 'TRAILING', governs_path: null } },
    ] }], bring_down_conditions: [], open_world_candidates: [],
  } });
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].reason, 'REPRESENTATION_ACCURACY_NOT_CHAPEAU');
  assert.equal(resolution.resolved.length, 1);
  assert.deepEqual(new Set(resolution.resolved.map((row) => row.concept_key)), new Set(['REP-B-QUALIFIER']));
  assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'KNOWLEDGE_QUALIFIER');
  assert.equal(resolution.resolved[0].claim.canonical_value, true);
  assert.equal(resolution.resolved[0].claim.attributes.knowledge_standard, 'ACTUAL');
  assert.deepEqual(resolution.resolved[0].provision_instance.party, {
    role: 'REPRESENTATION_MAKER', value: 'Parent', capacity: 'BUYER',
  });
  assert.ok(resolution.resolved.every((row) => row.concept_key !== 'REP-T-CAP'));
});

test('V31 replays grounded merger, remedies and boilerplate presence claims', async () => {
  const cases = [
    { sectionReference: '2.1', dealKey: 'm3-merger-v31', source: 'ARTICLE II\nSection 2.1 Effect of the Merger.\nThe Merger will be governed by and effected under Section 251(h) of the DGCL.\n', quote: 'The Merger will be governed by and effected under Section 251(h) of the DGCL.', shape: shapeMergerStructureProposals, parsed: (quote) => ({ structure_assertions: [{ assertion_kind: 'SHORT_FORM_251H', quote }], open_world_candidates: [] }), definition: 'MERGER_STRUCTURE_MECHANIC_PRESENT', concept: 'MERGER-STRUCTURE' },
    { sectionReference: '9.8', dealKey: 'm3-remedy-v31', source: 'ARTICLE IX\nSection 9.8 Specific Performance.\nEach party shall use reasonable best efforts to obtain an expedited proceeding.\n', quote: 'Each party shall use reasonable best efforts to obtain an expedited proceeding.', shape: shapeSpecificPerformanceRemedyProposals, parsed: (quote) => ({ remedy_assertions: [{ assertion_kind: 'EXPEDITED_PROCEEDING', quote }], open_world_candidates: [] }), expect_open_world: true },
    { sectionReference: '10.9', dealKey: 'm3-misc-v31', source: 'ARTICLE X\nSection 10.9 Governing Law.\nThis Agreement shall be governed by the Laws of the State of Delaware.\n', quote: 'This Agreement shall be governed by the Laws of the State of Delaware.', shape: shapeMiscBoilerplateProposals, parsed: (quote) => ({ boilerplate_assertions: [{ assertion_kind: 'GOVERNING_LAW', quote }], open_world_candidates: [] }), definition: 'MISC_BOILERPLATE_MECHANIC_PRESENT', concept: 'MISC-BOILERPLATE' },
  ];
  for (const item of cases) {
    const { resolution } = await replay({ ...item, parsed: item.parsed(item.quote) });
    if (item.expect_open_world) {
      assert.equal(resolution.resolved.length, 0, item.dealKey);
      assert.equal(resolution.open_world.length, 1, item.dealKey);
      assert.equal(resolution.open_world[0].reason, 'M3_CARRIER_ASSERTION_KIND_OUT_OF_ENUM', item.dealKey);
      continue;
    }
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
