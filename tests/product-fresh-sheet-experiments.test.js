'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const {
  FACT_BUDGET_BYTES_PER_FACT, buildAgreementSectionDraft, definedTermOf, deterministicRoutingDecision, directDefinitionSpanIds, factBudgetFor,
} = require('../lib/product/agreement-draft');
const { ABLATION_VARIANTS, variantAvailability } = require('../lib/product/cost-ablation');
const { CLAUDE_CLI_PROVIDER_ID, REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Work package E3 part 2 (plan finding (185)), Ben's brief (finding (177)):
// "It can experiment, tear up ideas etc. cone at completely fresh". The
// experiments that need no new model behaviour, behind request-profile
// flags: the routing from the words, the definitions the section uses,
// the fact budget.

test('deterministic routing decides only from the heading rules and anchoring defined terms, never from an AI classification or nothing', () => {
  assert.deepEqual(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }]).response, {
    families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'Deterministic: NO_SHOP by SECTION_FAMILY_RULE_CLASSIFIED.', deterministic_disagreements: [],
  });
  assert.deepEqual(deterministicRoutingDecision([{ section_family: 'MAE_DEFINITION', provenance: 'SECTION_FAMILY_DEFINED_TERM_ANCHORED' }, { section_family: 'REPRESENTATIONS', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }]).response.families, ['MAE_DEFINITION', 'REPRESENTATIONS']);
  assert.equal(deterministicRoutingDecision([]), null, 'no evidence: the model routes');
  assert.equal(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_AI_CLASSIFIED' }]), null);
  assert.equal(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }, { section_family: 'TERMINATION', provenance: 'SECTION_FAMILY_AI_CLASSIFIED' }]), null, 'one uncertain family and the model routes the whole section');
});

test('the defined term of a definition paragraph, the direct definitions of a section, and the fact budget', () => {
  assert.equal(definedTermOf('"Takeover Proposal" means any proposal'), 'Takeover Proposal');
  assert.equal(definedTermOf('(a) “Closing Date” shall mean the date'), 'Closing Date');
  assert.equal(definedTermOf('Section 8.3 Definitions. The following terms'), null);
  const defs = [{ span_id: 'a', exact_text: '"Takeover Proposal" means x' }, { span_id: 'b', exact_text: '"Superior Proposal" means y' }, { span_id: 'c', exact_text: 'no readable term' }, { span_id: 'd', exact_text: '"Proposal" means z' }];
  assert.deepEqual([...directDefinitionSpanIds('the Company may furnish information to a Person that has made a Takeover Proposal', defs)], ['a', 'c', 'd'], 'a used term, an unreadable paragraph (kept), and a term that is a word of another term');
  assert.deepEqual([...directDefinitionSpanIds('nothing defined here', defs)], ['c']);
  assert.equal(FACT_BUDGET_BYTES_PER_FACT, 290);
  assert.deepEqual(factBudgetFor(8578), { operative_bytes: 8578, expected: 30, ceiling: 63, basis: factBudgetFor(8578).basis });
  assert.equal(factBudgetFor(100).expected, 1);
  assert.equal(factBudgetFor(100).ceiling, 5);
});

function leanAnswer(request, copies = 1) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  const proposals = [];
  const groups = [];
  for (let index = 1; index <= copies; index += 1) {
    groups.push({ client_ref: `g${index}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key });
    proposals.push({
      client_ref: `p${index}`, group_ref: `g${index}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [`c${index}`], summary: 'The no-shop covenant' },
      components: [{ ref: `c${index}`, kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    });
  }
  return { proposals, groups, links: [], coverage: Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND'])) };
}

async function runConcho63(profile, { copies = 1 } = {}) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const response = leanAnswer(input.request, copies);
    return { provider_id: 'SYNTHETIC', model_id: 'FRESH/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile });
  return { result, seen, sourceDocument };
}

test('routing_mode deterministic_first routes Concho 6.3 (No Solicitation) from its heading with no routing call; the residual and the extraction run as before', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, routing_mode: 'deterministic_first' });
  assert.deepEqual(seen.map((input) => input.call_kind), ['RESIDUAL', 'EXTRACTION'], 'no ROUTING call');
  assert.equal(result.routing.routing_source, 'DETERMINISTIC');
  assert.equal(result.routing.model_call_id, null);
  assert.deepEqual(result.routing.families, ['NO_SHOP']);
  assert.equal(result.routing.disposition, 'FAMILY_ASSIGNED');
  assert.deepEqual(result.model_calls.map((call) => call.call_kind), ['RESIDUAL', 'EXTRACTION']);
  const note = result.issues.find((issue) => issue.code === 'ROUTING_DETERMINISTIC');
  assert.ok(note, 'the section says the words routed it');
  assert.deepEqual(JSON.parse(note.message).families, ['NO_SHOP']);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  // The section's own coverage is the routing's: no call behind it; the per-family coverage the extraction writes keeps the extraction call.
  assert.ok(result.coverage.some((item) => item.subject_kind === 'SECTION' && item.model_call_id === null));
  // Without the flag the routing call is made and the routing is the model's.
  const plain = await runConcho63(REQUEST_PROFILES.DEFAULT);
  assert.deepEqual(plain.seen.map((input) => input.call_kind), ['ROUTING', 'RESIDUAL', 'EXTRACTION']);
  assert.equal(plain.result.routing.routing_source, undefined);
});

test('definitions_scope direct sends whole only the definitions the section\'s own words use and lists the rest by first words', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, definitions_scope: 'direct' });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  const definitions = extraction.request.source_closure.definitions;
  const whole = definitions.filter((span) => span.exact_text);
  const listed = definitions.filter((span) => span.text_in === 'agreement block');
  assert.ok(definitions.length > 0);
  assert.ok(whole.length > 0, 'the terms the section uses go whole');
  assert.equal(whole.length + listed.length, definitions.length);
  const own = extraction.request.source_closure.full_section.exact_text;
  for (const span of whole) {
    const term = definedTermOf(span.exact_text);
    if (term) assert.ok(own.includes(term), `${term} is in the section's own words`);
  }
  for (const span of listed) {
    const term = definedTermOf(span.exact_text) || definedTermOf(span.first_words);
    assert.ok(typeof span.first_words === 'string' && span.first_words.length > 0);
    if (term) assert.ok(!new RegExp(`(^|[^A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`).test(own), `${term} is not in the section's own words`);
  }
  assert.equal(result.proposals[0].validation_status, 'VALID');
  const control = await runConcho63(REQUEST_PROFILES.DEFAULT);
  assert.equal(control.seen.find((input) => input.call_kind === 'EXTRACTION').request.source_closure.definitions.filter((span) => span.exact_text).length, definitions.length, 'without the flag every definition goes whole');
  // A definition the section never names is listed, not sent: the rule on a closure with one transitive definition.
  const { leanClosureForModel } = require('../lib/product/agreement-draft');
  const shaped = leanClosureForModel({
    operative: [], chapeau: [], cross_references: [], full_section: { span_id: 'f', exact_text: 'The Company shall not solicit any Takeover Proposal.' },
    definitions: [{ span_id: 'd1', structure_node_id: 'n', kind: 'DEFINITION', start_byte: 0, end_byte: 10, exact_text: '"Takeover Proposal" means an offer from a Person' }, { span_id: 'd2', structure_node_id: 'n', kind: 'DEFINITION', start_byte: 20, end_byte: 30, exact_text: '"Person" means an individual or entity' }],
  }, { aliases: null, cachedAgreement: false, directDefinitions: true, nodesById: new Map() });
  assert.equal(shaped.definitions[0].exact_text, '"Takeover Proposal" means an offer from a Person');
  assert.equal(shaped.definitions[1].text_in, 'agreement block');
  assert.equal(shaped.definitions[1].exact_text, undefined);
});

test('fact_budget puts the section\'s budget in the request as a check, and an answer past the ceiling is a note, never a hold', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, fact_budget: true });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  const budget = extraction.request.fact_budget;
  assert.ok(budget.operative_bytes > 0 && budget.expected >= 1 && budget.ceiling === budget.expected * 2 + 3);
  assert.match(extraction.request.scope_instruction, /a check, not a target/);
  assert.equal(result.issues.find((issue) => issue.code === 'FACT_BUDGET_EXCEEDED'), undefined);
  const over = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, fact_budget: true }, { copies: budget.ceiling + 1 });
  const note = over.result.issues.find((issue) => issue.code === 'FACT_BUDGET_EXCEEDED');
  assert.ok(note, 'the note');
  assert.equal(JSON.parse(note.message).proposals, budget.ceiling + 1);
  assert.equal(note.kind, 'NOTE');
  assert.ok(over.result.proposals.length >= 1, 'the facts are compiled as the validator sees them, not cut to the budget');
});

test('the fresh-sheet rungs are on the ladder and the CLI can run the deterministic ones', () => {
  for (const name of ['default', 'deterministic_routing', 'direct_definitions', 'fact_budget', 'anchors_sonnet55']) assert.ok(ABLATION_VARIANTS[name], name);
  assert.deepEqual(ABLATION_VARIANTS.deterministic_routing.replay, ['ROUTING', 'RESIDUAL', 'EXTRACTION'], 'no call: the stored answers route where the words do not');
  assert.equal(ABLATION_VARIANTS.deterministic_routing.profile.routing_mode, 'deterministic_first');
  assert.equal(ABLATION_VARIANTS.direct_definitions.profile.definitions_scope, 'direct');
  assert.equal(ABLATION_VARIANTS.fact_budget.profile.fact_budget, true);
  for (const name of ['default', 'deterministic_routing', 'direct_definitions', 'fact_budget', 'anchors_sonnet55']) assert.equal(variantAvailability(ABLATION_VARIANTS[name], CLAUDE_CLI_PROVIDER_ID).runnable, true, name);
});
